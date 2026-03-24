import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "../components/CustomButton";
import Header from "../components/Header";
import { COLORS } from "../constants/colors";
import { getLevelDefinition, TOTAL_LEVELS } from "../constants/levels";
import { RootStackParamList } from "../navigation/types";
import { authService } from "../services/authService";
import { gameService } from "../services/gameService";
import { useGameStore } from "../store/gameStore";
import { shouldEncourageLogin, useUserStore } from "../store/userStore";
import { getDifficultyLabel, getMotivationalMessage } from "../utils/motivation";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const progress = useGameStore((state) => state.progress);
  const activeGame = useGameStore((state) => state.activeGame);
  const user = useUserStore((state) => state);
  const completedLevels = Object.values(progress).filter(
    (entry) => entry.status === "completed"
  ).length;
  const totalStars = Object.values(progress).reduce(
    (sum, entry) => sum + entry.stars,
    0
  );
  const nextLevel = getLevelDefinition(gameService.getNextPlayableLevelId());
  const completionPercent = Math.round((completedLevels / TOTAL_LEVELS) * 100);
  const difficultyLabel = getDifficultyLabel(nextLevel.tier);
  const motivationalMessage = getMotivationalMessage({
    levelId: nextLevel.id,
    tier: nextLevel.tier,
    completedLevels,
    totalLevels: TOTAL_LEVELS,
    totalStars,
  });
  const encourageLogin = shouldEncourageLogin(user);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Sudoku Ryve"
          subtitle={
            user.mode === "signed_in" ? "Preview account mode" : "Guest journey"
          }
          rightAction={{
            icon: <Ionicons color={COLORS.text} name="settings-outline" size={20} />,
            onPress: () => navigation.navigate("Settings"),
          }}
        />

        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroEyebrow}>
                {user.mode === "signed_in" ? "Account Preview" : "Guest Session"}
              </Text>
              <Text style={styles.heroTitle}>Welcome back, {user.displayName}.</Text>
            </View>
            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>{completionPercent}% clear</Text>
            </View>
          </View>

          <Text style={styles.heroSubtitle}>
            Your next puzzle is Level {nextLevel.id}, {nextLevel.title}. Keep the flow
            going and push your star total higher.
          </Text>

          <View style={styles.heroActions}>
            <CustomButton
              label={activeGame?.status === "playing" ? "Resume Puzzle" : "Play Next Level"}
              onPress={() =>
                navigation.navigate("Game", {
                  levelId:
                    activeGame?.status === "playing"
                      ? activeGame.levelId
                      : nextLevel.id,
                })
              }
              icon={<Ionicons color={COLORS.surface} name="play" size={18} />}
              style={styles.heroButton}
            />
            <CustomButton
              label="Open Level Map"
              variant="secondary"
              onPress={() => navigation.navigate("LevelMap")}
              icon={<Ionicons color={COLORS.primary} name="map-outline" size={18} />}
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

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("LevelMap")}
          style={({ pressed }) => [styles.infoCard, pressed ? { opacity: 0.9 } : null]}
        >
          <Text style={styles.infoTitle}>Current route</Text>
          <Text style={styles.infoHeadline}>
            Level {nextLevel.id} • {difficultyLabel}
          </Text>
          <Text style={styles.routeMessage}>{motivationalMessage}</Text>
          <Text style={styles.infoBody}>
            {nextLevel.size}x{nextLevel.size} board • {nextLevel.hintLimit} hints
          </Text>
        </Pressable>

        {encourageLogin ? (
          <View style={styles.loginCard}>
            <Text style={styles.loginTitle}>You are building momentum.</Text>
            <Text style={styles.loginBody}>
              Connect an account next to prepare for cloud sync and deeper performance
              tracking once auth goes live.
            </Text>
            <CustomButton
              label="Switch to Account Preview"
              variant="success"
              onPress={() => navigation.navigate("Login")}
              icon={<Ionicons color={COLORS.surface} name="cloud-outline" size={18} />}
            />
          </View>
        ) : null}

        <View style={styles.dailyCard}>
          <Text style={styles.dailyTitle}>Daily Challenge</Text>
          <Text style={styles.dailyBody}>
            Planned next: a fresh board every day and a community leaderboard snapshot.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: COLORS.overlay,
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
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
    borderRadius: 24,
    padding: 18,
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
    borderRadius: 24,
    padding: 20,
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
    marginTop: 8,
    lineHeight: 30,
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
  loginCard: {
    marginTop: 16,
    backgroundColor: COLORS.accentSoft,
    borderRadius: 24,
    padding: 20,
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
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.borderStrong,
  },
  dailyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  dailyBody: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
});
