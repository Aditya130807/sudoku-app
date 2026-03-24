import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "../components/Header";
import { COLORS } from "../constants/colors";
import { GameSettings } from "../game/types";
import { RootStackParamList } from "../navigation/types";
import { gameService } from "../services/gameService";
import { useGameStore } from "../store/gameStore";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

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

export default function SettingsScreen({ navigation }: Props) {
  const settings = useGameStore((state) => state.settings);

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <View style={styles.container}>
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
                <Text style={styles.settingDescription}>{setting.description}</Text>
              </View>
              <Switch
                onValueChange={() => gameService.toggleSetting(setting.key)}
                trackColor={{ false: COLORS.borderStrong, true: COLORS.primary }}
                thumbColor={COLORS.surface}
                value={settings[setting.key]}
              />
            </View>
          ))}
        </View>

        <View style={styles.futureCard}>
          <Text style={styles.futureTitle}>Coming next</Text>
          <Text style={styles.futureBody}>
            Dark mode, Firebase sync, and daily challenge settings can slot into this
            panel without changing the current architecture.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
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
  futureCard: {
    marginTop: 18,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.borderStrong,
  },
  futureTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  futureBody: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
});
