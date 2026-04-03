import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../constants/colors";
import { useAppTheme } from "../context/ThemeContext";

interface LoadingScreenProps {
  subtitle?: string;
  showFallback?: boolean;
}

export default function LoadingScreen({
  subtitle = "Preparing your puzzle...",
  showFallback = false,
}: LoadingScreenProps) {
  const { activeTheme } = useAppTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: activeTheme.colors.background },
      ]}
    >
      {/* App Name */}
      <Text style={styles.title}>
        <Text style={{ color: COLORS.primary }}>Sudoku</Text>{" "}
        <Text style={{ color: COLORS.accent }}>Ryve</Text>
      </Text>

      {/* Loader */}
      <ActivityIndicator size="large" color={COLORS.primary} />

      {/* Subtitle */}
      <Text style={styles.subtitle}>{subtitle}</Text>

      {showFallback ? (
        <Text style={styles.fallbackMessage}>
          You can keep using the app while background sync finishes.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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

  fallbackMessage: {
    marginTop: 8,
    paddingHorizontal: 24,
    textAlign: "center",
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
