import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "../constants/colors";
import type { ThemeColors } from "../constants/themes";
import { hexToRgba } from "../utils/colorUtils";

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
  isCompleted: boolean;
  onPress: () => void;
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
  isCompleted,
  onPress,
  themeColors,
}: CellProps) {
  const textColor = themeColors?.text ?? COLORS.text;

  const backgroundColor = isIncorrect
    ? hexToRgba(COLORS.danger, 0.22)
    : isSelected
      ? "rgba(255, 200, 100, 0.3)"
      : isRelated
        ? "rgba(255, 200, 100, 0.12)"
        : isMatching
          ? hexToRgba(textColor, 0.1)
          : isCompleted
            ? hexToRgba(textColor, 0.08)
            : "transparent";

  const valueTextColor = !isIncorrect ? textColor : undefined;
  const notesTextColor = hexToRgba(textColor, 0.72);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.cell,
        {
          left,
          top,
          width: size,
          height: size,
          backgroundColor,
        },
      ]}
    >
      {value !== null ? (
        <View style={styles.contentWrap}>
          <Text
            style={[
              styles.value,
              isPrefilled && styles.prefilledValue,
              isSelected && styles.selectedValue,
              isIncorrect && styles.incorrectValue,
              valueTextColor ? { color: valueTextColor } : undefined,
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
              isSelected && styles.selectedNotes,
              notesTextColor ? { color: notesTextColor } : undefined,
              isSelected ? { color: textColor } : undefined,
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
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: "800",
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
  prefilledValue: {
    color: COLORS.text,
    fontWeight: "900",
  },
  selectedValue: {
    color: COLORS.primaryDark,
  },
  incorrectValue: {
    color: COLORS.danger,
  },
  emptyValue: {
    color: "transparent",
  },
});
