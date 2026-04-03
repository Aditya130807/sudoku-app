export type GridSize = 6 | 9;
export type DifficultyTier =
  | "Beginner"
  | "Intermediate"
  | "Advanced"
  | "Expert";
export type CellValue = number | null;
export type Board = CellValue[][];
export interface CellState {
  value: CellValue;
  notes: number[];
}
export type CellStateBoard = CellState[][];
export type LevelStatus = "locked" | "unlocked" | "in_progress" | "completed";

export interface GridConfig {
  size: GridSize;
  boxRows: number;
  boxCols: number;
  symbols: number[];
}

export interface CellPosition {
  row: number;
  col: number;
}

export interface LevelDefinition {
  id: number;
  order: number;
  title: string;
  theme: string;
  tier: DifficultyTier;
  size: GridSize;
  targetClues: number;
  hintLimit: number;
  targetTimeSeconds: number;
  unlocksAt: number | null;
  seed: number;
  rewardLabel: string;
  description: string;
}

export interface LevelProgress {
  status: LevelStatus;
  bestTimeSeconds: number | null;
  bestScore: number | null;
  stars: number;
  hintsUsed: number;
  attempts: number;
  completedAt: string | null;
}

export interface GameSettings {
  completionIndicator: boolean;
  mistakeHighlighting: boolean;
  autoCheck: boolean;
  soundEnabled: boolean;
}

export interface GameSession {
  levelId: number;
  isDailyChallenge?: boolean;
  challengeType?: "speed" | "noHint" | "mystery";
  puzzle: Board;
  solution: Board;
  board: Board;
  cellStates: CellStateBoard;
  selectedCell: CellPosition | null;
  hintsRemaining: number;
  hintsUsed: number;
  startedAt: number;
  elapsedSeconds: number;
  status: "playing" | "completed";
  score: number | null;
  stars: number;
  completedAt: string | null;
}

export interface GeneratedPuzzle {
  puzzle: Board;
  solution: Board;
}

export interface SectionCompletion {
  rows: number[];
  columns: number[];
  boxes: number[];
}

export interface HintMove {
  row: number;
  col: number;
  value: number;
  reason: string;
}

export interface GameMetrics {
  elapsedSeconds: number;
  score: number;
  stars: number;
}
