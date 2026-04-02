import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
// import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "../components/CustomButton";
import { COLORS } from "../constants/colors";
import { DEFAULT_THEME_ID, getThemeConfig } from "../constants/themes";
import { RootStackParamList } from "../navigation/types";
// import { authService } from "../services/authService";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

const FEATURES = [
  "30 guided levels",
  "Guest-friendly",
  "Hints and smart highlights",
];
const fixedAuthTheme = getThemeConfig(DEFAULT_THEME_ID).colors;

export default function LoginScreen({ navigation }: Props) {
  return (
    <SafeAreaView
      edges={["top", "bottom"]}
      style={[
        styles.safeArea,
        { backgroundColor: fixedAuthTheme.background },
      ]}
    >
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <Image
            resizeMode="cover"
            source={require("../../assets/icon.png")}
            style={styles.appIcon}
          />

          <View style={styles.logoRow}>
            <Text style={styles.logoText}>
              <Text style={styles.logoPrimary}>Sudoku</Text>{" "}
              <Text style={styles.logoAccent}>Ryve</Text>
            </Text>
            {/* <View style={styles.logoBadge}>
                <Ionicons color={COLORS.surface} name="grid-outline" size={18} />
              </View> */}
          </View>

          <Text style={styles.heading}>Train your brain. Relax your mind.</Text>
          {/* <Text style={styles.subheading}>
              Start instantly as a guest, grow through progressive levels, and unlock a
              smoother puzzle rhythm with every board.
            </Text> */}

          <Image
            resizeMode="contain"
            source={require("../assets/login.jpg")}
            style={styles.image}
          />

          <View style={styles.featureWrap}>
            {FEATURES.map((feature) => (
              <View key={feature} style={styles.featureChip}>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ marginTop: 20 }}>
          <CustomButton
            label="Continue"
            onPress={() => navigation.navigate("AuthChoice")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "space-evenly", // 🔥 KEY
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 20,
  },
  heroCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 30,
    padding: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 4,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignSelf: "center",
    marginBottom: 18,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  logoPrimary: {
    color: COLORS.primary,
  },
  logoAccent: {
    color: COLORS.accent,
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.overlay,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
    marginTop: 20,
  },
  subheading: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  image: {
    width: "100%",
    height: 280,
    marginTop: 8,
  },
  featureWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 8,
    marginBottom: 8,
    gap: 8,
  },
  featureChip: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  featureText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  actionCard: {
    marginTop: 18,
    backgroundColor: COLORS.surface,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  actionSubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 18,
  },
  primaryButton: {
    marginBottom: 12,
  },
  footerCopy: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
});
