import React, { createContext, useContext } from "react";

import { PersistedUserDataSnapshot } from "../services/storageService";

interface AuthStateContextValue {
  authSyncVersion: number;
  userId: string | null;
  latestUserData: PersistedUserDataSnapshot | null;
}

const AuthStateContext = createContext<AuthStateContextValue | undefined>(
  undefined,
);

export function AuthStateProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: AuthStateContextValue;
}) {
  return (
    <AuthStateContext.Provider value={value}>
      {children}
    </AuthStateContext.Provider>
  );
}

export function useAuthState() {
  const context = useContext(AuthStateContext);

  if (!context) {
    throw new Error("useAuthState must be used within an AuthStateProvider.");
  }

  return context;
}
