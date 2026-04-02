import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { deleteDoc, doc } from "firebase/firestore";

import { auth, db } from "../firebase";
import { gameStore } from "../store/gameStore";
import { userStore } from "../store/userStore";
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
};

async function reauthenticateBeforeDelete(
  currentUser: User,
  options?: DeleteAccountOptions,
) {
  if (options?.reauthenticate) {
    await options.reauthenticate();
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
    await signOut(auth);
    userStore.continueAsGuest();

    const { progress, lastPlayedLevelId } = gameStore.getState();

    await Promise.allSettled([
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
    await storageService.clearAllLocalData();
    gameStore.reset();
    userStore.resetUser();
  },

  async deleteAccount(options?: DeleteAccountOptions) {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error("No signed-in account was found.");
    }

    const userId = currentUser.uid;

    await reauthenticateBeforeDelete(currentUser, options);

    // Delete the Auth account first so a failed Firestore cleanup can never
    // leave the account active with a removed profile document.
    await deleteUser(currentUser);

    try {
      await deleteDoc(doc(db, "users", userId));
    } catch (error) {
      if (__DEV__) {
        console.warn("[account:delete-profile-cleanup]", error);
      }

      // The Auth account is already deleted at this point.
      // Firestore cleanup is best-effort and should not surface as a failed
      // account deletion to the caller.
    }

    await storageService.clearAllLocalData();
  },
};
