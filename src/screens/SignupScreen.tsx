import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "../components/CustomButton";
import { COLORS } from "../constants/colors";
import { DEFAULT_THEME_ID, getThemeConfig } from "../constants/themes";
import { RootStackParamList } from "../navigation/types";
import { authService } from "../services/authService";
import { getAuthErrorMessage, logAuthError } from "../utils/authErrors";
import { onButtonPress } from "../utils/feedback";

type Props = NativeStackScreenProps<RootStackParamList, "Signup">;
const fixedAuthTheme = getThemeConfig(DEFAULT_THEME_ID).colors;

const EMAIL_REGEX = /\S+@\S+\.\S+/;

function getEmailError(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "Email is required";
  }

  if (!EMAIL_REGEX.test(trimmedValue)) {
    return "Please enter a valid email address";
  }

  return "";
}

function getPasswordError(value: string) {
  if (!value) {
    return "Password is required";
  }

  if (value.length < 6) {
    return "Password must be at least 6 characters";
  }

  return "";
}

function getConfirmPasswordError(password: string, confirmPassword: string) {
  if (!confirmPassword) {
    return "Please confirm your password";
  }

  if (password !== confirmPassword) {
    return "Passwords do not match";
  }

  return "";
}

export default function SignupScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isFormValid =
    !getEmailError(email) &&
    !getPasswordError(password) &&
    !getConfirmPasswordError(password, confirmPassword);

  const validateForm = () => {
    const nextEmailError = getEmailError(email);
    const nextPasswordError = getPasswordError(password);
    const nextConfirmPasswordError = getConfirmPasswordError(
      password,
      confirmPassword,
    );

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setConfirmPasswordError(nextConfirmPasswordError);
    setFormError("");

    return !nextEmailError && !nextPasswordError && !nextConfirmPasswordError;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailError(value ? getEmailError(value) : "");
    if (formError) {
      setFormError("");
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordError(value ? getPasswordError(value) : "");
    setConfirmPasswordError(
      confirmPassword ? getConfirmPasswordError(value, confirmPassword) : "",
    );
    if (formError) {
      setFormError("");
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setConfirmPasswordError(
      value ? getConfirmPasswordError(password, value) : "",
    );
    if (formError) {
      setFormError("");
    }
  };

  const handleSignup = async () => {
    if (loading || !validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await authService.signUp(email.trim(), password);

      navigation.reset({
        index: 0,
        routes: [{ name: "Home" }],
      });
    } catch (error: unknown) {
      const errorCode = (error as { code?: string }).code;
      logAuthError("signup", error);
      setFormError(getAuthErrorMessage(errorCode));
    } finally {
      setLoading(false);
    }
  };

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
            <View style={styles.brandBlock}>
              <Image
                resizeMode="cover"
                source={require("../../assets/icon.png")}
                style={styles.appIcon}
              />
              <Text style={styles.brandTitle}>
                <Text style={styles.brandPrimary}>Sudoku</Text>{" "}
                <Text style={styles.brandAccent}>Ryve</Text>
              </Text>
              <Text style={styles.brandSubtitle}>
                Build your account and keep your puzzle progress moving.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>Create Account</Text>
              <Text style={styles.subheading}>
                Sign up to save your journey and jump back into your next board.
              </Text>

              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <View
                    style={[
                      styles.inputShell,
                      emailError || formError ? styles.inputShellError : null,
                    ]}
                  >
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      placeholder="Email"
                      placeholderTextColor={COLORS.textMuted}
                      style={styles.input}
                      textContentType="emailAddress"
                      value={email}
                      onChangeText={handleEmailChange}
                    />
                  </View>
                  {emailError ? (
                    <Text style={styles.errorText}>{emailError}</Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <View
                    style={[
                      styles.inputShell,
                      passwordError || formError
                        ? styles.inputShellError
                        : null,
                    ]}
                  >
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Password"
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry={!showPassword}
                      style={styles.input}
                      textContentType="newPassword"
                      value={password}
                      onChangeText={handlePasswordChange}
                    />
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      style={styles.visibilityButton}
                      onPress={() => {
                        void onButtonPress();
                        setShowPassword((current) => !current);
                      }}
                    >
                      <Text style={styles.visibilityText}>
                        {showPassword ? "Hide" : "Show"}
                      </Text>
                    </Pressable>
                  </View>
                  {passwordError ? (
                    <Text style={styles.errorText}>{passwordError}</Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <View
                    style={[
                      styles.inputShell,
                      confirmPasswordError || formError
                        ? styles.inputShellError
                        : null,
                    ]}
                  >
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="Confirm Password"
                      placeholderTextColor={COLORS.textMuted}
                      secureTextEntry={!showConfirmPassword}
                      style={styles.input}
                      textContentType="password"
                      value={confirmPassword}
                      onChangeText={handleConfirmPasswordChange}
                    />
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      style={styles.visibilityButton}
                      onPress={() => {
                        void onButtonPress();
                        setShowConfirmPassword((current) => !current);
                      }}
                    >
                      <Text style={styles.visibilityText}>
                        {showConfirmPassword ? "Hide" : "Show"}
                      </Text>
                    </Pressable>
                  </View>
                  {confirmPasswordError ? (
                    <Text style={styles.errorText}>{confirmPasswordError}</Text>
                  ) : null}
                </View>
              </View>
              {formError ? (
                <Text style={styles.formErrorText}>{formError}</Text>
              ) : null}

              <CustomButton
                disabled={!isFormValid || loading}
                fullWidth
                icon={
                  loading ? (
                    <ActivityIndicator color={COLORS.surface} size="small" />
                  ) : null
                }
                label={loading ? "Creating Account..." : "Create Account"}
                onPress={handleSignup}
                style={styles.primaryButton}
              />

              <Pressable
                accessibilityRole="button"
                disabled={loading}
                style={styles.footerButton}
                onPress={() => {
                  void onButtonPress();
                  navigation.navigate("AuthChoice");
                }}
              >
                <Text style={styles.footerText}>
                  Already have an account? Login
                </Text>
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
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 16,
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
  form: {
    gap: 12,
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
    flexDirection: "row",
    alignItems: "center",
  },
  inputShellError: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerSoft,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    paddingVertical: 16,
  },
  visibilityButton: {
    marginLeft: 12,
    paddingVertical: 6,
  },
  visibilityText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  formErrorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 2,
    textAlign: "center",
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
