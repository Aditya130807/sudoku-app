import { getLevelDefinition, getNextLevelId, LEVELS } from "../constants/levels";
import { PUZZLES } from "../data/puzzles";
import { getGridConfig } from "../game/difficulty";
import {
  Board,
  CellStateBoard,
  GameMetrics,
  GameSession,
  GameSettings,
  GeneratedPuzzle,
  LevelProgress,
  SectionCompletion,
} from "../game/types";
import { getHintMove } from "../game/solver";
import {
  cloneBoard,
  cloneCellStateBoard,
  getCompletedSections,
  getIncorrectCellKeys,
  isBoardSolved,
} from "../game/validator";
import { storageService } from "./storageService";
import { gameStore } from "../store/gameStore";
import { userStore } from "../store/userStore";

export interface GameActionResult {
  ok: boolean;
  completed?: boolean;
  message?: string;
  nextLevelId?: number | null;
}

export interface BoardHighlights {
  selectedValue: number | null;
  incorrectCellKeys: Set<string>;
  completedSections: SectionCompletion;
}

const puzzleCache = new Map<number, GeneratedPuzzle>();

function createCellStatesFromBoard(board: Board): CellStateBoard {
  return board.map((row) =>
    row.map((value) => ({
      value,
      notes: [],
    }))
  );
}

function createPersistableSession(session: GameSession): GameSession {
  return {
    ...session,
    puzzle: cloneBoard(session.puzzle),
    solution: cloneBoard(session.solution),
    board: cloneBoard(session.board),
    cellStates: cloneCellStateBoard(session.cellStates),
    selectedCell: session.selectedCell ? { ...session.selectedCell } : null,
    elapsedSeconds: getElapsedSeconds(session),
    startedAt: Date.now(),
  };
}

function persistSession(session: GameSession) {
  void storageService.saveGame(createPersistableSession(session));
}

function getGeneratedPuzzle(levelId: number): GeneratedPuzzle {
  const cachedPuzzle = puzzleCache.get(levelId);

  if (cachedPuzzle) {
    return {
      puzzle: cloneBoard(cachedPuzzle.puzzle),
      solution: cloneBoard(cachedPuzzle.solution),
    };
  }

  const puzzleData = PUZZLES[levelId];

  if (!puzzleData?.puzzle || !puzzleData?.solution) {
    throw new Error("Puzzle not found");
  }

  const isValidNineByNineGrid = (grid: number[][]) =>
    grid.length === 9 &&
    grid.every(
      (row) =>
        row.length === 9 &&
        row.every((value) => Number.isInteger(value) && value >= 0 && value <= 9)
    );

  if (
    !isValidNineByNineGrid(puzzleData.puzzle) ||
    !isValidNineByNineGrid(puzzleData.solution)
  ) {
    throw new Error(`Puzzle ${levelId} must be a 9x9 grid`);
  }

  const normalizedPuzzle: GeneratedPuzzle = {
    puzzle: puzzleData.puzzle.map((row) =>
      row.map((value) => (value === 0 ? null : value))
    ),
    solution: puzzleData.solution.map((row) =>
      row.map((value) => (value === 0 ? null : value))
    ),
  };

  const hasInvalidSolution = normalizedPuzzle.solution.some((row) =>
    row.some((value) => value === null)
  );

  if (hasInvalidSolution) {
    throw new Error(`Puzzle ${levelId} has invalid solution data`);
  }

  puzzleCache.set(levelId, normalizedPuzzle);

  return {
    puzzle: cloneBoard(normalizedPuzzle.puzzle),
    solution: cloneBoard(normalizedPuzzle.solution),
  };
}

function createSession(levelId: number): GameSession {
  const level = getLevelDefinition(levelId);
  const generatedPuzzle = getGeneratedPuzzle(levelId);
  if (!level) {
  throw new Error("Invalid level");
}

  return {
    levelId,
    puzzle: generatedPuzzle.puzzle,
    solution: generatedPuzzle.solution,
    board: cloneBoard(generatedPuzzle.puzzle),
    cellStates: createCellStatesFromBoard(generatedPuzzle.puzzle),
    selectedCell: null,
    hintsRemaining: level.hintLimit,
    hintsUsed: 0,
    startedAt: Date.now(),
    elapsedSeconds: 0,
    status: "playing",
    score: null,
    stars: 0,
    completedAt: null,
  };
}

export function getElapsedSeconds(session: GameSession): number {
  if (session.status === "completed") {
    return session.elapsedSeconds;
  }

  return (
    session.elapsedSeconds +
    Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000))
  );
}

function calculateMetrics(
  session: GameSession,
  elapsedSeconds: number
): GameMetrics {
  const level = getLevelDefinition(session.levelId);
  const baseScore =
    1000 + Math.max(0, level.targetTimeSeconds - elapsedSeconds) * 2;
  const hintPenalty = session.hintsUsed * 110;
  const timePenalty = Math.max(0, elapsedSeconds - level.targetTimeSeconds);
  const score = Math.max(200, baseScore - hintPenalty - timePenalty);

  let stars = 1;

  if (elapsedSeconds <= level.targetTimeSeconds && session.hintsUsed <= 1) {
    stars = 3;
  } else if (
    elapsedSeconds <= Math.round(level.targetTimeSeconds * 1.35) &&
    session.hintsUsed <= Math.max(1, level.hintLimit - 1)
  ) {
    stars = 2;
  }

  return {
    elapsedSeconds,
    score,
    stars,
  };
}

function countCompletedLevels(progress: Record<number, LevelProgress>): number {
  return Object.values(progress).filter(
    (entry) => entry.status === "completed"
  ).length;
}

function updateProgressAfterCompletion(
  progress: Record<number, LevelProgress>,
  session: GameSession,
  metrics: GameMetrics
): Record<number, LevelProgress> {
  const updatedProgress = {
    ...progress,
  };
  const currentProgress = updatedProgress[session.levelId];

  updatedProgress[session.levelId] = {
    ...currentProgress,
    status: "completed",
    bestTimeSeconds:
      currentProgress.bestTimeSeconds === null
        ? metrics.elapsedSeconds
        : Math.min(currentProgress.bestTimeSeconds, metrics.elapsedSeconds),
    bestScore:
      currentProgress.bestScore === null
        ? metrics.score
        : Math.max(currentProgress.bestScore, metrics.score),
    stars: Math.max(currentProgress.stars, metrics.stars),
    hintsUsed:
      currentProgress.hintsUsed === 0
        ? session.hintsUsed
        : Math.min(currentProgress.hintsUsed, session.hintsUsed),
    completedAt: new Date().toISOString(),
  };

  const nextLevelId = getNextLevelId(session.levelId);

  if (nextLevelId) {
    const nextLevelProgress = updatedProgress[nextLevelId];

    if (nextLevelProgress.status === "locked") {
      updatedProgress[nextLevelId] = {
        ...nextLevelProgress,
        status: "unlocked",
      };
    }
  }

  return updatedProgress;
}

export const gameService = {
  getLevelCards() {
    const { progress } = gameStore.getState();

    return LEVELS.map((level) => ({
      level,
      progress: progress[level.id],
    }));
  },

  getNextPlayableLevelId(): number {
    const { progress } = gameStore.getState();
    const nextLevel =
      LEVELS.find((level) => progress[level.id].status === "in_progress") ??
      LEVELS.find((level) => progress[level.id].status === "unlocked") ??
      LEVELS[0];

    return nextLevel.id;
  },

  getTotalStars(): number {
    const { progress } = gameStore.getState();
    return Object.values(progress).reduce((sum, entry) => sum + entry.stars, 0);
  },

  startLevel(levelId: number, options?: { forceNew?: boolean }): GameActionResult {
    const currentState = gameStore.getState();
    const levelProgress = currentState.progress[levelId];

    if (!levelProgress || levelProgress.status === "locked") {
      return {
        ok: false,
        message: "That level is still locked.",
      };
    }

    if (
      !options?.forceNew &&
      currentState.activeGame &&
      currentState.activeGame.levelId === levelId &&
      currentState.activeGame.status === "playing"
    ) {
      return {
        ok: true,
        message: "Resumed your current puzzle.",
      };
    }

    const session = createSession(levelId);
    if (!session || !session.board) {
      return { ok: false, message: "Failed to initialize level" };
    }

    gameStore.setState((previousState) => ({
      ...previousState,
      activeGame: session,
      lastPlayedLevelId: levelId,
      progress: {
        ...previousState.progress,
        [levelId]: {
          ...previousState.progress[levelId],
          status:
            previousState.progress[levelId].status === "completed"
              ? "completed"
              : "in_progress",
          attempts: previousState.progress[levelId].attempts + 1,
        },
      },
    }));

    persistSession(session);

    return {
      ok: true,
    };
  },

  resumeLastLevel(): GameActionResult {
    const { lastPlayedLevelId } = gameStore.getState();
    return this.startLevel(lastPlayedLevelId ?? this.getNextPlayableLevelId());
  },

  selectCell(row: number, col: number) {
    const { activeGame } = gameStore.getState();

    if (!activeGame || activeGame.status !== "playing") {
      return;
    }

    gameStore.setState((currentState) => ({
      ...currentState,
      activeGame: currentState.activeGame
        ? {
            ...currentState.activeGame,
            selectedCell: {
              row,
              col,
            },
          }
        : null,
    }));
  },

  inputValue(value: number, options?: { asNote?: boolean }): GameActionResult {
    const currentState = gameStore.getState();
    const { activeGame } = currentState;

    if (!activeGame || activeGame.status !== "playing" || !activeGame.selectedCell) {
      return {
        ok: false,
        message: "Choose a cell first.",
      };
    }

    const { row, col } = activeGame.selectedCell;
      if (
    row < 0 || col < 0 ||
    row >= activeGame.board.length ||
    col >= activeGame.board.length
  ) {
    return { ok: false, message: "Invalid cell" };
  }

    if (activeGame.puzzle[row][col] !== null) {
      return {
        ok: false,
        message: "Prefilled cells cannot be edited.",
      };
    }

    const nextBoard = cloneBoard(activeGame.board);
    const nextCellStates = cloneCellStateBoard(activeGame.cellStates);

    if (options?.asNote) {
      if (nextBoard[row][col] !== null) {
        return {
          ok: false,
          message: "Clear this value before adding notes.",
        };
      }

      const currentNotes = nextCellStates[row][col].notes;
      const nextNotes = currentNotes.includes(value)
        ? currentNotes.filter((note) => note !== value)
        : [...currentNotes, value].sort((a, b) => a - b);

      nextCellStates[row][col] = {
        ...nextCellStates[row][col],
        notes: nextNotes,
      };

      const noteSession: GameSession = {
        ...activeGame,
        cellStates: nextCellStates,
      };

      gameStore.setState((previousState) => ({
        ...previousState,
        activeGame: noteSession,
      }));

      persistSession(noteSession);

      return {
        ok: true,
      };
    }

    nextBoard[row][col] = value;
    nextCellStates[row][col] = {
      value,
      notes: [],
    };
    const nextSession: GameSession = {
      ...activeGame,
      board: nextBoard,
      cellStates: nextCellStates,
    };

    if (isBoardSolved(nextBoard, activeGame.solution)) {
      return this.completeLevel(nextSession);
    }

    gameStore.setState((previousState) => ({
      ...previousState,
      activeGame: nextSession,
    }));

    persistSession(nextSession);

    return {
      ok: true,
    };
  },

  eraseSelectedCell(): GameActionResult {
    const { activeGame } = gameStore.getState();

    if (!activeGame || activeGame.status !== "playing" || !activeGame.selectedCell) {
      return {
        ok: false,
        message: "Choose a cell first.",
      };
    }

    const { row, col } = activeGame.selectedCell;

    if (activeGame.puzzle[row][col] !== null) {
      return {
        ok: false,
        message: "Prefilled cells cannot be erased.",
      };
    }

    const nextBoard = cloneBoard(activeGame.board);
    const nextCellStates = cloneCellStateBoard(activeGame.cellStates);
    nextBoard[row][col] = null;
    nextCellStates[row][col] = {
      value: null,
      notes: [],
    };

    gameStore.setState((currentState) => ({
      ...currentState,
      activeGame: currentState.activeGame
        ? {
            ...currentState.activeGame,
            board: nextBoard,
            cellStates: nextCellStates,
          }
        : null,
    }));

    persistSession({
      ...activeGame,
      board: nextBoard,
      cellStates: nextCellStates,
    });

    return {
      ok: true,
    };
  },

  useHint(): GameActionResult {
    const { activeGame } = gameStore.getState();

    if (!activeGame || activeGame.status !== "playing") {
      return {
        ok: false,
        message: "Start a level to use hints.",
      };
    }

    if (activeGame.hintsRemaining <= 0) {
      return {
        ok: false,
        message: "No hints remaining on this level.",
      };
    }

    const hintMove = getHintMove(
      activeGame.board,
      activeGame.puzzle,
      activeGame.solution
    );

    if (!hintMove) {
      return {
        ok: false,
        message: "This board already matches the solved path.",
      };
    }

    const nextBoard = cloneBoard(activeGame.board);
    const nextCellStates = cloneCellStateBoard(activeGame.cellStates);
    nextBoard[hintMove.row][hintMove.col] = hintMove.value;
    nextCellStates[hintMove.row][hintMove.col] = {
      value: hintMove.value,
      notes: [],
    };
    const nextSession: GameSession = {
      ...activeGame,
      board: nextBoard,
      cellStates: nextCellStates,
      selectedCell: {
        row: hintMove.row,
        col: hintMove.col,
      },
      hintsRemaining: activeGame.hintsRemaining - 1,
      hintsUsed: activeGame.hintsUsed + 1,
    };

    if (isBoardSolved(nextBoard, activeGame.solution)) {
      const completedResult = this.completeLevel(nextSession);
      return {
        ...completedResult,
        message: hintMove.reason,
      };
    }

    gameStore.setState((currentState) => ({
      ...currentState,
      activeGame: nextSession,
    }));

    persistSession(nextSession);

    return {
      ok: true,
      message: hintMove.reason,
    };
  },

  resetCurrentLevel(): GameActionResult {
    const { activeGame } = gameStore.getState();

    if (!activeGame) {
      return {
        ok: false,
        message: "There is no active puzzle to reset.",
      };
    }

    const level = getLevelDefinition(activeGame.levelId);
    const nextSession: GameSession = {
      ...activeGame,
      board: cloneBoard(activeGame.puzzle),
      cellStates: createCellStatesFromBoard(activeGame.puzzle),
      selectedCell: null,
      hintsRemaining: level.hintLimit,
      hintsUsed: 0,
      startedAt: Date.now(),
      elapsedSeconds: 0,
      status: "playing",
      score: null,
      stars: 0,
      completedAt: null,
    };

    gameStore.setState((currentState) => ({
      ...currentState,
      activeGame: nextSession,
    }));

    persistSession(nextSession);

    return {
      ok: true,
      message: "Level reset.",
    };
  },

  toggleSetting(setting: keyof GameSettings) {
    gameStore.setState((currentState) => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        [setting]: !currentState.settings[setting],
      },
    }));
  },

  validateBoard(session: GameSession): Set<string> {
    return getIncorrectCellKeys(session.board, session.solution);
  },

  buildHighlights(
    session: GameSession,
    settings: GameSettings,
    options?: { revealIncorrectValues?: boolean }
  ): BoardHighlights {
    const level = getLevelDefinition(session.levelId);
    
    if (!level) {
  return {
    selectedValue: null,
    incorrectCellKeys: new Set(),
    completedSections: { rows: [], columns: [], boxes: [] }
  };
}
    const config = getGridConfig(level.size);
    const selectedValue = session.selectedCell
      ? session.board[session.selectedCell.row][session.selectedCell.col]
      : null;

    return {
      selectedValue,
      incorrectCellKeys:
        options?.revealIncorrectValues &&
        (settings.mistakeHighlighting || settings.autoCheck)
          ? getIncorrectCellKeys(session.board, session.solution)
          : new Set<string>(),
      completedSections: settings.completionIndicator
        ? getCompletedSections(session.board, session.solution, config)
        : {
            rows: [],
            columns: [],
            boxes: [],
          },
    };
  },

  getRemainingSymbolCounts(board: Board, solution: Board) {
    const counts = solution.flat().reduce<Record<number, number>>((result, value) => {
      if (value === null) {
        return result;
      }

      result[value] = (result[value] ?? 0) + 1;
      return result;
    }, {});

    board.flat().forEach((value) => {
      if (value === null) {
        return;
      }

      counts[value] = Math.max(0, (counts[value] ?? 0) - 1);
    });

    return counts;
  },

  completeLevel(session: GameSession): GameActionResult {
    const elapsedSeconds = getElapsedSeconds(session);
    const metrics = calculateMetrics(session, elapsedSeconds);
    const completedSession: GameSession = {
      ...session,
      board: cloneBoard(session.solution),
      cellStates: createCellStatesFromBoard(session.solution),
      status: "completed",
      elapsedSeconds,
      startedAt: Date.now(),
      score: metrics.score,
      stars: metrics.stars,
      completedAt: new Date().toISOString(),
    };

    gameStore.setState((currentState) => {
      const updatedProgress = updateProgressAfterCompletion(
        currentState.progress,
        completedSession,
        metrics
      );

      try {
      userStore.syncCompletedLevels(countCompletedLevels(updatedProgress))
    } catch {}

      return {
        ...currentState,
        activeGame: completedSession,
        lastPlayedLevelId: completedSession.levelId,
        progress: updatedProgress,
      };
    });

    void storageService.clearGame();

    return {
      ok: true,
      completed: true,
      nextLevelId: getNextLevelId(session.levelId),
      message: "Level complete.",
    };
  },

  async hydrateSavedGame(): Promise<void> {
    const savedSession = await storageService.loadGame();

    if (!savedSession) {
      return;
    }

    try {
      getLevelDefinition(savedSession.levelId);
    } catch {
      await storageService.clearGame();
      return;
    }

    if (savedSession.status === "completed") {
      await storageService.clearGame();
      return;
    }

    const restoredSession: GameSession = {
      ...savedSession,
      puzzle: cloneBoard(savedSession.puzzle),
      solution: cloneBoard(savedSession.solution),
      board: cloneBoard(savedSession.board),
      cellStates: cloneCellStateBoard(savedSession.cellStates),
      selectedCell: savedSession.selectedCell
        ? { ...savedSession.selectedCell }
        : null,
      startedAt: Date.now(),
    };

    gameStore.setState((currentState) => ({
      ...currentState,
      activeGame: restoredSession,
      lastPlayedLevelId: restoredSession.levelId,
      progress: {
        ...currentState.progress,
        [restoredSession.levelId]: {
          ...currentState.progress[restoredSession.levelId],
          status: "in_progress",
        },
      },
    }));
  },
};
