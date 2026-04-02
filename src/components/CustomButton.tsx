import React, { ReactNode, useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { COLORS } from "../constants/colors";
import { onButtonPress } from "../utils/feedback";

type ButtonVariant = "primary" | "secondary" | "ghost" | "success";

interface CustomButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  isLoading?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

const variantStyles: Record<
  ButtonVariant,
  {
    container: ViewStyle;
    label: TextStyle;
  }
> = {
  primary: {
    container: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    label: {
      color: COLORS.surface,
    },
  },
  secondary: {
    container: {
      backgroundColor: COLORS.surface,
      borderColor: COLORS.primary,
    },
    label: {
      color: COLORS.primary,
    },
  },
  ghost: {
    container: {
      backgroundColor: "transparent",
      borderColor: COLORS.border,
    },
    label: {
      color: COLORS.text,
    },
  },
  success: {
    container: {
      backgroundColor: COLORS.accent,
      borderColor: COLORS.accent,
    },
    label: {
      color: COLORS.surface,
    },
  },
};

export default function CustomButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  fullWidth = false,
  icon,
  isLoading = false,
  style,
  labelStyle,
}: CustomButtonProps) {
  const handlePress = useCallback(() => {
    void onButtonPress();
    onPress();
  }, [onPress]);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || isLoading}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant].container,
        fullWidth && styles.fullWidth,
        (disabled || isLoading) && styles.disabled,
        pressed && !disabled && !isLoading && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={String(variantStyles[variant].label.color)}
          />
        ) : (
          <>
            {icon ? <View style={styles.icon}>{icon}</View> : null}
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[styles.label, variantStyles[variant].label, labelStyle]}
            >
              {label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  fullWidth: {
    width: "100%",
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    opacity: 0.45,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    marginRight: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
  },
});
