export type RewardCalculationInput = {
  elapsedSeconds: number;
  targetTimeSeconds: number;
  /**
   * Mistakes made during the run (if tracked).
   * If your app doesn't track mistakes, pass `0`.
   */
  mistakes?: number;
};

export type RewardCalculationResult = {
  stars: 1 | 2 | 3;
  efficiency: number; // 0 - 100
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Converts completion performance into:
 * - 1 to 3 stars (time + mistakes)
 * - an efficiency percentage (higher is better)
 *
 * NOTE: This is intentionally UI-agnostic so it can be reused in other screens.
 */
export function calculateStarsAndEfficiency(
  input: RewardCalculationInput
): RewardCalculationResult {
  const elapsedSeconds = Math.max(0, Math.floor(input.elapsedSeconds));
  const targetTimeSeconds = Math.max(1, Math.floor(input.targetTimeSeconds));
  const mistakes = Math.max(0, Math.floor(input.mistakes ?? 0));

  // Time penalty grows as the solve drifts further past the target.
  // Example: if elapsedSeconds === targetTimeSeconds => timePenalty = 0.
  const timeOver = Math.max(0, elapsedSeconds - targetTimeSeconds);
  // Keep this forgiving so longer goal times remain fair.
  const timePenalty = Math.round((timeOver / targetTimeSeconds) * 60);

  // Tune these constants for the reward feel. (Keep them small so efficiency
  // doesn't collapse to 0 too quickly.)
  const mistakesPenaltyPer = 6;
  const efficiency = clamp(100 - mistakes * mistakesPenaltyPer - timePenalty, 0, 100);

  const moderateTimeThresholdSeconds = Math.round(targetTimeSeconds * 1.45);

  let stars: 1 | 2 | 3 = 1;
  if (mistakes === 0 && elapsedSeconds <= targetTimeSeconds) {
    stars = 3;
  } else if (elapsedSeconds <= moderateTimeThresholdSeconds && mistakes <= 1) {
    stars = 2;
  }

  return { stars, efficiency };
}

