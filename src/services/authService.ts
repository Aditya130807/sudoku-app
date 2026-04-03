import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { deleteDoc, doc } from "firebase/firestore";

import { auth, db } from "../firebase";
import { gameStore } from "../store/gameStore";
import { userStore } from "../store/userStore";
import { clearStoredThemeState } from "../utils/themeStorage";
import { beginAuthMigration } from "./authMigrationGate";
import { storageService } from "./storageService";
import {
  ensureUserProfile,
  migrateGuestSessionToUserProfile,
} from "./userProfileService";

async function runWithMigrationGate<T>(task: () => Promise<T>): Promise<T> {
  const endMigration = beginAuthMigration();

  try {
    return await task();
  } finally {
    endMigration();
  }
}

async function finalizeSignIn(user: { uid: string; email: string | null }) {
  userStore.setUser({
    id: user.uid,
    email: user.email,
  });

  try {
    await storageService.markHasEnteredApp();
  } catch {
    // Keep auth flow resilient when local persistence is unavailable.
  }

  try {
    await migrateGuestSessionToUserProfile(user.uid);
  } catch {
    // Keep auth flow resilient when migration cannot complete right now.
  }

  try {
    await ensureUserProfile(user.uid);
  } catch {
    // Keep auth flow resilient when Firestore is temporarily unavailable.
  }

  return user;
}

type DeleteAccountOptions = {
  reauthenticate?: () => Promise<void>;
  password?: string;
};

type GuestLoginErrorCode = "auth/guest-login-failed";

type GuestLoginError = Error & {
  code: GuestLoginErrorCode;
  cause?: unknown;
};

type AccountDeletionErrorCode = "account/profile-delete-failed";

type AccountDeletionError = Error & {
  code: AccountDeletionErrorCode;
  cause?: unknown;
};

type AuthDeletionErrorCode = "account/auth-delete-failed";

type AuthDeletionError = Error & {
  code: AuthDeletionErrorCode;
  cause?: unknown;
};

const PROFILE_DELETE_RETRY_DELAYS_MS = [300, 900, 1800] as const;

function createAccountDeletionError(cause?: unknown): AccountDeletionError {
  const error = new Error(
    "Unable to delete account data right now. Please try again.",
  ) as AccountDeletionError;
  error.code = "account/profile-delete-failed";

  if (cause !== undefined) {
    error.cause = cause;
  }

  return error;
}

function createAuthDeletionError(cause?: unknown): AuthDeletionError {
  const error = new Error(
    "Unable to delete your account right now. Please try again.",
  ) as AuthDeletionError;
  error.code = "account/auth-delete-failed";

  if (cause !== undefined) {
    error.cause = cause;
  }

  return error;
}

function createRecentLoginRequiredError() {
  const error = new Error("Please re-login to delete account") as Error & {
    code: "auth/requires-recent-login";
  };
  error.code = "auth/requires-recent-login";
  return error;
}

function getErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return undefined;
}

function isRequiresRecentLoginError(error: unknown): boolean {
  return getErrorCode(error) === "auth/requires-recent-login";
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function createGuestLoginError(cause?: unknown): GuestLoginError {
  const error = new Error(
    "Unable to continue as guest right now. Please try again.",
  ) as GuestLoginError;
  error.code = "auth/guest-login-failed";

  if (cause !== undefined) {
    error.cause = cause;
  }

  return error;
}

async function deleteProfileDocumentWithRetry(userId: string): Promise<void> {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt < PROFILE_DELETE_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    try {
      await deleteDoc(doc(db, "users", userId));
      return;
    } catch (error) {
      lastError = error;

      if (attempt === PROFILE_DELETE_RETRY_DELAYS_MS.length - 1) {
        break;
      }

      await sleep(PROFILE_DELETE_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw createAccountDeletionError(lastError);
}

async function reauthenticateBeforeDelete(
  currentUser: User,
  options?: DeleteAccountOptions,
) {
  if (options?.reauthenticate) {
    await options.reauthenticate();
    return;
  }

  if (typeof options?.password === "string") {
    const trimmedPassword = options.password.trim();

    if (!trimmedPassword) {
      throw createRecentLoginRequiredError();
    }

    const email = currentUser.email?.trim();

    if (!email) {
      throw createRecentLoginRequiredError();
    }

    const credential = EmailAuthProvider.credential(email, trimmedPassword);
    await reauthenticateWithCredential(currentUser, credential);
    return;
  }

  // Refreshing the ID token verifies there is still an active authenticated
  // session. If a provider-specific reauth UX is required, the caller can
  // pass options.reauthenticate.
  await currentUser.getIdToken(true);
}

export const authService = {
  // 🟢 Guest mode (keep this)
  async continueAsGuest() {
    try {
      await signOut(auth);
      userStore.continueAsGuest();

      const { progress, lastPlayedLevelId } = gameStore.getState();

      await Promise.all([
        storageService.markHasEnteredApp(),
        storageService.ensureGuestId(),
        storageService.saveGuestProgress(progress),
        storageService.saveGuestStats({
          completedLevels: userStore.getState().completedLevels,
          lastPlayedLevelId,
          claimedChallengeIds: [],
          streakCount: 0,
          lastClaimDate: null,
        }),
      ]);
    } catch (error) {
      throw createGuestLoginError(error);
    }
  },

  // 🟢 Email login
  async login(email: string, password: string) {
    return runWithMigrationGate(async () => {
      const res = await signInWithEmailAndPassword(auth, email, password);
      return finalizeSignIn(res.user);
    });
  },

  // 🟢 Signup
  async signUp(email: string, password: string) {
    return runWithMigrationGate(async () => {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      return finalizeSignIn(res.user);
    });
  },

  // 🔵 Google login
  async loginWithGoogle(idToken: string) {
    if (!idToken) {
      throw new Error("Google Sign-In failed: missing id_token");
    }

    return runWithMigrationGate(async () => {
      const credential = GoogleAuthProvider.credential(idToken);

      const res = await signInWithCredential(auth, credential);
      return finalizeSignIn(res.user);
    });
  },
  // 🔴 Logout
  async logout() {
    const firebaseAuth = getAuth();
    await signOut(firebaseAuth);
    await clearStoredThemeState();
    await storageService.clearAllLocalData();
    gameStore.reset();
    userStore.resetUser();
  },

  async deleteAccount(options?: DeleteAccountOptions) {
    return runWithMigrationGate(async () => {
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error("No signed-in account was found.");
      }

      const userId = currentUser.uid;

      await reauthenticateBeforeDelete(currentUser, options);

      try {
        await deleteUser(currentUser);
      } catch (error) {
        if (isRequiresRecentLoginError(error)) {
          throw error;
        }

        throw createAuthDeletionError(error);
      }

      await deleteProfileDocumentWithRetry(userId);

      await clearStoredThemeState();
      await storageService.clearAllLocalData();
    });
  },
};
