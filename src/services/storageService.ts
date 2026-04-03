import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  Board,
  CellPosition,
  CellStateBoard,
  GameSession,
  LevelProgress,
} from "../game/types";
import { cloneBoard, cloneCellStateBoard } from "../game/validator";

const ACTIVE_GAME_STORAGE_KEY = "@sudoku_ryve/active_game";
const HAS_ENTERED_APP_STORAGE_KEY = "hasEnteredApp";
const GUEST_ID_STORAGE_KEY = "@sudoku_ryve/guest_id";
const GUEST_PROGRESS_STORAGE_KEY = "@sudoku_ryve/guest_progress";
const GUEST_STATS_STORAGE_KEY = "@sudoku_ryve/guest_stats";

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

export interface GuestStatsSnapshot {
  completedLevels: number;
  lastPlayedLevelId: number | null;
  claimedChallengeIds: string[];
  streakCount: number;
  lastClaimDate: string | null;
}

export interface GuestSessionSnapshot {
  guestId: string;
  coins: number;
  progress: Record<number, LevelProgress>;
  stats: GuestStatsSnapshot;
}

export interface PersistedUserDataSnapshot {
  coins: number;
  progress: Record<number, LevelProgress>;
  stats: GuestStatsSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredClaimedChallengesPayload(
  value: unknown,
): value is StoredClaimedChallengesPayload {
  return (
    isRecord(value) &&
    Array.isArray(value.ids) &&
    value.ids.every((entry): entry is string => typeof entry === "string") &&
    typeof value.streakCount === "number" &&
    Number.isFinite(value.streakCount)
  );
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
        row.every((value) => isValidCellValue(value)),
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
        entry <= 9,
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
            isValidNotes(cell.notes),
        ),
    )
  );
}

function isValidCellPosition(
  position: unknown,
): position is CellPosition | null {
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
    selectedCell: session.selectedCell ? { ...session.selectedCell } : null,
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
  rawValue: string | null,
): StoredClaimedChallengesPayload {
  if (!rawValue) {
    return {
      ids: [],
      streakCount: 0,
    };
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (!isStoredClaimedChallengesPayload(parsedValue)) {
      return {
        ids: [],
        streakCount: 0,
      };
    }

    return {
      ids: parsedValue.ids.map((value) => value.trim()).filter(Boolean),
      streakCount: Math.max(0, Math.floor(parsedValue.streakCount)),
    };
  } catch {
    return {
      ids: [],
      streakCount: 0,
    };
  }
}

function parseProgressSnapshot(
  rawValue: string | null,
): Record<number, LevelProgress> {
  if (!rawValue) {
    return {};
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (!isRecord(parsedValue)) {
      return {};
    }

    return parsedValue as unknown as Record<number, LevelProgress>;
  } catch {
    return {};
  }
}

function parseGuestStatsSnapshot(rawValue: string | null): GuestStatsSnapshot {
  const defaultStats: GuestStatsSnapshot = {
    completedLevels: 0,
    lastPlayedLevelId: null,
    claimedChallengeIds: [],
    streakCount: 0,
    lastClaimDate: null,
  };

  if (!rawValue) {
    return defaultStats;
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (!isRecord(parsedValue)) {
      return defaultStats;
    }

    const completedLevels =
      typeof parsedValue.completedLevels === "number" &&
      Number.isFinite(parsedValue.completedLevels) &&
      parsedValue.completedLevels >= 0
        ? Math.floor(parsedValue.completedLevels)
        : 0;

    const lastPlayedLevelId =
      typeof parsedValue.lastPlayedLevelId === "number" &&
      Number.isInteger(parsedValue.lastPlayedLevelId) &&
      parsedValue.lastPlayedLevelId > 0
        ? parsedValue.lastPlayedLevelId
        : null;

    const claimedChallengeIds = Array.isArray(parsedValue.claimedChallengeIds)
      ? parsedValue.claimedChallengeIds.filter(
          (value): value is string => typeof value === "string",
        )
      : [];

    const streakCount =
      typeof parsedValue.streakCount === "number" &&
      Number.isFinite(parsedValue.streakCount) &&
      parsedValue.streakCount > 0
        ? Math.floor(parsedValue.streakCount)
        : 0;

    const lastClaimDate =
      typeof parsedValue.lastClaimDate === "string" &&
      parsedValue.lastClaimDate.trim()
        ? parsedValue.lastClaimDate.trim()
        : null;

    return {
      completedLevels,
      lastPlayedLevelId,
      claimedChallengeIds,
      streakCount,
      lastClaimDate,
    };
  } catch {
    return defaultStats;
  }
}

export const storageService = {
  async clearAllLocalData(): Promise<void> {
    await AsyncStorage.multiRemove([
      HAS_ENTERED_APP_STORAGE_KEY,
      GUEST_ID_STORAGE_KEY,
      GUEST_PROGRESS_STORAGE_KEY,
      GUEST_STATS_STORAGE_KEY,
      ACTIVE_GAME_STORAGE_KEY,
      STORAGE_KEYS.USER_COINS,
      STORAGE_KEYS.CLAIMED_CHALLENGES,
      STORAGE_KEYS.LAST_CLAIM_DATE,
    ]);
  },

  async markHasEnteredApp(): Promise<void> {
    await AsyncStorage.setItem(HAS_ENTERED_APP_STORAGE_KEY, "true");
  },

  async hasEnteredApp(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(HAS_ENTERED_APP_STORAGE_KEY);
      return value === "true";
    } catch {
      return false;
    }
  },

  async ensureGuestId(): Promise<string> {
    const existingGuestId = await AsyncStorage.getItem(GUEST_ID_STORAGE_KEY);

    if (existingGuestId && existingGuestId.trim()) {
      return existingGuestId;
    }

    const guestId = `guest_${Date.now()}`;
    await AsyncStorage.setItem(GUEST_ID_STORAGE_KEY, guestId);
    return guestId;
  },

  async getGuestId(): Promise<string | null> {
    try {
      const guestId = await AsyncStorage.getItem(GUEST_ID_STORAGE_KEY);

      if (!guestId || !guestId.trim()) {
        return null;
      }

      return guestId;
    } catch {
      return null;
    }
  },

  async saveGuestProgress(
    progress: Record<number, LevelProgress>,
  ): Promise<void> {
    await AsyncStorage.setItem(
      GUEST_PROGRESS_STORAGE_KEY,
      JSON.stringify(progress),
    );
  },

  async saveGuestStats(stats: GuestStatsSnapshot): Promise<void> {
    await AsyncStorage.setItem(GUEST_STATS_STORAGE_KEY, JSON.stringify(stats));
  },

  async loadGuestProgressSnapshot(): Promise<Record<number, LevelProgress>> {
    try {
      const rawProgress = await AsyncStorage.getItem(
        GUEST_PROGRESS_STORAGE_KEY,
      );
      return parseProgressSnapshot(rawProgress);
    } catch {
      return {};
    }
  },

  async loadGuestStatsSnapshot(): Promise<GuestStatsSnapshot> {
    try {
      const [rawStats, dailyEconomyState] = await Promise.all([
        AsyncStorage.getItem(GUEST_STATS_STORAGE_KEY),
        this.loadDailyEconomyState(),
      ]);
      const parsedStats = parseGuestStatsSnapshot(rawStats);

      return {
        ...parsedStats,
        claimedChallengeIds:
          parsedStats.claimedChallengeIds.length > 0
            ? parsedStats.claimedChallengeIds
            : dailyEconomyState.claimedChallengeIds,
        streakCount:
          parsedStats.streakCount > 0
            ? parsedStats.streakCount
            : dailyEconomyState.streakCount,
        lastClaimDate:
          parsedStats.lastClaimDate ?? dailyEconomyState.lastClaimDate,
      };
    } catch {
      return {
        completedLevels: 0,
        lastPlayedLevelId: null,
        claimedChallengeIds: [],
        streakCount: 0,
        lastClaimDate: null,
      };
    }
  },

  async loadGuestUserData(): Promise<PersistedUserDataSnapshot> {
    const [coins, progress, stats] = await Promise.all([
      this.loadCoins(),
      this.loadGuestProgressSnapshot(),
      this.loadGuestStatsSnapshot(),
    ]);

    return {
      coins,
      progress,
      stats,
    };
  },

  async saveGuestUserData(snapshot: PersistedUserDataSnapshot): Promise<void> {
    await Promise.all([
      this.saveCoins(snapshot.coins),
      this.saveGuestProgress(snapshot.progress),
      this.saveGuestStats(snapshot.stats),
      this.saveDailyEconomyState({
        claimedChallengeIds: snapshot.stats.claimedChallengeIds,
        streakCount: snapshot.stats.streakCount,
        lastClaimDate: snapshot.stats.lastClaimDate,
      }),
    ]);
  },

  async loadGuestSessionSnapshot(): Promise<GuestSessionSnapshot | null> {
    const guestId = await this.getGuestId();

    if (!guestId) {
      return null;
    }

    const { coins, progress, stats } = await this.loadGuestUserData();

    return {
      guestId,
      coins,
      progress,
      stats,
    };
  },

  async clearGuestSessionSnapshot(): Promise<void> {
    await this.clearAllLocalData();
  },

  async saveGame(session: GameSession): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ACTIVE_GAME_STORAGE_KEY,
        JSON.stringify(cloneSession(session)),
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
      .filter(
        (challengeId): challengeId is string => typeof challengeId === "string",
      )
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
        }),
      ),
      AsyncStorage.setItem(
        STORAGE_KEYS.LAST_CLAIM_DATE,
        normalizedLastClaimDate,
      ),
    ]);
  },

  async clearLocalAccountData(): Promise<void> {
    await this.clearAllLocalData();
  },
};
