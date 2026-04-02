import { Audio } from "expo-av";

const CLICK_SOUND = require("../../assets/sounds/click.mp3");
const SUCCESS_SOUND = require("../../assets/sounds/success.mp3");

type SoundAsset = number;

async function playSound(asset: SoundAsset) {
  let sound: Audio.Sound | null = null;
  let isUnloaded = false;

  const unloadSound = async () => {
    if (!sound || isUnloaded) {
      return;
    }

    isUnloaded = true;
    sound.setOnPlaybackStatusUpdate(null);

    try {
      await sound.unloadAsync();
    } catch {
      // Ignore unload failures to avoid breaking the caller.
    }
  };

  try {
    const createdSound = await Audio.Sound.createAsync(asset);
    sound = createdSound.sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        void unloadSound();
        return;
      }

      if (status.didJustFinish) {
        void unloadSound();
      }
    });

    await sound.playAsync();
  } catch {
    await unloadSound();
  }
}

export function playClickSound() {
  return playSound(CLICK_SOUND);
}

export function playSuccessSound() {
  return playSound(SUCCESS_SOUND);
}
