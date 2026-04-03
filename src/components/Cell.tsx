import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "../constants/colors";
import type { ThemeColors, ThemeId } from "../constants/themes";
import { hexToRgba } from "../utils/colorUtils";
import { onButtonPress } from "../utils/feedback";

const themeTextColors: Record<ThemeId, { fixed: string; user: string }> = {
  classic: {
    fixed: "#1A1A1A",
    user: "#14B8A6",
  },
  volcanic: {
    fixed: "#1A1A1A",
    user: "#FB923C",
  },
  slime: {
    fixed: "#1A1A1A",
    user: "#14B8A6",
  },
  wood: {
    fixed: "#170502",
    user: "#663209",
  },
  ice: {
    fixed: "#000E24",
    user: "#1C4D8B",
  },
};

interface CellProps {
  value: number | null;
  notes: number[];
  size: number;
  left: number;
  top: number;
  isPrefilled: boolean;
  isSelected: boolean;
  isRelated: boolean;
  isMatching: boolean;
  isIncorrect: boolean;
  isHintHighlighted: boolean;
  isHintError: boolean;
  isLineComplete: boolean;
  correctColor: string;
  onPress: () => void;
  themeId?: ThemeId;
  themeColors?: ThemeColors;
}

export default function Cell({
  value,
  notes,
  size,
  left,
  top,
  isPrefilled,
  isSelected,
  isRelated,
  isMatching,
  isIncorrect,
  isHintHighlighted,
  isHintError,
  isLineComplete,
  correctColor,
  onPress,
  themeId,
  themeColors,
}: CellProps) {
  const textColor = themeColors?.text ?? COLORS.text;
  const colors = themeTextColors[themeId ?? "classic"];
  const isFixed = isPrefilled;
  const handlePress = useCallback(() => {
    if (isFixed) {
      return;
    }

    void onButtonPress();
    onPress();
  }, [isFixed, onPress]);

  const showHintError = isHintError;
  const showHintHighlight = !showHintError && isHintHighlighted;
  const showCompleted = !showHintError && !showHintHighlight && isLineComplete;
  const showSelected =
    !showHintError && !showHintHighlight && !showCompleted && isSelected;
  const showSameNumber =
    !showHintError &&
    !showHintHighlight &&
    !showCompleted &&
    !showSelected &&
    isMatching;

  let backgroundColor = "transparent";
  let borderColor = "transparent";
  let borderWidth = 0;

  if (showHintError) {
    backgroundColor = hexToRgba(COLORS.danger, 0.2);
    borderColor = COLORS.danger;
    borderWidth = 2;
  } else if (showHintHighlight) {
    backgroundColor = hexToRgba("#22C55E", 0.12);
    borderColor = "#22C55E";
    borderWidth = 2;
  } else if (showCompleted) {
    backgroundColor = hexToRgba(correctColor, 0.12);
    borderColor = correctColor;
    borderWidth = 2;
  } else if (isIncorrect) {
    backgroundColor = hexToRgba(COLORS.danger, 0.22);
  } else if (showSelected) {
    backgroundColor = "rgba(255, 200, 100, 0.3)";
  } else if (isRelated) {
    backgroundColor = "rgba(255, 200, 100, 0.12)";
  } else if (showSameNumber) {
    backgroundColor = hexToRgba(textColor, 0.1);
  }

  if (backgroundColor === "transparent" && isFixed) {
    backgroundColor = hexToRgba(textColor, 0.04);
  }

  const resolvedCellStyle = {
    left,
    top,
    width: size,
    height: size,
    backgroundColor,
    borderColor,
    borderWidth,
    opacity: showCompleted || showHintHighlight ? 0.98 : 1,
  };

  const notesTextColor = hexToRgba(textColor, 0.72);

  return (
    <Pressable
      disabled={isFixed}
      onPress={handlePress}
      style={[styles.cell, resolvedCellStyle]}
    >
      {value !== null ? (
        <View style={styles.contentWrap}>
          <Text
            style={[
              styles.value,
              {
                color: isFixed ? colors.fixed : colors.user,
                fontWeight: isFixed ? "700" : "500",
              },
            ]}
          >
            {value}
          </Text>
        </View>
      ) : (
        <View style={styles.contentWrap}>
          <Text
            style={[
              styles.notes,
              notes.length === 0 && styles.emptyValue,
              showSelected && styles.selectedNotes,
              notesTextColor ? { color: notesTextColor } : undefined,
              showSelected ? { color: textColor } : undefined,
            ]}
          >
            {[
              [1, 2, 3],
              [4, 5, 6],
              [7, 8, 9],
            ]
              .map((row) =>
                row
                  .map((digit) => (notes.includes(digit) ? `${digit}` : " "))
                  .join(" "),
              )
              .join("\n")}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    margin: 0,
    padding: 0,
  },
  contentWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: 20,
    textAlign: "center",
    includeFontPadding: false,
  },
  notes: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 11,
    textAlign: "center",
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
  selectedNotes: {
    color: COLORS.primaryDark,
  },
  emptyValue: {
    color: "transparent",
  },
});
