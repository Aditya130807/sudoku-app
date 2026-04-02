import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_THEME_ID,
  normalizeThemeId,
  sanitizeThemeIds,
  type ThemeId,
} from "../constants/themes";

const UNLOCKED_THEMES_STORAGE_KEY = "@sudoku_ryve/themes/unlocked";
const ACTIVE_THEME_STORAGE_KEY = "@sudoku_ryve/themes/active";

export interface StoredThemeState {
  unlockedThemeIds: ThemeId[];
  activeThemeId: ThemeId;
}

const THEME_STORAGE_KEYS = [UNLOCKED_THEMES_STORAGE_KEY, ACTIVE_THEME_STORAGE_KEY];

function parseUnlockedThemeIds(rawValue: string | null): ThemeId[] {
  if (!rawValue) {
    return [DEFAULT_THEME_ID];
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [DEFAULT_THEME_ID];
    }

    const themeIds = parsedValue.filter(
      (value): value is string => typeof value === "string"
    );

    return sanitizeThemeIds(themeIds);
  } catch {
    return [DEFAULT_THEME_ID];
  }
}

function getStoredActiveThemeId(
  rawValue: string | null,
  unlockedThemeIds: ThemeId[]
): ThemeId {
  const activeThemeId = normalizeThemeId(rawValue);

  return unlockedThemeIds.includes(activeThemeId)
    ? activeThemeId
    : DEFAULT_THEME_ID;
}

export async function loadStoredThemeState(): Promise<StoredThemeState> {
  try {
    const [rawUnlockedThemes, rawActiveTheme] = await Promise.all([
      AsyncStorage.getItem(UNLOCKED_THEMES_STORAGE_KEY),
      AsyncStorage.getItem(ACTIVE_THEME_STORAGE_KEY),
    ]);

    const unlockedThemeIds = parseUnlockedThemeIds(rawUnlockedThemes);

    return {
      unlockedThemeIds,
      activeThemeId: getStoredActiveThemeId(rawActiveTheme, unlockedThemeIds),
    };
  } catch {
    return {
      unlockedThemeIds: [DEFAULT_THEME_ID],
      activeThemeId: DEFAULT_THEME_ID,
    };
  }
}

export async function persistUnlockedThemeIds(
  unlockedThemeIds: readonly ThemeId[],
): Promise<void> {
  const sanitizedThemeIds = sanitizeThemeIds(unlockedThemeIds);

  await AsyncStorage.setItem(
    UNLOCKED_THEMES_STORAGE_KEY,
    JSON.stringify(sanitizedThemeIds)
  );
}

export async function persistActiveThemeId(activeThemeId: ThemeId): Promise<void> {
  await AsyncStorage.setItem(
    ACTIVE_THEME_STORAGE_KEY,
    normalizeThemeId(activeThemeId)
  );
}

export async function clearStoredThemeState(): Promise<void> {
  await AsyncStorage.multiRemove(THEME_STORAGE_KEYS);
}
