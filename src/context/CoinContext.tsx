import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { storageService } from "../services/storageService";

interface CoinContextValue {
  coins: number;
  isHydrated: boolean;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
}

const CoinContext = createContext<CoinContextValue | undefined>(undefined);

function normalizeCoinAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.floor(amount);
}

export function CoinProvider({ children }: { children: React.ReactNode }) {
  const [coins, setCoins] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const coinsRef = useRef(0);

  useEffect(() => {
    let isDisposed = false;

    void (async () => {
      const storedCoins = await storageService.loadCoins();

      if (isDisposed) {
        return;
      }

      coinsRef.current = storedCoins;
      setCoins(storedCoins);
      setIsHydrated(true);
    })();

    return () => {
      isDisposed = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void storageService.saveCoins(coins);
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

  const value = useMemo(
    () => ({
      coins,
      isHydrated,
      addCoins,
      spendCoins,
    }),
    [coins, isHydrated]
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
