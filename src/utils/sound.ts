import {
  playClickSound as playThemedClickSound,
  playSuccessSound as playThemedSuccessSound,
} from "../../utils/soundManager";

export function playClickSound() {
  void playThemedClickSound().catch(() => {
    // Keep button feedback resilient when audio playback fails.
  });
  return Promise.resolve();
}

export function playSuccessSound() {
  playThemedSuccessSound();
  return Promise.resolve();
}
