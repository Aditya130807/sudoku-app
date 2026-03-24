import { DifficultyTier, GridConfig, GridSize } from "./types";

export const GRID_CONFIGS: Record<GridSize, GridConfig> = {
  6: {
    size: 6,
    boxRows: 2,
    boxCols: 3,
    symbols: [1, 2, 3, 4, 5, 6],
  },
  9: {
    size: 9,
    boxRows: 3,
    boxCols: 3,
    symbols: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  },
};

export const TIER_DESCRIPTIONS: Record<DifficultyTier, string> = {
  Beginner: "Gentle 9x9 warmups focused on rhythm and confidence.",
  Intermediate: "Classic 9x9 puzzles with plenty of visible momentum.",
  Advanced: "Lean 9x9 boards that reward careful scanning and planning.",
  Expert: "Complex endgame-heavy 9x9 runs for focused solvers.",
};

export function getGridConfig(size: GridSize): GridConfig {
  return GRID_CONFIGS[size];
}
