import React, { createContext, useContext, useEffect, useState } from "react";

import {
  DEFAULT_THEME_ID,
  THEME_LIST,
  getThemeConfig,
  sanitizeThemeIds,
  type ThemeConfig,
  type ThemeId,
} from "../constants/themes";
import { gameStore } from "../store/gameStore";
import {
  clearStoredThemeState,
  loadStoredThemeState,
  persistActiveThemeId,
  persistUnlockedThemeIds,
} from "../utils/themeStorage";
import { useCoins } from "./CoinContext";

interface ThemeActionResult {
  ok: boolean;
  message: string;
}

interface AppThemeContextValue {
  isHydrated: boolean;
  themes: ThemeConfig[];
  unlockedThemeIds: ThemeId[];
  activeThemeId: ThemeId;
  activeTheme: ThemeConfig;
  isThemeUnlocked: (themeId: string) => boolean;
  buyTheme: (themeId: ThemeId) => Promise<ThemeActionResult>;
  applyTheme: (themeId: ThemeId) => Promise<ThemeActionResult>;
  resetThemeState: () => Promise<void>;
}

const ThemeContext = createContext<AppThemeContextValue | undefined>(undefined);

function areThemeIdListsEqual(
  currentThemeIds: readonly string[],
  nextThemeIds: readonly string[],
) {
  if (currentThemeIds.length !== nextThemeIds.length) {
    return false;
  }

  return currentThemeIds.every(
    (themeId, index) => themeId === nextThemeIds[index],
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { addCoins, isHydrated: isCoinHydrated, spendCoins } = useCoins();
  const [unlockedThemeIds, setUnlockedThemeIds] = useState<ThemeId[]>([
    DEFAULT_THEME_ID,
  ]);
  const [activeThemeId, setActiveThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isDisposed = false;

    void (async () => {
      try {
        const storedThemeState = await loadStoredThemeState();

        if (isDisposed) {
          return;
        }

        setUnlockedThemeIds(storedThemeState.unlockedThemeIds);
        setActiveThemeId(storedThemeState.activeThemeId);
      } catch {
      } finally {
        if (!isDisposed) {
          setIsHydrated(true);
        }
      }
    })();

    return () => {
      isDisposed = true;
    };
  }, []);

  useEffect(() => {
    const sanitizedThemeIds = sanitizeThemeIds(unlockedThemeIds);
    const currentState = gameStore.getState();

    if (
      currentState.currentTheme === activeThemeId &&
      areThemeIdListsEqual(currentState.unlockedThemes, sanitizedThemeIds)
    ) {
      return;
    }

    gameStore.setState({
      ...currentState,
      currentTheme: activeThemeId,
      unlockedThemes: sanitizedThemeIds,
    });
  }, [activeThemeId, unlockedThemeIds]);

  async function buyTheme(themeId: ThemeId): Promise<ThemeActionResult> {
    const theme = getThemeConfig(themeId);

    if (!isCoinHydrated) {
      return {
        ok: false,
        message: "Your coin wallet is still loading.",
      };
    }

    if (unlockedThemeIds.includes(theme.id)) {
      return applyTheme(theme.id);
    }

    const nextUnlockedThemeIds = sanitizeThemeIds([
      ...unlockedThemeIds,
      theme.id,
    ]);
    const requiresCoins = theme.price > 0;

    if (requiresCoins && !spendCoins(theme.price)) {
      return {
        ok: false,
        message: "Not enough coins.",
      };
    }

    try {
      await Promise.all([
        persistUnlockedThemeIds(nextUnlockedThemeIds),
        persistActiveThemeId(theme.id),
      ]);
      setUnlockedThemeIds(nextUnlockedThemeIds);
      setActiveThemeId(theme.id);

      return {
        ok: true,
        message: `${theme.name} unlocked and applied.`,
      };
    } catch {
      if (requiresCoins) {
        addCoins(theme.price);
      }

      return {
        ok: false,
        message: "We couldn't save that purchase right now.",
      };
    }
  }

  async function applyTheme(themeId: ThemeId): Promise<ThemeActionResult> {
    const theme = getThemeConfig(themeId);

    if (!unlockedThemeIds.includes(theme.id)) {
      return {
        ok: false,
        message: "Unlock this theme before applying it.",
      };
    }

    if (activeThemeId === theme.id) {
      return {
        ok: true,
        message: `${theme.name} is already active.`,
      };
    }

    try {
      await persistActiveThemeId(theme.id);
      setActiveThemeId(theme.id);

      return {
        ok: true,
        message: `${theme.name} is now active.`,
      };
    } catch {
      return {
        ok: false,
        message: "We couldn't apply that theme right now.",
      };
    }
  }

  function isThemeUnlocked(themeId: string) {
    return unlockedThemeIds.includes(getThemeConfig(themeId).id);
  }

  async function resetThemeState() {
    await clearStoredThemeState();
    setUnlockedThemeIds([DEFAULT_THEME_ID]);
    setActiveThemeId(DEFAULT_THEME_ID);
  }

  const activeTheme = getThemeConfig(activeThemeId);

  return (
    <ThemeContext.Provider
      value={{
        isHydrated,
        themes: THEME_LIST,
        unlockedThemeIds,
        activeThemeId,
        activeTheme,
        isThemeUnlocked,
        buyTheme,
        applyTheme,
        resetThemeState,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used within a ThemeProvider.");
  }

  return context;
}
