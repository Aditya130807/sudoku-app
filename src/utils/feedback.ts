import { lightTap, success } from "./haptics";
import { playClickSound } from "./sound";

async function runFeedback(effects: Array<() => Promise<void> | void>) {
  await Promise.allSettled(effects.map((effect) => Promise.resolve(effect())));
}

export function onButtonPress() {
  return runFeedback([lightTap, playClickSound]);
}

export function onGameWin() {
  return runFeedback([success]);
}
