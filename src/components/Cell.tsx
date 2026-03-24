import React from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";

import { COLORS } from "../constants/colors";

interface CellProps {
  value: number | null;
  notes: number[];
  size: number;
  isPrefilled: boolean;
  isSelected: boolean;
  isRelated: boolean;
  isMatching: boolean;
  isIncorrect: boolean;
  isCompleted: boolean;
  borderStyle: ViewStyle;
  onPress: () => void;
}

export default function Cell({
  value,
  notes,
  size,
  isPrefilled,
  isSelected,
  isRelated,
  isMatching,
  isIncorrect,
  isCompleted,
  borderStyle,
  onPress,
}: CellProps) {
  const backgroundColor = isIncorrect
    ? COLORS.dangerSoft
    : isSelected
      ? COLORS.primarySoft
      : isCompleted
        ? COLORS.accentSoft
        : isMatching
          ? COLORS.backgroundMuted
          : isRelated
            ? COLORS.surfaceAlt
            : COLORS.surface;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.cell,
        borderStyle,
        {
          width: size,
          height: size,
          backgroundColor,
        },
      ]}
    >
      {value !== null ? (
        <Text
          style={[
            styles.value,
            isPrefilled && styles.prefilledValue,
            isSelected && styles.selectedValue,
            isIncorrect && styles.incorrectValue,
          ]}
        >
          {value}
        </Text>
      ) : (
        <Text
          style={[
            styles.notes,
            notes.length === 0 && styles.emptyValue,
            isSelected && styles.selectedNotes,
          ]}
        >
          {[
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
          ]
            .map((row) =>
              row.map((digit) => (notes.includes(digit) ? `${digit}` : " ")).join(" ")
            )
            .join("\n")}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: "center",
    justifyContent: "center",
    borderColor: COLORS.border,
  },
  value: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: "700",
  },
  notes: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 11,
    textAlign: "center",
    letterSpacing: 0.2,
    paddingHorizontal: 2,
  },
  selectedNotes: {
    color: COLORS.primaryDark,
  },
  prefilledValue: {
    color: COLORS.text,
    fontWeight: "800",
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
