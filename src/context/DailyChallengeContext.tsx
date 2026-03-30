import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { TOTAL_LEVELS } from "../constants/levels";
import { useCoins } from "./CoinContext";
import {
  DAILY_CHALLENGE_UNLOCK_LEVEL,
  DailyRewardChallenge,
  DailyRewardChallengeId,
  getDailyRewardChallenges,
  getTodayKey,
  isYesterday,
} from "../services/dailyChallengeService";
import { gameService } from "../services/gameService";
import { storageService } from "../services/storageService";

interface DailyChallengeStatus extends DailyRewardChallenge {
  claimed: boolean;
}

interface DailyChallengeResult {
  challengeId: DailyRewardChallengeId;
  ok: boolean;
  message: string;
  reward: number;
}

interface DailyChallengeContextValue {
  isHydrated: boolean;
  challenges: DailyChallengeStatus[];
  claimedChallengeIds: DailyRewardChallengeId[];
  streakCount: number;
  lastClaimDate: string | null;
  claimChallenge: (challengeId: DailyRewardChallengeId) => DailyChallengeResult;
  registerGameStarted: () => DailyChallengeResult[];
  registerGameWon: (levelId: number) => DailyChallengeResult[];
}

const DailyChallengeContext = createContext<DailyChallengeContextValue | undefined>(
  undefined
);

function sanitizeClaimedChallengeIds(
  challengeIds: string[],
  availableChallengeIds: DailyRewardChallengeId[]
): DailyRewardChallengeId[] {
  const validIds = new Set<DailyRewardChallengeId>(availableChallengeIds);
  const sanitizedIds = new Set<DailyRewardChallengeId>();

  challengeIds.forEach((challengeId) => {
    if (validIds.has(challengeId as DailyRewardChallengeId)) {
      sanitizedIds.add(challengeId as DailyRewardChallengeId);
    }
  });

  return availableChallengeIds.filter((challengeId) => sanitizedIds.has(challengeId));
}

export function DailyChallengeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { addCoins } = useCoins();
  const [storedClaimedChallengeIds, setStoredClaimedChallengeIds] = useState<
    DailyRewardChallengeId[]
  >([]);
  const [lastClaimDate, setLastClaimDate] = useState<string | null>(null);
  const [storedStreakCount, setStoredStreakCount] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const challengeCatalog = useMemo(
    () => getDailyRewardChallenges(TOTAL_LEVELS),
    []
  );
  const challengeIds = useMemo(
    () => challengeCatalog.map((challenge) => challenge.id),
    [challengeCatalog]
  );
  const todayKey = getTodayKey();
  const claimedChallengeIds = useMemo(
    () => (lastClaimDate === todayKey ? storedClaimedChallengeIds : []),
    [lastClaimDate, storedClaimedChallengeIds, todayKey]
  );
  const streakCount = useMemo(
    () =>
      lastClaimDate &&
      (lastClaimDate === todayKey || isYesterday(lastClaimDate, todayKey))
        ? storedStreakCount
        : 0,
    [lastClaimDate, storedStreakCount, todayKey]
  );

  useEffect(() => {
    let isDisposed = false;

    void (async () => {
      const storedState = await storageService.loadDailyEconomyState();

      if (isDisposed) {
        return;
      }

      const shouldKeepStreak =
        !!storedState.lastClaimDate &&
        (storedState.lastClaimDate === todayKey ||
          isYesterday(storedState.lastClaimDate, todayKey));

      setStoredClaimedChallengeIds(
        storedState.lastClaimDate === todayKey
          ? sanitizeClaimedChallengeIds(storedState.claimedChallengeIds, challengeIds)
          : []
      );
      setLastClaimDate(storedState.lastClaimDate);
      setStoredStreakCount(shouldKeepStreak ? storedState.streakCount : 0);
      setIsHydrated(true);
    })();

    return () => {
      isDisposed = true;
    };
  }, [challengeIds, todayKey]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void storageService.saveDailyEconomyState({
      claimedChallengeIds: storedClaimedChallengeIds,
      lastClaimDate,
      streakCount: storedStreakCount,
    });
  }, [isHydrated, lastClaimDate, storedClaimedChallengeIds, storedStreakCount]);

  const claimChallenges = useCallback(
    (challengeIdsToClaim: DailyRewardChallengeId[]) => {
      if (!isHydrated) {
        return challengeIdsToClaim.map((challengeId) => ({
          challengeId,
          ok: false,
          message: "Daily rewards are still loading.",
          reward: 0,
        }));
      }

      const uniqueChallengeIds = Array.from(new Set(challengeIdsToClaim)).filter(
        (challengeId) => challengeCatalog.some((challenge) => challenge.id === challengeId)
      );

      if (
        gameService.getNextPlayableLevelId() < DAILY_CHALLENGE_UNLOCK_LEVEL
      ) {
        return uniqueChallengeIds.map((challengeId) => ({
          challengeId,
          ok: false,
          message: `Unlock at Level ${DAILY_CHALLENGE_UNLOCK_LEVEL}.`,
          reward: 0,
        }));
      }

      const todayClaimedIds = lastClaimDate === todayKey ? claimedChallengeIds : [];
      const nextClaimedIds = [...todayClaimedIds];
      const successfulRewards: DailyChallengeResult[] = [];
      const skippedRewards: DailyChallengeResult[] = [];

      uniqueChallengeIds.forEach((challengeId) => {
        const challenge = challengeCatalog.find(
          (entry) => entry.id === challengeId
        );

        if (!challenge) {
          skippedRewards.push({
            challengeId,
            ok: false,
            message: "That reward is unavailable today.",
            reward: 0,
          });
          return;
        }

        if (todayClaimedIds.includes(challengeId) || nextClaimedIds.includes(challengeId)) {
          skippedRewards.push({
            challengeId,
            ok: false,
            message: `${challenge.title} already claimed today.`,
            reward: 0,
          });
          return;
        }

        nextClaimedIds.push(challengeId);
        successfulRewards.push({
          challengeId,
          ok: true,
          message: `${challenge.title} complete: +${challenge.reward} coins.`,
          reward: challenge.reward,
        });
      });

      if (!successfulRewards.length) {
        return skippedRewards;
      }

      const totalReward = successfulRewards.reduce(
        (rewardSum, challenge) => rewardSum + challenge.reward,
        0
      );
      const nextStreakCount =
        lastClaimDate === todayKey
          ? streakCount || 1
          : lastClaimDate && isYesterday(lastClaimDate, todayKey)
            ? Math.max(1, streakCount) + 1
            : 1;

      setStoredClaimedChallengeIds(nextClaimedIds);
      setLastClaimDate(todayKey);
      setStoredStreakCount(nextStreakCount);
      addCoins(totalReward);

      return [...successfulRewards, ...skippedRewards];
    },
    [
      addCoins,
      challengeCatalog,
      claimedChallengeIds,
      isHydrated,
      lastClaimDate,
      streakCount,
      todayKey,
    ]
  );

  const challenges = useMemo(
    () =>
      challengeCatalog.map((challenge) => ({
        ...challenge,
        claimed: claimedChallengeIds.includes(challenge.id),
      })),
    [challengeCatalog, claimedChallengeIds]
  );

  const value = useMemo(
    () => ({
      isHydrated,
      challenges,
      claimedChallengeIds,
      streakCount,
      lastClaimDate,
      claimChallenge: (challengeId: DailyRewardChallengeId) =>
        claimChallenges([challengeId])[0] ?? {
          challengeId,
          ok: false,
          message: "That reward could not be claimed.",
          reward: 0,
        },
      registerGameStarted: () => claimChallenges(["play_1_game"]),
      registerGameWon: (levelId: number) => {
        const featuredChallenge = challengeCatalog.find(
          (challenge) => challenge.id === "featured_daily_board"
        );
        const challengeIdsToClaim: DailyRewardChallengeId[] = ["win_1_game"];

        if (featuredChallenge?.levelId === levelId) {
          challengeIdsToClaim.push("featured_daily_board");
        }

        return claimChallenges(challengeIdsToClaim);
      },
    }),
    [
      challengeCatalog,
      challenges,
      claimChallenges,
      claimedChallengeIds,
      isHydrated,
      lastClaimDate,
      streakCount,
    ]
  );

  return (
    <DailyChallengeContext.Provider value={value}>
      {children}
    </DailyChallengeContext.Provider>
  );
}

export function useDailyChallenges() {
  const context = useContext(DailyChallengeContext);

  if (!context) {
    throw new Error(
      "useDailyChallenges must be used within a DailyChallengeProvider."
    );
  }

  return context;
}
