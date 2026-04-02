import React from "react";
import { Image, ImageSourcePropType, StyleSheet, View } from "react-native";

import { COLORS } from "../constants/colors";
import type { ThemeColors, ThemeId } from "../constants/themes";
import { getGridConfig } from "../game/difficulty";
import {
  Board,
  CellPosition,
  CellStateBoard,
  GridSize,
  SectionCompletion,
} from "../game/types";
import { getCellKey, isInSameSection } from "../game/validator";
import { hexToRgba } from "../utils/colorUtils";
import Cell from "./Cell";

interface SudokuGridProps {
  boardSize: number;
  size: GridSize;
  board: Board;
  solution: Board;
  cellStates: CellStateBoard;
  puzzle: Board;
  selectedCell: CellPosition | null;
  selectedValue: number | null;
  incorrectCellKeys: Set<string>;
  completedSections: SectionCompletion;
  hintHighlight: Record<string, boolean>;
  hintErrors: Record<string, boolean>;
  onPressCell: (row: number, col: number) => void;
  gridImage: ImageSourcePropType;
  gridViewport?: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  themeId?: ThemeId;
  themeColors?: ThemeColors;
}

export default function SudokuGrid({
  boardSize,
  size,
  board,
  solution,
  cellStates,
  puzzle,
  selectedCell,
  selectedValue,
  incorrectCellKeys,
  completedSections: _completedSections,
  hintHighlight,
  hintErrors,
  onPressCell,
  gridImage,
  gridViewport,
  themeId,
  themeColors,
}: SudokuGridProps) {
  const gridDimension = 9;
  const config = getGridConfig(size);
  const cellSize = boardSize / gridDimension;
  const viewport = gridViewport ?? {
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  };
  const backgroundStyle = {
    width: boardSize / viewport.width,
    height: boardSize / viewport.height,
    left: (-viewport.left * boardSize) / viewport.width,
    top: (-viewport.top * boardSize) / viewport.height,
  };

  const textColor = themeColors?.text ?? COLORS.text;
  const lineColor = hexToRgba(textColor, 0.28);
  const correctColor =
    themeId === "classic"
      ? "#22C55E"
      : (themeColors?.correctColor ?? "#22C55E");
  const grid = board;

  function isRowComplete(rowIndex: number) {
    return grid[rowIndex].every(
      (val, colIndex) => val !== null && val === solution[rowIndex][colIndex],
    );
  }

  function isColComplete(colIndex: number) {
    return grid.every(
      (row, rowIndex) =>
        row[colIndex] !== null &&
        row[colIndex] === solution[rowIndex][colIndex],
    );
  }

  function isBoxComplete(boxRow: number, boxCol: number) {
    for (let r = boxRow * 3; r < boxRow * 3 + 3; r += 1) {
      for (let c = boxCol * 3; c < boxCol * 3 + 3; c += 1) {
        if (grid[r][c] === null || grid[r][c] !== solution[r][c]) {
          return false;
        }
      }
    }

    return true;
  }

  const cells = board.flatMap((row, rowIndex) =>
    row.map((value, colIndex) => {
      const cellPosition = { row: rowIndex, col: colIndex };
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
      const rowDone = isRowComplete(rowIndex);
      const colDone = isColComplete(colIndex);
      const boxDone = isBoxComplete(
        Math.floor(rowIndex / 3),
        Math.floor(colIndex / 3),
      );
      const isLineComplete = rowDone || colDone || boxDone;
      const hintKey = `${rowIndex}-${colIndex}`;

      return (
        <Cell
          key={getCellKey(rowIndex, colIndex)}
          value={value}
          notes={cellStates[rowIndex][colIndex].notes}
          size={cellSize}
          left={colIndex * cellSize}
          top={rowIndex * cellSize}
          isPrefilled={puzzle[rowIndex][colIndex] !== null}
          isSelected={isSelected}
          isRelated={isRelated}
          isMatching={isMatching}
          isIncorrect={incorrectCellKeys.has(getCellKey(rowIndex, colIndex))}
          isHintHighlighted={!!hintHighlight[hintKey]}
          isHintError={!!hintErrors[hintKey]}
          isLineComplete={isLineComplete}
          correctColor={correctColor}
          onPress={() => onPressCell(rowIndex, colIndex)}
          themeColors={themeColors}
        />
      );
    }),
  );

  return (
    <View
      style={[
        styles.wrapper,
        {
          width: boardSize,
          height: boardSize,
          shadowColor: hexToRgba(textColor, 0.25),
        },
      ]}
    >
      <Image
        resizeMode="stretch"
        source={gridImage}
        style={[styles.backgroundImage, backgroundStyle]}
      />
      <View style={styles.overlay}>
        <View style={styles.gridLinesLayer} pointerEvents="none">
          <View
            style={[
              styles.outerBorder,
              {
                borderColor: lineColor,
              },
            ]}
          />

          {Array.from({ length: gridDimension - 1 }, (_, index) => {
            const lineIndex = index + 1;
            const isMajor = lineIndex % 3 === 0;
            const thickness = isMajor ? 2 : 1;
            const position = lineIndex * cellSize - thickness / 2;

            return (
              <View key={`v-${lineIndex}`}>
                <View
                  style={[
                    styles.verticalLine,
                    {
                      left: position,
                      width: thickness,
                      backgroundColor: lineColor,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.horizontalLine,
                    {
                      top: position,
                      height: thickness,
                      backgroundColor: lineColor,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>

        <View style={styles.cellsLayer}>{cells}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: "center",
    borderRadius: 0,
    overflow: "hidden",
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 16,
    },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 4,
  },
  backgroundImage: {
    position: "absolute",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLinesLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  cellsLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  outerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
  },
  verticalLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  horizontalLine: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
