/**
 * Returns the recommended time goal for a given difficulty.
 *
 * All values are in seconds.
 * Keep this file UI-agnostic so the rest of the app can reuse it.
 */
export function getTimeGoal(difficulty: string): number {
  const key = difficulty.trim().toLowerCase();

  // Ranges (in minutes) requested:
  // beginner → 5–7 min
  // easy → 7–10 min
  // medium → 10–15 min
  // hard → 15–20 min
  //
  // We return deterministic midpoints so every level in the same tier uses a
  // consistent and fair goal.
  const midpointsSeconds: Record<string, number> = {
    beginner: 6 * 60, // 360s
    easy: 8.5 * 60, // 510s
    medium: 12.5 * 60, // 750s
    hard: 17.5 * 60, // 1050s
  };

  // Map app tiers to the requested label set.
  const normalized =
    key === "beginner"
      ? "beginner"
      : key === "intermediate"
        ? "easy"
        : key === "advanced"
          ? "medium"
          : key === "expert"
            ? "hard"
            : key;

  const value = midpointsSeconds[normalized];
  // Fallback to a reasonable beginner goal.
  return Math.round(value ?? midpointsSeconds.beginner);
}

