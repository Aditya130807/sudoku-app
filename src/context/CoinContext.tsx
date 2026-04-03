import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { persistCoinsForCurrentUser } from "../services/userDataService";
import { useAuthState } from "./AuthStateContext";

interface CoinContextValue {
  coins: number;
  isHydrated: boolean;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  resetCoins: () => void;
}

const CoinContext = createContext<CoinContextValue | undefined>(undefined);

function normalizeCoinAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.floor(amount);
}

export function CoinProvider({ children }: { children: React.ReactNode }) {
  const { authSyncVersion, latestUserData } = useAuthState();
  const [coins, setCoins] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const coinsRef = useRef(0);
  const skipNextPersistRef = useRef(false);

  useEffect(() => {
    skipNextPersistRef.current = true;

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

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    void persistCoinsForCurrentUser(coins).catch(() => {
      // Keep wallet interactions working even when persistence fails.
    });
  }, [coins, isHydrated]);

  const addCoins = (amount: number) => {
    const safeAmount = normalizeCoinAmount(amount);

    if (safeAmount <= 0) {
      return;
    }

    setCoins((currentCoins) => {
      const nextCoins = currentCoins + safeAmount;
      coinsRef.current = nextCoins;
      return nextCoins;
    });
  };

  const spendCoins = (amount: number) => {
    const safeAmount = normalizeCoinAmount(amount);

    if (safeAmount <= 0 || coinsRef.current < safeAmount) {
      return false;
    }

    coinsRef.current -= safeAmount;
    setCoins((currentCoins) => Math.max(0, currentCoins - safeAmount));
    return true;
  };

  const resetCoins = () => {
    coinsRef.current = 0;
    setCoins(0);
    setIsHydrated(true);
  };

  const value = useMemo(
    () => ({
      coins,
      isHydrated,
      addCoins,
      spendCoins,
      resetCoins,
    }),
    [coins, isHydrated],
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
