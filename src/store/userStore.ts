import { useSyncExternalStore } from "react";

export interface UserState {
  mode: "guest" | "signed_in";
  displayName: string;
  completedLevels: number;
  loginPromptDismissed: boolean;
  uid?: string;        // 🔥 ADD
  email?: string | null; // 🔥 ADD
}

const initialUserState: UserState = {
  mode: "guest",
  displayName: "Guest Player",
  completedLevels: 0,
  loginPromptDismissed: false,
  uid: undefined,        // ✅ add
  email: null,           // ✅ add

};

let userState: UserState = initialUserState;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function setUserState(
  updater: UserState | ((currentState: UserState) => UserState)
) {
  userState = typeof updater === "function" ? updater(userState) : updater;
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return userState;
}

export function useUserStore<T>(selector: (state: UserState) => T): T {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return selector(snapshot);
}

export function shouldEncourageLogin(state: UserState): boolean {
  return (
    state.mode === "guest" &&
    state.completedLevels >= 3 &&
    !state.loginPromptDismissed
  );
}

export const userStore = {
  
  getState: getSnapshot,
  subscribe,
  setUser(user: { id: string; email: string | null }) {
  setUserState((currentState) => ({
    ...currentState,
    mode: "signed_in",
    uid: user.id,
    email: user.email,
    displayName: user.email?.split("@")[0] ?? "Player",
    loginPromptDismissed: true,
  }));
},
resetUser() {
  setUserState({
    ...initialUserState,
  });
},
isSignedIn() {
  return userState.mode === "signed_in";
},
continueAsGuest() {
  setUserState((currentState) => ({
    ...currentState,
    mode: "guest",
    displayName: "Guest Player",
    uid: undefined,
    email: null,
  }));
},

  signInPreview() {
    setUserState((currentState) => ({
      ...currentState,
      mode: "signed_in",
      displayName: "Ryve Player",
      loginPromptDismissed: true,
    }));
  },
  dismissLoginPrompt() {
    setUserState((currentState) => ({
      ...currentState,
      loginPromptDismissed: true,
    }));
  },
  syncCompletedLevels(completedLevels: number) {
    setUserState((currentState) => ({
      ...currentState,
      completedLevels,
    }));
  },
};
