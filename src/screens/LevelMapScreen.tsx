import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../components/Header";
import LevelCard from "../components/LevelCard";
import { COLORS } from "../constants/colors";
import { LEVELS, TOTAL_LEVELS } from "../constants/levels";
import { useAppTheme } from "../context/ThemeContext";
import { RootStackParamList } from "../navigation/types";
import { gameService } from "../services/gameService";
import { useGameStore } from "../store/gameStore";
import { hexToRgba } from "../utils/colorUtils";

type Props = NativeStackScreenProps<RootStackParamList, "LevelMap">;

export default function LevelMapScreen({ navigation }: Props) {
  const { activeTheme } = useAppTheme();
  const progress = useGameStore((state) => state.progress);
  const activeGame = useGameStore((state) => state.activeGame);
  const completedLevels = Object.values(progress).filter(
    (entry) => entry.status === "completed",
  ).length;
  const totalStars = Object.values(progress).reduce(
    (sum, entry) => sum + entry.stars,
    0,
  );

  const currentLevelId = useMemo(() => {
    if (activeGame?.status === "playing") return activeGame.levelId;
    return gameService.getNextPlayableLevelId();
  }, [activeGame?.levelId, activeGame?.status]);

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
      >
        <Header
          title="Level Map"
          subtitle="Follow the climb from calm starts to expert finishes."
          leftAction={{
            icon: <Ionicons color={COLORS.text} name="arrow-back" size={20} />,
            onPress: () => navigation.goBack(),
          }}
          rightAction={{
            icon: (
              <Ionicons color={COLORS.text} name="settings-outline" size={20} />
            ),
            onPress: () => navigation.navigate("Settings"),
          }}
        />

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryValue}>
              {completedLevels}/{TOTAL_LEVELS}
            </Text>
            <Text style={styles.summaryLabel}>Levels completed</Text>
          </View>
          <View>
            <Text style={styles.summaryValue}>{totalStars}</Text>
            <Text style={styles.summaryLabel}>Stars total</Text>
          </View>
        </View>

        {/* <View style={styles.mapWrap}>
          {LEVELS.map((level) => {
            const entry = progress[level.id];
            const state = getLevelNodeState(level.id, entry, currentLevelId);

            return (
              <View key={level.id} style={styles.nodeWrapper}>
                <LevelNode
                  levelId={level.id}
                  state={state}
                  onPress={() => navigation.navigate("Game", { levelId: level.id })}
                />
              </View>
            );
          })}
        </View> */}
        <View style={{ marginTop: 10, alignItems: "center" }}>
          {LEVELS.map((level) => {
            const entry = progress[level.id];
            const position =
              level.id % 3 === 0
                ? "center"
                : level.id % 2 === 0
                  ? "right"
                  : "left";
            return (
              <View
                key={level.id}
                style={{
                  width: "100%",
                  alignItems:
                    position === "center"
                      ? "center"
                      : position === "right"
                        ? "flex-end"
                        : "flex-start",
                }}
              >
                <LevelCard
                  level={level}
                  progress={entry}
                  onPress={() =>
                    navigation.navigate("Game", { levelId: level.id })
                  }
                  style={
                    level.id === currentLevelId
                      ? { borderWidth: 3, borderColor: COLORS.accent }
                      : undefined
                  }
                />

                {/* connector line */}
                <View
                  style={{
                    width: 2,
                    height: 30,
                    backgroundColor: hexToRgba(activeTheme.colors.text, 0.24),
                    marginVertical: 6,

                    alignSelf:
                      position === "center"
                        ? "center"
                        : position === "right"
                          ? "flex-end"
                          : "flex-start",

                    // 🔥 THIS is the key
                    marginRight: position === "right" ? 60 : 0,
                    marginLeft: position === "left" ? 60 : 0,
                  }}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 28,
  },
  summaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: COLORS.overlay,
    borderRadius: 26,
    padding: 22,
    marginBottom: 18,
  },
  summaryValue: {
    color: COLORS.surface,
    fontSize: 28,
    fontWeight: "900",
  },
  summaryLabel: {
    color: "#DCE6F7",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
  },
});
