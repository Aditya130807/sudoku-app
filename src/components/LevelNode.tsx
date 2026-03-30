import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { COLORS } from "../constants/colors";

export type LevelNodeState = "locked" | "available" | "current" | "completed";

interface LevelNodeProps {
  levelId: number;
  state: LevelNodeState;
  onPress: () => void;
}

const DIAMETERS: Record<Exclude<LevelNodeState, "available">, number> & {
  available: number;
} = {
  locked: 40,
  available: 40,
  current: 52,
  completed: 40,
};

export default function LevelNode({ levelId, state, onPress }: LevelNodeProps) {
  const disabled = state === "locked";
  const diameter = DIAMETERS[state];

  const theme = getTheme(state);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pressable,
        {
          opacity: disabled ? 0.6 : pressed && !disabled ? 0.9 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.node,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: theme.background,
            borderColor: theme.border,
          },
        ]}
      >
        {state === "completed" ? (
          <Ionicons name="checkmark" size={diameter * 0.38} color={theme.content} />
        ) : null}
        {state !== "completed" ? (
          <Text style={[styles.nodeText, { color: theme.content }]}>
            {levelId}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function getTheme(state: LevelNodeState) {
  switch (state) {
    case "current":
      return {
        background: COLORS.primary,
        border: COLORS.primary,
        content: COLORS.surface,
      };
    case "completed":
      return {
        background: COLORS.accent,
        border: COLORS.accent,
        content: COLORS.surface,
      };
    case "locked":
      return {
        background: COLORS.surfaceAlt,
        border: COLORS.border,
        content: COLORS.textMuted,
      };
    case "available":
    default:
      return {
        background: COLORS.surfaceAlt,
        border: COLORS.primary,
        content: COLORS.primary,
      };
  }
}

const styles = StyleSheet.create({
  pressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  node: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  nodeText: {
    fontSize: 14,
    fontWeight: "900",
  },
});

