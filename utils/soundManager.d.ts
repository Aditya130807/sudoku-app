export type InputTheme =
  | "wood"
  | "wooden"
  | "volcanic"
  | "slime"
  | "ice"
  | "classic"
  | string;

export type SoundKey =
  | "click"
  | "wooden"
  | "volcanic"
  | "slime"
  | "ice"
  | "classic"
  | "hint"
  | "success"
  | "login";

export type LoadedSoundMap = Record<
  SoundKey,
  import("expo-av").Audio.Sound | null
>;

export function setSoundEnabled(enabled: boolean): void;
export function getLoadedSounds(): LoadedSoundMap;
export function preloadSounds(): Promise<void>;
export function playInputSound(theme: InputTheme): Promise<void>;
export function playClickSound(): Promise<void>;
export function playHintSound(): void;
export function playSuccessSound(): void;
export function playLoginSound(): void;
export function unloadSounds(): Promise<void>;
