import { Board, CellPosition, CellStateBoard, GridConfig, SectionCompletion } from "./types";

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function cloneCellStateBoard(cellStates: CellStateBoard): CellStateBoard {
  return cellStates.map((row) =>
    row.map((cell) => ({
      value: cell.value,
      notes: [...cell.notes],
    }))
  );
}

export function getCellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function getBoxIndex(
  row: number,
  col: number,
  config: GridConfig
): number {
  const boxesPerRow = config.size / config.boxCols;
  return (
    Math.floor(row / config.boxRows) * boxesPerRow +
    Math.floor(col / config.boxCols)
  );
}

export function isValueAllowed(
  board: Board,
  row: number,
  col: number,
  value: number,
  config: GridConfig
): boolean {
  for (let index = 0; index < config.size; index += 1) {
    if (index !== col && board[row][index] === value) {
      return false;
    }

    if (index !== row && board[index][col] === value) {
      return false;
    }
  }

  const boxStartRow = Math.floor(row / config.boxRows) * config.boxRows;
  const boxStartCol = Math.floor(col / config.boxCols) * config.boxCols;

  for (let rowOffset = 0; rowOffset < config.boxRows; rowOffset += 1) {
    for (let colOffset = 0; colOffset < config.boxCols; colOffset += 1) {
      const currentRow = boxStartRow + rowOffset;
      const currentCol = boxStartCol + colOffset;

      if (currentRow === row && currentCol === col) {
        continue;
      }

      if (board[currentRow][currentCol] === value) {
        return false;
      }
    }
  }

  return true;
}

export function getIncorrectCellKeys(
  board: Board,
  solution: Board
): Set<string> {
  const incorrectKeys = new Set<string>();

  board.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      if (value !== null && value !== solution[rowIndex][colIndex]) {
        incorrectKeys.add(getCellKey(rowIndex, colIndex));
      }
    });
  });

  return incorrectKeys;
}

export function isBoardSolved(board: Board, solution: Board): boolean {
  for (let row = 0; row < board.length; row += 1) {
    for (let col = 0; col < board[row].length; col += 1) {
      if (board[row][col] !== solution[row][col]) {
        return false;
      }
    }
  }

  return true;
}

export function getCompletedSections(
  board: Board,
  solution: Board,
  config: GridConfig
): SectionCompletion {
  const rows: number[] = [];
  const columns: number[] = [];
  const boxes: number[] = [];
  const boxesPerRow = config.size / config.boxCols;
  const totalBoxes = (config.size / config.boxRows) * boxesPerRow;

  for (let row = 0; row < config.size; row += 1) {
    const completed = board[row].every(
      (value, col) => value !== null && value === solution[row][col]
    );

    if (completed) {
      rows.push(row);
    }
  }

  for (let col = 0; col < config.size; col += 1) {
    let completed = true;

    for (let row = 0; row < config.size; row += 1) {
      if (board[row][col] === null || board[row][col] !== solution[row][col]) {
        completed = false;
        break;
      }
    }

    if (completed) {
      columns.push(col);
    }
  }

  for (let boxIndex = 0; boxIndex < totalBoxes; boxIndex += 1) {
    const boxRowStart = Math.floor(boxIndex / boxesPerRow) * config.boxRows;
    const boxColStart = (boxIndex % boxesPerRow) * config.boxCols;
    let completed = true;

    for (let rowOffset = 0; rowOffset < config.boxRows; rowOffset += 1) {
      for (let colOffset = 0; colOffset < config.boxCols; colOffset += 1) {
        const row = boxRowStart + rowOffset;
        const col = boxColStart + colOffset;

        if (board[row][col] === null || board[row][col] !== solution[row][col]) {
          completed = false;
          break;
        }
      }

      if (!completed) {
        break;
      }
    }

    if (completed) {
      boxes.push(boxIndex);
    }
  }

  return {
    rows,
    columns,
    boxes,
  };
}

export function isInSameSection(
  first: CellPosition,
  second: CellPosition,
  config: GridConfig
): boolean {
  return (
    first.row === second.row ||
    first.col === second.col ||
    getBoxIndex(first.row, first.col, config) ===
      getBoxIndex(second.row, second.col, config)
  );
}
