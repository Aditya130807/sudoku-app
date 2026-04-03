import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

const DEFAULT_VOLUME = 0.7;
const MIN_PLAY_INTERVAL_MS = 45;

const THEME_INPUT_KEY_MAP = {
  wood: "wooden",
  wooden: "wooden",
  volcanic: "volcanic",
  fire: "volcanic",
  slime: "slime",
  ice: "ice",
  classic: "classic",
};

const SOUND_ASSETS = {
  click: require("../assets/sounds/click.mp3"),
  wooden: require("../assets/sounds/wooden_input.wav"),
  volcanic: require("../assets/sounds/fire_input.mp3"),
  slime: require("../assets/sounds/slime_input.mp3"),
  ice: require("../assets/sounds/ice_input.mp3"),
  hint: require("../assets/sounds/hint.wav"),
  success: require("../assets/sounds/success.wav"),
  login: require("../assets/sounds/login.wav"),
};

const soundMap = {
  click: null,
  wooden: null,
  volcanic: null,
  slime: null,
  ice: null,
  classic: null,
  hint: null,
  success: null,
  login: null,
};

const lastPlayedAt = new Map();
let preloadPromise = null;
let soundEnabled = true;

function shouldSkipRapidReplay(soundKey) {
  const now = Date.now();
  const lastPlayed = lastPlayedAt.get(soundKey) ?? 0;

  if (now - lastPlayed < MIN_PLAY_INTERVAL_MS) {
    return true;
  }

  lastPlayedAt.set(soundKey, now);
  return false;
}

async function loadSound(soundKey, asset) {
  const sound = new Audio.Sound();

  await sound.loadAsync(asset, {
    shouldPlay: false,
    isLooping: false,
    volume: DEFAULT_VOLUME,
  });

  soundMap[soundKey] = sound;
}

export function setSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
}

export function getLoadedSounds() {
  return soundMap;
}

export async function preloadSounds() {
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async () => {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    });

    await Promise.all(
      Object.entries(SOUND_ASSETS).map(([soundKey, asset]) =>
        loadSound(soundKey, asset),
      ),
    );

    // Classic theme input shares the default click sound.
    soundMap.classic = soundMap.click;
  })();

  try {
    await preloadPromise;
  } catch (error) {
    preloadPromise = null;
    throw error;
  }
}

function playSoundByKey(soundKey) {
  if (!soundEnabled) {
    return;
  }

  const sound = soundMap[soundKey];

  if (!sound) {
    void preloadSounds();
    return;
  }

  if (shouldSkipRapidReplay(soundKey)) {
    return;
  }

  void sound.replayAsync().catch(() => {
    // Ignore playback failures to keep interaction handlers stable.
  });
}

export async function playInputSound(theme) {
  if (!soundEnabled) {
    return;
  }

  const normalizedTheme =
    typeof theme === "string" ? theme.trim().toLowerCase() : "";
  const mappedTheme = THEME_INPUT_KEY_MAP[normalizedTheme];

  if (!mappedTheme) {
    return;
  }

  const sound = soundMap[mappedTheme];

  if (!sound) {
    return;
  }

  if (shouldSkipRapidReplay(mappedTheme)) {
    return;
  }

  try {
    await sound.replayAsync();
  } catch {}
}

export async function playClickSound() {
  if (!soundEnabled) {
    return;
  }

  const clickSound = soundMap.click;

  if (!clickSound) {
    return;
  }

  if (shouldSkipRapidReplay("click")) {
    return;
  }

  try {
    await clickSound.replayAsync();
  } catch {}
}

export function playHintSound() {
  playSoundByKey("hint");
}

export function playSuccessSound() {
  playSoundByKey("success");
}

export function playLoginSound() {
  playSoundByKey("login");
}

export async function unloadSounds() {
  const uniqueSounds = new Set(
    Object.values(soundMap).filter((sound) => sound !== null),
  );

  await Promise.all(
    Array.from(uniqueSounds).map(async (sound) => {
      try {
        await sound.unloadAsync();
      } catch {
        // Ignore unload failures to keep shutdown robust.
      }
    }),
  );

  Object.keys(soundMap).forEach((key) => {
    soundMap[key] = null;
  });

  lastPlayedAt.clear();
  preloadPromise = null;
}
