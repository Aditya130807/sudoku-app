import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CoinIcon from "../components/CoinIcon";
import CustomButton from "../components/CustomButton";
import Header from "../components/Header";
import { COLORS } from "../constants/colors";
import { useCoins } from "../context/CoinContext";
import { useDailyChallenges } from "../context/DailyChallengeContext";
import { useAppTheme } from "../context/ThemeContext";
import { GameSettings } from "../game/types";
import { RootStackParamList } from "../navigation/types";
import { authService } from "../services/authService";
import { gameService } from "../services/gameService";
import { gameStore, useGameStore } from "../store/gameStore";
import { useUserStore, userStore } from "../store/userStore";
import { getAuthErrorCode } from "../utils/authErrors";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

type AppExtraConfig = {
  privacyPolicyUrl?: string;
  accountDeletionUrl?: string;
};

const SETTING_LABELS: {
  key: keyof GameSettings;
  title: string;
  description: string;
}[] = [
  {
    key: "completionIndicator",
    title: "Completion indicator",
    description: "Glow solved rows, columns, and boxes in green.",
  },
  {
    key: "mistakeHighlighting",
    title: "Mistake highlighting",
    description: "Mark incorrect entries directly on the board.",
  },
  {
    key: "autoCheck",
    title: "Auto-check",
    description: "Show immediate feedback when an entry misses the solution.",
  },
  {
    key: "soundEnabled",
    title: "Sound",
    description: "Keep the experience quiet or ready for effects later.",
  },
];

function getDeleteAccountErrorMessage(error: unknown) {
  const errorCode = getAuthErrorCode(error);

  if (errorCode === "auth/requires-recent-login") {
    return "Please re-login to delete account";
  }

  if (errorCode === "account/profile-delete-failed") {
    return "Deletion failed, try again";
  }

  if (errorCode === "account/auth-delete-failed") {
    return "Deletion failed, try again";
  }

  if (
    errorCode === "auth/invalid-credential" ||
    errorCode === "auth/wrong-password"
  ) {
    return "Please re-login to delete account";
  }

  return "Deletion failed, try again";
}

export default function SettingsScreen({ navigation }: Props) {
  const { activeTheme, resetThemeState, unlockedThemeIds } = useAppTheme();
  const { coins, isHydrated: isCoinHydrated, resetCoins } = useCoins();
  const { claimedChallengeIds, challenges, resetDailyChallenges } =
    useDailyChallenges();
  const settings = useGameStore((state) => state.settings);
  const user = useUserStore((state) => state);
  const isSignedIn = useUserStore((state) => state.mode === "signed_in");
  const userEmail = useUserStore((state) => state.email);
  const isGuest = user.mode === "guest" || !user.uid;
  const [accountFeedback, setAccountFeedback] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeletePasswordPrompt, setShowDeletePasswordPrompt] =
    useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const isMountedRef = useRef(true);
  const appExtraConfig =
    (Constants.expoConfig?.extra as AppExtraConfig | undefined) ?? {};
  const privacyPolicyUrl = appExtraConfig.privacyPolicyUrl?.trim() ?? "";
  const accountDeletionUrl = appExtraConfig.accountDeletionUrl?.trim() ?? "";

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const openExternalPage = async (url: string, fallbackMessage: string) => {
    try {
      if (!url) {
        setAccountFeedback(fallbackMessage);
        return;
      }

      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        setAccountFeedback(fallbackMessage);
        return;
      }

      setAccountFeedback(null);
      await Linking.openURL(url);
    } catch {
      setAccountFeedback(fallbackMessage);
    }
  };

  const closeDeletePasswordPrompt = () => {
    setShowDeletePasswordPrompt(false);
    setDeletePassword("");
  };

  const handleDeleteAccount = async (passwordForReauth?: string) => {
    if (!isSignedIn) {
      return;
    }

    setAccountFeedback(null);
    setIsDeletingAccount(true);

    try {
      await authService.deleteAccount(
        passwordForReauth
          ? {
              password: passwordForReauth,
            }
          : undefined,
      );
      await resetThemeState();
      resetCoins();
      resetDailyChallenges();
      gameStore.reset();
      userStore.resetUser();
      closeDeletePasswordPrompt();
    } catch (error: unknown) {
      if (isMountedRef.current) {
        const errorCode = getAuthErrorCode(error);

        if (errorCode === "auth/requires-recent-login" && !passwordForReauth) {
          setAccountFeedback("Please re-login to delete account");
          setShowDeletePasswordPrompt(true);
          return;
        }

        setAccountFeedback(getDeleteAccountErrorMessage(error));
      }
    } finally {
      if (isMountedRef.current) {
        setIsDeletingAccount(false);
      }
    }
  };

  const handleConfirmDeleteWithPassword = () => {
    if (!deletePassword.trim()) {
      setAccountFeedback("Please re-login to delete account");
      return;
    }

    void handleDeleteAccount(deletePassword);
  };

  const performSignOut = async () => {
    if (!isSignedIn || isSigningOut) {
      return;
    }

    setAccountFeedback(null);
    setIsSigningOut(true);

    try {
      await authService.logout();
      await resetThemeState();
      resetCoins();
      resetDailyChallenges();
      gameStore.reset();
      userStore.resetUser();

      if (isMountedRef.current) {
        navigation.reset({
          index: 0,
          routes: [{ name: "AuthChoice" }],
        });
      }
    } catch (error: unknown) {
      if (isMountedRef.current) {
        const errorCode = getAuthErrorCode(error);
        const message =
          errorCode === "auth/network-request-failed"
            ? "Network error. Check your internet connection."
            : "We couldn't sign you out right now. Please try again.";
        setAccountFeedback(message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsSigningOut(false);
      }
    }
  };

  const handleSignOut = () => {
    if (!isSignedIn || isSigningOut || isDeletingAccount) {
      return;
    }

    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          void performSignOut();
        },
      },
    ]);
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account and clears the saved data on this device. A web deletion page is also available below.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void handleDeleteAccount();
          },
        },
      ],
    );
  };

  const handleOpenDailyChallenges = () => {
    if (isGuest) {
      Alert.alert(
        "Login Required",
        "You need to be logged in to access Daily Challenges.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Login",
            onPress: () => navigation.navigate("AuthChoice"),
          },
        ],
      );
      return;
    }

    navigation.navigate("DailyChallenges");
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
        style={styles.scrollView}
      >
        <Header
          title="Settings"
          subtitle="Tune the board feedback to your solving style."
          leftAction={{
            icon: <Ionicons color={COLORS.text} name="arrow-back" size={20} />,
            onPress: () => navigation.goBack(),
          }}
        />

        <View style={styles.settingsList}>
          {SETTING_LABELS.map((setting) => (
            <View key={setting.key} style={styles.settingCard}>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>{setting.title}</Text>
                <Text style={styles.settingDescription}>
                  {setting.description}
                </Text>
              </View>
              <Switch
                onValueChange={() => gameService.toggleSetting(setting.key)}
                trackColor={{
                  false: COLORS.borderStrong,
                  true: COLORS.primary,
                }}
                thumbColor={COLORS.surface}
                value={settings[setting.key]}
              />
            </View>
          ))}
        </View>

        <View style={styles.themeCard}>
          <View style={styles.themeCardHeader}>
            <View style={styles.themeCopy}>
              <Text style={styles.themeTitle}>Theme Store</Text>
              <Text style={styles.themeDescription}>
                Spend coins on board looks and apply them instantly on this
                device.
              </Text>
            </View>
            <View style={styles.themeBadge}>
              <Text style={styles.themeBadgeText}>
                {unlockedThemeIds.length} unlocked
              </Text>
            </View>
          </View>

          <View style={styles.themeMetaRow}>
            <Text style={styles.themeMetaLabel}>Current theme</Text>
            <Text style={styles.themeMetaValue}>{activeTheme.name}</Text>
          </View>

          <CustomButton
            label="Open Theme Store"
            onPress={() => navigation.navigate("ThemeStore")}
            style={styles.themeButton}
          />
        </View>

        <View style={styles.themeCard}>
          <View style={styles.themeCardHeader}>
            <View style={styles.themeCopy}>
              <Text style={styles.themeTitle}>Economy</Text>
              <Text style={styles.themeDescription}>
                Earn coins by completing daily challenges and watching rewarded
                ads.
              </Text>
            </View>
            <View style={styles.themeBadge}>
              <View style={styles.themeBadgeRow}>
                <CoinIcon size={14} />
                <Text style={styles.themeBadgeText}>
                  {isCoinHydrated ? `${coins}` : "..."}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.themeMetaRow}>
            <Text style={styles.themeMetaLabel}>Daily rewards</Text>
            <Text style={styles.themeMetaValue}>
              {claimedChallengeIds.length}/{challenges.length} claimed
            </Text>
          </View>

          <CustomButton
            label="Open Daily Challenges"
            onPress={handleOpenDailyChallenges}
            style={styles.themeButton}
            variant="secondary"
          />
        </View>

        <View style={styles.themeCard}>
          <View style={styles.themeCardHeader}>
            <View style={styles.themeCopy}>
              <Text style={styles.themeTitle}>Account & Privacy</Text>
              <Text style={styles.themeDescription}>
                {isSignedIn
                  ? "Review the privacy policy, use the web deletion page, or permanently delete your account from here."
                  : "Review the privacy policy here. Sign in to manage account deletion options."}
              </Text>
            </View>
          </View>

          {isSignedIn && userEmail ? (
            <View style={styles.themeMetaRow}>
              <Text style={styles.themeMetaLabel}>Signed in as</Text>
              <Text style={styles.themeMetaValue}>{userEmail}</Text>
            </View>
          ) : null}

          <CustomButton
            label="Open Privacy Policy"
            onPress={() => {
              void openExternalPage(
                privacyPolicyUrl,
                "Add a valid privacy policy URL in app config before release.",
              );
            }}
            style={styles.themeButton}
            variant="secondary"
          />

          {!isSignedIn ? (
            <CustomButton
              label="Login / Sign Up"
              onPress={() => navigation.navigate("AuthChoice")}
              style={styles.secondaryButton}
              variant="secondary"
            />
          ) : null}

          {isSignedIn ? (
            <>
              <CustomButton
                label="Open Web Deletion Page"
                onPress={() => {
                  void openExternalPage(
                    accountDeletionUrl,
                    "Add a valid account deletion URL in app config before release.",
                  );
                }}
                style={styles.secondaryButton}
                variant="secondary"
              />
              <CustomButton
                disabled={isDeletingAccount}
                label={
                  isDeletingAccount ? "Deleting Account..." : "Delete Account"
                }
                onPress={confirmDeleteAccount}
                style={styles.deleteButton}
                labelStyle={styles.deleteButtonLabel}
              />
              <CustomButton
                disabled={isSigningOut || isDeletingAccount}
                label={isSigningOut ? "Signing Out..." : "Sign Out"}
                onPress={handleSignOut}
                style={styles.signOutButton}
                labelStyle={styles.signOutButtonLabel}
                variant="secondary"
              />
            </>
          ) : null}

          {accountFeedback ? (
            <Text style={styles.accountFeedback}>{accountFeedback}</Text>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={closeDeletePasswordPrompt}
        transparent
        visible={showDeletePasswordPrompt}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Please re-login to delete account
            </Text>
            <Text style={styles.modalDescription}>
              Enter your password to continue account deletion.
            </Text>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isDeletingAccount}
              onChangeText={setDeletePassword}
              placeholder="Password"
              placeholderTextColor={COLORS.textMuted}
              secureTextEntry
              style={styles.modalInput}
              textContentType="password"
              value={deletePassword}
            />

            <View style={styles.modalActionsRow}>
              <Pressable
                accessibilityRole="button"
                disabled={isDeletingAccount}
                onPress={closeDeletePasswordPrompt}
                style={({ pressed }) => [
                  styles.modalCancelButton,
                  pressed ? styles.modalCancelPressed : null,
                ]}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </Pressable>

              <CustomButton
                disabled={isDeletingAccount}
                isLoading={isDeletingAccount}
                label={isDeletingAccount ? "Deleting..." : "Confirm Deletion"}
                onPress={handleConfirmDeleteWithPassword}
                style={styles.modalConfirmButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    padding: 20,
  },
  settingsList: {
    gap: 14,
  },
  settingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  settingCopy: {
    flex: 1,
    paddingRight: 16,
  },
  settingTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },
  settingDescription: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  themeCard: {
    marginTop: 18,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  themeCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  themeCopy: {
    flex: 1,
  },
  themeTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  themeDescription: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  themeBadge: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  themeBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  themeBadgeText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  themeMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 16,
  },
  themeMetaLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  themeMetaValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  themeButton: {
    marginTop: 16,
  },
  secondaryButton: {
    marginTop: 12,
  },
  signOutButton: {
    marginTop: 12,
    backgroundColor: "#EF4444",
    borderWidth: 0,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  signOutButtonLabel: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  deleteButton: {
    marginTop: 18,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  deleteButtonLabel: {
    color: "#DC2626",
    fontWeight: "700",
  },
  accountFeedback: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 12,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 18,
    padding: 18,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  modalDescription: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  modalInput: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    color: COLORS.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  modalActionsRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalCancelButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modalCancelPressed: {
    opacity: 0.8,
  },
  modalCancelButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  modalConfirmButton: {
    flex: 1,
  },
});
