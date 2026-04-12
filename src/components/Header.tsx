import React, { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "../constants/colors";
import type { ThemeColors } from "../constants/themes";
import { useCoins } from "../context/CoinContext";
import { hexToRgba } from "../utils/colorUtils";
import { onButtonPress } from "../utils/feedback";
import CoinIcon from "./CoinIcon";

interface HeaderAction {
  icon?: ReactNode;
  label?: string;
  onPress: () => void;
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: HeaderAction;
  rightAction?: HeaderAction;
  themeColors?: ThemeColors;
}

function CoinBalance({ themeColors }: { themeColors?: ThemeColors }) {
  const { coins, isHydrated } = useCoins();
  const backgroundColor = themeColors?.grid ?? COLORS.surface;
  const borderColor = themeColors?.text
    ? hexToRgba(themeColors.text, 0.2)
    : COLORS.border;
  const textColor = themeColors?.text ?? COLORS.text;

  return (
    <View
      style={[
        styles.coinBalance,
        {
          backgroundColor,
          borderColor,
        },
      ]}
    >
      <CoinIcon size={16} />
      <Text
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[styles.coinBalanceText, { color: textColor }]}
      >
        {isHydrated ? coins : "..."}
      </Text>
    </View>
  );
}

function ActionButton({
  action,
  themeColors,
}: {
  action?: HeaderAction;
  themeColors?: ThemeColors;
}) {
  if (!action) {
    return null;
  }

  const buttonBackground = themeColors?.grid ?? COLORS.surface;
  const buttonBorder = themeColors?.text
    ? hexToRgba(themeColors.text, 0.2)
    : COLORS.border;
  const labelColor = themeColors?.text ?? COLORS.text;
  const handlePress = () => {
    void onButtonPress();
    action.onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.actionButton,
        {
          backgroundColor: buttonBackground,
          borderColor: buttonBorder,
        },
      ]}
    >
      {action.icon}
      {action.label ? (
        <Text
          adjustsFontSizeToFit
          numberOfLines={1}
          style={[styles.actionLabel, { color: labelColor }]}
        >
          {action.label}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function Header({
  title,
  subtitle,
  leftAction,
  rightAction,
  themeColors,
}: HeaderProps) {
  const titleColor = themeColors?.text ?? COLORS.text;
  const subtitleColor = themeColors?.text
    ? hexToRgba(themeColors.text, 0.65)
    : COLORS.textMuted;

  return (
    <View style={styles.container}>
      <View style={styles.leftGroup}>
        <ActionButton action={leftAction} themeColors={themeColors} />
        <View style={styles.titleWrap}>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.title, { color: titleColor }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[styles.subtitle, { color: subtitleColor }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rightGroup}>
        <CoinBalance themeColors={themeColors} />
        {rightAction ? (
          <ActionButton action={rightAction} themeColors={themeColors} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  leftGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
  },
  rightGroup: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    flexShrink: 1,
  },
  actionButton: {
    minWidth: 40,
    minHeight: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    flexDirection: "row",
  },
  coinBalance: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  coinBalanceText: {
    fontSize: 13,
    fontWeight: "800",
    flexShrink: 1,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
    flexShrink: 1,
  },
});
