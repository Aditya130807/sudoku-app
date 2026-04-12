import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { TOTAL_LEVELS } from "../constants/levels";
import {
  DAILY_CHALLENGE_UNLOCK_LEVEL,
  DailyRewardChallenge,
  DailyRewardChallengeId,
  claimDailyRewardSecure,
  completeAndClaimDailyRewardSecure,
  getDailyRewardStateForCurrentUser,
  getDailyRewardChallenges,
  getTodayKey,
  isYesterday,
  migrateLegacyDailyStatsForCurrentUser,
} from "../services/dailyChallengeService";
import { gameService } from "../services/gameService";
import { useAuthState } from "./AuthStateContext";
import { useCoins } from "./CoinContext";

interface DailyChallengeStatus extends DailyRewardChallenge {
  claimed: boolean;
}

interface DailyChallengeResult {
  challengeId: DailyRewardChallengeId;
  ok: boolean;
  message: string;
  reward: number;
  totalCoins?: number;
}

interface DailyChallengeContextValue {
  isHydrated: boolean;
  challenges: DailyChallengeStatus[];
  claimedChallengeIds: DailyRewardChallengeId[];
  streakCount: number;
  lastClaimDate: string | null;
  claimChallenge: (
    challengeId: DailyRewardChallengeId,
  ) => Promise<DailyChallengeResult>;
  registerGameStarted: () => Promise<DailyChallengeResult[]>;
  registerGameWon: (levelId: number) => Promise<DailyChallengeResult[]>;
  resetDailyChallenges: () => void;
}

const DailyChallengeContext = createContext<
  DailyChallengeContextValue | undefined
>(undefined);

function sanitizeClaimedChallengeIds(
  challengeIds: string[],
  availableChallengeIds: DailyRewardChallengeId[],
): DailyRewardChallengeId[] {
  const validIds = new Set<DailyRewardChallengeId>(availableChallengeIds);
  const sanitizedIds = new Set<DailyRewardChallengeId>();

  challengeIds.forEach((challengeId) => {
    if (validIds.has(challengeId as DailyRewardChallengeId)) {
      sanitizedIds.add(challengeId as DailyRewardChallengeId);
    }
  });

  return availableChallengeIds.filter((challengeId) =>
    sanitizedIds.has(challengeId),
  );
}

export function DailyChallengeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { authSyncVersion, latestUserData, userId } = useAuthState();
  const { refreshCoinsFromFirestore } = useCoins();
  const [storedClaimedChallengeIds, setStoredClaimedChallengeIds] = useState<
    DailyRewardChallengeId[]
  >([]);
  const [lastClaimDate, setLastClaimDate] = useState<string | null>(null);
  const [storedStreakCount, setStoredStreakCount] = useState(0);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const todayKey = getTodayKey();
  const challengeCatalog = useMemo(
    () => getDailyRewardChallenges(TOTAL_LEVELS, todayKey),
    [todayKey],
  );
  const challengeIds = useMemo(
    () => challengeCatalog.map((challenge) => challenge.id),
    [challengeCatalog],
  );
  const claimedChallengeIds = useMemo(
    () => (lastClaimDate === todayKey ? storedClaimedChallengeIds : []),
    [lastClaimDate, storedClaimedChallengeIds, todayKey],
  );
  const streakCount = useMemo(
    () =>
      lastClaimDate &&
      (lastClaimDate === todayKey || isYesterday(lastClaimDate, todayKey))
        ? storedStreakCount
        : 0,
    [lastClaimDate, storedStreakCount, todayKey],
  );

  const refreshStateFromRemote = useCallback(
    async (forceRefresh = false) => {
      if (!userId) {
        setStoredClaimedChallengeIds([]);
        setLastClaimDate(null);
        setStoredStreakCount(0);
        return;
      }

      const remoteState = await getDailyRewardStateForCurrentUser(
        TOTAL_LEVELS,
        {
          forceRefresh,
        },
      );

      setStoredClaimedChallengeIds(
        sanitizeClaimedChallengeIds(
          remoteState.claimedChallengeIds,
          challengeIds,
        ),
      );
      setLastClaimDate(remoteState.lastClaimDate);
      setStoredStreakCount(remoteState.streakCount);
    },
    [challengeIds, userId],
  );

  useEffect(() => {
    let isDisposed = false;

    void (async () => {
      setIsHydrated(false);

      try {
        if (!userId) {
          if (!isDisposed) {
            setStoredClaimedChallengeIds([]);
            setLastClaimDate(null);
            setStoredStreakCount(0);
          }
          return;
        }

        await migrateLegacyDailyStatsForCurrentUser(
          TOTAL_LEVELS,
          latestUserData?.stats,
        );

        if (isDisposed) {
          return;
        }

        await refreshStateFromRemote(true);
      } catch {
        if (!isDisposed) {
          setStoredClaimedChallengeIds([]);
          setLastClaimDate(null);
          setStoredStreakCount(0);
        }
      } finally {
        if (!isDisposed) {
          setIsHydrated(true);
        }
      }
    })();

    return () => {
      isDisposed = true;
    };
  }, [authSyncVersion, latestUserData?.stats, refreshStateFromRemote, userId]);

  const claimChallenges = useCallback(
    async (
      challengeIdsToClaim: DailyRewardChallengeId[],
      options?: {
        playedLevelId?: number;
      },
    ) => {
      if (!isHydrated) {
        return challengeIdsToClaim.map((challengeId) => ({
          challengeId,
          ok: false,
          message: "Daily rewards are still loading.",
          reward: 0,
        }));
      }

      if (!userId) {
        return challengeIdsToClaim.map((challengeId) => ({
          challengeId,
          ok: false,
          message: "Login is required to claim daily rewards.",
          reward: 0,
        }));
      }

      const uniqueChallengeIds = Array.from(
        new Set(challengeIdsToClaim),
      ).filter((challengeId) =>
        challengeCatalog.some((challenge) => challenge.id === challengeId),
      );

      if (gameService.getNextPlayableLevelId() < DAILY_CHALLENGE_UNLOCK_LEVEL) {
        return uniqueChallengeIds.map((challengeId) => ({
          challengeId,
          ok: false,
          message: `Unlock at Level ${DAILY_CHALLENGE_UNLOCK_LEVEL}.`,
          reward: 0,
        }));
      }

      setIsClaiming(true);

      try {
        const results: DailyChallengeResult[] = [];
        let hasSuccessfulClaim = false;

        for (const challengeId of uniqueChallengeIds) {
          const result = await completeAndClaimDailyRewardSecure(challengeId, {
            totalLevels: TOTAL_LEVELS,
            playedLevelId:
              challengeId === "featured_daily_board"
                ? options?.playedLevelId
                : undefined,
          });

          results.push(result);

          if (result.ok) {
            hasSuccessfulClaim = true;
          }
        }

        if (hasSuccessfulClaim) {
          await refreshCoinsFromFirestore();
        }

        await refreshStateFromRemote(true);
        return results;
      } finally {
        setIsClaiming(false);
      }
    },
    [
      challengeCatalog,
      isHydrated,
      refreshCoinsFromFirestore,
      refreshStateFromRemote,
      userId,
    ],
  );

  const challenges = useMemo(
    () =>
      challengeCatalog.map((challenge) => ({
        ...challenge,
        claimed: claimedChallengeIds.includes(challenge.id),
      })),
    [challengeCatalog, claimedChallengeIds],
  );

  const resetDailyChallenges = useCallback(() => {
    setStoredClaimedChallengeIds([]);
    setLastClaimDate(null);
    setStoredStreakCount(0);
    setIsHydrated(true);
  }, []);

  const claimChallenge = useCallback(
    async (
      challengeId: DailyRewardChallengeId,
    ): Promise<DailyChallengeResult> => {
      if (!isHydrated) {
        return {
          challengeId,
          ok: false,
          message: "Daily rewards are still loading.",
          reward: 0,
        };
      }

      if (!userId) {
        return {
          challengeId,
          ok: false,
          message: "Login is required to claim daily rewards.",
          reward: 0,
        };
      }

      if (isClaiming) {
        return {
          challengeId,
          ok: false,
          message: "A reward claim is already in progress.",
          reward: 0,
        };
      }

      setIsClaiming(true);

      try {
        const result = await claimDailyRewardSecure(challengeId, {
          totalLevels: TOTAL_LEVELS,
        });

        if (result.ok && result.totalAwarded > 0) {
          await refreshCoinsFromFirestore();
        }

        await refreshStateFromRemote(true);

        return {
          challengeId,
          ok: result.ok,
          message: result.message,
          reward: result.challengeReward,
          totalCoins: result.totalCoins,
        };
      } finally {
        setIsClaiming(false);
      }
    },
    [
      isClaiming,
      isHydrated,
      refreshCoinsFromFirestore,
      refreshStateFromRemote,
      userId,
    ],
  );

  const value = useMemo(
    () => ({
      isHydrated,
      challenges,
      claimedChallengeIds,
      streakCount,
      lastClaimDate,
      claimChallenge,
      registerGameStarted: () => claimChallenges(["play_1_game"]),
      registerGameWon: async (levelId: number) => {
        const featuredChallenge = challengeCatalog.find(
          (challenge) => challenge.id === "featured_daily_board",
        );
        const challengeIdsToClaim: DailyRewardChallengeId[] = ["win_1_game"];

        if (featuredChallenge?.levelId === levelId) {
          challengeIdsToClaim.push("featured_daily_board");
        }

        return claimChallenges(challengeIdsToClaim, {
          playedLevelId: levelId,
        });
      },
      resetDailyChallenges,
    }),
    [
      challengeCatalog,
      challenges,
      claimChallenge,
      claimChallenges,
      claimedChallengeIds,
      isHydrated,
      lastClaimDate,
      resetDailyChallenges,
      streakCount,
    ],
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
      "useDailyChallenges must be used within a DailyChallengeProvider.",
    );
  }

  return context;
}
