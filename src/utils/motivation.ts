import { DifficultyTier } from "../game/types";

export function getDifficultyLabel(tier: DifficultyTier): string {
  switch (tier) {
    case "Beginner":
      return "Beginner";
    case "Intermediate":
      return "Easy";
    case "Advanced":
      return "Medium";
    case "Expert":
      return "Hard";
  }
}

export type MotivationalMessageInput = {
  levelId: number;
  tier: DifficultyTier;
  completedLevels: number;
  totalLevels: number;
  totalStars: number;
};

export function getMotivationalMessage(
  input: MotivationalMessageInput
): string {
  const { tier, completedLevels, totalLevels, totalStars } = input;

  const completionRatio = totalLevels > 0 ? completedLevels / totalLevels : 0;
  const starIntensity = completedLevels > 0 ? totalStars / completedLevels : 0;

  // Make messages feel responsive early on.
  if (completionRatio <= 0.15) {
    return "Great start! Keep going 🔥";
  }

  if (tier === "Expert") {
    if (completionRatio >= 0.6) return "Almost there, stay sharp 🧠";
    return starIntensity >= 2 ? "You're improving fast 💪" : "Ready for the next challenge?";
  }

  if (completionRatio >= 0.8) {
    return "Almost there, stay sharp 🧠";
  }

  if (starIntensity >= 2) {
    return "You're improving fast 💪";
  }

  // Default fallback
  return "Ready for the next challenge?";
}

