import React, {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  applyCoinDeltaForCurrentUser,
  refreshCoinsFromFirestoreForCurrentUser,
  type CoinMutationReason,
} from "../services/userDataService";
import { storageService } from "../services/storageService";
import { useAuthState } from "./AuthStateContext";

interface CoinContextValue {
  coins: number;
  isHydrated: boolean;
  addCoins: (
    amount: number,
    options?: { reason?: CoinMutationReason },
  ) => Promise<boolean>;
  spendCoins: (amount: number) => Promise<boolean>;
  refreshCoinsFromFirestore: () => Promise<number>;
  resetCoins: () => void;
}

const CoinContext = createContext<CoinContextValue | undefined>(undefined);

function normalizeCoinAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.floor(amount);
}

function normalizeCoinBalance(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  return Math.floor(amount);
}

export function CoinProvider({ children }: { children: React.ReactNode }) {
  const { authSyncVersion, latestUserData, userId } = useAuthState();
  const [coins, setCoins] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const coinsRef = useRef(0);

  const setTrustedCoins = useCallback((amount: number) => {
    const safeAmount = normalizeCoinBalance(amount);
    coinsRef.current = safeAmount;
    setCoins(safeAmount);

    void storageService.saveCoins(safeAmount).catch(() => {
      // Keep wallet rendering stable if local persistence is unavailable.
    });
  }, []);

  useEffect(() => {
    if (latestUserData) {
      coinsRef.current = latestUserData.coins;
      setCoins(latestUserData.coins);
      setIsHydrated(true);
      return;
    }

    // Keep startup resilient when auth sync has no remote snapshot yet.
    coinsRef.current = 0;
    setCoins(0);
    setIsHydrated(true);
  }, [authSyncVersion, latestUserData]);

  const refreshCoinsFromFirestore = useCallback(async () => {
    const trustedCoins = await refreshCoinsFromFirestoreForCurrentUser();
    setTrustedCoins(trustedCoins);
    return trustedCoins;
  }, [setTrustedCoins]);

  const addCoins = useCallback(
    async (amount: number, options?: { reason?: CoinMutationReason }) => {
      const safeAmount = normalizeCoinAmount(amount);

      if (safeAmount <= 0) {
        return false;
      }

      try {
        await applyCoinDeltaForCurrentUser(safeAmount, {
          reason: options?.reason,
        });
        await refreshCoinsFromFirestore();
        return true;
      } catch {
        if (userId) {
          await refreshCoinsFromFirestore();
        }
        return false;
      }
    },
    [refreshCoinsFromFirestore, userId],
  );

  const spendCoins = useCallback(
    async (amount: number) => {
      const safeAmount = normalizeCoinAmount(amount);

      if (safeAmount <= 0) {
        return false;
      }

      if (coinsRef.current < safeAmount && userId) {
        await refreshCoinsFromFirestore();
      }

      if (coinsRef.current < safeAmount) {
        return false;
      }

      try {
        await applyCoinDeltaForCurrentUser(-safeAmount, {
          reason: "theme_purchase",
        });
        await refreshCoinsFromFirestore();
        return true;
      } catch {
        if (userId) {
          await refreshCoinsFromFirestore();
        }
        return false;
      }
    },
    [refreshCoinsFromFirestore, userId],
  );

  const resetCoins = useCallback(() => {
    coinsRef.current = 0;
    setCoins(0);
    setIsHydrated(true);
  }, []);

  const value = useMemo(
    () => ({
      coins,
      isHydrated,
      addCoins,
      spendCoins,
      refreshCoinsFromFirestore,
      resetCoins,
    }),
    [
      addCoins,
      coins,
      isHydrated,
      refreshCoinsFromFirestore,
      resetCoins,
      spendCoins,
    ],
  );

  return <CoinContext.Provider value={value}>{children}</CoinContext.Provider>;
}

export function useCoins() {
  const context = useContext(CoinContext);

  if (!context) {
    throw new Error("useCoins must be used within a CoinProvider.");
  }

  return context;
}
