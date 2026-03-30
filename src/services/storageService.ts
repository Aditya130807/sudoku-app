import AsyncStorage from "@react-native-async-storage/async-storage";

import { Board, CellPosition, CellStateBoard, GameSession } from "../game/types";
import { cloneBoard, cloneCellStateBoard } from "../game/validator";

const ACTIVE_GAME_STORAGE_KEY = "@sudoku_ryve/active_game";

export const STORAGE_KEYS = {
  USER_COINS: "USER_COINS",
  CLAIMED_CHALLENGES: "CLAIMED_CHALLENGES",
  LAST_CLAIM_DATE: "LAST_CLAIM_DATE",
} as const;

interface StoredClaimedChallengesPayload {
  ids: string[];
  streakCount: number;
}

export interface StoredDailyEconomyState {
  claimedChallengeIds: string[];
  lastClaimDate: string | null;
  streakCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidCellValue(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 9)
  );
}

function isValidBoard(board: unknown): board is Board {
  return (
    Array.isArray(board) &&
    board.length === 9 &&
    board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 9 &&
        row.every((value) => isValidCellValue(value))
    )
  );
}

function isValidNotes(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "number" &&
        Number.isInteger(entry) &&
        entry >= 1 &&
        entry <= 9
    )
  );
}

function isValidCellStateBoard(board: unknown): board is CellStateBoard {
  return (
    Array.isArray(board) &&
    board.length === 9 &&
    board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 9 &&
        row.every(
          (cell) =>
            isRecord(cell) &&
            isValidCellValue(cell.value) &&
            isValidNotes(cell.notes)
        )
    )
  );
}

function isValidCellPosition(position: unknown): position is CellPosition | null {
  if (position === null) {
    return true;
  }

  if (!isRecord(position)) {
    return false;
  }

  const row = position.row;
  const col = position.col;

  return (
    typeof row === "number" &&
    Number.isInteger(row) &&
    row >= 0 &&
    row < 9 &&
    typeof col === "number" &&
    Number.isInteger(col) &&
    col >= 0 &&
    col < 9
  );
}

function isValidGameSession(value: unknown): value is GameSession {
  if (!isRecord(value)) {
    return false;
  }

  const levelId = value.levelId;
  const puzzle = value.puzzle;
  const solution = value.solution;
  const board = value.board;
  const cellStates = value.cellStates;
  const selectedCell = value.selectedCell;
  const hintsRemaining = value.hintsRemaining;
  const hintsUsed = value.hintsUsed;
  const startedAt = value.startedAt;
  const elapsedSeconds = value.elapsedSeconds;
  const status = value.status;
  const score = value.score;
  const stars = value.stars;
  const completedAt = value.completedAt;

  return (
    typeof levelId === "number" &&
    Number.isInteger(levelId) &&
    levelId > 0 &&
    isValidBoard(puzzle) &&
    isValidBoard(solution) &&
    isValidBoard(board) &&
    isValidCellStateBoard(cellStates) &&
    isValidCellPosition(selectedCell) &&
    typeof hintsRemaining === "number" &&
    Number.isInteger(hintsRemaining) &&
    hintsRemaining >= 0 &&
    typeof hintsUsed === "number" &&
    Number.isInteger(hintsUsed) &&
    hintsUsed >= 0 &&
    typeof startedAt === "number" &&
    Number.isFinite(startedAt) &&
    typeof elapsedSeconds === "number" &&
    Number.isFinite(elapsedSeconds) &&
    (status === "playing" || status === "completed") &&
    (score === null || (typeof score === "number" && Number.isFinite(score))) &&
    typeof stars === "number" &&
    Number.isInteger(stars) &&
    stars >= 0 &&
    (completedAt === null || typeof completedAt === "string")
  );
}

function cloneSession(session: GameSession): GameSession {
  return {
    ...session,
    puzzle: cloneBoard(session.puzzle),
    solution: cloneBoard(session.solution),
    board: cloneBoard(session.board),
    cellStates: cloneCellStateBoard(session.cellStates),
    selectedCell: session.selectedCell
      ? { ...session.selectedCell }
      : null,
  };
}

function parseStoredCoins(rawValue: string | null): number {
  if (!rawValue) {
    return 0;
  }

  const parsedCoins = Number(rawValue);

  if (!Number.isFinite(parsedCoins) || parsedCoins < 0) {
    return 0;
  }

  return Math.floor(parsedCoins);
}

function parseStoredClaimedChallenges(
  rawValue: string | null
): StoredClaimedChallengesPayload {
  if (!rawValue) {
    return {
      ids: [],
      streakCount: 0,
    };
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (
      typeof parsedValue !== "object" ||
      parsedValue === null ||
      Array.isArray(parsedValue)
    ) {
      return {
        ids: [],
        streakCount: 0,
      };
    }

    const ids = Array.isArray(parsedValue.ids)
      ? parsedValue.ids.filter((value): value is string => typeof value === "string")
      : [];
    const streakCount =
      typeof parsedValue.streakCount === "number" &&
      Number.isFinite(parsedValue.streakCount) &&
      parsedValue.streakCount >= 0
        ? Math.floor(parsedValue.streakCount)
        : 0;

    return {
      ids,
      streakCount,
    };
  } catch {
    return {
      ids: [],
      streakCount: 0,
    };
  }
}

export const storageService = {
  async saveGame(session: GameSession): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ACTIVE_GAME_STORAGE_KEY,
        JSON.stringify(cloneSession(session))
      );
    } catch {
      // Avoid surfacing storage failures to the gameplay flow.
    }
  },

  async loadGame(): Promise<GameSession | null> {
    try {
      const rawSession = await AsyncStorage.getItem(ACTIVE_GAME_STORAGE_KEY);

      if (!rawSession) {
        return null;
      }

      const parsedSession: unknown = JSON.parse(rawSession);

      if (!isValidGameSession(parsedSession)) {
        await AsyncStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
        return null;
      }

      return cloneSession(parsedSession);
    } catch {
      return null;
    }
  },

  async clearGame(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ACTIVE_GAME_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures to keep the app stable.
    }
  },

  async loadCoins(): Promise<number> {
    try {
      const rawCoins = await AsyncStorage.getItem(STORAGE_KEYS.USER_COINS);
      return parseStoredCoins(rawCoins);
    } catch {
      return 0;
    }
  },

  async saveCoins(coins: number): Promise<void> {
    const safeCoins =
      Number.isFinite(coins) && coins > 0 ? Math.floor(coins) : 0;

    await AsyncStorage.setItem(STORAGE_KEYS.USER_COINS, safeCoins.toString());
  },

  async loadDailyEconomyState(): Promise<StoredDailyEconomyState> {
    try {
      const [rawClaimedChallenges, rawLastClaimDate] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.CLAIMED_CHALLENGES),
        AsyncStorage.getItem(STORAGE_KEYS.LAST_CLAIM_DATE),
      ]);
      const parsedClaimedChallenges =
        parseStoredClaimedChallenges(rawClaimedChallenges);

      return {
        claimedChallengeIds: parsedClaimedChallenges.ids,
        lastClaimDate:
          typeof rawLastClaimDate === "string" && rawLastClaimDate.trim()
            ? rawLastClaimDate.trim()
            : null,
        streakCount: parsedClaimedChallenges.streakCount,
      };
    } catch {
      return {
        claimedChallengeIds: [],
        lastClaimDate: null,
        streakCount: 0,
      };
    }
  },

  async saveDailyEconomyState({
    claimedChallengeIds,
    lastClaimDate,
    streakCount,
  }: StoredDailyEconomyState): Promise<void> {
    const safeIds = claimedChallengeIds
      .filter((challengeId): challengeId is string => typeof challengeId === "string")
      .map((challengeId) => challengeId.trim())
      .filter(Boolean);
    const safeStreakCount =
      Number.isFinite(streakCount) && streakCount > 0
        ? Math.floor(streakCount)
        : 0;
    const normalizedLastClaimDate =
      typeof lastClaimDate === "string" && lastClaimDate.trim()
        ? lastClaimDate.trim()
        : "";

    await Promise.all([
      AsyncStorage.setItem(
        STORAGE_KEYS.CLAIMED_CHALLENGES,
        JSON.stringify({
          ids: safeIds,
          streakCount: safeStreakCount,
        })
      ),
      AsyncStorage.setItem(STORAGE_KEYS.LAST_CLAIM_DATE, normalizedLastClaimDate),
    ]);
  },
};
