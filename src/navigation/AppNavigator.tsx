import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { COLORS } from "../constants/colors";
import { useAppTheme } from "../context/ThemeContext";
import AuthChoiceScreen from "../screens/AuthChoiceScreen";
import DailyChallengeScreen from "../screens/DailyChallengeScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import GameScreen from "../screens/GameScreen";
import HomeScreen from "../screens/HomeScreen";
import LevelMapScreen from "../screens/LevelMapScreen";
import LoadingScreen from "../screens/LoadingScreen";
import LoginScreen from "../screens/LoginScreen";
import SettingsScreen from "../screens/SettingsScreen";
import SignupScreen from "../screens/SignupScreen";
import ThemeStoreScreen from "../screens/ThemeStoreScreen";
import TutorialScreen from "../screens/TutorialScreen";
import { storageService } from "../services/storageService";
import { useUserStore } from "../store/userStore";
import { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

function getStatusBarStyle(backgroundColor: string): "dark" | "light" {
  const normalizedColor = backgroundColor.trim().replace("#", "");
  const hexColor =
    normalizedColor.length === 3
      ? normalizedColor
          .split("")
          .map((value) => `${value}${value}`)
          .join("")
      : normalizedColor;

  if (hexColor.length !== 6) {
    return "dark";
  }

  const red = Number.parseInt(hexColor.slice(0, 2), 16);
  const green = Number.parseInt(hexColor.slice(2, 4), 16);
  const blue = Number.parseInt(hexColor.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance >= 0.62 ? "dark" : "light";
}

export default function AppNavigator() {
  const { activeTheme } = useAppTheme();
  const isSignedIn = useUserStore((state) => state.mode === "signed_in");
  const [hasEnteredApp, setHasEnteredApp] = useState(false);
  const [isEntryStateHydrated, setIsEntryStateHydrated] = useState(false);

  useEffect(() => {
    let isDisposed = false;

    void (async () => {
      try {
        const hasEntered = await storageService.hasEnteredApp();

        if (isDisposed) {
          return;
        }

        setHasEnteredApp(hasEntered);
      } catch {
      } finally {
        if (!isDisposed) {
          setIsEntryStateHydrated(true);
        }
      }
    })();

    return () => {
      isDisposed = true;
    };
  }, []);

  if (!isEntryStateHydrated) {
    return (
      <SafeAreaProvider>
        <LoadingScreen />
      </SafeAreaProvider>
    );
  }

  const shouldStartAtHome = isSignedIn || hasEnteredApp;
  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: activeTheme.colors.background,
      border: activeTheme.colors.grid,
      card: activeTheme.colors.grid,
      primary: COLORS.primary,
      text: activeTheme.colors.text,
      notification: COLORS.accent,
    },
  };
  const stackScreenOptions = {
    headerShown: false,
    contentStyle: {
      backgroundColor: activeTheme.colors.background,
    },
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style={getStatusBarStyle(activeTheme.colors.background)} />
        <Stack.Navigator
          key={`${isSignedIn ? "signed-in" : "signed-out"}-${
            hasEnteredApp ? "entered" : "new"
          }`}
          initialRouteName={shouldStartAtHome ? "Home" : "Welcome"}
          screenOptions={stackScreenOptions}
        >
          {!isSignedIn ? (
            <>
              <Stack.Screen name="Welcome" component={LoginScreen} />
              <Stack.Screen name="AuthChoice" component={AuthChoiceScreen} />
              <Stack.Screen name="Signup" component={SignupScreen} />
              <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
              />
            </>
          ) : null}
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="LevelMap" component={LevelMapScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="ThemeStore" component={ThemeStoreScreen} />
          <Stack.Screen
            name="DailyChallenges"
            component={DailyChallengeScreen}
          />
          <Stack.Screen name="Tutorial" component={TutorialScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
