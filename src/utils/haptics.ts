import * as Haptics from "expo-haptics";

async function runHaptic(effect: () => Promise<void>) {
  try {
    await effect();
  } catch {
    // Keep interactions stable on platforms where haptics are unavailable.
  }
}

export function lightTap() {
  return runHaptic(() => Haptics.selectionAsync());
}

export function success() {
  return runHaptic(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

export function error() {
  return runHaptic(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  );
}
