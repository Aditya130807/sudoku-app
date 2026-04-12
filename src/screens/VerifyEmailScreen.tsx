import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { signOut } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "../components/CustomButton";
import { COLORS } from "../constants/colors";
import { DEFAULT_THEME_ID, getThemeConfig } from "../constants/themes";
import { auth } from "../firebase";
import { RootStackParamList } from "../navigation/types";
import {
  authService,
  clearRecentInteractiveAuthAttempt,
} from "../services/authService";
import { getAuthErrorMessage, logAuthError } from "../utils/authErrors";

type Props = NativeStackScreenProps<RootStackParamList, "VerifyEmail">;

const fixedAuthTheme = getThemeConfig(DEFAULT_THEME_ID).colors;

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState(
    route.params?.infoMessage ?? "",
  );
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  const handleBackPress = async () => {
    try {
      await signOut(auth);
    } catch {
      // Keep exit behavior resilient if auth sign-out fails.
    }

    clearRecentInteractiveAuthAttempt();
    navigation.reset({
      index: 0,
      routes: [{ name: "AuthChoice" }],
    });
  };

  const handleVerifiedPress = async () => {
    if (isCheckingVerification) {
      return;
    }

    setErrorMessage("");
    setInfoMessage("");
    setIsCheckingVerification(true);

    try {
      const verifiedUser =
        await authService.refreshCurrentUserAfterEmailVerification();

      if (!verifiedUser?.uid) {
        setErrorMessage("Unable to continue. Please sign in again.");
        return;
      }
    } catch (error: unknown) {
      const errorCode = (error as { code?: string }).code;
      logAuthError("login", error);

      if (errorCode === "auth/email-not-verified") {
        setErrorMessage(
          "Your email is not verified yet. Please check your inbox.",
        );
        return;
      }

      setErrorMessage(getAuthErrorMessage(errorCode));
    } finally {
      setIsCheckingVerification(false);
    }
  };

  const handleResendPress = async () => {
    if (isResendingEmail) {
      return;
    }

    setErrorMessage("");
    setInfoMessage("");
    setIsResendingEmail(true);

    try {
      await authService.resendEmailVerification();
      setInfoMessage("Verification email sent again");
    } catch (error: unknown) {
      const errorCode = (error as { code?: string }).code;
      logAuthError("signup", error);
      setErrorMessage(getAuthErrorMessage(errorCode));
    } finally {
      setIsResendingEmail(false);
    }
  };

  const currentEmail = auth.currentUser?.email?.trim();

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safeArea, { backgroundColor: fixedAuthTheme.background }]}
    >
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { backgroundColor: fixedAuthTheme.background },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.screen}>
            <Pressable
              accessibilityRole="button"
              disabled={isCheckingVerification || isResendingEmail}
              style={styles.backButton}
              onPress={handleBackPress}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </Pressable>

            <View style={styles.card}>
              <Text style={styles.heading}>Verify your email</Text>
              <Text style={styles.subheading}>
                We&apos;ve sent a verification link to your email.
              </Text>
              <Text style={styles.subheading}>
                Please check your inbox (and spam folder) and click the link to
                continue.
              </Text>
              {currentEmail ? (
                <Text style={styles.emailLabel}>{currentEmail}</Text>
              ) : null}

              <CustomButton
                disabled={isCheckingVerification || isResendingEmail}
                fullWidth
                icon={
                  isCheckingVerification ? (
                    <ActivityIndicator color={COLORS.surface} size="small" />
                  ) : null
                }
                label={
                  isCheckingVerification
                    ? "Checking verification..."
                    : "I've verified my email"
                }
                onPress={handleVerifiedPress}
                style={styles.primaryButton}
              />

              <CustomButton
                disabled={isCheckingVerification || isResendingEmail}
                fullWidth
                icon={
                  isResendingEmail ? (
                    <ActivityIndicator color={COLORS.primary} size="small" />
                  ) : null
                }
                label={isResendingEmail ? "Sending..." : "Resend email"}
                variant="secondary"
                onPress={handleResendPress}
                style={styles.secondaryButton}
              />

              <Text style={styles.helperText}>
                Didn&apos;t get the email? You can resend it in a few seconds.
              </Text>

              {errorMessage ? (
                <Text style={styles.errorText}>{errorMessage}</Text>
              ) : null}
              {infoMessage ? (
                <Text style={styles.infoText}>{infoMessage}</Text>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  screen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  backgroundOrbTop: {
    position: "absolute",
    top: -48,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.primarySoft,
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: -28,
    left: -56,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: COLORS.accentSoft,
  },
  card: {
    borderRadius: 26,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 4,
  },
  heading: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  subheading: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  emailLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  primaryButton: {
    marginTop: 20,
  },
  secondaryButton: {
    marginTop: 10,
  },
  helperText: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 12,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 12,
  },
  infoText: {
    color: COLORS.accentDark,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 12,
  },
});
