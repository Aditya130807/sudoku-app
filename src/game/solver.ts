import { Board, GridConfig, HintMove } from "./types";
import { cloneBoard, isValueAllowed } from "./validator";

interface SearchTarget {
  row: number;
  col: number;
  candidates: number[];
}

function getCandidates(
  board: Board,
  row: number,
  col: number,
  config: GridConfig
): number[] {
  if (board[row][col] !== null) {
    return [];
  }

  return config.symbols.filter((value) =>
    isValueAllowed(board, row, col, value, config)
  );
}

function findBestSearchTarget(
  board: Board,
  config: GridConfig
): SearchTarget | null {
  let bestTarget: SearchTarget | null = null;

  for (let row = 0; row < config.size; row += 1) {
    for (let col = 0; col < config.size; col += 1) {
      if (board[row][col] !== null) {
        continue;
      }

      const candidates = getCandidates(board, row, col, config);

      if (candidates.length === 0) {
        return {
          row,
          col,
          candidates,
        };
      }

      if (!bestTarget || candidates.length < bestTarget.candidates.length) {
        bestTarget = {
          row,
          col,
          candidates,
        };
      }
    }
  }

  return bestTarget;
}

function solveRecursive(board: Board, config: GridConfig): boolean {
  const target = findBestSearchTarget(board, config);

  if (!target) {
    return true;
  }

  if (target.candidates.length === 0) {
    return false;
  }

  for (const value of target.candidates) {
    board[target.row][target.col] = value;

    if (solveRecursive(board, config)) {
      return true;
    }

    board[target.row][target.col] = null;
  }

  return false;
}

function countSolutionsRecursive(
  board: Board,
  config: GridConfig,
  limit: number
): number {
  if (limit <= 0) {
    return 0;
  }

  const target = findBestSearchTarget(board, config);

  if (!target) {
    return 1;
  }

  if (target.candidates.length === 0) {
    return 0;
  }

  let count = 0;

  for (const value of target.candidates) {
    board[target.row][target.col] = value;
    count += countSolutionsRecursive(board, config, limit - count);
    board[target.row][target.col] = null;

    if (count >= limit) {
      return count;
    }
  }

  return count;
}

export function solveBoard(board: Board, config: GridConfig): Board | null {
  const attempt = cloneBoard(board);
  return solveRecursive(attempt, config) ? attempt : null;
}

export function countSolutions(
  board: Board,
  config: GridConfig,
  limit = 2
): number {
  const attempt = cloneBoard(board);
  return countSolutionsRecursive(attempt, config, limit);
}

export function getHintMove(
  board: Board,
  puzzle: Board,
  solution: Board
): HintMove | null {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (puzzle[row][col] !== null) {
        continue;
      }

      if (board[row][col] !== solution[row][col]) {
        return {
          row,
          col,
          value: solution[row][col] as number,
          reason:
            board[row][col] === null
              ? "A safe value has been placed for you."
              : "This cell has been corrected to the solved path.",
        };
      }
    }
  }

  return null;
}
