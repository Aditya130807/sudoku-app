import React, { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS } from "../constants/colors";

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
}

function ActionButton({ action }: { action?: HeaderAction }) {
  if (!action) {
    return <View style={styles.actionPlaceholder} />;
  }

  return (
    <Pressable onPress={action.onPress} style={styles.actionButton}>
      {action.icon}
      {action.label ? <Text style={styles.actionLabel}>{action.label}</Text> : null}
    </Pressable>
  );
}

export default function Header({
  title,
  subtitle,
  leftAction,
  rightAction,
}: HeaderProps) {
  return (
    <View style={styles.container}>
      <ActionButton action={leftAction} />
      <View style={styles.titleWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <ActionButton action={rightAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  titleWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  actionButton: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    flexDirection: "row",
  },
  actionPlaceholder: {
    width: 48,
    height: 48,
  },
  actionLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 6,
  },
});
