import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import {
  Alert,
  NativeModules,
  Platform,
  Pressable,
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
import { getLevelDefinition, TOTAL_LEVELS } from "../constants/levels";
import { useCoins } from "../context/CoinContext";
import { useDailyChallenges } from "../context/DailyChallengeContext";
import { useAppTheme } from "../context/ThemeContext";
import { navigationRef } from "../navigation/navigationRef";
import { RootStackParamList } from "../navigation/types";
import {
  bannerAdsEnabled,
  bannerAdUnitId,
  initializeAds,
  isRewardedLoaded,
  preloadRewardedAd,
  rewardedAdsEnabled,
  showRewardedAd,
  subscribeRewardedAdState,
} from "../services/adService";
import { DAILY_CHALLENGE_UNLOCK_LEVEL } from "../services/dailyChallengeService";
import { gameService } from "../services/gameService";
import { useGameStore } from "../store/gameStore";
import { shouldEncourageLogin, useUserStore } from "../store/userStore";
import {
  getDifficultyLabel,
  getMotivationalMessage,
} from "../utils/motivation";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;
const BONUS_REWARDED_AD_COINS = 20;

let BannerAdComponent: any = null;
let bannerAdaptiveSize: any = null;

if (NativeModules.RNGoogleMobileAdsModule) {
  try {
    const adsModule =
      require("react-native-google-mobile-ads") as typeof import("react-native-google-mobile-ads");
    BannerAdComponent = adsModule.BannerAd;
    bannerAdaptiveSize = adsModule.BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
  } catch {
    BannerAdComponent = null;
    bannerAdaptiveSize = null;
  }
}

export default function HomeScreen({ navigation }: Props) {
  const isFocused = useIsFocused();
  const { activeTheme, unlockedThemeIds } = useAppTheme();
  const { addCoins, coins, isHydrated: isCoinHydrated } = useCoins();
  const { challenges, streakCount } = useDailyChallenges();
  const progress = useGameStore((state) => state.progress);
  const activeGame = useGameStore((state) => state.activeGame);
  const isGameStateHydrated = useGameStore(
    (state) => state.isGameStateHydrated,
  );
  const user = useUserStore((state) => state);
  const completedLevels = Object.values(progress).filter(
    (entry) => entry.status === "completed",
  ).length;
  const totalStars = Object.values(progress).reduce(
    (sum, entry) => sum + entry.stars,
    0,
  );
  const nextLevel = getLevelDefinition(gameService.getNextPlayableLevelId());
  const userLevel = nextLevel.id;
  const completionPercent = Math.round((completedLevels / TOTAL_LEVELS) * 100);
  const difficultyLabel = getDifficultyLabel(nextLevel.tier);
  const dailyChallengeUnlocked = userLevel >= DAILY_CHALLENGE_UNLOCK_LEVEL;
  const pendingDailyRewards = challenges
    .filter((challenge) => !challenge.claimed)
    .reduce((rewardSum, challenge) => rewardSum + challenge.reward, 0);
  const motivationalMessage = getMotivationalMessage({
    levelId: nextLevel.id,
    tier: nextLevel.tier,
    completedLevels,
    totalLevels: TOTAL_LEVELS,
    totalStars,
  });
  const encourageLogin = shouldEncourageLogin(user);
  const isGuest = user.mode === "guest" || !user.uid;
  const [isRewardAdLoading, setIsRewardAdLoading] = useState(false);
  const [isRewardedAdReady, setIsRewardedAdReady] = useState(isRewardedLoaded);
  const [rewardNotice, setRewardNotice] = useState<string | null>(null);
  const [isNavigationReady, setIsNavigationReady] = useState(() =>
    navigationRef.isReady(),
  );
  const hasResumablePuzzle =
    isGameStateHydrated && activeGame?.status === "playing";

  useEffect(() => {
    return subscribeRewardedAdState(setIsRewardedAdReady);
  }, []);

  useEffect(() => {
    if (navigationRef.isReady()) {
      setIsNavigationReady(true);
      return;
    }

    const unsubscribe = navigationRef.addListener("state", () => {
      if (navigationRef.isReady()) {
        setIsNavigationReady(true);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isFocused || !rewardedAdsEnabled || isRewardedAdReady) {
      return;
    }

    if (!isNavigationReady || !navigationRef.isReady()) {
      return;
    }

    let isDisposed = false;

    const loadRewardedAdSafely = async () => {
      try {
        await initializeAds();

        if (isDisposed) {
          return;
        }

        await preloadRewardedAd();
      } catch (error) {}
    };

    void loadRewardedAdSafely();

    return () => {
      isDisposed = true;
    };
  }, [isFocused, isNavigationReady, isRewardedAdReady]);

  useEffect(() => {
    if (!isFocused || !rewardedAdsEnabled || isRewardedAdReady) {
      return;
    }

    if (!isNavigationReady || !navigationRef.isReady()) {
      return;
    }

    const retry = setTimeout(() => {
      void (async () => {
        try {
          await initializeAds();
          await preloadRewardedAd();
        } catch (error) {}
      })();
    }, 1000);

    return () => {
      clearTimeout(retry);
    };
  }, [isFocused, isNavigationReady, isRewardedAdReady]);

  const handleWatchRewardedAd = async () => {
    if (
      !isFocused ||
      !isCoinHydrated ||
      isRewardAdLoading ||
      !isRewardedAdReady
    ) {
      return;
    }

    setIsRewardAdLoading(true);
    setRewardNotice(null);

    try {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 300);
      });

      if (!isFocused) {
        return;
      }

      const didEarnReward = await showRewardedAd();

      if (didEarnReward) {
        addCoins(BONUS_REWARDED_AD_COINS);
        setRewardNotice(
          `+${BONUS_REWARDED_AD_COINS} coins added to your wallet.`,
        );
      } else {
        setRewardNotice("No bonus granted because the ad did not complete.");
      }
    } catch {
      setRewardNotice(
        "Reward ad is not available right now. Please try again.",
      );
    } finally {
      setIsRewardAdLoading(false);
    }
  };

  const handleOpenDailyChallenges = () => {
    if (isGuest) {
      Alert.alert(
        "Login Required",
        "You need to be logged in to access Daily Challenges.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Login",
            onPress: () => navigation.navigate("AuthChoice"),
          },
        ],
      );
      return;
    }

    navigation.navigate("DailyChallenges");
  };

  const handleResumePuzzle = () => {
    if (!activeGame || activeGame.status !== "playing") {
      Alert.alert("No puzzle to resume");
      return;
    }

    navigation.navigate("Game", {
      levelId: activeGame.levelId,
    });
  };

  const handleStartNextLevel = () => {
    if (!isGameStateHydrated) {
      return;
    }

    navigation.navigate("Game", {
      levelId: nextLevel.id,
    });
  };

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[
        styles.safeArea,
        { backgroundColor: activeTheme.colors.background },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          { backgroundColor: activeTheme.colors.background },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Sudoku Ryve"
          subtitle={user.mode === "signed_in" ? "Signed in" : "Guest journey"}
          rightAction={{
            icon: (
              <Ionicons color={COLORS.text} name="settings-outline" size={20} />
            ),
            onPress: () => navigation.navigate("Settings"),
          }}
        />

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.heroEyebrow}
              >
                {user.mode === "signed_in" ? "Signed In" : "Guest Session"}
              </Text>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.heroTitle}
              >
                Welcome back, {user.displayName}.
              </Text>
            </View>
            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>
                {completionPercent}% clear
              </Text>
            </View>
          </View>

          <Text style={styles.heroSubtitle}>
            Your next puzzle is Level {nextLevel.id}, {nextLevel.title}. Keep
            the flow going and push your star total higher.
          </Text>

          <View style={styles.heroActions}>
            {hasResumablePuzzle ? (
              <CustomButton
                label="Resume Puzzle"
                onPress={handleResumePuzzle}
                icon={<Ionicons color={COLORS.surface} name="play" size={18} />}
                style={styles.heroButton}
              />
            ) : (
              <CustomButton
                disabled={!isGameStateHydrated}
                label={isGameStateHydrated ? "Play Next Level" : "Loading..."}
                onPress={handleStartNextLevel}
                icon={<Ionicons color={COLORS.surface} name="play" size={18} />}
                style={styles.heroButton}
              />
            )}
            <CustomButton
              label="Open Level Map"
              variant="secondary"
              onPress={() => navigation.navigate("LevelMap")}
              icon={
                <Ionicons color={COLORS.primary} name="map-outline" size={18} />
              }
              style={styles.heroButton}
            />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{completedLevels}</Text>
            <Text style={styles.statLabel}>Levels cleared</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalStars}</Text>
            <Text style={styles.statLabel}>Stars earned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{TOTAL_LEVELS}</Text>
            <Text style={styles.statLabel}>Total stages</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Wallet</Text>
          <View style={styles.coinHeadlineRow}>
            {isCoinHydrated ? <CoinIcon size={22} /> : null}
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={styles.infoHeadline}
            >
              {isCoinHydrated ? `${coins} ready` : "Loading wallet"}
            </Text>
          </View>
          <Text style={styles.infoBody}>
            Earn coins by playing daily challenges and watching ads.
          </Text>
        </View>

        {rewardedAdsEnabled ? (
          <View style={styles.rewardCard}>
            <Text style={styles.rewardTitle}>Bonus Coins</Text>
            <Text style={styles.rewardBody}>
              Watch one short ad to earn {BONUS_REWARDED_AD_COINS} coins. Daily
              challenges add even more rewards.
            </Text>
            <CustomButton
              disabled={
                !isCoinHydrated || isRewardAdLoading || !isRewardedAdReady
              }
              label={
                isRewardAdLoading
                  ? "Loading ad..."
                  : `Watch Ad +${BONUS_REWARDED_AD_COINS}`
              }
              onPress={() => {
                void handleWatchRewardedAd();
              }}
              style={styles.rewardButton}
            />
            {rewardNotice ? (
              <Text style={styles.rewardNotice}>{rewardNotice}</Text>
            ) : null}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("LevelMap")}
          style={({ pressed }) => [
            styles.infoCard,
            pressed ? { opacity: 0.9 } : null,
          ]}
        >
          <Text style={styles.infoTitle}>Current route</Text>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={styles.infoHeadline}
          >
            Level {nextLevel.id} | {difficultyLabel}
          </Text>
          <Text style={styles.routeMessage}>{motivationalMessage}</Text>
          <Text style={styles.infoBody}>
            {nextLevel.size}x{nextLevel.size} board | {nextLevel.hintLimit}{" "}
            hints
          </Text>
        </Pressable>

        {encourageLogin ? (
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>You are building momentum.</Text>
            <Text style={styles.loginBody}>
              Create an account to keep access to sign-in features and future
              progress sync improvements.
            </Text>
            <CustomButton
              label="Create Your Account"
              variant="success"
              onPress={() => navigation.navigate("AuthChoice")}
              icon={
                <Ionicons
                  color={COLORS.surface}
                  name="cloud-outline"
                  size={18}
                />
              }
            />
          </View>
        ) : null}

        <View style={styles.dailyCard}>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={styles.dailyTitle}
          >
            Daily Challenges
          </Text>
          {dailyChallengeUnlocked ? (
            <>
              <View style={styles.streakRow}>
                <View style={styles.streakBadge}>
                  <Text style={styles.streakText}>
                    Streak: {streakCount} days
                  </Text>
                </View>
              </View>
              <View style={styles.dailyRewardRow}>
                <Text style={styles.dailyRewardText}>Reward:</Text>
                <CoinIcon size={14} />
                <Text style={styles.dailyRewardText}>
                  {pendingDailyRewards}
                </Text>
              </View>
              <CustomButton
                label="Open Daily Challenges"
                onPress={handleOpenDailyChallenges}
                style={styles.dailyButton}
              />
            </>
          ) : (
            <View style={styles.dailyLockCard}>
              <Text style={styles.dailyLockedText}>
                {`\u{1F512} Unlock at Level ${DAILY_CHALLENGE_UNLOCK_LEVEL}`}
              </Text>
            </View>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("ThemeStore")}
          style={({ pressed }) => [
            styles.themeCard,
            pressed ? styles.themeCardPressed : null,
          ]}
        >
          <View style={styles.themeCardHeader}>
            <View style={styles.themeCardCopy}>
              <Text
                adjustsFontSizeToFit
                numberOfLines={1}
                style={styles.themeCardTitle}
              >
                Theme Store
              </Text>
              <Text numberOfLines={1} style={styles.themeCardSubtitle}>
                Spend coins on unlocks - {unlockedThemeIds.length} themes owned
              </Text>
            </View>
            <Ionicons
              color={COLORS.primary}
              name="color-palette-outline"
              size={22}
            />
          </View>

          <View style={styles.themeWalletRow}>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={styles.themeCardCurrent}
            >
              Current: {activeTheme.name}
            </Text>
            {isCoinHydrated ? (
              <View style={styles.themeWalletBadge}>
                <CoinIcon size={14} />
                <Text style={styles.themeWalletText}>{coins}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      </ScrollView>

      {Platform.OS !== "web" &&
      bannerAdsEnabled &&
      bannerAdUnitId &&
      BannerAdComponent &&
      bannerAdaptiveSize ? (
        <View
          style={[
            styles.bannerContainer,
            { backgroundColor: activeTheme.colors.background },
          ]}
        >
          <BannerAdComponent
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            size={bannerAdaptiveSize}
            unitId={bannerAdUnitId}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 20,
  },
  heroCard: {
    backgroundColor: COLORS.overlay,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    color: COLORS.accentSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  heroTitle: {
    color: COLORS.surface,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    marginTop: 10,
    flexShrink: 1,
  },
  progressBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  progressBadgeText: {
    color: COLORS.surface,
    fontSize: 12,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#DCE6F7",
    fontSize: 14,
    lineHeight: 22,
    marginTop: 14,
  },
  heroActions: {
    gap: 12,
    marginTop: 18,
  },
  heroButton: {
    width: "100%",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: "900",
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 6,
  },
  infoCard: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
    overflow: "hidden",
  },
  infoTitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  infoHeadline: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
    flexShrink: 1,
  },
  coinHeadlineRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  routeMessage: {
    marginTop: 12,
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 22,
  },
  infoBody: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  rewardCard: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rewardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  rewardBody: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  rewardButton: {
    marginTop: 12,
  },
  rewardNotice: {
    marginTop: 10,
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  loginCard: {
    marginTop: 16,
    backgroundColor: COLORS.accentSoft,
    borderRadius: 16,
    padding: 16,
  },
  loginTitle: {
    color: COLORS.accentDark,
    fontSize: 21,
    fontWeight: "900",
  },
  loginBody: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 16,
  },
  dailyCard: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dailyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    flexShrink: 1,
  },
  streakRow: {
    marginTop: 12,
  },
  streakBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.overlay,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  streakText: {
    color: COLORS.surface,
    fontSize: 13,
    fontWeight: "800",
  },
  dailyRewardText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  dailyRewardRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  dailyButton: {
    marginTop: 14,
  },
  dailyLockCard: {
    marginTop: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 16,
    padding: 16,
  },
  dailyLockedText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  themeCard: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  themeCardPressed: {
    opacity: 0.92,
  },
  themeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  themeCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  themeCardTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
    flexShrink: 1,
  },
  themeCardSubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  themeCardCurrent: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
  },
  themeWalletRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  themeWalletBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  themeWalletText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  bannerContainer: {
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: 8,
    paddingTop: 8,
  },
});
