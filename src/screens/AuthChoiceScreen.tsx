import { FontAwesome } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
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
import { RootStackParamList } from "../navigation/types";
import { authService } from "../services/authService";
import { getGenericAuthErrorMessage, logAuthError } from "../utils/authErrors";

const GOOGLE_ANDROID_CLIENT_ID =
  "312094184536-7fp1gshpja07t2o97ftbuc539qqhincf.apps.googleusercontent.com";
const GOOGLE_WEB_CLIENT_ID =
  "312094184536-4si2t0g994khbab2n53h0odrmoukepa5.apps.googleusercontent.com";

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<RootStackParamList, "AuthChoice">;

export default function AuthChoiceScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [formError, setFormError] = useState("");

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
    if (!validateCredentials()) {
      return;
    }

    try {
      await authService.login(email.trim(), password);
      navigation.replace("Home");
    } catch (error: any) {
      logAuthError("login", error);
      setFormError(getGenericAuthErrorMessage("login"));
    }
  };

  const handleCreateAccount = () => {
    // Navigate to the dedicated signup form screen.
    navigation.navigate("Signup");
  };

  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
  });

  const handleGoogle = async () => {
    if (!request) {
      console.warn("[auth:google] Auth request not ready yet");
      return;
    }

    if (Constants.appOwnership === "expo" && Platform.OS !== "web") {
      console.warn(
        "[auth:google] Running in Expo Go. Use a development build for reliable native Google Sign-In.",
      );
    }

    const result = await promptAsync();
    console.log("[auth:google] Prompt result", result);

    const params =
      "params" in result
        ? (result.params as Record<string, string | undefined>)
        : undefined;

    const oauthError = params?.error;
    const oauthErrorDescription = params?.error_description;

    if (oauthError || oauthErrorDescription) {
      console.warn("[auth:google] OAuth provider error", {
        error: oauthError,
        errorDescription: oauthErrorDescription,
      });
    }

    if (result.type !== "success") {
      return;
    }

    const idToken = params?.id_token;
    if (!idToken) {
      console.warn("[auth:google] Missing id_token in successful response", {
        params,
      });
      setFormError(
        "Google Sign-In did not return an ID token. Please try again.",
      );
      return;
    }

    await authService.loginWithGoogle(idToken);
    navigation.replace("Home");
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.container}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
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

            <Text style={styles.title}>Welcome</Text>
            <Text style={styles.subtitle}>
              Ready to solve your first puzzle?
            </Text>

            <View style={styles.inputGroup}>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Email"
                style={[styles.input, emailError ? styles.inputError : null]}
                value={email}
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

              <TextInput
                placeholder="Password"
                secureTextEntry
                style={[styles.input, passwordError ? styles.inputError : null]}
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  if (passwordError) setPasswordError("");
                  if (formError) setFormError("");
                }}
              />
              {passwordError ? (
                <Text style={styles.errorText}>{passwordError}</Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                style={styles.forgotPasswordButton}
                onPress={() => navigation.navigate("ForgotPassword")}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </Pressable>
            </View>

            <View style={styles.buttonGroup}>
              <CustomButton label="Login" onPress={handleLogin} />

              <View style={styles.secondaryButtonWrapper}>
                <CustomButton
                  label="Create Account"
                  variant="secondary"
                  onPress={handleCreateAccount}
                />
              </View>
            </View>

            {formError ? (
              <Text style={styles.formErrorText}>{formError}</Text>
            ) : null}

            <View style={styles.orDivider} accessibilityRole="text">
              <View style={styles.orLine} />
              <Text style={styles.orLabel}>OR</Text>
              <View style={styles.orLine} />
            </View>

            <CustomButton
              label="Continue with Google"
              variant="secondary"
              icon={
                <FontAwesome name="google" size={18} color={COLORS.primary} />
              }
              onPress={async () => {
                try {
                  await handleGoogle();
                } catch (error) {
                  logAuthError("login", error);
                  setFormError(getGenericAuthErrorMessage("login"));
                }
              }}
            />
          </ScrollView>

          <View style={styles.guestContainer}>
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                await authService.continueAsGuest();
                navigation.replace("Home");
              }}
              style={styles.guestButton}
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
    backgroundColor: "#F5F7FB",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
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
    marginBottom: 20,
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
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ddd",
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

  orDivider: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  orLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginHorizontal: 12,
  },

  guestContainer: {
    paddingBottom: 16,
    paddingTop: 10,
    backgroundColor: "#F5F7FB",
  },
  guestButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  guestText: {
    textAlign: "center",
    color: COLORS.primary,
    fontWeight: "700",
  },
});
