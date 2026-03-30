import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "../components/CustomButton";
import Header from "../components/Header";
import { COLORS } from "../constants/colors";
import { useDailyChallenges } from "../context/DailyChallengeContext";
import { useAppTheme } from "../context/ThemeContext";
import { RootStackParamList } from "../navigation/types";
import {
  DAILY_CHALLENGE_UNLOCK_LEVEL,
} from "../services/dailyChallengeService";
import { gameService } from "../services/gameService";
import { hexToRgba } from "../utils/colorUtils";

type Props = NativeStackScreenProps<RootStackParamList, "DailyChallenges">;

export default function DailyChallengeScreen({ navigation }: Props) {
  const { activeTheme } = useAppTheme();
  const { challenges, isHydrated, streakCount } = useDailyChallenges();
  const themeColors = activeTheme.colors;
  const styles = useMemo(
    () => createDailyChallengeStyles(themeColors),
    [themeColors]
  );
  const userLevel = gameService.getNextPlayableLevelId();
  const isUnlocked = userLevel >= DAILY_CHALLENGE_UNLOCK_LEVEL;
  const availableReward = challenges
    .filter((challenge) => !challenge.claimed)
    .reduce((rewardSum, challenge) => rewardSum + challenge.reward, 0);

  const openRecommendedGame = (challengeId: string, levelId?: number) => {
    if (challengeId === "featured_daily_board" && levelId) {
      navigation.navigate("Game", { levelId });
      return;
    }

    navigation.navigate("Game", {
      levelId: gameService.getNextPlayableLevelId(),
    });
  };

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
            icon: <Ionicons color={themeColors.text} name="arrow-back" size={20} />,
            onPress: () => navigation.goBack(),
          }}
        />

        {isUnlocked ? (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryLabel}>Streak</Text>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={styles.summaryValue}
                >
                  {streakCount} days
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryBlock}>
                <Text style={styles.summaryLabel}>Reward</Text>
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={styles.summaryValue}
                >
                  {isHydrated ? `${availableReward} coins` : "..."}
                </Text>
              </View>
            </View>

            <View style={styles.challengeList}>
              {challenges.map((challenge) => {
                const actionLabel = challenge.claimed
                  ? "Claimed"
                  : challenge.actionLabel;

                return (
                  <View key={challenge.id} style={styles.challengeCard}>
                    <View style={styles.challengeHeader}>
                      <View style={styles.challengeCopy}>
                        <Text
                          adjustsFontSizeToFit
                          numberOfLines={1}
                          style={styles.challengeTitle}
                        >
                          {challenge.title}
                        </Text>
                      </View>

                      <View style={styles.rewardBadge}>
                        <Text style={styles.rewardBadgeText}>+{challenge.reward}</Text>
                      </View>
                    </View>

                    <CustomButton
                      fullWidth
                      disabled={challenge.claimed}
                      label={actionLabel}
                      onPress={() =>
                        openRecommendedGame(challenge.id, challenge.levelId)
                      }
                      style={styles.challengeButton}
                      variant={challenge.claimed ? "success" : "primary"}
                    />
                  </View>
                );
              })}
            </View>
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

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    contentContainer: {
      padding: 20,
      paddingBottom: 28,
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
      fontSize: 24,
      fontWeight: "900",
      marginTop: 8,
      flexShrink: 1,
    },
    challengeList: {
      gap: 12,
      marginTop: 16,
    },
    challengeCard: {
      backgroundColor: themeColors.grid,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: border,
      padding: 16,
    },
    challengeHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "center",
    },
    challengeCopy: {
      flex: 1,
      minWidth: 0,
    },
    challengeTitle: {
      color: themeColors.text,
      fontSize: 18,
      fontWeight: "800",
      flexShrink: 1,
    },
    rewardBadge: {
      backgroundColor: COLORS.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    rewardBadgeText: {
      color: COLORS.primaryDark,
      fontSize: 12,
      fontWeight: "800",
    },
    challengeButton: {
      marginTop: 12,
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
