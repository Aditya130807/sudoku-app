import React, { useState } from "react";
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
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { createUserWithEmailAndPassword } from "firebase/auth";

import CustomButton from "../components/CustomButton";
import { COLORS } from "../constants/colors";
import { auth } from "../firebase";
import { RootStackParamList } from "../navigation/types";
import { userStore } from "../store/userStore";
import {
  getGenericAuthErrorMessage,
  logAuthError,
} from "../utils/authErrors";

type Props = NativeStackScreenProps<RootStackParamList, "Signup">;

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
      confirmPassword
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
      confirmPassword ? getConfirmPasswordError(value, confirmPassword) : ""
    );
    if (formError) {
      setFormError("");
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setConfirmPasswordError(
      value ? getConfirmPasswordError(password, value) : ""
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
      const credentials = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      userStore.setUser({
        id: credentials.user.uid,
        email: credentials.user.email,
      });

      navigation.replace("Home");
    } catch (error: any) {
      logAuthError("signup", error);
      setFormError(getGenericAuthErrorMessage("signup"));
    } finally {
      setLoading(false);
    }
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
                    style={[styles.inputShell, emailError ? styles.inputShellError : null]}
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
                  {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                </View>

                <View style={styles.fieldGroup}>
                  <View
                    style={[
                      styles.inputShell,
                      passwordError ? styles.inputShellError : null,
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
                      onPress={() => setShowPassword((current) => !current)}
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
                      confirmPasswordError ? styles.inputShellError : null,
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
                      onPress={() => setShowConfirmPassword((current) => !current)}
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
              {formError ? <Text style={styles.formErrorText}>{formError}</Text> : null}

              <CustomButton
                disabled={!isFormValid || loading}
                fullWidth
                icon={
                  loading ? <ActivityIndicator color={COLORS.surface} size="small" /> : null
                }
                label={loading ? "Creating Account..." : "Create Account"}
                onPress={handleSignup}
                style={styles.primaryButton}
              />

              <Pressable
                accessibilityRole="button"
                disabled={loading}
                style={styles.footerButton}
                onPress={() => navigation.navigate("AuthChoice")}
              >
                <Text style={styles.footerText}>Already have an account? Login</Text>
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
