import { useSyncExternalStore } from "react";

import { LEVELS } from "../constants/levels";
import {
  DEFAULT_THEME_ID,
  getThemeConfig,
  isValidThemeId,
} from "../constants/themes";
import { GameSession, GameSettings, LevelProgress } from "../game/types";

export interface DailyChallengeProgress {
  completed: boolean;
  completedAt: string | null;
}

export interface GameState {
  settings: GameSettings;
  progress: Record<number, LevelProgress>;
  activeGame: GameSession | null;
  isGameStateHydrated: boolean;
  lastPlayedLevelId: number | null;
  coins: number;
  unlockedThemes: string[];
  currentTheme: string;
}

const defaultSettings: GameSettings = {
  completionIndicator: true,
  mistakeHighlighting: true,
  autoCheck: true,
  soundEnabled: true,
};

function createInitialProgress(): Record<number, LevelProgress> {
  return LEVELS.reduce<Record<number, LevelProgress>>((result, level) => {
    result[level.id] = {
      status: level.id === 1 ? "unlocked" : "locked",
      bestTimeSeconds: null,
      bestScore: null,
      stars: 0,
      hintsUsed: 0,
      attempts: 0,
      completedAt: null,
    };
    return result;
  }, {});
}

const initialGameState: GameState = {
  settings: defaultSettings,
  progress: createInitialProgress(),
  activeGame: null,
  isGameStateHydrated: false,
  lastPlayedLevelId: null,
  coins: 0,
  unlockedThemes: [DEFAULT_THEME_ID],
  currentTheme: DEFAULT_THEME_ID,
};

let gameState: GameState = initialGameState;
const listeners = new Set<() => void>();
const set = setGameState;

function emitChange() {
  listeners.forEach((listener) => listener());
}

function setGameState(
  updater: GameState | ((currentState: GameState) => GameState),
) {
  gameState = typeof updater === "function" ? updater(gameState) : updater;
  emitChange();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return gameState;
}

export function useGameStore<T>(selector: (state: GameState) => T): T {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return selector(snapshot);
}

export const gameStore = {
  getState: getSnapshot,
  subscribe,
  setState: setGameState,
  addCoins(amount: number) {
    const safeAmount = Number.isFinite(amount) ? Math.floor(amount) : 0;

    if (safeAmount <= 0) {
      return;
    }

    set((currentState) => ({
      ...currentState,
      coins: currentState.coins + safeAmount,
    }));
  },
  unlockTheme(themeId: string): boolean {
    const normalizedThemeId = themeId.trim();

    if (!normalizedThemeId) {
      return false;
    }

    if (!isValidThemeId(normalizedThemeId)) {
      return false;
    }

    if (normalizedThemeId === DEFAULT_THEME_ID) {
      setGameState((currentState) => {
        const hasDefault =
          currentState.unlockedThemes.includes(DEFAULT_THEME_ID);
        return {
          ...currentState,
          unlockedThemes: hasDefault
            ? currentState.unlockedThemes
            : [...currentState.unlockedThemes, DEFAULT_THEME_ID],
          currentTheme: currentState.currentTheme || DEFAULT_THEME_ID,
        };
      });
      return true;
    }

    const theme = getThemeConfig(normalizedThemeId);
    const price = Math.max(0, Math.floor(theme.price));
    if (price <= 0) {
      // Treat any unexpected non-positive prices as free.
      setGameState((currentState) => {
        if (currentState.unlockedThemes.includes(normalizedThemeId)) {
          return currentState;
        }

        return {
          ...currentState,
          unlockedThemes: [...currentState.unlockedThemes, normalizedThemeId],
        };
      });
      return true;
    }

    let unlocked = false;
    setGameState((currentState) => {
      if (currentState.unlockedThemes.includes(normalizedThemeId)) {
        return currentState;
      }

      if (currentState.coins < price) {
        return currentState;
      }

      unlocked = true;
      return {
        ...currentState,
        coins: currentState.coins - price,
        unlockedThemes: [...currentState.unlockedThemes, normalizedThemeId],
      };
    });

    return unlocked;
  },
  setTheme(themeId: string): boolean {
    const normalizedThemeId = themeId.trim();

    if (!normalizedThemeId) {
      return false;
    }

    if (!isValidThemeId(normalizedThemeId)) {
      return false;
    }

    let updated = false;
    setGameState((currentState) => {
      if (normalizedThemeId === DEFAULT_THEME_ID) {
        updated = true;
        return {
          ...currentState,
          unlockedThemes: currentState.unlockedThemes.includes(DEFAULT_THEME_ID)
            ? currentState.unlockedThemes
            : [...currentState.unlockedThemes, DEFAULT_THEME_ID],
          currentTheme: DEFAULT_THEME_ID,
        };
      }

      const unlocked = currentState.unlockedThemes.includes(normalizedThemeId);
      if (!unlocked) return currentState;

      updated = true;
      return {
        ...currentState,
        currentTheme: normalizedThemeId,
      };
    });

    return updated;
  },
  reset() {
    setGameState(initialGameState);
  },
};
