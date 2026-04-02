import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { LEVELS } from "../constants/levels";
import { auth, db } from "../firebase";
import { LevelProgress, LevelStatus } from "../game/types";
import { gameStore } from "../store/gameStore";
import { userStore } from "../store/userStore";
import { waitForAuthMigrationToFinish } from "./authMigrationGate";
import {
  GuestStatsSnapshot,
  PersistedUserDataSnapshot,
  storageService,
} from "./storageService";

export interface LoadUserDataResult {
  data: PersistedUserDataSnapshot;
  isFallbackData: boolean;
}

let fallbackDataUserId: string | null = null;

function markFallbackDataState(userId: string | null, isFallbackData: boolean) {
  if (!userId) {
    fallbackDataUserId = null;
    return;
  }

  if (isFallbackData) {
    fallbackDataUserId = userId;
    return;
  }

  if (fallbackDataUserId === userId) {
    fallbackDataUserId = null;
  }
}

function shouldBlockRemoteSync(userId: string): boolean {
  return fallbackDataUserId === userId;
}

const VALID_LEVEL_STATUSES: ReadonlySet<LevelStatus> = new Set([
  "locked",
  "unlocked",
  "in_progress",
  "completed",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

function normalizeInteger(
  value: unknown,
  fallback = 0,
  minimum = Number.MIN_SAFE_INTEGER,
): number {
  const normalizedValue = Math.floor(normalizeNumber(value, fallback));
  return Math.max(minimum, normalizedValue);
}

function normalizeCoins(value: unknown): number {
  return normalizeInteger(value, 0, 0);
}

function createDefaultProgress(): Record<number, LevelProgress> {
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

function sanitizeLevelProgress(
  value: unknown,
  fallback: LevelProgress,
): LevelProgress {
  if (!isRecord(value)) {
    return fallback;
  }

  const statusCandidate =
    typeof value.status === "string" &&
    VALID_LEVEL_STATUSES.has(value.status as LevelStatus)
      ? (value.status as LevelStatus)
      : fallback.status;
  const bestTimeCandidate =
    typeof value.bestTimeSeconds === "number" &&
    Number.isFinite(value.bestTimeSeconds) &&
    value.bestTimeSeconds >= 0
      ? Math.floor(value.bestTimeSeconds)
      : null;
  const bestScoreCandidate =
    typeof value.bestScore === "number" && Number.isFinite(value.bestScore)
      ? Math.floor(value.bestScore)
      : null;
  const hintsUsed = normalizeInteger(value.hintsUsed, fallback.hintsUsed, 0);
  const attempts = normalizeInteger(value.attempts, fallback.attempts, 0);
  const stars = normalizeInteger(value.stars, fallback.stars, 0);

  return {
    status: statusCandidate,
    bestTimeSeconds: bestTimeCandidate,
    bestScore: bestScoreCandidate,
    stars,
    hintsUsed,
    attempts,
    completedAt:
      typeof value.completedAt === "string" && value.completedAt.trim()
        ? value.completedAt
        : null,
  };
}

function sanitizeProgress(value: unknown): Record<number, LevelProgress> {
  const defaults = createDefaultProgress();

  if (!isRecord(value)) {
    return defaults;
  }

  const nextProgress = { ...defaults };

  LEVELS.forEach((level) => {
    const rawEntry = value[level.id] ?? value[String(level.id)];
    nextProgress[level.id] = sanitizeLevelProgress(
      rawEntry,
      defaults[level.id],
    );
  });

  return nextProgress;
}

function countCompletedLevels(progress: Record<number, LevelProgress>): number {
  return Object.values(progress).filter((entry) => entry.status === "completed")
    .length;
}

function sanitizeStats(
  value: unknown,
  progress: Record<number, LevelProgress>,
): GuestStatsSnapshot {
  const completedLevelsFromProgress = countCompletedLevels(progress);

  if (!isRecord(value)) {
    return {
      completedLevels: completedLevelsFromProgress,
      lastPlayedLevelId: null,
      claimedChallengeIds: [],
      streakCount: 0,
      lastClaimDate: null,
    };
  }

  const completedLevels = Math.max(
    completedLevelsFromProgress,
    normalizeInteger(value.completedLevels, completedLevelsFromProgress, 0),
  );
  const lastPlayedLevelId =
    typeof value.lastPlayedLevelId === "number" &&
    Number.isInteger(value.lastPlayedLevelId) &&
    value.lastPlayedLevelId > 0
      ? value.lastPlayedLevelId
      : null;

  const claimedChallengeIds = Array.isArray(value.claimedChallengeIds)
    ? Array.from(
        new Set(
          value.claimedChallengeIds
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter(Boolean),
        ),
      )
    : [];

  return {
    completedLevels,
    lastPlayedLevelId,
    claimedChallengeIds,
    streakCount: normalizeInteger(value.streakCount, 0, 0),
    lastClaimDate:
      typeof value.lastClaimDate === "string" && value.lastClaimDate.trim()
        ? value.lastClaimDate.trim()
        : null,
  };
}

function sanitizeUserDataSnapshot(value: {
  coins?: unknown;
  progress?: unknown;
  stats?: unknown;
}): PersistedUserDataSnapshot {
  const progress = sanitizeProgress(value.progress);
  const stats = sanitizeStats(value.stats, progress);

  return {
    coins: normalizeCoins(value.coins),
    progress,
    stats,
  };
}

function getUserDocument(userId: string) {
  return doc(db, "users", userId);
}

async function saveRemoteUserData(
  userId: string,
  payload: Partial<PersistedUserDataSnapshot>,
): Promise<void> {
  await waitForAuthMigrationToFinish();

  if (shouldBlockRemoteSync(userId)) {
    return;
  }

  const documentPayload: Record<string, unknown> = {
    lastLogin: serverTimestamp(),
  };

  if (typeof payload.coins === "number") {
    documentPayload.coins = normalizeCoins(payload.coins);
  }

  if (payload.progress) {
    documentPayload.progress = payload.progress;
  }

  if (payload.stats) {
    documentPayload.stats = payload.stats;
  }

  await setDoc(getUserDocument(userId), documentPayload, { merge: true });
}

function buildCurrentStatsSnapshot(
  dailyState: Pick<
    GuestStatsSnapshot,
    "claimedChallengeIds" | "streakCount" | "lastClaimDate"
  >,
): GuestStatsSnapshot {
  const gameState = gameStore.getState();
  const completedLevelsFromProgress = countCompletedLevels(gameState.progress);
  const completedLevels = Math.max(
    completedLevelsFromProgress,
    userStore.getState().completedLevels,
  );

  return {
    completedLevels,
    lastPlayedLevelId: gameState.lastPlayedLevelId,
    claimedChallengeIds: Array.from(new Set(dailyState.claimedChallengeIds)),
    streakCount: Math.max(0, Math.floor(dailyState.streakCount)),
    lastClaimDate: dailyState.lastClaimDate,
  };
}

export async function loadUserData(
  userId: string | null,
): Promise<LoadUserDataResult> {
  if (!userId) {
    const guestSnapshot = await storageService.loadGuestUserData();
    markFallbackDataState(null, false);
    return {
      data: sanitizeUserDataSnapshot(guestSnapshot),
      isFallbackData: false,
    };
  }

  await waitForAuthMigrationToFinish();

  try {
    const userDoc = getUserDocument(userId);
    const snapshot = await getDoc(userDoc);
    const rawData = snapshot.exists() ? snapshot.data() : {};
    const normalizedData = sanitizeUserDataSnapshot({
      coins: rawData.coins,
      progress: rawData.progress,
      stats: rawData.stats,
    });

    markFallbackDataState(userId, false);
    return {
      data: normalizedData,
      isFallbackData: false,
    };
  } catch {
    const fallbackSnapshot = await storageService.loadGuestUserData();
    markFallbackDataState(userId, true);
    return {
      data: sanitizeUserDataSnapshot(fallbackSnapshot),
      isFallbackData: true,
    };
  }
}

export function hydrateStoresFromUserData(snapshot: PersistedUserDataSnapshot) {
  const normalized = sanitizeUserDataSnapshot(snapshot);
  const activeGame = gameStore.getState().activeGame;
  const nextProgress = { ...normalized.progress };

  if (activeGame?.status === "playing") {
    const currentEntry = nextProgress[activeGame.levelId];

    if (currentEntry) {
      nextProgress[activeGame.levelId] = {
        ...currentEntry,
        status:
          currentEntry.status === "completed" ? "completed" : "in_progress",
      };
    }
  }

  gameStore.setState((currentState) => ({
    ...currentState,
    progress: nextProgress,
    lastPlayedLevelId:
      normalized.stats.lastPlayedLevelId ??
      activeGame?.levelId ??
      currentState.lastPlayedLevelId,
    coins: normalized.coins,
  }));

  userStore.syncCompletedLevels(
    Math.max(
      normalized.stats.completedLevels,
      countCompletedLevels(nextProgress),
    ),
  );
}

export async function persistProgressAndStatsForCurrentUser(): Promise<void> {
  const progress = gameStore.getState().progress;
  const currentUserId = auth.currentUser?.uid ?? null;

  if (currentUserId) {
    await waitForAuthMigrationToFinish();

    const loadResult = await loadUserData(currentUserId);

    if (loadResult.isFallbackData || shouldBlockRemoteSync(currentUserId)) {
      return;
    }

    const gameState = gameStore.getState();
    const completedLevels = Math.max(
      userStore.getState().completedLevels,
      countCompletedLevels(gameState.progress),
    );

    await saveRemoteUserData(currentUserId, {
      progress,
      stats: {
        ...loadResult.data.stats,
        completedLevels,
        lastPlayedLevelId: gameState.lastPlayedLevelId,
      },
    });
    return;
  }

  const [dailyEconomyState, storedCoins] = await Promise.all([
    storageService.loadDailyEconomyState(),
    storageService.loadCoins(),
  ]);
  const stats = buildCurrentStatsSnapshot({
    claimedChallengeIds: dailyEconomyState.claimedChallengeIds,
    streakCount: dailyEconomyState.streakCount,
    lastClaimDate: dailyEconomyState.lastClaimDate,
  });

  await storageService.saveGuestUserData({
    coins: storedCoins,
    progress,
    stats,
  });
}

export async function persistCoinsForCurrentUser(coins: number): Promise<void> {
  const safeCoins = normalizeCoins(coins);
  const currentUserId = auth.currentUser?.uid ?? null;

  await storageService.saveCoins(safeCoins);

  if (currentUserId) {
    await waitForAuthMigrationToFinish();

    if (shouldBlockRemoteSync(currentUserId)) {
      return;
    }

    await saveRemoteUserData(currentUserId, {
      coins: safeCoins,
    });
    return;
  }

  const existingGuestData = await storageService.loadGuestUserData();

  await storageService.saveGuestUserData({
    ...existingGuestData,
    coins: safeCoins,
  });
}

export async function persistDailyStatsForCurrentUser(input: {
  claimedChallengeIds: string[];
  streakCount: number;
  lastClaimDate: string | null;
}): Promise<void> {
  const stats = buildCurrentStatsSnapshot(input);
  const currentUserId = auth.currentUser?.uid ?? null;

  if (currentUserId) {
    await waitForAuthMigrationToFinish();

    if (shouldBlockRemoteSync(currentUserId)) {
      return;
    }

    await saveRemoteUserData(currentUserId, {
      stats,
    });
    return;
  }

  const existingGuestData = await storageService.loadGuestUserData();

  await storageService.saveGuestUserData({
    ...existingGuestData,
    stats,
  });
}
