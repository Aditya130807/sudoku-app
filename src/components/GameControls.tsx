import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

import { COLORS } from "../constants/colors";
import CustomButton from "./CustomButton";

interface GameControlsProps {
  onErase: () => void;
  onReset: () => void;
  onHint: () => void;
  onGuide: () => void;
  disableActions?: boolean;
  disableHint?: boolean;
}

export default function GameControls({
  onErase,
  onReset,
  onHint,
  onGuide,
  disableActions = false,
  disableHint = false,
}: GameControlsProps) {
  return (
    <View style={styles.container}>
      <CustomButton
        label="Hint"
        variant="success"
        onPress={onHint}
        disabled={disableActions || disableHint}
        icon={<Ionicons color={COLORS.surface} name="bulb-outline" size={18} />}
        style={styles.control}
        labelStyle={styles.controlLabel}
      />
      <CustomButton
        label="Erase"
        variant="secondary"
        onPress={onErase}
        disabled={disableActions}
        icon={
          <Ionicons color={COLORS.primary} name="backspace-outline" size={16} />
        }
        style={styles.control}
        labelStyle={styles.controlLabel}
      />
      <CustomButton
        label="Guide"
        variant="ghost"
        onPress={onGuide}
        icon={
          <Ionicons color={COLORS.text} name="help-circle-outline" size={16} />
        }
        style={styles.control}
        labelStyle={styles.controlLabel}
      />
      <CustomButton
        label="Reset"
        variant="ghost"
        onPress={onReset}
        disabled={disableActions}
        icon={<Ionicons color={COLORS.text} name="refresh-outline" size={16} />}
        style={styles.control}
        labelStyle={styles.controlLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  control: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 8,
  },
  controlLabel: {
    fontSize: 11,
  },
});
