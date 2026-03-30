import React from "react";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { COLORS } from "../constants/colors";
import { useAppTheme } from "../context/ThemeContext";
import DailyChallengeScreen from "../screens/DailyChallengeScreen";
import GameScreen from "../screens/GameScreen";
import HomeScreen from "../screens/HomeScreen";
import LevelMapScreen from "../screens/LevelMapScreen";
import LoginScreen from "../screens/LoginScreen";
import MarketplaceScreen from "../screens/MarketplaceScreen";
import AuthChoiceScreen from "../screens/AuthChoiceScreen";
import SignupScreen from "../screens/SignupScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ThemeStoreScreen from "../screens/ThemeStoreScreen";
import TutorialScreen from "../screens/TutorialScreen";
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

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style={getStatusBarStyle(activeTheme.colors.background)} />
        <Stack.Navigator
          initialRouteName="Welcome"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Welcome" component={LoginScreen} />
          <Stack.Screen name="AuthChoice" component={AuthChoiceScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="LevelMap" component={LevelMapScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="ThemeStore" component={ThemeStoreScreen} />
          <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
          <Stack.Screen name="DailyChallenges" component={DailyChallengeScreen} />
          <Stack.Screen name="Tutorial" component={TutorialScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
