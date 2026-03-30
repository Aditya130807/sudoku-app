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

export const DAILY_CHALLENGE_UNLOCK_LEVEL = 5;

const DAILY_PLAY_REWARD_COINS = 10;
const DAILY_WIN_REWARD_COINS = 20;
const DAILY_REWARD_COINS = 25;

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

function parseDateKey(
  dateKey: string
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
    date.getUTCDate()
  )}`;
}

export function isYesterday(dateKey: string, referenceDateKey = getTodayKey()): boolean {
  const parsedReferenceDate = parseDateKey(referenceDateKey);

  if (!parsedReferenceDate) {
    return false;
  }

  const referenceDate = new Date(
    Date.UTC(
      parsedReferenceDate.year,
      parsedReferenceDate.month - 1,
      parsedReferenceDate.day
    )
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
  totalLevels: number
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
  totalLevels: number
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
