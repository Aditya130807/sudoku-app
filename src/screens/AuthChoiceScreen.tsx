import { FontAwesome } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
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
import { playSuccessSound } from "../utils/sound";
const fixedAuthTheme = getThemeConfig(DEFAULT_THEME_ID).colors;

type Props = NativeStackScreenProps<RootStackParamList, "AuthChoice">;

export default function AuthChoiceScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  const validateCredentials = () => {
    const trimmedEmail = email.trim();
    let nextEmailError = "";
    let nextPasswordError = "";

    setFormError("");

    if (!trimmedEmail.includes("@")) {
      nextEmailError = "Email must include '@'.";
    }

    if (password.length < 6) {
      nextPasswordError = "Password must be at least 6 characters.";
    }

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    return !nextEmailError && !nextPasswordError;
  };

  const handleLogin = async () => {
    if (isLoginLoading) {
      return;
    }

    if (!validateCredentials()) {
      return;
    }

    setIsLoginLoading(true);

    try {
      await authService.login(email.trim(), password);
      await Promise.allSettled([
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        playSuccessSound(),
      ]);
      navigation.reset({
        index: 0,
        routes: [{ name: "Home" }],
      });
    } catch (error: unknown) {
      const errorCode = (error as { code?: string }).code;
      logAuthError("login", error);
      setFormError(getAuthErrorMessage(errorCode));
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleCreateAccount = () => {
    // Navigate to the dedicated signup form screen.
    navigation.navigate("Signup");
  };

  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[styles.safeArea, { backgroundColor: fixedAuthTheme.background }]}
    >
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { backgroundColor: fixedAuthTheme.background },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={require("../assets/login.jpg")}
              style={styles.image}
            />

            <Text style={styles.logo}>
              <Text style={{ color: COLORS.primary }}>Sudoku</Text>{" "}
              <Text style={{ color: COLORS.accent }}>Ryve</Text>
            </Text>

            <Image
              source={require("../../assets/icon.png")}
              style={styles.appIcon}
            />

            <Text style={styles.title}>Welcome</Text>
            <Text style={styles.subtitle}>
              Ready to solve your first puzzle?
            </Text>

            <View style={styles.inputGroup}>
              <TextInput
                autoCapitalize="none"
                placeholderTextColor="#cecece"
                keyboardType="email-address"
                placeholder="Email"
                style={[
                  styles.input,
                  { backgroundColor: fixedAuthTheme.grid },
                  emailError || formError ? styles.inputError : null,
                  isEmailFocused ? styles.inputFocused : null,
                ]}
                value={email}
                onFocus={() => setIsEmailFocused(true)}
                onBlur={() => setIsEmailFocused(false)}
                onChangeText={(value) => {
                  setEmail(value);
                  if (emailError) setEmailError("");
                  if (passwordError) setPasswordError("");
                  if (formError) setFormError("");
                }}
              />
              {emailError ? (
                <Text style={styles.errorText}>{emailError}</Text>
              ) : null}

              <View
                style={[
                  styles.passwordInputContainer,
                  { backgroundColor: fixedAuthTheme.grid },
                  passwordError || formError ? styles.inputError : null,
                  isPasswordFocused ? styles.inputFocused : null,
                ]}
              >
                <TextInput
                  placeholder="Password"
                  placeholderTextColor="#cecece"
                  secureTextEntry={!isPasswordVisible}
                  style={styles.passwordInput}
                  value={password}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (passwordError) setPasswordError("");
                    if (formError) setFormError("");
                  }}
                />

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setIsPasswordVisible((value) => !value)}
                  style={({ pressed }) => [
                    styles.passwordToggle,
                    pressed ? styles.passwordTogglePressed : null,
                  ]}
                >
                  <FontAwesome
                    name={isPasswordVisible ? "eye-slash" : "eye"}
                    size={18}
                    color={COLORS.textMuted}
                  />
                </Pressable>
              </View>
              {passwordError ? (
                <Text style={styles.errorText}>{passwordError}</Text>
              ) : null}
              {formError ? (
                <Text style={styles.formErrorText}>{formError}</Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              style={styles.forgotPasswordButton}
              onPress={() => {
                void onButtonPress();
                navigation.navigate("ForgotPassword");
              }}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </Pressable>

            <View style={styles.buttonGroup}>
              <CustomButton
                label="Login"
                onPress={handleLogin}
                disabled={isLoginLoading}
                isLoading={isLoginLoading}
              />

              <View style={styles.secondaryButtonWrapper}>
                <CustomButton
                  label="Create Account"
                  variant="secondary"
                  onPress={handleCreateAccount}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.guestContainer}>
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                void onButtonPress();
                await authService.continueAsGuest();
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Home" }],
                });
              }}
              style={({ pressed }) => [
                styles.guestButton,
                pressed ? styles.guestButtonPressed : null,
              ]}
            >
              <Text style={styles.guestText}>Continue as Guest</Text>
            </Pressable>
          </View>
        </View>
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
  container: {
    flex: 1,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
    paddingBottom: 16, // keep space above the pinned guest button
  },
  bgCircle1: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.primarySoft,
  },
  bgCircle2: {
    position: "absolute",
    bottom: 100,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.accentSoft,
  },
  image: {
    width: "90%",
    height: 140,
    marginBottom: 10,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 12,
  },
  logo: {
    fontSize: 30,
    fontWeight: "900",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "500",
    color: COLORS.text,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 18,
  },
  buttonGroup: {
    width: "100%",
  },
  secondaryButtonWrapper: {
    marginTop: 12,
  },
  inputGroup: {
    width: "100%",
    marginTop: 6,
  },
  input: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  inputFocused: {
    borderColor: "#3B82F6",
    borderWidth: 2,
  },
  passwordInputContainer: {
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    padding: 0,
  },
  passwordToggle: {
    marginLeft: 8,
    padding: 2,
  },
  passwordTogglePressed: {
    opacity: 0.7,
    transform: [{ scale: 0.96 }],
  },
  inputError: {
    borderColor: "#D64545",
  },
  errorText: {
    color: "#D64545",
    fontSize: 12,
    marginTop: -4,
    marginBottom: 10,
    marginLeft: 4,
  },
  formErrorText: {
    color: "#D64545",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginTop: -2,
    marginBottom: 10,
    paddingVertical: 2,
  },
  forgotPasswordText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },

  guestContainer: {
    paddingBottom: 16,
    paddingTop: 10,
    backgroundColor: "transparent",
  },
  guestButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  guestButtonPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.96 }],
  },
  guestText: {
    textAlign: "center",
    color: COLORS.primary,
    fontWeight: "700",
  },
});
