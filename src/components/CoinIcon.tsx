import React from "react";
import { Image, StyleSheet } from "react-native";

interface CoinIconProps {
  size?: number;
}

export default function CoinIcon({ size = 20 }: CoinIconProps) {
  return (
    <Image
      source={require("../../assets/icons/coin.png")}
      style={[styles.icon, { width: size, height: size }]}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    resizeMode: "contain",
    marginRight: 5,
  },
});
