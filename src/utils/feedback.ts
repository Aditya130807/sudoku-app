import { lightTap, success } from "./haptics";
import { playClickSound, playSuccessSound } from "./sound";

async function runFeedback(effects: (() => Promise<void>)[]) {
  await Promise.allSettled(effects.map((effect) => effect()));
}

export function onButtonPress() {
  return runFeedback([lightTap, playClickSound]);
}

export function onGameWin() {
  return runFeedback([success, playSuccessSound]);
}
