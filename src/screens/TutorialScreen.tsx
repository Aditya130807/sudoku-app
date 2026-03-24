import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "../components/CustomButton";
import Header from "../components/Header";
import { COLORS } from "../constants/colors";
import { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Tutorial">;

const SLIDES = [
  {
    title: "Start with strong anchors",
    body: "Tap any editable cell, then use the number pad below the grid. Prefilled cells stay locked so you always know what is safe to change.",
  },
  {
    title: "Read the board feedback",
    body: "Selected cells light up, matching numbers are highlighted, and solved rows, columns, or boxes can glow green when the completion indicator is on.",
  },
  {
    title: "Use hints sparingly",
    body: "Hints fill one safe move and help momentum, but they lower your score and use up the limited supply on each level.",
  },
  {
    title: "Push for better stars",
    body: "Finish faster and with fewer hints to improve your score and star rating. Every completed level unlocks the next step on the map.",
  },
];

export default function TutorialScreen({ navigation, route }: Props) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const lastSlide = index === SLIDES.length - 1;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <View style={styles.container}>
        <Header
          title="Tutorial"
          subtitle="A quick walkthrough of the Sudoku Ryve flow."
          leftAction={{
            icon: <Ionicons color={COLORS.text} name="arrow-back" size={20} />,
            onPress: () => navigation.goBack(),
          }}
        />

        <View style={styles.card}>
          <View style={styles.slideBadge}>
            <Text style={styles.slideBadgeText}>
              Tip {index + 1}/{SLIDES.length}
            </Text>
          </View>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>
        </View>

        <View style={styles.dots}>
          {SLIDES.map((_, dotIndex) => (
            <View
              key={dotIndex}
              style={[styles.dot, dotIndex === index && styles.dotActive]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <CustomButton
            label="Previous"
            onPress={() => setIndex((current) => Math.max(0, current - 1))}
            variant="ghost"
            disabled={index === 0}
          />
          {lastSlide ? (
            <CustomButton
              label={route.params?.fromGame ? "Back to Puzzle" : "Finish"}
              onPress={() => navigation.goBack()}
            />
          ) : (
            <CustomButton
              label="Next"
              onPress={() =>
                setIndex((current) => Math.min(SLIDES.length - 1, current + 1))
              }
            />
          )}
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
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 30,
    padding: 24,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  slideBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 18,
  },
  slideBadgeText: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
  },
  body: {
    color: COLORS.textMuted,
    fontSize: 16,
    lineHeight: 25,
    marginTop: 16,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginVertical: 20,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.borderStrong,
  },
  dotActive: {
    width: 28,
    backgroundColor: COLORS.primary,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
});
