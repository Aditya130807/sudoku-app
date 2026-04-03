import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CoinIcon from "../components/CoinIcon";
import CustomButton from "../components/CustomButton";
import Header from "../components/Header";
import { COLORS } from "../constants/colors";
import { useCoins } from "../context/CoinContext";
import { useAppTheme } from "../context/ThemeContext";
import { RootStackParamList } from "../navigation/types";
import {
  DAILY_ALL_COMPLETE_BONUS_COINS,
  DAILY_CHALLENGE_UNLOCK_LEVEL,
  DailyChallengeProgress,
  DailyChallengeType,
  claimReward,
  getDailyChallengeProgress,
  getDailyChallenges,
  getRewardCoinsForType,
  resetDailyIfNewDate,
} from "../services/dailyChallengeService";
import { gameService } from "../services/gameService";
import { hexToRgba } from "../utils/colorUtils";

type Props = NativeStackScreenProps<RootStackParamList, "DailyChallenges">;

type ChallengeStatus = "Not started" | "Completed" | "Claimed";

type ChallengePalette = {
  surface: string;
  border: string;
  accent: string;
  accentText: string;
  progressTrack: string;
  progressFill: string;
};

type ChallengeCardModel = {
  type: DailyChallengeType;
  title: string;
  puzzleId: number;
  reward: number;
  status: ChallengeStatus;
  progressValue: number;
  progress: DailyChallengeProgress[DailyChallengeType];
  palette: ChallengePalette;
};

const CHALLENGE_ORDER: DailyChallengeType[] = ["speed", "noHint", "mystery"];

const CHALLENGE_TITLE_BY_TYPE: Record<DailyChallengeType, string> = {
  speed: "Speed",
  noHint: "No Hint",
  mystery: "Mystery",
};

const CHALLENGE_PALETTE_BY_TYPE: Record<DailyChallengeType, ChallengePalette> =
  {
    speed: {
      surface: "#E8F0FF",
      border: "#BAD0FF",
      accent: "#2F6BFF",
      accentText: "#0E328F",
      progressTrack: "#C8DAFF",
      progressFill: "#2F6BFF",
    },
    noHint: {
      surface: "#FFF3E3",
      border: "#FFD5A1",
      accent: "#F2A93B",
      accentText: "#8D5203",
      progressTrack: "#FFE4BE",
      progressFill: "#F2A93B",
    },
    mystery: {
      surface: "#E6F8F0",
      border: "#B8E9D1",
      accent: "#22B573",
      accentText: "#0F6A42",
      progressTrack: "#CBF2E0",
      progressFill: "#22B573",
    },
  };

const EMPTY_DAILY_PROGRESS: DailyChallengeProgress = {
  speed: { completed: false, claimed: false },
  noHint: { completed: false, claimed: false },
  mystery: { completed: false, claimed: false },
};

function getChallengeStatus(
  progress: DailyChallengeProgress[DailyChallengeType],
): ChallengeStatus {
  if (progress.claimed) {
    return "Claimed";
  }

  if (progress.completed) {
    return "Completed";
  }

  return "Not started";
}

function getChallengeProgressValue(
  progress: DailyChallengeProgress[DailyChallengeType],
): number {
  if (progress.claimed) {
    return 100;
  }

  if (progress.completed) {
    return 65;
  }

  return 5;
}

function getStatusTextColor(
  styles: ReturnType<typeof createDailyChallengeStyles>,
  status: ChallengeStatus,
): string {
  if (status === "Claimed") {
    return styles.statusClaimed.color as string;
  }

  if (status === "Completed") {
    return styles.statusCompleted.color as string;
  }

  return styles.statusNotStarted.color as string;
}

function getStatusIconName(
  status: ChallengeStatus,
): "ellipse-outline" | "checkmark-circle-outline" | "checkmark-circle" {
  if (status === "Claimed") {
    return "checkmark-circle";
  }

  if (status === "Completed") {
    return "checkmark-circle-outline";
  }

  return "ellipse-outline";
}

function DailyChallengeCard({
  card,
  claimLoading,
  isAnyClaiming,
  onClaim,
  styles,
}: {
  card: ChallengeCardModel;
  claimLoading: boolean;
  isAnyClaiming: boolean;
  onClaim: (type: DailyChallengeType) => void;
  styles: ReturnType<typeof createDailyChallengeStyles>;
}) {
  const claimDisabled =
    !card.progress.completed || card.progress.claimed || isAnyClaiming;
  const claimLabel = card.progress.claimed
    ? "Claimed"
    : card.progress.completed
      ? "Claim Reward"
      : "Claim Reward";
  const statusColor = getStatusTextColor(styles, card.status);

  return (
    <View
      style={[
        styles.challengeCardBase,
        {
          backgroundColor: card.palette.surface,
          borderColor: card.palette.border,
        },
      ]}
    >
      <View style={styles.challengeTopRow}>
        <View style={styles.challengeTitleWrap}>
          <Text style={styles.challengeTitle}>{card.title}</Text>
          <Text style={styles.challengeSubtitle}>
            Today: Puzzle #{card.puzzleId}
          </Text>
        </View>

        <View
          style={[styles.rewardPill, { backgroundColor: card.palette.accent }]}
        >
          <CoinIcon size={14} />
          <Text style={styles.rewardPillText}>+{card.reward}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <Ionicons
          color={statusColor}
          name={getStatusIconName(card.status)}
          size={16}
        />
        <Text style={[styles.statusText, { color: statusColor }]}>
          {card.status}
        </Text>
      </View>

      <View style={styles.progressRow}>
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: card.palette.progressTrack },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: card.palette.progressFill,
                width: `${card.progressValue}%`,
              },
            ]}
          />
        </View>
      </View>

      <CustomButton
        fullWidth
        disabled={claimDisabled}
        isLoading={claimLoading}
        label={claimLabel}
        onPress={() => onClaim(card.type)}
        style={styles.claimButton}
        variant={card.progress.claimed ? "success" : "primary"}
      />
    </View>
  );
}

export default function DailyChallengeScreen({ navigation }: Props) {
  const { activeTheme } = useAppTheme();
  const { addCoins } = useCoins();
  const themeColors = activeTheme.colors;
  const styles = useMemo(
    () => createDailyChallengeStyles(themeColors),
    [themeColors],
  );
  const [dailyProgress, setDailyProgress] =
    useState<DailyChallengeProgress>(EMPTY_DAILY_PROGRESS);
  const [dailyPuzzleSet, setDailyPuzzleSet] = useState<Record<
    DailyChallengeType,
    number
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [claimingType, setClaimingType] = useState<DailyChallengeType | null>(
    null,
  );
  const userLevel = gameService.getNextPlayableLevelId();
  const isUnlocked = userLevel >= DAILY_CHALLENGE_UNLOCK_LEVEL;

  const refreshDailyState = useCallback(async () => {
    setIsLoading(true);

    try {
      await resetDailyIfNewDate();
      const [progress] = await Promise.all([getDailyChallengeProgress()]);
      setDailyPuzzleSet(getDailyChallenges());
      setDailyProgress(progress);
    } catch {
      setNotice("Unable to load daily challenge data right now.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshDailyState();
    }, [refreshDailyState]),
  );

  const cardModels = useMemo<ChallengeCardModel[]>(() => {
    if (!dailyPuzzleSet) {
      return [];
    }

    return CHALLENGE_ORDER.map((type) => {
      const progress = dailyProgress[type];

      return {
        type,
        title: CHALLENGE_TITLE_BY_TYPE[type],
        puzzleId: dailyPuzzleSet[type],
        reward: getRewardCoinsForType(type),
        status: getChallengeStatus(progress),
        progressValue: getChallengeProgressValue(progress),
        progress,
        palette: CHALLENGE_PALETTE_BY_TYPE[type],
      };
    });
  }, [dailyProgress, dailyPuzzleSet]);

  const completedCount = useMemo(
    () =>
      CHALLENGE_ORDER.filter((type) => dailyProgress[type].completed).length,
    [dailyProgress],
  );
  const claimedCount = useMemo(
    () => CHALLENGE_ORDER.filter((type) => dailyProgress[type].claimed).length,
    [dailyProgress],
  );
  const bonusProgressPercent = (completedCount / CHALLENGE_ORDER.length) * 100;
  const allCompleteBonusStatus =
    completedCount < CHALLENGE_ORDER.length
      ? `${completedCount}/3 completed`
      : claimedCount === CHALLENGE_ORDER.length
        ? "Bonus claimed"
        : "All complete";

  const handleClaimReward = useCallback(
    async (type: DailyChallengeType) => {
      if (claimingType) {
        return;
      }

      setClaimingType(type);

      try {
        const result = await claimReward(type);

        if (!result) {
          return;
        }

        setDailyProgress(result.progress);

        if (result.totalAwarded > 0) {
          addCoins(result.totalAwarded);
        }

        if (result.allCompleteBonus > 0) {
          setNotice(
            `${result.message} Complete all bonus +${result.allCompleteBonus} coins.`,
          );
        } else {
          setNotice(result.message);
        }
      } catch {
        setNotice("Unable to claim reward right now.");
      } finally {
        setClaimingType(null);
      }
    },
    [addCoins, claimingType],
  );

  const handleOpenChallengePuzzle = useCallback(
    (type: DailyChallengeType) => {
      if (!dailyPuzzleSet) {
        return;
      }

      navigation.navigate("Game", {
        levelId: dailyPuzzleSet[type],
        isDailyChallenge: true,
        challengeType: type,
      });
    },
    [dailyPuzzleSet, navigation],
  );

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Daily Challenges"
          themeColors={themeColors}
          leftAction={{
            icon: (
              <Ionicons color={themeColors.text} name="arrow-back" size={20} />
            ),
            onPress: () => navigation.goBack(),
          }}
        />

        {isUnlocked ? (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryLabel}>Daily Track</Text>
                <Text style={styles.summaryValue}>
                  {completedCount}/3 complete
                </Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.summaryBlock}>
                <Text style={styles.summaryLabel}>Claimed</Text>
                <Text style={styles.summaryValue}>
                  {claimedCount}/3 rewards
                </Text>
              </View>
            </View>

            {notice ? (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeText}>{notice}</Text>
              </View>
            ) : null}

            {isLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color={themeColors.text} size="small" />
                <Text style={styles.loadingText}>
                  Loading daily challenges...
                </Text>
              </View>
            ) : (
              <View style={styles.challengeList}>
                {cardModels.map((card) => (
                  <View key={card.type}>
                    <DailyChallengeCard
                      card={card}
                      claimLoading={claimingType === card.type}
                      isAnyClaiming={claimingType !== null}
                      onClaim={handleClaimReward}
                      styles={styles}
                    />

                    <CustomButton
                      fullWidth
                      label={`Play ${card.title}`}
                      onPress={() => handleOpenChallengePuzzle(card.type)}
                      style={styles.playButton}
                      variant="secondary"
                    />
                  </View>
                ))}

                <View style={styles.bonusCard}>
                  <View style={styles.bonusTopRow}>
                    <Text style={styles.bonusTitle}>
                      Complete all {"\u2192"} +{DAILY_ALL_COMPLETE_BONUS_COINS}{" "}
                      coins
                    </Text>

                    <Text style={styles.bonusStatus}>
                      {allCompleteBonusStatus}
                    </Text>
                  </View>

                  <View style={styles.bonusProgressTrack}>
                    <View
                      style={[
                        styles.bonusProgressFill,
                        { width: `${bonusProgressPercent}%` },
                      ]}
                    />
                  </View>
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.lockCard}>
            <Text style={styles.lockText}>
              {`\u{1F512} Unlock at Level ${DAILY_CHALLENGE_UNLOCK_LEVEL}`}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createDailyChallengeStyles(themeColors: {
  background: string;
  grid: string;
  text: string;
}) {
  const border = hexToRgba(themeColors.text, 0.16);
  const mutedText = hexToRgba(themeColors.text, 0.68);
  const noticeBackground = hexToRgba(themeColors.grid, 0.75);

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    contentContainer: {
      padding: 20,
      paddingBottom: 28,
      backgroundColor: themeColors.background,
    },
    summaryCard: {
      backgroundColor: themeColors.grid,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
    },
    summaryBlock: {
      flex: 1,
      minWidth: 0,
    },
    summaryDivider: {
      width: 1,
      alignSelf: "stretch",
      marginHorizontal: 16,
      backgroundColor: border,
    },
    summaryLabel: {
      color: mutedText,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    summaryValue: {
      color: themeColors.text,
      fontSize: 22,
      fontWeight: "900",
      marginTop: 8,
      flexShrink: 1,
    },
    noticeCard: {
      marginTop: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: noticeBackground,
    },
    noticeText: {
      color: themeColors.text,
      fontSize: 13,
      fontWeight: "900",
    },
    loadingCard: {
      marginTop: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: themeColors.grid,
      paddingVertical: 18,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    loadingText: {
      color: themeColors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    challengeList: {
      gap: 12,
      marginTop: 16,
    },
    challengeCardBase: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 16,
    },
    challengeTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "center",
    },
    challengeTitleWrap: {
      flex: 1,
      minWidth: 0,
    },
    challengeTitle: {
      color: themeColors.text,
      fontSize: 18,
      fontWeight: "800",
      flexShrink: 1,
    },
    challengeSubtitle: {
      color: mutedText,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 5,
    },
    rewardPill: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    rewardPillText: {
      color: COLORS.surface,
      fontSize: 12,
      fontWeight: "800",
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 12,
      gap: 6,
    },
    statusText: {
      fontSize: 13,
      fontWeight: "800",
    },
    statusNotStarted: {
      color: mutedText,
    },
    statusCompleted: {
      color: COLORS.warning,
    },
    statusClaimed: {
      color: COLORS.accentDark,
    },
    progressRow: {
      marginTop: 12,
    },
    progressTrack: {
      width: "100%",
      height: 8,
      borderRadius: 999,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
    },
    claimButton: {
      marginTop: 12,
    },
    playButton: {
      marginTop: 10,
    },
    bonusCard: {
      backgroundColor: themeColors.grid,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      padding: 16,
      marginTop: 4,
    },
    bonusTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    bonusTitle: {
      color: themeColors.text,
      fontSize: 15,
      fontWeight: "800",
      flex: 1,
    },
    bonusStatus: {
      color: COLORS.primaryDark,
      fontSize: 12,
      fontWeight: "800",
    },
    bonusProgressTrack: {
      marginTop: 12,
      width: "100%",
      height: 8,
      borderRadius: 999,
      backgroundColor: COLORS.primarySoft,
      overflow: "hidden",
    },
    bonusProgressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: COLORS.primary,
    },
    lockCard: {
      marginTop: 16,
      backgroundColor: themeColors.grid,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      padding: 16,
    },
    lockText: {
      color: themeColors.text,
      fontSize: 18,
      fontWeight: "800",
      textAlign: "center",
    },
  });
}
