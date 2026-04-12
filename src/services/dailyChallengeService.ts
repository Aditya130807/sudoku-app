import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { PUZZLES } from "../data/puzzles";
import { auth, db, functions } from "../firebase";
import { storageService } from "./storageService";

export type DailyRewardChallengeId =
  | "play_1_game"
  | "win_1_game"
  | "featured_daily_board";

export interface DailyChallenge {
  date: string;
  levelId: number;
  reward: number;
}

export interface DailyRewardChallenge {
  id: DailyRewardChallengeId;
  title: string;
  description: string;
  reward: number;
  actionLabel: string;
  levelId?: number;
}

export interface DailyChallengeSet {
  speed: number;
  noHint: number;
  mystery: number;
}

export type DailyChallengeType = keyof DailyChallengeSet;

export interface DailyChallengeProgressEntry {
  completed: boolean;
  claimed: boolean;
  attemptsRemaining: number;
}

export interface DailyChallengeProgress {
  speed: DailyChallengeProgressEntry;
  noHint: DailyChallengeProgressEntry;
  mystery: DailyChallengeProgressEntry;
}

export interface DailyChallengeRewardResult {
  ok: boolean;
  progress: DailyChallengeProgress;
  challengeReward: number;
  allCompleteBonus: number;
  totalAwarded: number;
  totalCoins: number;
  allCompleted: boolean;
  message: string;
}

export interface DailyRewardChallengeStatus extends DailyRewardChallenge {
  claimed: boolean;
  completed: boolean;
}

export interface DailyRewardStateSnapshot {
  challenges: DailyRewardChallengeStatus[];
  claimedChallengeIds: DailyRewardChallengeId[];
  streakCount: number;
  lastClaimDate: string | null;
}

interface DailyChallengeSetWithFeatured extends DailyChallengeSet {
  featuredDailyBoard: number;
}

interface RemoteChallengeState {
  completed: boolean;
  claimed: boolean;
  reward: number;
  levelId: number | null;
  attemptsRemaining: number | null;
}

interface RemoteDailyChallengeDocument {
  date: string;
  dailyLevelId: number;
  challengeSet: DailyChallengeSetWithFeatured;
  challenges: {
    play_1_game: RemoteChallengeState;
    win_1_game: RemoteChallengeState;
    featured_daily_board: RemoteChallengeState;
    speed: RemoteChallengeState;
    noHint: RemoteChallengeState;
    mystery: RemoteChallengeState;
  };
  allCompleteBonusClaimed: boolean;
  streak: number;
  streakCount: number;
  lastClaimDate: string | null;
}

type UnifiedChallengeId = DailyRewardChallengeId | DailyChallengeType;

interface DailyChallengeCacheEntry {
  userId: string;
  date: string;
  state: RemoteDailyChallengeDocument;
}

interface LegacyDailyStatsInput {
  claimedChallengeIds?: string[];
  streakCount?: number;
  lastClaimDate?: string | null;
}

interface SecureClaimResult {
  ok: boolean;
  challengeId: UnifiedChallengeId;
  message: string;
  challengeReward: number;
  allCompleteBonus: number;
  totalAwarded: number;
  totalCoins: number;
  progress: DailyChallengeProgress;
  allCompleted: boolean;
  state: RemoteDailyChallengeDocument;
}

interface CallableBaseResult {
  ok: boolean;
  message: string;
  state: RemoteDailyChallengeDocument | null;
}

interface CallableClaimResult extends CallableBaseResult {
  challengeReward: number;
  allCompleteBonus: number;
  totalAwarded: number;
  totalCoins: number;
}

interface CallableCompleteResult extends CallableBaseResult {
  alreadyCompleted: boolean;
}

interface CallableFailureResult extends CallableBaseResult {
  attemptsRemaining: number | null;
}

export const DAILY_CHALLENGE_UNLOCK_LEVEL = 5;

const DAILY_PLAY_REWARD_COINS = 10;
const DAILY_WIN_REWARD_COINS = 20;
const DAILY_REWARD_COINS = 25;
export const DAILY_CHALLENGE_MAX_ATTEMPTS = 2;

const DAILY_CHALLENGE_REWARD_BY_TYPE: Record<DailyChallengeType, number> = {
  speed: 10,
  noHint: 15,
  mystery: 20,
};

export const DAILY_ALL_COMPLETE_BONUS_COINS = 25;

const PUZZLE_CHALLENGE_TYPES: DailyChallengeType[] = [
  "speed",
  "noHint",
  "mystery",
];

const DAILY_REWARD_BY_ID: Record<DailyRewardChallengeId, number> = {
  play_1_game: DAILY_PLAY_REWARD_COINS,
  win_1_game: DAILY_WIN_REWARD_COINS,
  featured_daily_board: DAILY_REWARD_COINS,
};

const FALLBACK_TOTAL_LEVELS = 30;

let dailyChallengeCache: DailyChallengeCacheEntry | null = null;

const generateDailyChallengesCallable = httpsCallable(
  functions,
  "generateDailyChallenges",
);
const completeChallengeCallable = httpsCallable(functions, "completeChallenge");
const claimDailyRewardCallable = httpsCallable(functions, "claimDailyReward");
const registerDailyChallengeFailureCallable = httpsCallable(
  functions,
  "registerDailyChallengeFailure",
);
const migrateLegacyDailyStatsCallable = httpsCallable(
  functions,
  "migrateLegacyDailyStats",
);

const ALL_PUZZLE_IDS = Object.keys(PUZZLES)
  .map((value) => Number(value))
  .filter((value) => Number.isInteger(value))
  .sort((left, right) => left - right);

export const easyPool: readonly number[] = ALL_PUZZLE_IDS.filter(
  (levelId) => levelId <= 10,
);
export const hardPool: readonly number[] = ALL_PUZZLE_IDS.filter(
  (levelId) => levelId > 20,
);
export const specialPool: readonly number[] = ALL_PUZZLE_IDS.filter(
  (levelId) => levelId > 10 && levelId <= 20,
);

function assertPoolHasValues(pool: readonly number[], poolName: string): void {
  if (!pool.length) {
    throw new Error(`${poolName} must contain at least one puzzle id.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createEmptyDailyChallengeProgress(): DailyChallengeProgress {
  return {
    speed: {
      completed: false,
      claimed: false,
      attemptsRemaining: DAILY_CHALLENGE_MAX_ATTEMPTS,
    },
    noHint: {
      completed: false,
      claimed: false,
      attemptsRemaining: DAILY_CHALLENGE_MAX_ATTEMPTS,
    },
    mystery: {
      completed: false,
      claimed: false,
      attemptsRemaining: DAILY_CHALLENGE_MAX_ATTEMPTS,
    },
  };
}

function isAttemptLimitedChallenge(type: DailyChallengeType): boolean {
  return type === "speed" || type === "noHint";
}

function isRewardChallengeId(value: unknown): value is DailyRewardChallengeId {
  return (
    value === "play_1_game" ||
    value === "win_1_game" ||
    value === "featured_daily_board"
  );
}

function sanitizeAttemptsRemaining(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DAILY_CHALLENGE_MAX_ATTEMPTS;
  }

  const normalizedValue = Math.floor(value);
  return Math.max(0, Math.min(DAILY_CHALLENGE_MAX_ATTEMPTS, normalizedValue));
}

function sanitizeDailyChallengeProgressEntry(
  value: unknown,
): DailyChallengeProgressEntry {
  if (!isRecord(value)) {
    return {
      completed: false,
      claimed: false,
      attemptsRemaining: DAILY_CHALLENGE_MAX_ATTEMPTS,
    };
  }

  return {
    completed: value.completed === true,
    claimed: value.claimed === true,
    attemptsRemaining: sanitizeAttemptsRemaining(value.attemptsRemaining),
  };
}

function cloneRemoteDocument(
  state: RemoteDailyChallengeDocument,
): RemoteDailyChallengeDocument {
  return {
    ...state,
    challengeSet: {
      ...state.challengeSet,
    },
    challenges: {
      play_1_game: { ...state.challenges.play_1_game },
      win_1_game: { ...state.challenges.win_1_game },
      featured_daily_board: { ...state.challenges.featured_daily_board },
      speed: { ...state.challenges.speed },
      noHint: { ...state.challenges.noHint },
      mystery: { ...state.challenges.mystery },
    },
  };
}

function getSafeTotalLevels(input?: number): number {
  if (typeof input === "number" && Number.isInteger(input) && input > 0) {
    return input;
  }

  if (ALL_PUZZLE_IDS.length > 0) {
    return ALL_PUZZLE_IDS.length;
  }

  return FALLBACK_TOTAL_LEVELS;
}

function buildDefaultChallengeSet(dateKey: string, totalLevels: number) {
  const puzzleSet = getDailyChallenges(dateKey);

  return {
    ...puzzleSet,
    featuredDailyBoard: getDailyLevelIdForDate(totalLevels, dateKey),
  };
}

function createDefaultRemoteDailyDocument(
  dateKey: string,
  totalLevels: number,
): RemoteDailyChallengeDocument {
  const challengeSet = buildDefaultChallengeSet(dateKey, totalLevels);

  return {
    date: dateKey,
    dailyLevelId: challengeSet.featuredDailyBoard,
    challengeSet,
    challenges: {
      play_1_game: {
        completed: false,
        claimed: false,
        reward: DAILY_REWARD_BY_ID.play_1_game,
        levelId: null,
        attemptsRemaining: null,
      },
      win_1_game: {
        completed: false,
        claimed: false,
        reward: DAILY_REWARD_BY_ID.win_1_game,
        levelId: null,
        attemptsRemaining: null,
      },
      featured_daily_board: {
        completed: false,
        claimed: false,
        reward: DAILY_REWARD_BY_ID.featured_daily_board,
        levelId: challengeSet.featuredDailyBoard,
        attemptsRemaining: null,
      },
      speed: {
        completed: false,
        claimed: false,
        reward: DAILY_CHALLENGE_REWARD_BY_TYPE.speed,
        levelId: challengeSet.speed,
        attemptsRemaining: DAILY_CHALLENGE_MAX_ATTEMPTS,
      },
      noHint: {
        completed: false,
        claimed: false,
        reward: DAILY_CHALLENGE_REWARD_BY_TYPE.noHint,
        levelId: challengeSet.noHint,
        attemptsRemaining: DAILY_CHALLENGE_MAX_ATTEMPTS,
      },
      mystery: {
        completed: false,
        claimed: false,
        reward: DAILY_CHALLENGE_REWARD_BY_TYPE.mystery,
        levelId: challengeSet.mystery,
        attemptsRemaining: null,
      },
    },
    allCompleteBonusClaimed: false,
    streak: 0,
    streakCount: 0,
    lastClaimDate: null,
  };
}

function sanitizeNumber(value: unknown, fallback: number, minimum = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(value));
}

function sanitizeRemoteChallengeState(
  value: unknown,
  fallback: RemoteChallengeState,
): RemoteChallengeState {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  const claimed = value.claimed === true;
  const completed = claimed || value.completed === true;
  const attemptsRemaining =
    fallback.attemptsRemaining === null
      ? null
      : sanitizeAttemptsRemaining(value.attemptsRemaining);

  return {
    completed,
    claimed,
    reward: fallback.reward,
    levelId: fallback.levelId,
    attemptsRemaining,
  };
}

function sanitizeRemoteDailyDocument(
  value: unknown,
  dateKey: string,
  totalLevels: number,
): RemoteDailyChallengeDocument {
  const defaults = createDefaultRemoteDailyDocument(dateKey, totalLevels);

  if (!isRecord(value)) {
    return defaults;
  }

  const dailyLevelId = sanitizeNumber(
    value.dailyLevelId,
    defaults.dailyLevelId,
    1,
  );
  const challengeSetCandidate = value.challengeSet;
  const challengeSet = isRecord(challengeSetCandidate)
    ? {
        speed: sanitizeNumber(
          challengeSetCandidate.speed,
          defaults.challengeSet.speed,
          1,
        ),
        noHint: sanitizeNumber(
          challengeSetCandidate.noHint,
          defaults.challengeSet.noHint,
          1,
        ),
        mystery: sanitizeNumber(
          challengeSetCandidate.mystery,
          defaults.challengeSet.mystery,
          1,
        ),
        featuredDailyBoard: sanitizeNumber(
          challengeSetCandidate.featuredDailyBoard,
          dailyLevelId,
          1,
        ),
      }
    : defaults.challengeSet;

  const challengesCandidate = value.challenges;
  const challengeSource = isRecord(challengesCandidate)
    ? challengesCandidate
    : defaults.challenges;

  const sanitized: RemoteDailyChallengeDocument = {
    date:
      typeof value.date === "string" && parseDateKey(value.date.trim())
        ? value.date.trim()
        : dateKey,
    dailyLevelId: challengeSet.featuredDailyBoard,
    challengeSet,
    challenges: {
      play_1_game: sanitizeRemoteChallengeState(challengeSource.play_1_game, {
        ...defaults.challenges.play_1_game,
        levelId: null,
      }),
      win_1_game: sanitizeRemoteChallengeState(challengeSource.win_1_game, {
        ...defaults.challenges.win_1_game,
        levelId: null,
      }),
      featured_daily_board: sanitizeRemoteChallengeState(
        challengeSource.featured_daily_board,
        {
          ...defaults.challenges.featured_daily_board,
          levelId: challengeSet.featuredDailyBoard,
        },
      ),
      speed: sanitizeRemoteChallengeState(challengeSource.speed, {
        ...defaults.challenges.speed,
        levelId: challengeSet.speed,
      }),
      noHint: sanitizeRemoteChallengeState(challengeSource.noHint, {
        ...defaults.challenges.noHint,
        levelId: challengeSet.noHint,
      }),
      mystery: sanitizeRemoteChallengeState(challengeSource.mystery, {
        ...defaults.challenges.mystery,
        levelId: challengeSet.mystery,
      }),
    },
    allCompleteBonusClaimed: value.allCompleteBonusClaimed === true,
    streak: sanitizeNumber(
      value.streak,
      sanitizeNumber(value.streakCount, 0, 0),
      0,
    ),
    streakCount: sanitizeNumber(
      value.streakCount,
      sanitizeNumber(value.streak, 0, 0),
      0,
    ),
    lastClaimDate:
      typeof value.lastClaimDate === "string" &&
      parseDateKey(value.lastClaimDate.trim())
        ? value.lastClaimDate.trim()
        : null,
  };

  return sanitized;
}

function toDailyChallengeProgress(
  state: RemoteDailyChallengeDocument,
): DailyChallengeProgress {
  return {
    speed: sanitizeDailyChallengeProgressEntry(state.challenges.speed),
    noHint: sanitizeDailyChallengeProgressEntry(state.challenges.noHint),
    mystery: sanitizeDailyChallengeProgressEntry(state.challenges.mystery),
  };
}

function getChallengeTitleById(
  challengeId: DailyRewardChallengeId,
  totalLevels: number,
  dateKey: string,
): string {
  const challenge = getDailyRewardChallenges(totalLevels, dateKey).find(
    (entry) => entry.id === challengeId,
  );

  return challenge?.title ?? challengeId;
}

function createEmptyDailyRewardState(
  totalLevels: number,
  dateKey: string,
): DailyRewardStateSnapshot {
  const rewardChallenges = getDailyRewardChallenges(totalLevels, dateKey).map(
    (challenge) => ({
      ...challenge,
      claimed: false,
      completed: false,
    }),
  );

  return {
    challenges: rewardChallenges,
    claimedChallengeIds: [],
    streakCount: 0,
    lastClaimDate: null,
  };
}

function toDailyRewardState(
  state: RemoteDailyChallengeDocument,
  totalLevels: number,
): DailyRewardStateSnapshot {
  const catalog = getDailyRewardChallenges(totalLevels, state.date);
  const challenges = catalog.map((challenge) => {
    const sourceState = state.challenges[challenge.id];
    return {
      ...challenge,
      completed: sourceState.completed,
      claimed: sourceState.claimed,
    };
  });

  return {
    challenges,
    claimedChallengeIds: challenges
      .filter((challenge) => challenge.claimed)
      .map((challenge) => challenge.id),
    streakCount: state.streakCount,
    lastClaimDate: state.lastClaimDate,
  };
}

function isAllPuzzleChallengesCompleted(
  state: RemoteDailyChallengeDocument,
): boolean {
  return PUZZLE_CHALLENGE_TYPES.every(
    (challengeType) => state.challenges[challengeType].completed,
  );
}

function isAllChallengesCompleted(progress: DailyChallengeProgress): boolean {
  return (
    progress.speed.completed &&
    progress.noHint.completed &&
    progress.mystery.completed
  );
}

function getSignedInUserId(): string | null {
  const uid = auth.currentUser?.uid?.trim();
  return uid ? uid : null;
}

function getUserDocRef(userId: string) {
  return doc(db, "users", userId);
}

function getDailyChallengeDocRef(userId: string, dateKey: string) {
  return doc(db, "users", userId, "dailyChallenges", dateKey);
}

function readDailyChallengeCache(
  userId: string,
  dateKey: string,
): RemoteDailyChallengeDocument | null {
  if (
    !dailyChallengeCache ||
    dailyChallengeCache.userId !== userId ||
    dailyChallengeCache.date !== dateKey
  ) {
    return null;
  }

  return cloneRemoteDocument(dailyChallengeCache.state);
}

function writeDailyChallengeCache(
  userId: string,
  dateKey: string,
  state: RemoteDailyChallengeDocument,
) {
  dailyChallengeCache = {
    userId,
    date: dateKey,
    state: cloneRemoteDocument(state),
  };
}

function clearDailyChallengeCache() {
  dailyChallengeCache = null;
}

function readCallableData(input: unknown): Record<string, unknown> {
  return isRecord(input) ? input : {};
}

function readCallableMessage(
  input: Record<string, unknown>,
  fallback: string,
): string {
  if (typeof input.message === "string" && input.message.trim()) {
    return input.message.trim();
  }

  return fallback;
}

function extractSnapshotFromCallable(
  input: Record<string, unknown>,
  totalLevels: number,
): RemoteDailyChallengeDocument | null {
  if (!isRecord(input.snapshot)) {
    return null;
  }

  const dateKey = getTodayKey();
  return sanitizeRemoteDailyDocument(input.snapshot, dateKey, totalLevels);
}

function toErrorMessage(error: unknown, fallbackMessage: string): string {
  if (isRecord(error) && typeof error.message === "string" && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

async function readDailyStateFromFirestore(
  userId: string,
  dateKey: string,
  totalLevels: number,
): Promise<RemoteDailyChallengeDocument | null> {
  try {
    const snapshot = await getDoc(getDailyChallengeDocRef(userId, dateKey));

    if (!snapshot.exists()) {
      return null;
    }

    return sanitizeRemoteDailyDocument(snapshot.data(), dateKey, totalLevels);
  } catch {
    return null;
  }
}

async function ensureDailyStateFromBackend(
  userId: string,
  totalLevels: number,
  options?: {
    forceRefresh?: boolean;
  },
): Promise<RemoteDailyChallengeDocument> {
  const dateKey = getTodayKey();

  if (!options?.forceRefresh) {
    const cachedState = readDailyChallengeCache(userId, dateKey);

    if (cachedState) {
      return cachedState;
    }
  }

  try {
    const result = await generateDailyChallengesCallable({
      totalLevels,
    });
    const callableData = readCallableData(result.data);
    const snapshotState = extractSnapshotFromCallable(
      callableData,
      totalLevels,
    );

    if (snapshotState) {
      writeDailyChallengeCache(userId, dateKey, snapshotState);
      return cloneRemoteDocument(snapshotState);
    }
  } catch {
    // Fall through to Firestore read fallback.
  }

  const firestoreState = await readDailyStateFromFirestore(
    userId,
    dateKey,
    totalLevels,
  );

  if (firestoreState) {
    writeDailyChallengeCache(userId, dateKey, firestoreState);
    return cloneRemoteDocument(firestoreState);
  }

  const defaults = createDefaultRemoteDailyDocument(dateKey, totalLevels);
  writeDailyChallengeCache(userId, dateKey, defaults);
  return defaults;
}

async function callClaimDailyReward(
  challengeId: UnifiedChallengeId,
  totalLevels: number,
): Promise<CallableClaimResult> {
  try {
    const result = await claimDailyRewardCallable({ challengeId, totalLevels });
    const callableData = readCallableData(result.data);

    return {
      ok: callableData.success === true,
      message: readCallableMessage(callableData, "Try again later"),
      state: extractSnapshotFromCallable(callableData, totalLevels),
      challengeReward: sanitizeNumber(callableData.challengeReward, 0, 0),
      allCompleteBonus: sanitizeNumber(callableData.allCompleteBonus, 0, 0),
      totalAwarded: sanitizeNumber(callableData.coinsAdded, 0, 0),
      totalCoins: sanitizeNumber(callableData.totalCoins, 0, 0),
    };
  } catch (error) {
    return {
      ok: false,
      message: toErrorMessage(error, "Try again later"),
      state: null,
      challengeReward: 0,
      allCompleteBonus: 0,
      totalAwarded: 0,
      totalCoins: 0,
    };
  }
}

async function callCompleteChallenge(
  challengeId: UnifiedChallengeId,
  totalLevels: number,
  playedLevelId?: number,
): Promise<CallableCompleteResult> {
  try {
    const payload: {
      challengeId: UnifiedChallengeId;
      totalLevels: number;
      playedLevelId?: number;
    } = {
      challengeId,
      totalLevels,
    };

    if (typeof playedLevelId === "number" && Number.isInteger(playedLevelId)) {
      payload.playedLevelId = playedLevelId;
    }

    const result = await completeChallengeCallable(payload);
    const callableData = readCallableData(result.data);

    return {
      ok: callableData.success === true,
      alreadyCompleted: callableData.alreadyCompleted === true,
      message: readCallableMessage(callableData, "Try again later"),
      state: extractSnapshotFromCallable(callableData, totalLevels),
    };
  } catch (error) {
    return {
      ok: false,
      alreadyCompleted: false,
      message: toErrorMessage(error, "Try again later"),
      state: null,
    };
  }
}

async function callRegisterChallengeFailure(
  challengeId: DailyChallengeType,
  totalLevels: number,
): Promise<CallableFailureResult> {
  try {
    const result = await registerDailyChallengeFailureCallable({
      challengeId,
      totalLevels,
    });
    const callableData = readCallableData(result.data);

    return {
      ok: callableData.success === true,
      message: readCallableMessage(callableData, "Try again later"),
      state: extractSnapshotFromCallable(callableData, totalLevels),
      attemptsRemaining:
        typeof callableData.attemptsRemaining === "number"
          ? sanitizeAttemptsRemaining(callableData.attemptsRemaining)
          : null,
    };
  } catch (error) {
    return {
      ok: false,
      message: toErrorMessage(error, "Try again later"),
      state: null,
      attemptsRemaining: null,
    };
  }
}

async function callMigrateLegacyDailyStats(
  totalLevels: number,
  payload: {
    claimedChallengeIds: DailyRewardChallengeId[];
    streakCount: number;
    lastClaimDate: string | null;
  },
): Promise<CallableBaseResult> {
  try {
    const result = await migrateLegacyDailyStatsCallable({
      totalLevels,
      ...payload,
    });
    const callableData = readCallableData(result.data);

    return {
      ok: callableData.success === true,
      message: readCallableMessage(callableData, "Try again later"),
      state: extractSnapshotFromCallable(callableData, totalLevels),
    };
  } catch (error) {
    return {
      ok: false,
      message: toErrorMessage(error, "Try again later"),
      state: null,
    };
  }
}

function createFailureClaimResult(
  challengeId: UnifiedChallengeId,
  message: string,
  state: RemoteDailyChallengeDocument,
): SecureClaimResult {
  return {
    ok: false,
    challengeId,
    message,
    challengeReward: 0,
    allCompleteBonus: 0,
    totalAwarded: 0,
    totalCoins: 0,
    progress: toDailyChallengeProgress(state),
    allCompleted: isAllPuzzleChallengesCompleted(state),
    state,
  };
}

function hydrateCacheFromState(state: RemoteDailyChallengeDocument) {
  const signedInUserId = getSignedInUserId();

  if (!signedInUserId) {
    return;
  }

  writeDailyChallengeCache(signedInUserId, state.date, state);
}

export function getRewardCoinsForType(type: DailyChallengeType): number {
  return DAILY_CHALLENGE_REWARD_BY_TYPE[type];
}

export async function getDailyRewardStateForCurrentUser(
  totalLevels: number,
  options?: {
    forceRefresh?: boolean;
  },
): Promise<DailyRewardStateSnapshot> {
  const safeTotalLevels = getSafeTotalLevels(totalLevels);
  const dateKey = getTodayKey();
  const signedInUserId = getSignedInUserId();

  if (!signedInUserId) {
    clearDailyChallengeCache();
    return createEmptyDailyRewardState(safeTotalLevels, dateKey);
  }

  const state = await ensureDailyStateFromBackend(
    signedInUserId,
    safeTotalLevels,
    {
      forceRefresh: options?.forceRefresh,
    },
  );

  return toDailyRewardState(state, safeTotalLevels);
}

export async function migrateLegacyDailyStatsForCurrentUser(
  totalLevels: number,
  legacyInput: LegacyDailyStatsInput | null | undefined,
): Promise<void> {
  const signedInUserId = getSignedInUserId();

  if (!signedInUserId || !legacyInput) {
    return;
  }

  const safeTotalLevels = getSafeTotalLevels(totalLevels);
  const todayKey = getTodayKey();
  const normalizedLastClaimDate =
    typeof legacyInput.lastClaimDate === "string" &&
    parseDateKey(legacyInput.lastClaimDate.trim())
      ? legacyInput.lastClaimDate.trim()
      : null;

  if (normalizedLastClaimDate !== todayKey) {
    return;
  }

  const normalizedClaimIds = Array.isArray(legacyInput.claimedChallengeIds)
    ? Array.from(
        new Set(
          legacyInput.claimedChallengeIds
            .map((value) => value.trim())
            .filter((value) => isRewardChallengeId(value)),
        ),
      )
    : [];

  if (!normalizedClaimIds.length) {
    return;
  }

  const result = await callMigrateLegacyDailyStats(safeTotalLevels, {
    claimedChallengeIds: normalizedClaimIds,
    streakCount: sanitizeNumber(legacyInput.streakCount, 0, 0),
    lastClaimDate: normalizedLastClaimDate,
  });

  if (result.state) {
    hydrateCacheFromState(result.state);
    return;
  }

  await ensureDailyStateFromBackend(signedInUserId, safeTotalLevels, {
    forceRefresh: true,
  });
}

export async function claimDailyRewardSecure(
  challengeId: UnifiedChallengeId,
  options?: {
    totalLevels?: number;
  },
): Promise<SecureClaimResult> {
  const safeTotalLevels = getSafeTotalLevels(options?.totalLevels);
  const signedInUserId = getSignedInUserId();

  if (!signedInUserId) {
    const fallback = createDefaultRemoteDailyDocument(
      getTodayKey(),
      safeTotalLevels,
    );
    return createFailureClaimResult(
      challengeId,
      "Login is required to claim daily rewards.",
      fallback,
    );
  }

  const claimResult = await callClaimDailyReward(challengeId, safeTotalLevels);
  const nextState =
    claimResult.state ??
    (await ensureDailyStateFromBackend(signedInUserId, safeTotalLevels, {
      forceRefresh: true,
    }));

  hydrateCacheFromState(nextState);

  if (!claimResult.ok) {
    return createFailureClaimResult(
      challengeId,
      claimResult.message,
      nextState,
    );
  }

  return {
    ok: true,
    challengeId,
    message: claimResult.message,
    challengeReward: claimResult.challengeReward,
    allCompleteBonus: claimResult.allCompleteBonus,
    totalAwarded: claimResult.totalAwarded,
    totalCoins: claimResult.totalCoins,
    progress: toDailyChallengeProgress(nextState),
    allCompleted: isAllPuzzleChallengesCompleted(nextState),
    state: nextState,
  };
}

export async function completeAndClaimDailyRewardSecure(
  challengeId: DailyRewardChallengeId,
  options?: {
    totalLevels?: number;
    playedLevelId?: number;
  },
): Promise<{
  challengeId: DailyRewardChallengeId;
  ok: boolean;
  message: string;
  reward: number;
  totalCoins?: number;
}> {
  const safeTotalLevels = getSafeTotalLevels(options?.totalLevels);
  const completionResult = await callCompleteChallenge(
    challengeId,
    safeTotalLevels,
    options?.playedLevelId,
  );

  if (!completionResult.ok && !completionResult.alreadyCompleted) {
    return {
      challengeId,
      ok: false,
      message: completionResult.message,
      reward: 0,
    };
  }

  if (completionResult.state) {
    hydrateCacheFromState(completionResult.state);
  }

  const secureResult = await claimDailyRewardSecure(challengeId, {
    totalLevels: safeTotalLevels,
  });

  return {
    challengeId,
    ok: secureResult.ok,
    message: secureResult.ok
      ? `${getChallengeTitleById(challengeId, safeTotalLevels, getTodayKey())} complete: +${secureResult.challengeReward} coins.`
      : secureResult.message,
    reward: secureResult.challengeReward,
    totalCoins: secureResult.ok ? secureResult.totalCoins : undefined,
  };
}

function readCoinsFromUserSnapshot(snapshot: { data: () => unknown }): number {
  const rawData = snapshot.data();
  const value = isRecord(rawData) ? rawData.coins : undefined;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export async function getTotalCoins(): Promise<number> {
  const signedInUserId = getSignedInUserId();

  if (!signedInUserId) {
    return storageService.loadCoins();
  }

  try {
    const snapshot = await getDoc(getUserDocRef(signedInUserId));

    if (!snapshot.exists()) {
      return 0;
    }

    return readCoinsFromUserSnapshot(snapshot);
  } catch {
    return storageService.loadCoins();
  }
}

export async function getDailyChallengeProgress(): Promise<DailyChallengeProgress> {
  const signedInUserId = getSignedInUserId();

  if (!signedInUserId) {
    return createEmptyDailyChallengeProgress();
  }

  const state = await ensureDailyStateFromBackend(
    signedInUserId,
    getSafeTotalLevels(),
  );

  return toDailyChallengeProgress(state);
}

export async function resetDailyIfNewDate(): Promise<DailyChallengeProgress> {
  return getDailyChallengeProgress();
}

export async function markCompleted(
  type: DailyChallengeType,
  options?: {
    playedLevelId?: number;
  },
): Promise<DailyChallengeProgress> {
  const signedInUserId = getSignedInUserId();

  if (!signedInUserId) {
    return createEmptyDailyChallengeProgress();
  }

  const totalLevels = getSafeTotalLevels();
  const completionResult = await callCompleteChallenge(
    type,
    totalLevels,
    options?.playedLevelId,
  );

  if (completionResult.state) {
    hydrateCacheFromState(completionResult.state);
    return toDailyChallengeProgress(completionResult.state);
  }

  const refreshedState = await ensureDailyStateFromBackend(
    signedInUserId,
    totalLevels,
    {
      forceRefresh: true,
    },
  );

  return toDailyChallengeProgress(refreshedState);
}

export async function registerChallengeFailed(
  type: DailyChallengeType,
): Promise<DailyChallengeProgress> {
  const signedInUserId = getSignedInUserId();

  if (!signedInUserId) {
    return createEmptyDailyChallengeProgress();
  }

  if (!isAttemptLimitedChallenge(type)) {
    return getDailyChallengeProgress();
  }

  const totalLevels = getSafeTotalLevels();
  const failureResult = await callRegisterChallengeFailure(type, totalLevels);

  if (failureResult.state) {
    hydrateCacheFromState(failureResult.state);
    return toDailyChallengeProgress(failureResult.state);
  }

  const refreshedState = await ensureDailyStateFromBackend(
    signedInUserId,
    totalLevels,
    {
      forceRefresh: true,
    },
  );

  return toDailyChallengeProgress(refreshedState);
}

export async function claimReward(
  type: DailyChallengeType,
): Promise<DailyChallengeRewardResult | null> {
  const secureResult = await claimDailyRewardSecure(type, {
    totalLevels: getSafeTotalLevels(),
  });

  if (!secureResult.ok) {
    return {
      ok: false,
      progress: secureResult.progress,
      challengeReward: 0,
      allCompleteBonus: 0,
      totalAwarded: 0,
      totalCoins: secureResult.totalCoins,
      allCompleted: secureResult.allCompleted,
      message: secureResult.message,
    };
  }

  return {
    ok: true,
    progress: secureResult.progress,
    challengeReward: secureResult.challengeReward,
    allCompleteBonus: secureResult.allCompleteBonus,
    totalAwarded: secureResult.totalAwarded,
    totalCoins: secureResult.totalCoins,
    allCompleted: secureResult.allCompleted,
    message: secureResult.message,
  };
}

export async function checkAllCompleted(): Promise<DailyChallengeRewardResult> {
  const signedInUserId = getSignedInUserId();

  if (!signedInUserId) {
    return {
      ok: false,
      progress: createEmptyDailyChallengeProgress(),
      challengeReward: 0,
      allCompleteBonus: 0,
      totalAwarded: 0,
      totalCoins: 0,
      allCompleted: false,
      message: "Login is required to claim daily rewards.",
    };
  }

  const state = await ensureDailyStateFromBackend(
    signedInUserId,
    getSafeTotalLevels(),
  );
  const progress = toDailyChallengeProgress(state);

  if (!isAllChallengesCompleted(progress)) {
    return {
      ok: false,
      progress,
      challengeReward: 0,
      allCompleteBonus: 0,
      totalAwarded: 0,
      totalCoins: await getTotalCoins(),
      allCompleted: false,
      message: "All daily challenges are not completed yet.",
    };
  }

  if (!state.allCompleteBonusClaimed) {
    return {
      ok: false,
      progress,
      challengeReward: 0,
      allCompleteBonus: 0,
      totalAwarded: 0,
      totalCoins: await getTotalCoins(),
      allCompleted: true,
      message: "Complete and claim challenge rewards to unlock the bonus.",
    };
  }

  return {
    ok: true,
    progress,
    challengeReward: 0,
    allCompleteBonus: DAILY_ALL_COMPLETE_BONUS_COINS,
    totalAwarded: 0,
    totalCoins: await getTotalCoins(),
    allCompleted: true,
    message: "All daily challenges completed. Bonus granted.",
  };
}

function toTwoDigits(value: number): string {
  return value.toString().padStart(2, "0");
}

function assertValidTotalLevels(totalLevels: number): void {
  if (!Number.isInteger(totalLevels) || totalLevels <= 0) {
    throw new Error("totalLevels must be a positive integer.");
  }
}

export function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function getDailySeed(): string {
  return getTodayKey();
}

export function hashStringToNumber(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function pickFromPool(
  pool: readonly number[],
  dateSeed: string,
  challengeType: keyof DailyChallengeSet,
  excludedIds: Set<number> = new Set<number>(),
): number {
  assertPoolHasValues(pool, `${challengeType} pool`);

  const startIndex =
    hashStringToNumber(`${dateSeed}:${challengeType}`) % pool.length;

  for (let offset = 0; offset < pool.length; offset += 1) {
    const candidate = pool[(startIndex + offset) % pool.length];

    if (!excludedIds.has(candidate)) {
      return candidate;
    }
  }

  return pool[startIndex];
}

export function getDailyChallenges(
  dateSeed: string = getDailySeed(),
): DailyChallengeSet {
  const normalizedSeed = dateSeed.trim();

  if (!parseDateKey(normalizedSeed)) {
    throw new Error("dateSeed must use YYYY-MM-DD format.");
  }

  assertPoolHasValues(easyPool, "easyPool");
  assertPoolHasValues(hardPool, "hardPool");
  assertPoolHasValues(specialPool, "specialPool");

  const speed = pickFromPool(easyPool, normalizedSeed, "speed");
  const noHint = pickFromPool(hardPool, normalizedSeed, "noHint");
  const mystery = pickFromPool(
    specialPool,
    normalizedSeed,
    "mystery",
    new Set<number>([speed, noHint]),
  );

  return {
    speed,
    noHint,
    mystery,
  };
}

function parseDateKey(
  dateKey: string,
): { year: number; month: number; day: number } | null {
  const trimmed = dateKey.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}

function formatDateUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${toTwoDigits(date.getUTCMonth() + 1)}-${toTwoDigits(
    date.getUTCDate(),
  )}`;
}

export function isYesterday(
  dateKey: string,
  referenceDateKey = getTodayKey(),
): boolean {
  const parsedReferenceDate = parseDateKey(referenceDateKey);

  if (!parsedReferenceDate) {
    return false;
  }

  const referenceDate = new Date(
    Date.UTC(
      parsedReferenceDate.year,
      parsedReferenceDate.month - 1,
      parsedReferenceDate.day,
    ),
  );
  const yesterday = new Date(referenceDate.getTime() - 24 * 60 * 60 * 1000);

  return dateKey.trim() === formatDateUTC(yesterday);
}

export function getDailyLevelId(totalLevels: number): number {
  return getDailyLevelIdForDate(totalLevels, getTodayKey());
}

function getDailyLevelIdForDate(totalLevels: number, dateKey: string): number {
  assertValidTotalLevels(totalLevels);

  const parsedDate = parseDateKey(dateKey);
  const dayOfMonth = parsedDate ? parsedDate.day : new Date().getUTCDate();

  return (dayOfMonth % totalLevels) + 1;
}

export function getDailyChallenge(totalLevels: number): DailyChallenge {
  return getDailyChallengeForDate(totalLevels, getTodayKey());
}

function getDailyChallengeForDate(
  totalLevels: number,
  dateKey: string,
): DailyChallenge {
  return {
    date: dateKey,
    levelId: getDailyLevelIdForDate(totalLevels, dateKey),
    reward: DAILY_REWARD_COINS,
  };
}

export function getFeaturedDailyRewardChallenge(
  totalLevels: number,
  dateKey: string = getTodayKey(),
): DailyRewardChallenge {
  const featuredChallenge = getDailyChallengeForDate(totalLevels, dateKey);

  return {
    id: "featured_daily_board",
    title: `Beat Level ${featuredChallenge.levelId}`,
    description: "Clear today's featured puzzle for a bonus coin drop.",
    reward: featuredChallenge.reward,
    actionLabel: "Play Daily Board",
    levelId: featuredChallenge.levelId,
  };
}

export function getDailyRewardChallenges(
  totalLevels: number,
  dateKey: string = getTodayKey(),
): DailyRewardChallenge[] {
  return [
    {
      id: "play_1_game",
      title: "Play 1 game",
      description: "Jump into any puzzle and claim your warm-up coins.",
      reward: DAILY_PLAY_REWARD_COINS,
      actionLabel: "Play Now",
    },
    {
      id: "win_1_game",
      title: "Win 1 game",
      description: "Finish any puzzle today to earn a bigger reward.",
      reward: DAILY_WIN_REWARD_COINS,
      actionLabel: "Finish a Level",
    },
    getFeaturedDailyRewardChallenge(totalLevels, dateKey),
  ];
}

export async function getDailyChallengeSnapshot(
  totalLevels: number = getSafeTotalLevels(),
): Promise<{
  challengeSet: DailyChallengeSet;
  progress: DailyChallengeProgress;
}> {
  const safeTotalLevels = getSafeTotalLevels(totalLevels);
  const todayKey = getTodayKey();
  const signedInUserId = getSignedInUserId();

  if (!signedInUserId) {
    return {
      challengeSet: getDailyChallenges(todayKey),
      progress: createEmptyDailyChallengeProgress(),
    };
  }

  const state = await ensureDailyStateFromBackend(
    signedInUserId,
    safeTotalLevels,
  );

  return {
    challengeSet: {
      speed: state.challengeSet.speed,
      noHint: state.challengeSet.noHint,
      mystery: state.challengeSet.mystery,
    },
    progress: toDailyChallengeProgress(state),
  };
}
