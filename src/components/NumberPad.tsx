import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "../constants/colors";
import type { ThemeColors } from "../constants/themes";
import { hexToRgba } from "../utils/colorUtils";
import { onButtonPress } from "../utils/feedback";

interface NumberPadProps {
  symbols: number[];
  remainingCounts: Record<number, number>;
  selectedValue: number | null;
  onPressValue: (value: number) => void;
  disabled?: boolean;
  themeColors?: ThemeColors;
}

export default function NumberPad({
  symbols,
  remainingCounts,
  selectedValue,
  onPressValue,
  disabled = false,
  themeColors,
}: NumberPadProps) {
  const backgroundColor = themeColors?.grid ?? COLORS.surface;
  const textColor = themeColors?.text ?? COLORS.text;
  const borderColor = hexToRgba(textColor, 0.2);
  const mutedTextColor = hexToRgba(textColor, 0.62);
  const handleValuePress = useCallback(
    (value: number) => {
      void onButtonPress();
      onPressValue(value);
    },
    [onPressValue],
  );

  return (
    <View style={styles.container}>
      {symbols.map((value) => {
        const exhausted = (remainingCounts[value] ?? 0) === 0;
        const isSelected = selectedValue === value;

        return (
          <Pressable
            disabled={disabled}
            key={value}
            onPress={() => handleValuePress(value)}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor,
                borderColor,
              },
              isSelected && {
                backgroundColor: textColor,
                borderColor: textColor,
              },
              exhausted && styles.buttonExhausted,
              pressed && !disabled && styles.buttonPressed,
              disabled && styles.buttonDisabled,
            ]}
          >
            <Text
              style={[
                styles.value,
                { color: isSelected ? backgroundColor : textColor },
              ]}
            >
              {value}
            </Text>
            <Text
              style={[
                styles.remaining,
                {
                  color: isSelected ? hexToRgba(backgroundColor, 0.74) : mutedTextColor,
                },
              ]}
            >
              {remainingCounts[value] ?? 0} left
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
  },
  button: {
    width: 74,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonExhausted: {
    opacity: 0.55,
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  value: {
    fontSize: 22,
    fontWeight: "800",
  },
  remaining: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
});
