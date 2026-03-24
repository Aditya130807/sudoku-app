import { getGridConfig } from "./difficulty";
import { countSolutions } from "./solver";
import { Board, GeneratedPuzzle, GridConfig, LevelDefinition } from "./types";
import { cloneBoard } from "./validator";

type RandomSource = () => number;

function createRandom(seed: number): RandomSource {
  return function seededRandom() {
    let currentSeed = (seed += 0x6d2b79f5);
    currentSeed = Math.imul(currentSeed ^ (currentSeed >>> 15), currentSeed | 1);
    currentSeed ^= currentSeed + Math.imul(currentSeed ^ (currentSeed >>> 7), currentSeed | 61);
    return ((currentSeed ^ (currentSeed >>> 14)) >>> 0) / 4294967296;
  };
}

function range(length: number): number[] {
  return Array.from({ length }, (_, index) => index);
}

function shuffle<T>(values: T[], random: RandomSource): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const currentValue = result[index];
    result[index] = result[swapIndex];
    result[swapIndex] = currentValue;
  }

  return result;
}

function pattern(row: number, col: number, config: GridConfig): number {
  return (
    (config.boxCols * (row % config.boxRows) +
      Math.floor(row / config.boxRows) +
      col) %
    config.size
  );
}

function buildSolvedBoard(config: GridConfig, random: RandomSource): Board {
  const rowBandOrder = shuffle(range(config.size / config.boxRows), random);
  const rows = rowBandOrder.flatMap((band) =>
    shuffle(range(config.boxRows), random).map((row) => band * config.boxRows + row)
  );
  const columnStackOrder = shuffle(range(config.size / config.boxCols), random);
  const columns = columnStackOrder.flatMap((stack) =>
    shuffle(range(config.boxCols), random).map(
      (column) => stack * config.boxCols + column
    )
  );
  const symbols = shuffle([...config.symbols], random);

  return rows.map((row) =>
    columns.map((column) => symbols[pattern(row, column, config)])
  );
}

function carvePuzzle(
  solution: Board,
  config: GridConfig,
  targetClues: number,
  random: RandomSource
): Board {
  const puzzle = cloneBoard(solution);
  const positions = shuffle(
    range(config.size * config.size).map((index) => ({
      row: Math.floor(index / config.size),
      col: index % config.size,
    })),
    random
  );
  let filledCells = config.size * config.size;

  for (const position of positions) {
    if (filledCells <= targetClues) {
      break;
    }

    const previousValue = puzzle[position.row][position.col];
    puzzle[position.row][position.col] = null;

    const solutionCount = countSolutions(puzzle, config, 2);

    if (solutionCount !== 1) {
      puzzle[position.row][position.col] = previousValue;
      continue;
    }

    filledCells -= 1;
  }

  return puzzle;
}

export function generatePuzzle(level: LevelDefinition): GeneratedPuzzle {
  const config = getGridConfig(level.size);
  const random = createRandom(level.seed);
  const solution = buildSolvedBoard(config, random);
  const puzzle = carvePuzzle(solution, config, level.targetClues, random);

  return {
    puzzle,
    solution,
  };
}
