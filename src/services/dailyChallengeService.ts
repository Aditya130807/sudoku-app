import AsyncStorage from "@react-native-async-storage/async-storage";

import { PUZZLES } from "../data/puzzles";
import { auth } from "../firebase";
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

interface StoredDailyChallengeProgressState {
  date: string;
  progress: DailyChallengeProgress;
  allCompleteBonusClaimed: boolean;
}

export const DAILY_CHALLENGE_UNLOCK_LEVEL = 5;

const DAILY_PLAY_REWARD_COINS = 10;
const DAILY_WIN_REWARD_COINS = 20;
const DAILY_REWARD_COINS = 25;
const DAILY_CHALLENGE_PROGRESS_KEY_PREFIX = "@sudoku_ryve/daily_progress";

const DAILY_CHALLENGE_REWARD_BY_TYPE: Record<DailyChallengeType, number> = {
  speed: 10,
  noHint: 15,
  mystery: 20,
};

export const DAILY_ALL_COMPLETE_BONUS_COINS = 25;

let isUpdating = false;
let updateQueue: Promise<void> = Promise.resolve();

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

function createEmptyDailyChallengeProgress(): DailyChallengeProgress {
  return {
    speed: { completed: false, claimed: false },
    noHint: { completed: false, claimed: false },
    mystery: { completed: false, claimed: false },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeDailyChallengeProgressEntry(
  value: unknown,
): DailyChallengeProgressEntry {
  if (!isRecord(value)) {
    return { completed: false, claimed: false };
  }

  return {
    completed: value.completed === true,
    claimed: value.claimed === true,
  };
}

function sanitizeDailyChallengeProgress(
  value: unknown,
): DailyChallengeProgress {
  if (!isRecord(value)) {
    return createEmptyDailyChallengeProgress();
  }

  return {
    speed: sanitizeDailyChallengeProgressEntry(value.speed),
    noHint: sanitizeDailyChallengeProgressEntry(value.noHint),
    mystery: sanitizeDailyChallengeProgressEntry(value.mystery),
  };
}

function parseStoredDailyChallengeProgressState(
  value: unknown,
): StoredDailyChallengeProgressState | null {
  if (!isRecord(value)) {
    return null;
  }

  const date = typeof value.date === "string" ? value.date.trim() : "";

  if (!parseDateKey(date)) {
    return null;
  }

  return {
    date,
    progress: sanitizeDailyChallengeProgress(value.progress),
    allCompleteBonusClaimed: value.allCompleteBonusClaimed === true,
  };
}

async function getDailyChallengeProgressStorageKey(): Promise<string> {
  const signedInUserId = auth.currentUser?.uid?.trim();

  if (signedInUserId) {
    return `${DAILY_CHALLENGE_PROGRESS_KEY_PREFIX}:${signedInUserId}`;
  }

  const existingGuestId = await storageService.getGuestId();
  const guestId = existingGuestId ?? (await storageService.ensureGuestId());

  return `${DAILY_CHALLENGE_PROGRESS_KEY_PREFIX}:${guestId}`;
}

async function loadStoredDailyChallengeProgressState(): Promise<StoredDailyChallengeProgressState | null> {
  try {
    const storageKey = await getDailyChallengeProgressStorageKey();
    const rawValue = await AsyncStorage.getItem(storageKey);

    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    return parseStoredDailyChallengeProgressState(parsedValue);
  } catch {
    return null;
  }
}

async function saveStoredDailyChallengeProgressState(
  state: StoredDailyChallengeProgressState,
): Promise<void> {
  const storageKey = await getDailyChallengeProgressStorageKey();
  await AsyncStorage.setItem(storageKey, JSON.stringify(state));
}

async function ensureDailyChallengeProgressState(): Promise<StoredDailyChallengeProgressState> {
  const todaySeed = getDailySeed();
  const storedState = await loadStoredDailyChallengeProgressState();

  if (!storedState || storedState.date !== todaySeed) {
    const resetState: StoredDailyChallengeProgressState = {
      date: todaySeed,
      progress: createEmptyDailyChallengeProgress(),
      allCompleteBonusClaimed: false,
    };
    await saveStoredDailyChallengeProgressState(resetState);
    return resetState;
  }

  return storedState;
}

function isAllChallengesCompleted(progress: DailyChallengeProgress): boolean {
  return (
    progress.speed.completed &&
    progress.noHint.completed &&
    progress.mystery.completed
  );
}

async function addToTotalCoins(amount: number): Promise<number> {
  const safeAmount = Number.isFinite(amount) ? Math.floor(amount) : 0;
  const currentCoins = await storageService.loadCoins();

  if (safeAmount <= 0) {
    return currentCoins;
  }

  const nextCoins = currentCoins + safeAmount;
  await storageService.saveCoins(nextCoins);
  return nextCoins;
}

async function createRewardResult(
  ok: boolean,
  message: string,
  progress: DailyChallengeProgress,
  challengeReward: number,
  allCompleteBonus: number,
): Promise<DailyChallengeRewardResult> {
  const safeChallengeReward = Math.max(0, Math.floor(challengeReward));
  const safeAllCompleteBonus = Math.max(0, Math.floor(allCompleteBonus));
  const totalAwarded = safeChallengeReward + safeAllCompleteBonus;
  const totalCoins = await addToTotalCoins(totalAwarded);

  return {
    ok,
    progress,
    challengeReward: safeChallengeReward,
    allCompleteBonus: safeAllCompleteBonus,
    totalAwarded,
    totalCoins,
    allCompleted: isAllChallengesCompleted(progress),
    message,
  };
}

async function withDailyChallengeUpdateLock<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const waitForTurn = updateQueue;
  let releaseLock: () => void = () => {};

  updateQueue = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  await waitForTurn;
  isUpdating = true;

  try {
    return await operation();
  } finally {
    isUpdating = false;
    releaseLock();
  }
}

export function getRewardCoinsForType(type: DailyChallengeType): number {
  return DAILY_CHALLENGE_REWARD_BY_TYPE[type];
}

export async function getTotalCoins(): Promise<number> {
  return storageService.loadCoins();
}

export async function getDailyChallengeProgress(): Promise<DailyChallengeProgress> {
  return withDailyChallengeUpdateLock(async () => {
    const state = await ensureDailyChallengeProgressState();
    return state.progress;
  });
}

export async function resetDailyIfNewDate(): Promise<DailyChallengeProgress> {
  return withDailyChallengeUpdateLock(async () => {
    const state = await ensureDailyChallengeProgressState();
    return state.progress;
  });
}

export async function markCompleted(
  type: DailyChallengeType,
): Promise<DailyChallengeProgress> {
  return withDailyChallengeUpdateLock(async () => {
    const state = await ensureDailyChallengeProgressState();

    if (state.progress[type].completed) {
      return state.progress;
    }

    const nextProgress: DailyChallengeProgress = {
      ...state.progress,
      [type]: {
        ...state.progress[type],
        completed: true,
      },
    };

    await saveStoredDailyChallengeProgressState({
      date: state.date,
      progress: nextProgress,
      allCompleteBonusClaimed: state.allCompleteBonusClaimed,
    });

    return nextProgress;
  });
}

export async function claimReward(
  type: DailyChallengeType,
): Promise<DailyChallengeRewardResult | null> {
  return withDailyChallengeUpdateLock(async () => {
    const state = await ensureDailyChallengeProgressState();
    const target = state.progress[type];

    if (!target || !target.completed) {
      return null;
    }

    if (target.claimed) {
      return null;
    }

    const rewardAmount = getRewardCoinsForType(type);
    target.claimed = true;

    let allCompleteBonus = 0;
    if (isAllChallengesCompleted(state.progress)) {
      if (state.allCompleteBonusClaimed) {
        allCompleteBonus = 0;
      } else {
        state.allCompleteBonusClaimed = true;
        allCompleteBonus = DAILY_ALL_COMPLETE_BONUS_COINS;
      }
    }

    await saveStoredDailyChallengeProgressState({
      date: state.date,
      progress: state.progress,
      allCompleteBonusClaimed: state.allCompleteBonusClaimed,
    });

    const totalAwarded = rewardAmount + allCompleteBonus;
    const totalCoins = await addToTotalCoins(totalAwarded);

    return {
      ok: true,
      progress: state.progress,
      challengeReward: rewardAmount,
      allCompleteBonus,
      totalAwarded,
      totalCoins,
      allCompleted: isAllChallengesCompleted(state.progress),
      message: `${type} reward claimed.`,
    };
  });
}

export async function checkAllCompleted(): Promise<DailyChallengeRewardResult> {
  return withDailyChallengeUpdateLock(async () => {
    const state = await ensureDailyChallengeProgressState();

    if (!isAllChallengesCompleted(state.progress)) {
      return createRewardResult(
        false,
        "All daily challenges are not completed yet.",
        state.progress,
        0,
        0,
      );
    }

    if (state.allCompleteBonusClaimed) {
      return createRewardResult(
        false,
        "All-complete bonus already claimed.",
        state.progress,
        0,
        0,
      );
    }

    await saveStoredDailyChallengeProgressState({
      date: state.date,
      progress: state.progress,
      allCompleteBonusClaimed: true,
    });

    return createRewardResult(
      true,
      "All daily challenges completed. Bonus granted.",
      state.progress,
      0,
      DAILY_ALL_COMPLETE_BONUS_COINS,
    );
  });
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
  const now = new Date();
  const year = now.getFullYear();
  const month = toTwoDigits(now.getMonth() + 1);
  const day = toTwoDigits(now.getDate());
  return `${year}-${month}-${day}`;
}

export function getDailySeed(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = toTwoDigits(now.getUTCMonth() + 1);
  const day = toTwoDigits(now.getUTCDate());
  return `${year}-${month}-${day}`;
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
  assertValidTotalLevels(totalLevels);
  const dayOfMonth = new Date().getDate();
  return (dayOfMonth % totalLevels) + 1;
}

export function getDailyChallenge(totalLevels: number): DailyChallenge {
  return {
    date: getTodayKey(),
    levelId: getDailyLevelId(totalLevels),
    reward: DAILY_REWARD_COINS,
  };
}

export function getFeaturedDailyRewardChallenge(
  totalLevels: number,
): DailyRewardChallenge {
  const featuredChallenge = getDailyChallenge(totalLevels);

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
    getFeaturedDailyRewardChallenge(totalLevels),
  ];
}
