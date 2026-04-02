import React, { useCallback } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { COLORS, DIFFICULTY_COLORS } from "../constants/colors";
import { LevelDefinition, LevelProgress } from "../game/types";
import { onButtonPress } from "../utils/feedback";

interface LevelCardProps {
  level: LevelDefinition;
  progress: LevelProgress;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

function getStatusLabel(progress: LevelProgress): string {
  if (progress.status === "completed") {
    return "Completed";
  }

  if (progress.status === "in_progress") {
    return "In Progress";
  }

  if (progress.status === "unlocked") {
    return "Unlocked";
  }

  return "Locked";
}

export default function LevelCard({
  level,
  progress,
  onPress,
  style,
}: LevelCardProps) {
  const locked = progress.status === "locked";
  const handlePress = useCallback(() => {
    void onButtonPress();
    onPress();
  }, [onPress]);

  return (
    <Pressable
      disabled={locked}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: DIFFICULTY_COLORS[level.tier],
          opacity: locked ? 0.55 : 1,
        },
        pressed && !locked && styles.pressed,
        style,
      ]}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.levelName}>Level {level.id}</Text>
          <Text style={styles.title}>{level.title}</Text>
        </View>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: DIFFICULTY_COLORS[level.tier],
            },
          ]}
        >
          <Text style={styles.badgeText}>{level.tier}</Text>
        </View>
      </View>

      <Text style={styles.description}>{level.description}</Text>

      <View style={styles.infoRow}>
        <Text style={styles.meta}>{level.size}x{level.size}</Text>
        <Text style={styles.meta}>{level.targetClues} clues</Text>
        <Text style={styles.meta}>{level.hintLimit} hints</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.status}>{getStatusLabel(progress)}</Text>
        <Text style={styles.stars}>Stars {progress.stars}/3</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "84%",
    borderWidth: 2,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    padding: 18,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 3,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  levelName: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginLeft: 10, // 🔥 ADD THIS
  },
  badgeText: {
    color: COLORS.surface,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  description: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  infoRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 16,
  },
  meta: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
  },
  status: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  stars: {
    color: COLORS.accentDark,
    fontSize: 13,
    fontWeight: "800",
  },
});
