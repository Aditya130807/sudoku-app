import { useSyncExternalStore } from "react";

import { LEVELS } from "../constants/levels";
import { GameSession, GameSettings, LevelProgress } from "../game/types";

export interface GameState {
  settings: GameSettings;
  progress: Record<number, LevelProgress>;
  activeGame: GameSession | null;
  lastPlayedLevelId: number | null;
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
  lastPlayedLevelId: null,
};

let gameState: GameState = initialGameState;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function setGameState(
  updater: GameState | ((currentState: GameState) => GameState)
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
  reset() {
    setGameState(initialGameState);
  },
};
