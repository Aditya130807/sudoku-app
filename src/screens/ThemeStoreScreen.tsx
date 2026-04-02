import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "../components/CustomButton";
import Header from "../components/Header";
import { COLORS } from "../constants/colors";
import { type ThemeConfig, type ThemeId } from "../constants/themes";
import { useCoins } from "../context/CoinContext";
import { useAppTheme } from "../context/ThemeContext";
import { RootStackParamList } from "../navigation/types";
import { hexToRgba } from "../utils/colorUtils";

type Props = NativeStackScreenProps<RootStackParamList, "ThemeStore">;

type FeedbackTone = "success" | "error";
type ThemeCardState = "locked" | "unlocked" | "active";

interface FeedbackState {
  tone: FeedbackTone;
  message: string;
}

function getPriceLabel(price: number) {
  return price <= 0 ? "FREE" : `${price} coins`;
}

function getThemeCardState(
  themeId: ThemeId,
  activeThemeId: ThemeId,
  unlockedThemeIds: ThemeId[],
): ThemeCardState {
  if (activeThemeId === themeId) {
    return "active";
  }

  if (unlockedThemeIds.includes(themeId)) {
    return "unlocked";
  }

  return "locked";
}

function getActionLabel(theme: ThemeConfig, state: ThemeCardState) {
  if (state === "active") {
    return "ACTIVE";
  }

  if (state === "unlocked") {
    return "APPLY";
  }

  return `BUY ${theme.price} COINS`;
}

function getStatusLabel(state: ThemeCardState) {
  return state.toUpperCase();
}

export default function ThemeStoreScreen({ navigation }: Props) {
  const {
    activeTheme,
    activeThemeId,
    applyTheme,
    buyTheme,
    isHydrated,
    themes,
    unlockedThemeIds,
  } = useAppTheme();
  const { coins, isHydrated: isCoinHydrated } = useCoins();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeout = setTimeout(() => {
      setFeedback(null);
    }, 2600);

    return () => {
      clearTimeout(timeout);
    };
  }, [feedback]);

  const pushFeedback = (tone: FeedbackTone, message: string) => {
    setFeedback({
      tone,
      message,
    });
  };

  const handlePurchase = async (theme: ThemeConfig) => {
    const result = await buyTheme(theme.id);
    pushFeedback(result.ok ? "success" : "error", result.message);
  };

  const handleApply = async (theme: ThemeConfig) => {
    const result = await applyTheme(theme.id);
    pushFeedback(result.ok ? "success" : "error", result.message);
  };

  const handleThemeAction = (theme: ThemeConfig) => {
    if (!isHydrated || !isCoinHydrated) {
      pushFeedback("error", "Loading your wallet and saved themes...");
      return;
    }

    const state = getThemeCardState(theme.id, activeThemeId, unlockedThemeIds);

    if (state === "active") {
      pushFeedback("success", `${theme.name} is already active.`);
      return;
    }

    if (state === "locked") {
      if (coins < theme.price) {
        pushFeedback("error", "Not enough coins.");
        return;
      }

      Alert.alert(
        "Spend coins",
        `Unlock ${theme.name} for ${theme.price} coins? The theme will apply instantly after purchase.`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: `Buy ${theme.price}`,
            onPress: () => {
              void handlePurchase(theme);
            },
          },
        ],
      );
      return;
    }

    void handleApply(theme);
  };

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[
        styles.safeArea,
        { backgroundColor: activeTheme.colors.background },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.contentContainer,
          { backgroundColor: activeTheme.colors.background },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Theme Store"
          subtitle={`Active theme: ${activeTheme.name}`}
          themeColors={activeTheme.colors}
          leftAction={{
            icon: (
              <Ionicons
                color={activeTheme.colors.text}
                name="arrow-back"
                size={20}
              />
            ),
            onPress: () => navigation.goBack(),
          }}
        />

        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: activeTheme.colors.grid,
              borderColor: hexToRgba(activeTheme.colors.text, 0.14),
            },
          ]}
        >
          <View style={styles.summaryBlock}>
            <Text
              style={[
                styles.summaryLabel,
                { color: hexToRgba(activeTheme.colors.text, 0.65) },
              ]}
            >
              Active
            </Text>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[styles.summaryValue, { color: activeTheme.colors.text }]}
            >
              {activeTheme.name}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryBlock}>
            <Text
              style={[
                styles.summaryLabel,
                { color: hexToRgba(activeTheme.colors.text, 0.65) },
              ]}
            >
              Unlocked
            </Text>
            <Text
              style={[styles.summaryValue, { color: activeTheme.colors.text }]}
            >
              {unlockedThemeIds.length}/{themes.length}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryBlock}>
            <Text
              style={[
                styles.summaryLabel,
                { color: hexToRgba(activeTheme.colors.text, 0.65) },
              ]}
            >
              Coins
            </Text>
            <Text
              style={[styles.summaryValue, { color: activeTheme.colors.text }]}
            >
              {isCoinHydrated ? coins : 0}
            </Text>
          </View>
        </View>

        <Text style={styles.summaryCaption}>
          Theme purchases now spend coins and auto-apply the new look
          immediately.
        </Text>

        {feedback ? (
          <View
            style={[
              styles.feedbackCard,
              feedback.tone === "error"
                ? styles.feedbackError
                : styles.feedbackSuccess,
            ]}
          >
            <Text
              style={[
                styles.feedbackText,
                feedback.tone === "error"
                  ? styles.feedbackTextError
                  : styles.feedbackTextSuccess,
              ]}
            >
              {feedback.message}
            </Text>
          </View>
        ) : null}

        <View style={styles.themeGrid}>
          {themes.map((theme) => {
            const state = getThemeCardState(
              theme.id,
              activeThemeId,
              unlockedThemeIds,
            );
            const isActive = state === "active";
            const hasEnoughCoins = coins >= theme.price;
            const showInsufficientState =
              state === "locked" && isCoinHydrated && !hasEnoughCoins;

            return (
              <View
                key={theme.id}
                style={[
                  styles.themeCard,
                  isActive
                    ? [
                        styles.themeCardActive,
                        {
                          borderColor: theme.colors.text,
                          shadowColor: hexToRgba(theme.colors.text, 0.28),
                        },
                      ]
                    : null,
                  showInsufficientState ? styles.themeCardInsufficient : null,
                ]}
              >
                <View style={styles.previewPanel}>
                  <Image
                    source={theme.previewImage}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />

                  {isActive ? (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>ACTIVE</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.themeContent}>
                  <Text
                    adjustsFontSizeToFit
                    numberOfLines={1}
                    style={styles.themeName}
                  >
                    {theme.name}
                  </Text>

                  <View style={styles.swatchRow}>
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: theme.colors.background },
                      ]}
                    />
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: theme.colors.grid },
                      ]}
                    />
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: theme.colors.text },
                      ]}
                    />
                  </View>

                  <View style={styles.detailsSection}>
                    <View style={styles.statusRow}>
                      <Text style={styles.metaLabel}>Status</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          state === "active"
                            ? styles.statusBadgeActive
                            : state === "unlocked"
                              ? styles.statusBadgeUnlocked
                              : styles.statusBadgeLocked,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            state === "active"
                              ? styles.statusTextActive
                              : state === "unlocked"
                                ? styles.statusTextUnlocked
                                : styles.statusTextLocked,
                          ]}
                        >
                          {getStatusLabel(state)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.priceSection}>
                      <Text style={styles.metaLabel}>Price</Text>
                      <Text style={styles.priceText}>
                        {getPriceLabel(theme.price)}
                      </Text>
                      {showInsufficientState ? (
                        <Text style={styles.insufficientText}>
                          Need {theme.price - coins} more coins
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                <CustomButton
                  fullWidth
                  disabled={!isHydrated || !isCoinHydrated || isActive}
                  label={getActionLabel(theme, state)}
                  onPress={() => handleThemeAction(theme)}
                  style={styles.cardButton}
                  variant={
                    isActive
                      ? "success"
                      : state === "unlocked"
                        ? "primary"
                        : "secondary"
                  }
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 28,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  summaryBlock: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 8,
  },
  summaryCaption: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  feedbackCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  feedbackError: {
    backgroundColor: COLORS.dangerSoft,
  },
  feedbackSuccess: {
    backgroundColor: COLORS.primarySoft,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: "700",
  },
  feedbackTextError: {
    color: COLORS.danger,
  },
  feedbackTextSuccess: {
    color: COLORS.primaryDark,
  },
  themeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  themeCard: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  themeCardActive: {
    shadowOpacity: 0.18,
  },
  themeCardInsufficient: {
    borderColor: COLORS.danger,
  },
  previewPanel: {
    borderRadius: 16,
    overflow: "hidden",
    justifyContent: "center",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: 110,
    borderRadius: 14,
  },
  currentBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currentBadgeText: {
    color: COLORS.accentDark,
    fontSize: 12,
    fontWeight: "800",
  },
  themeContent: {
    marginTop: 14,
  },
  themeName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    flexShrink: 1,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailsSection: {
    marginTop: 10,
    backgroundColor: COLORS.backgroundMuted,
    borderRadius: 18,
    padding: 12,
    gap: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  priceSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  metaLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeLocked: {
    backgroundColor: COLORS.surfaceAlt,
  },
  statusBadgeUnlocked: {
    backgroundColor: COLORS.primarySoft,
  },
  statusBadgeActive: {
    backgroundColor: COLORS.accentSoft,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },
  statusTextLocked: {
    color: COLORS.textMuted,
  },
  statusTextUnlocked: {
    color: COLORS.primaryDark,
  },
  statusTextActive: {
    color: COLORS.accentDark,
  },
  priceText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 6,
  },
  insufficientText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  cardButton: {
    marginTop: 14,
    borderRadius: 18,
    minHeight: 50,
  },
});
