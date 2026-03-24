import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "../constants/colors";

interface NumberPadProps {
  symbols: number[];
  remainingCounts: Record<number, number>;
  selectedValue: number | null;
  onPressValue: (value: number) => void;
  disabled?: boolean;
}

export default function NumberPad({
  symbols,
  remainingCounts,
  selectedValue,
  onPressValue,
  disabled = false,
}: NumberPadProps) {
  return (
    <View style={styles.container}>
      {symbols.map((value) => {
        const exhausted = (remainingCounts[value] ?? 0) === 0;

        return (
          <Pressable
            disabled={disabled}
            key={value}
            onPress={() => onPressValue(value)}
            style={({ pressed }) => [
              styles.button,
              selectedValue === value && styles.buttonSelected,
              exhausted && styles.buttonExhausted,
              pressed && !disabled && styles.buttonPressed,
              disabled && styles.buttonDisabled,
            ]}
          >
            <Text
              style={[
                styles.value,
                selectedValue === value && styles.valueSelected,
              ]}
            >
              {value}
            </Text>
            <Text style={styles.remaining}>{remainingCounts[value] ?? 0} left</Text>
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
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
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
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
  },
  valueSelected: {
    color: COLORS.surface,
  },
  remaining: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
});
