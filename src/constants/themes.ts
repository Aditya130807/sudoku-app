import type { ImageSourcePropType } from "react-native";

export type ThemeId = "classic" | "wood" | "slime" | "fire" | "ice";

export interface ThemeColors {
  grid: string;
  background: string;
  text: string;
}

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  price: number;
  previewImage: ImageSourcePropType;
  gridImage: ImageSourcePropType;
  frameImage?: ImageSourcePropType;
  gridViewport?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  colors: ThemeColors;
}

export const DEFAULT_THEME_ID: ThemeId = "classic";

const LEGACY_THEME_ID_ALIASES: Record<string, ThemeId> = {
  default: DEFAULT_THEME_ID,
};

export const THEME_LIST: ThemeConfig[] = [
  {
    id: "classic",
    name: "Classic",
    price: 0,
    previewImage: require("../../assets/themes/classic.png"),
    gridImage: require("../../assets/themes/classic-grid.png"),
    // frameImage: require("../../assets/themes/classic-grid.png"),  
    colors: {
      grid: "#FFFFFF",
      background: "#EEF5FF",
      text: "#000000",
    },
  },
  {
    id: "fire",
    name: "Fire",
    price: 149,
    previewImage: require("../../assets/themes/fire.png"),
    gridImage: require("../../assets/themes/fire-grid.png"),
    frameImage: require("../../assets/themes/fire-frame.png"),
    colors: {
      grid: "#FFE1C4",
      background: "#ffffff",
      text: "#000000",
    },
  },
  {
    id: "slime",
    name: "Slime",
    price: 99,
    previewImage: require("../../assets/themes/slime.png"),
    gridImage: require("../../assets/themes/slime-grid.png"),
    frameImage: require("../../assets/themes/slime-frame.png"),
    // gridViewport: {
    //   left: 0.1,
    //   top: 0.161,
    //   width: 0.3775,
    //   height: 0.4899,
    // },
    colors: {
      grid: "#D4FFC7",
      background: "#EEFFE8",
      text: "#133809",
    },
  },
  {
    id: "wood",
    name: "Wood",
    price: 129,
    previewImage: require("../../assets/themes/wood.png"),
    gridImage: require("../../assets/themes/wooden-grid.png"),
    frameImage: require("../../assets/themes/wood-frame.png"),
    // gridViewport: {
    //   left: 0.0711,
    //   top: 0.0606,
    //   width: 0.8744,
    //   height: 0.8787,
    // },
    colors: {
      grid: "#F3DEC4",
      background: "#FAF0E2",
      text: "#5B3820",
    },
  },
  {
    id: "ice",
    name: "Ice",
    price: 179,
    previewImage: require("../../assets/themes/ice.png"),
    gridImage: require("../../assets/themes/ice-grid.png"),
    frameImage: require("../../assets/themes/ice-frame.png"),
    // gridViewport: {
    //   left: 0.0791,
    //   top: 0.1555,
    //   width: 0.4949,
    //   height: 0.6855,
    // },
    colors: {
      grid: "#D8F0FF",
      background: "#EDF9FF",
      text: "#1F4C68",
    },
  },
];

export const THEMES = THEME_LIST.reduce<Record<ThemeId, ThemeConfig>>(
  (catalog, theme) => {
    catalog[theme.id] = theme;
    return catalog;
  },
  {} as Record<ThemeId, ThemeConfig>,
);

function toCanonicalThemeId(
  themeId: string | null | undefined,
): ThemeId | null {
  if (!themeId) {
    return null;
  }

  const normalizedThemeId = themeId.trim().toLowerCase();

  if (!normalizedThemeId) {
    return null;
  }

  if (normalizedThemeId in LEGACY_THEME_ID_ALIASES) {
    return LEGACY_THEME_ID_ALIASES[normalizedThemeId];
  }

  if (normalizedThemeId in THEMES) {
    return normalizedThemeId as ThemeId;
  }

  return null;
}

export function normalizeThemeId(themeId: string | null | undefined): ThemeId {
  return toCanonicalThemeId(themeId) ?? DEFAULT_THEME_ID;
}

export function getThemeConfig(
  themeId: string | null | undefined,
): ThemeConfig {
  return THEMES[normalizeThemeId(themeId)];
}

export function isValidThemeId(themeId: string): boolean {
  return toCanonicalThemeId(themeId) !== null;
}

export function sanitizeThemeIds(
  themeIds: readonly (string | ThemeId | null | undefined)[],
): ThemeId[] {
  const unlockedThemeIds = new Set<ThemeId>([DEFAULT_THEME_ID]);

  themeIds.forEach((themeId) => {
    const normalizedThemeId = toCanonicalThemeId(themeId ?? undefined);

    if (normalizedThemeId) {
      unlockedThemeIds.add(normalizedThemeId);
    }
  });

  return THEME_LIST.map((theme) => theme.id).filter((themeId) =>
    unlockedThemeIds.has(themeId),
  );
}
