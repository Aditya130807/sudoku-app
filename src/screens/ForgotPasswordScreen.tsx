import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { sendPasswordResetEmail } from "firebase/auth";

import CustomButton from "../components/CustomButton";
import { COLORS } from "../constants/colors";
import { auth } from "../firebase";
import { RootStackParamList } from "../navigation/types";
import {
  FORGOT_PASSWORD_REQUEST_MESSAGE,
  getAuthErrorCode,
  getGenericAuthErrorMessage,
  logAuthError,
} from "../utils/authErrors";

type ForgotPasswordScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

const EMAIL_REGEX = /\S+@\S+\.\S+/;

function validateEmail(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "Email is required";
  }

  if (!EMAIL_REGEX.test(trimmedValue)) {
    return "Please enter a valid email address";
  }

  return "";
}

export default function ForgotPasswordScreen({
  navigation,
}: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const isEmailValid = useMemo(() => !validateEmail(email), [email]);
  const isSuccess = !!successMessage;

  const handleEmailChange = (value: string) => {
    setEmail(value);

    if (emailError) {
      setEmailError("");
    }

    if (successMessage) {
      setSuccessMessage("");
    }
  };

  const handleEmailBlur = () => {
    if (!email) {
      return;
    }

    setEmailError(validateEmail(email));
  };

  const handleSendResetLink = async () => {
    const nextEmailError = validateEmail(email);

    setEmailError(nextEmailError);
    setSuccessMessage("");

    if (loading || nextEmailError) {
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMessage(FORGOT_PASSWORD_REQUEST_MESSAGE);
      setEmailError("");
    } catch (error: any) {
      logAuthError("forgot-password", error);

      if (getAuthErrorCode(error) === "auth/user-not-found") {
        setSuccessMessage(FORGOT_PASSWORD_REQUEST_MESSAGE);
        setEmailError("");
        return;
      }

      setEmailError(getGenericAuthErrorMessage("forgot-password"));
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("AuthChoice");
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.screen}>
            <View style={styles.brandBlock}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoBadgeText}>9x9</Text>
              </View>
              <Text style={styles.brandTitle}>
                <Text style={styles.brandPrimary}>Sudoku</Text>{" "}
                <Text style={styles.brandAccent}>Ryve</Text>
              </Text>
              <Text style={styles.brandSubtitle}>
                Reset your password and get back to your next puzzle.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>Forgot Password</Text>
              <Text style={styles.subheading}>
                Enter the email linked to your account and we will send you a reset
                link.
              </Text>

              <View style={styles.fieldGroup}>
                <View
                  style={[
                    styles.inputShell,
                    emailError ? styles.inputShellError : null,
                    isSuccess ? styles.inputShellSuccess : null,
                  ]}
                >
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading && !isSuccess}
                    keyboardType="email-address"
                    placeholder="Email"
                    placeholderTextColor={COLORS.textMuted}
                    style={styles.input}
                    textContentType="emailAddress"
                    value={email}
                    onBlur={handleEmailBlur}
                    onChangeText={handleEmailChange}
                  />
                </View>

                {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                {successMessage ? (
                  <Text style={styles.successText}>{successMessage}</Text>
                ) : null}
              </View>

              <CustomButton
                disabled={!isEmailValid || loading || isSuccess}
                fullWidth
                icon={
                  loading ? <ActivityIndicator color={COLORS.surface} size="small" /> : null
                }
                label={loading ? "Sending..." : "Send Reset Link"}
                onPress={handleSendResetLink}
                style={styles.primaryButton}
              />

              <Pressable
                accessibilityRole="button"
                disabled={loading}
                style={styles.footerButton}
                onPress={handleBackToLogin}
              >
                <Text style={styles.footerText}>Back to Login</Text>
              </Pressable>
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
    backgroundColor: COLORS.background,
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
  brandBlock: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.overlay,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  logoBadgeText: {
    color: COLORS.surface,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: "900",
    marginTop: 16,
  },
  brandPrimary: {
    color: COLORS.primary,
  },
  brandAccent: {
    color: COLORS.accent,
  },
  brandSubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 290,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 6,
  },
  heading: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  subheading: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  fieldGroup: {
    width: "100%",
  },
  inputShell: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  inputShellError: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerSoft,
  },
  inputShellSuccess: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  input: {
    color: COLORS.text,
    fontSize: 15,
    paddingVertical: 16,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  successText: {
    color: COLORS.accentDark,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: "700",
  },
  primaryButton: {
    marginTop: 20,
  },
  footerButton: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  footerText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "700",
  },
});
