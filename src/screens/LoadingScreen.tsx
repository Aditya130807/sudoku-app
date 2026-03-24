import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { COLORS } from "../constants/colors";

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      {/* App Name */}
      <Text style={styles.title}>
        <Text style={{ color: COLORS.primary }}>Sudoku</Text>{" "}
        <Text style={{ color: COLORS.accent }}>Ryve</Text>
      </Text>

      {/* Loader */}
      <ActivityIndicator size="large" color={COLORS.primary} />

      {/* Subtitle */}
      <Text style={styles.subtitle}>Preparing your puzzle...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 20,
  },

  subtitle: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
});