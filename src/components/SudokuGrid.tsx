import React from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import { COLORS } from "../constants/colors";
import { getGridConfig } from "../game/difficulty";
import {
  Board,
  CellPosition,
  CellStateBoard,
  GridSize,
  SectionCompletion,
} from "../game/types";
import { getBoxIndex, getCellKey, isInSameSection } from "../game/validator";
import Cell from "./Cell";

interface SudokuGridProps {
  size: GridSize;
  board: Board;
  cellStates: CellStateBoard;
  puzzle: Board;
  selectedCell: CellPosition | null;
  selectedValue: number | null;
  incorrectCellKeys: Set<string>;
  completedSections: SectionCompletion;
  onPressCell: (row: number, col: number) => void;
}

export default function SudokuGrid({
  size,
  board,
  cellStates,
  puzzle,
  selectedCell,
  selectedValue,
  incorrectCellKeys,
  completedSections,
  onPressCell,
}: SudokuGridProps) {
  const { width } = useWindowDimensions();
  const config = getGridConfig(size);
  const boardSize = Math.min(width - 32, size === 6 ? 330 : 360);
  const cellSize = Math.floor(boardSize / size);

  return (
    <View style={[styles.wrapper, { width: cellSize * size }]}>
      {board.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((value, colIndex) => {
            const cellPosition = { row: rowIndex, col: colIndex };
            const boxIndex = getBoxIndex(rowIndex, colIndex, config);
            const isSelected =
              selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
            const isRelated =
              !!selectedCell &&
              !isSelected &&
              isInSameSection(selectedCell, cellPosition, config);
            const isMatching =
              selectedValue !== null &&
              value !== null &&
              value === selectedValue &&
              !isSelected;
            const isCompleted =
              completedSections.rows.includes(rowIndex) ||
              completedSections.columns.includes(colIndex) ||
              completedSections.boxes.includes(boxIndex);

            return (
              <Cell
                key={getCellKey(rowIndex, colIndex)}
                value={value}
                notes={cellStates[rowIndex][colIndex].notes}
                size={cellSize}
                isPrefilled={puzzle[rowIndex][colIndex] !== null}
                isSelected={isSelected}
                isRelated={isRelated}
                isMatching={isMatching}
                isIncorrect={incorrectCellKeys.has(getCellKey(rowIndex, colIndex))}
                isCompleted={isCompleted}
                onPress={() => onPressCell(rowIndex, colIndex)}
                borderStyle={{
                  borderTopWidth: rowIndex % config.boxRows === 0 ? 2 : 1,
                  borderLeftWidth: colIndex % config.boxCols === 0 ? 2 : 1,
                  borderRightWidth:
                    colIndex === size - 1 ? 2 : (colIndex + 1) % config.boxCols === 0 ? 2 : 0,
                  borderBottomWidth:
                    rowIndex === size - 1 ? 2 : (rowIndex + 1) % config.boxRows === 0 ? 2 : 0,
                  borderColor: isCompleted ? COLORS.accent : COLORS.borderStrong,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "center",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: COLORS.surface,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 16,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  row: {
    flexDirection: "row",
  },
});
