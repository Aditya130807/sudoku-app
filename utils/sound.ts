import { createAudioPlayer, type AudioPlayer } from "expo-audio";

const CLICK_SOUND = require("../assets/sounds/click.mp3");
const SUCCESS_SOUND = require("../assets/sounds/success.mp3");

type SoundAsset = number;

async function playSound(asset: SoundAsset) {
  let player: AudioPlayer | null = null;
  let playbackSubscription: { remove: () => void } | null = null;
  let isRemoved = false;

  const removePlayer = () => {
    if (playbackSubscription) {
      playbackSubscription.remove();
      playbackSubscription = null;
    }

    if (!player || isRemoved) {
      return;
    }

    isRemoved = true;

    try {
      player.remove();
    } catch {
      // Keep caller safe even when cleanup fails.
    }
  };

  try {
    player = createAudioPlayer(asset, {
      keepAudioSessionActive: true,
    });

    playbackSubscription = player.addListener(
      "playbackStatusUpdate",
      (status) => {
        if (!status.isLoaded || status.didJustFinish) {
          removePlayer();
          return;
        }
      },
    );

    player.play();
  } catch {
    removePlayer();
  }
}

export function playClickSound() {
  return playSound(CLICK_SOUND);
}

export function playSuccessSound() {
  return playSound(SUCCESS_SOUND);
}
