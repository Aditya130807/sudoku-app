import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  AppState,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  playHintSound,
  playInputSound,
  playSuccessSound,
} from "../../utils/soundManager";
import CoinIcon from "../components/CoinIcon";
import CustomButton from "../components/CustomButton";
import GameControls from "../components/GameControls";
import Header from "../components/Header";
import NumberPad from "../components/NumberPad";
import SudokuGrid from "../components/SudokuGrid";
import { getLevelDefinition, getNextLevelId } from "../constants/levels";
import type { ThemeColors } from "../constants/themes";
import { useDailyChallenges } from "../context/DailyChallengeContext";
import { useAppTheme } from "../context/ThemeContext";
import { getGridConfig } from "../game/difficulty";
import { calculateStarsAndEfficiency } from "../game/reward";
import { getTimeGoal } from "../game/timeGoals";
import { Board, SectionCompletion } from "../game/types";
import { RootStackParamList } from "../navigation/types";
import {
  initializeAds,
  preloadInterstitialAd,
  showInterstitialAd,
} from "../services/adService";
import {
  DAILY_CHALLENGE_MAX_ATTEMPTS,
  getDailyChallengeProgress,
  markCompleted,
  registerChallengeFailed,
} from "../services/dailyChallengeService";
import { gameService } from "../services/gameService";
import { gameStore, useGameStore } from "../store/gameStore";
import { hexToRgba } from "../utils/colorUtils";
import { onGameWin } from "../utils/feedback";
import { formatDuration, useLiveElapsedSeconds } from "../utils/timer";
import LoadingScreen from "./LoadingScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Game">;

const FRAME_THICKNESS = 22;

const EMPTY_COMPLETION: SectionCompletion = {
  rows: [],
  columns: [],
  boxes: [],
};

type HintStateMap = Record<string, boolean>;
type MysteryCellMap = Record<string, true>;

const MYSTERY_HIDDEN_CLUE_COUNT = 8;
const MYSTERY_PREDEFINED_CELLS: [number, number][] = [
  [0, 0],
  [0, 4],
  [0, 8],
  [4, 0],
  [4, 4],
  [4, 8],
  [8, 0],
  [8, 4],
  [8, 8],
  [2, 2],
  [2, 6],
  [6, 2],
  [6, 6],
];

let pausedAtCacheMs: number | null = null;
let pausedAtCacheSessionKey: string | null = null;

function getHintStateKey(row: number, col: number) {
  return `${row}-${col}`;
}

function getMysteryCellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function parseHintStateKey(key: string) {
  const [rowPart, colPart] = key.split("-");
  const row = Number(rowPart);
  const col = Number(colPart);

  if (Number.isNaN(row) || Number.isNaN(col)) {
    return null;
  }

  return { row, col };
}

function parseMysteryCellKey(key: string) {
  const [rowPart, colPart] = key.split(":");
  const row = Number(rowPart);
  const col = Number(colPart);

  if (Number.isNaN(row) || Number.isNaN(col)) {
    return null;
  }

  return { row, col };
}

function isRowSolved(board: Board, solution: Board, rowIndex: number) {
  return board[rowIndex].every(
    (value, colIndex) =>
      value !== null && value === solution[rowIndex][colIndex],
  );
}

function isColumnSolved(board: Board, solution: Board, colIndex: number) {
  return board.every(
    (row, rowIndex) =>
      row[colIndex] !== null && row[colIndex] === solution[rowIndex][colIndex],
  );
}

function isBoxSolved(
  board: Board,
  solution: Board,
  rowIndex: number,
  colIndex: number,
  boxRows: number,
  boxCols: number,
) {
  const rowStart = Math.floor(rowIndex / boxRows) * boxRows;
  const colStart = Math.floor(colIndex / boxCols) * boxCols;

  for (let row = rowStart; row < rowStart + boxRows; row += 1) {
    for (let col = colStart; col < colStart + boxCols; col += 1) {
      if (board[row][col] === null || board[row][col] !== solution[row][col]) {
        return false;
      }
    }
  }

  return true;
}

function createMysteryHiddenCellMap(puzzle: Board): MysteryCellMap {
  const hiddenCellMap: MysteryCellMap = {};
  let hiddenCount = 0;

  const tryAddCell = (row: number, col: number) => {
    if (hiddenCount >= MYSTERY_HIDDEN_CLUE_COUNT) {
      return;
    }

    if (puzzle[row]?.[col] === null) {
      return;
    }

    const key = getMysteryCellKey(row, col);

    if (hiddenCellMap[key]) {
      return;
    }

    hiddenCellMap[key] = true;
    hiddenCount += 1;
  };

  MYSTERY_PREDEFINED_CELLS.forEach(([row, col]) => {
    tryAddCell(row, col);
  });

  if (hiddenCount >= MYSTERY_HIDDEN_CLUE_COUNT) {
    return hiddenCellMap;
  }

  for (let row = 0; row < puzzle.length; row += 1) {
    for (let col = 0; col < puzzle[row].length; col += 1) {
      if ((row + col) % 2 !== 0) {
        continue;
      }

      tryAddCell(row, col);

      if (hiddenCount >= MYSTERY_HIDDEN_CLUE_COUNT) {
        return hiddenCellMap;
      }
    }
  }

  return hiddenCellMap;
}

function createInitialMysteryRevealedCellMap(
  board: Board,
  solution: Board,
  hiddenCellMap: MysteryCellMap,
  boxRows: number,
  boxCols: number,
): MysteryCellMap {
  const revealedCellMap: MysteryCellMap = {};

  Object.keys(hiddenCellMap).forEach((key) => {
    const parsedCell = parseMysteryCellKey(key);

    if (!parsedCell) {
      return;
    }

    const shouldReveal =
      isRowSolved(board, solution, parsedCell.row) ||
      isColumnSolved(board, solution, parsedCell.col) ||
      isBoxSolved(
        board,
        solution,
        parsedCell.row,
        parsedCell.col,
        boxRows,
        boxCols,
      );

    if (shouldReveal) {
      revealedCellMap[key] = true;
    }
  });

  return revealedCellMap;
}

function toHintStateKeyFromValidatorKey(key: string) {
  const [rowPart, colPart] = key.split(":");
  const row = Number(rowPart);
  const col = Number(colPart);

  if (Number.isNaN(row) || Number.isNaN(col)) {
    return null;
  }

  return getHintStateKey(row, col);
}

function getValidationNotice(incorrectCount: number) {
  if (incorrectCount <= 0) {
    return null;
  }

  return incorrectCount === 1
    ? "1 entry still needs attention."
    : `${incorrectCount} entries still need attention.`;
}

function getSafeLevelDefinition(levelId: number) {
  try {
    return getLevelDefinition(levelId);
  } catch {
    return null;
  }
}

function getDailyChallengeMaxTimeSeconds(
  baseTimeSeconds: number,
  challengeType: "speed" | "noHint" | "mystery" | undefined,
): number {
  if (challengeType === "speed") {
    return Math.max(0, baseTimeSeconds - 120);
  }

  return baseTimeSeconds;
}

function getAttemptsRemainingLabel(attemptsRemaining: number): string {
  if (attemptsRemaining === 1) {
    return "1 attempt remaining";
  }

  return `${attemptsRemaining} attempts remaining`;
}

export default function GameScreen({ navigation, route }: Props) {
  const { levelId } = route.params;
  const isDailyChallenge = route.params?.isDailyChallenge === true;
  const isFocused = useIsFocused();
  const dailyChallengeType = route.params?.challengeType;
  const dailyChallengeAttemptsRemaining =
    route.params?.dailyChallengeAttemptsRemaining;
  const isMysteryDailyChallenge =
    isDailyChallenge && dailyChallengeType === "mystery";
  const disableHints = isDailyChallenge && dailyChallengeType === "noHint";
  const isDailyRetryAttempt =
    isDailyChallenge &&
    (dailyChallengeType === "speed" || dailyChallengeType === "noHint") &&
    typeof dailyChallengeAttemptsRemaining === "number" &&
    dailyChallengeAttemptsRemaining < DAILY_CHALLENGE_MAX_ATTEMPTS;
  const { width: windowWidth } = useWindowDimensions();
  const boardSize = Math.min(windowWidth - 32, 360);
  const framedBoardSize = boardSize + FRAME_THICKNESS * 2;
  const level = getSafeLevelDefinition(levelId);
  const gridConfig = level ? getGridConfig(level.size) : null;
  const {
    isHydrated: isDailyChallengeHydrated,
    registerGameStarted,
    registerGameWon,
  } = useDailyChallenges();
  const { activeTheme } = useAppTheme();
  const activeThemeIdRef = useRef(activeTheme.id);
  const frameImage = activeTheme.frameImage;
  const activeGame = useGameStore((state) => state.activeGame);
  const settings = useGameStore((state) => state.settings);
  const themeColors = activeTheme.colors;
  const styles = useMemo(
    () => createGameScreenStyles(themeColors),
    [themeColors],
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [appState, setAppState] = useState(AppState.currentState);
  const [isNotesMode, setIsNotesMode] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [revealIncorrectValues, setRevealIncorrectValues] = useState(false);
  const [hintHighlight, setHintHighlight] = useState<HintStateMap>({});
  const [hintErrors, setHintErrors] = useState<HintStateMap>({});
  const [showChallengeFailureModal, setShowChallengeFailureModal] =
    useState(false);
  const [
    challengeFailureAttemptsRemaining,
    setChallengeFailureAttemptsRemaining,
  ] = useState<number | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionRewardCoins, setCompletionRewardCoins] = useState(0);
  const [completionRewardMessages, setCompletionRewardMessages] = useState<
    string[]
  >([]);
  const [mysteryHiddenCellMap, setMysteryHiddenCellMap] =
    useState<MysteryCellMap>({});
  const [mysteryRevealedCellMap, setMysteryRevealedCellMap] =
    useState<MysteryCellMap>({});
  const lastDailyCompletionTrackingKeyRef = useRef<string | null>(null);
  const lastChallengeFailureTrackingKeyRef = useRef<string | null>(null);
  const lastInterstitialCompletionKeyRef = useRef<string | null>(null);
  const lastWinFeedbackKeyRef = useRef<string | null>(null);
  const pauseStartRef = useRef<number | null>(null);
  const pauseAdjustedStartedAtRef = useRef<number | null>(null);
  const startTimeRef = useRef(Date.now());
  const completionAnimation = useRef(new Animated.Value(0)).current;
  const hintHighlightTimeoutsRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const claimStartRewards = useCallback(async () => {
    const results = await registerGameStarted();
    return results.filter((result) => result.ok);
  }, [registerGameStarted]);
  const claimWinRewards = useCallback(
    async (currentLevelId: number) => {
      const results = await registerGameWon(currentLevelId);
      return results.filter((result) => result.ok);
    },
    [registerGameWon],
  );

  const currentSession =
    activeGame &&
    activeGame.levelId === levelId &&
    Boolean(activeGame.isDailyChallenge) === isDailyChallenge &&
    (!isDailyChallenge || activeGame.challengeType === dailyChallengeType)
      ? activeGame
      : null;
  const currentSessionRef = useRef(currentSession);
  const isActive = isFocused && appState === "active";
  const elapsedSeconds = useLiveElapsedSeconds(
    currentSession ?? null,
    isActive,
  );
  const isPauseAdjustedSessionStart =
    !!currentSession &&
    currentSession.status === "playing" &&
    pauseAdjustedStartedAtRef.current !== null &&
    currentSession.startedAt === pauseAdjustedStartedAtRef.current;
  const highlights = currentSession
    ? gameService.buildHighlights(currentSession, settings, {
        revealIncorrectValues:
          revealIncorrectValues && currentSession.status === "playing",
      })
    : {
        selectedValue: null,
        incorrectCellKeys: new Set<string>(),
        completedSections: EMPTY_COMPLETION,
      };
  const remainingCounts = currentSession
    ? gameService.getRemainingSymbolCounts(
        currentSession.board,
        currentSession.solution,
      )
    : {};
  const selectedCell = currentSession?.selectedCell ?? null;
  const selectedCellLocked =
    !!currentSession &&
    !!selectedCell &&
    currentSession.puzzle[selectedCell.row][selectedCell.col] !== null;
  const numberPadDisabled =
    !currentSession ||
    currentSession.status !== "playing" ||
    !selectedCell ||
    selectedCellLocked;
  const currentSessionStatus = currentSession?.status ?? null;
  const currentSessionStartedAt = currentSession?.startedAt ?? null;
  const sessionStartKey =
    currentSessionStatus === "playing" && currentSession
      ? `${currentSession.levelId}-${currentSession.startedAt}`
      : null;
  const sessionCompletionKey =
    currentSessionStatus === "completed"
      ? (currentSession?.completedAt ?? null)
      : null;
  const challengeAttemptTrackingKey = sessionStartKey ?? sessionCompletionKey;
  const dailyChallengeMaxTimeSeconds = getDailyChallengeMaxTimeSeconds(
    level?.targetTimeSeconds ?? 0,
    isDailyChallenge ? dailyChallengeType : undefined,
  );
  const remainingTimeSeconds = Math.max(
    0,
    dailyChallengeMaxTimeSeconds - elapsedSeconds,
  );
  const showSpeedCountdown = isDailyChallenge && dailyChallengeType === "speed";

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
    });

    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    currentSessionRef.current = currentSession;
  }, [currentSession]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        const session = currentSessionRef.current;

        if (!session || session.status !== "playing") {
          return;
        }

        if (pauseStartRef.current !== null) {
          return;
        }

        const now = Date.now();
        pauseStartRef.current = now;
        pausedAtCacheMs = now;
        pausedAtCacheSessionKey = `${session.levelId}-${session.startedAt}`;
      };
    }, []),
  );

  useEffect(() => {
    if (appState === "active") {
      return;
    }

    if (!currentSession || currentSession.status !== "playing") {
      return;
    }

    if (pauseStartRef.current !== null) {
      return;
    }

    const now = Date.now();
    pauseStartRef.current = now;
    pausedAtCacheMs = now;
    pausedAtCacheSessionKey = `${currentSession.levelId}-${currentSession.startedAt}`;
  }, [appState, currentSession]);

  useEffect(() => {
    if (!isActive || !currentSession || currentSession.status !== "playing") {
      return;
    }

    const sessionKey = `${currentSession.levelId}-${currentSession.startedAt}`;
    const pausedAtFromCache =
      pausedAtCacheSessionKey === sessionKey ? pausedAtCacheMs : null;
    const pausedAt = pauseStartRef.current ?? pausedAtFromCache;

    if (pausedAt === null) {
      return;
    }

    const pausedDuration = Date.now() - pausedAt;
    pauseStartRef.current = null;
    pausedAtCacheMs = null;
    pausedAtCacheSessionKey = null;

    if (pausedDuration <= 0) {
      return;
    }

    let adjustedStartedAt: number | null = null;

    gameStore.setState((state) => {
      const activeSession = state.activeGame;

      if (
        !activeSession ||
        activeSession.levelId !== levelId ||
        activeSession.status !== "playing"
      ) {
        return state;
      }

      adjustedStartedAt = activeSession.startedAt + pausedDuration;

      return {
        ...state,
        activeGame: {
          ...activeSession,
          startedAt: adjustedStartedAt,
        },
      };
    });

    if (adjustedStartedAt !== null) {
      pauseAdjustedStartedAtRef.current = adjustedStartedAt;
    }
  }, [currentSession, isActive, levelId]);

  useEffect(() => {
    if (currentSessionStatus !== "playing") {
      pauseAdjustedStartedAtRef.current = null;
      return;
    }

    if (
      pauseAdjustedStartedAtRef.current !== null &&
      currentSessionStartedAt !== pauseAdjustedStartedAtRef.current
    ) {
      pauseAdjustedStartedAtRef.current = null;
    }
  }, [currentSessionStartedAt, currentSessionStatus]);

  const triggerChallengeFail = useCallback(
    (type: "speed" | "noHint") => {
      if (!challengeAttemptTrackingKey) {
        return;
      }

      if (
        lastChallengeFailureTrackingKeyRef.current ===
        challengeAttemptTrackingKey
      ) {
        return;
      }

      lastChallengeFailureTrackingKeyRef.current = challengeAttemptTrackingKey;
      setShowCompletionModal(false);
      setNotice(null);

      void (async () => {
        try {
          const updatedProgress = await registerChallengeFailed(type);
          setChallengeFailureAttemptsRemaining(
            updatedProgress[type].attemptsRemaining,
          );
        } catch {
          setChallengeFailureAttemptsRemaining(null);
        } finally {
          setShowChallengeFailureModal(true);
        }
      })();
    },
    [challengeAttemptTrackingKey],
  );

  const checkMysteryReveal = useCallback(
    (row: number, col: number, board: Board, solution: Board) => {
      if (!isMysteryDailyChallenge || !gridConfig) {
        return;
      }

      const rowSolved = isRowSolved(board, solution, row);
      const colSolved = isColumnSolved(board, solution, col);
      const boxSolved = isBoxSolved(
        board,
        solution,
        row,
        col,
        gridConfig.boxRows,
        gridConfig.boxCols,
      );

      if (!rowSolved && !colSolved && !boxSolved) {
        return;
      }

      const boxRow = Math.floor(row / gridConfig.boxRows);
      const boxCol = Math.floor(col / gridConfig.boxCols);
      const keysToReveal: MysteryCellMap = {};

      Object.keys(mysteryHiddenCellMap).forEach((key) => {
        const parsedCell = parseMysteryCellKey(key);

        if (!parsedCell) {
          return;
        }

        const inRow = parsedCell.row === row;
        const inColumn = parsedCell.col === col;
        const inBox =
          Math.floor(parsedCell.row / gridConfig.boxRows) === boxRow &&
          Math.floor(parsedCell.col / gridConfig.boxCols) === boxCol;

        if (
          (rowSolved && inRow) ||
          (colSolved && inColumn) ||
          (boxSolved && inBox)
        ) {
          keysToReveal[key] = true;
        }
      });

      if (!Object.keys(keysToReveal).length) {
        return;
      }

      setMysteryRevealedCellMap((previousMap) => {
        const nextMap: MysteryCellMap = { ...previousMap };
        let hasChanged = false;

        Object.keys(keysToReveal).forEach((key) => {
          if (!nextMap[key]) {
            nextMap[key] = true;
            hasChanged = true;
          }
        });

        return hasChanged ? nextMap : previousMap;
      });
    },
    [gridConfig, isMysteryDailyChallenge, mysteryHiddenCellMap],
  );

  const boardForGrid = useMemo(() => {
    if (!currentSession || !isMysteryDailyChallenge) {
      return currentSession?.board ?? null;
    }

    const maskedBoard = currentSession.board.map((row) => [...row]) as (
      | number
      | null
      | "?"
    )[][];

    Object.keys(mysteryHiddenCellMap).forEach((key) => {
      if (mysteryRevealedCellMap[key]) {
        return;
      }

      const parsedCell = parseMysteryCellKey(key);

      if (!parsedCell) {
        return;
      }

      maskedBoard[parsedCell.row][parsedCell.col] = "?";
    });

    return maskedBoard as unknown as Board;
  }, [
    currentSession,
    isMysteryDailyChallenge,
    mysteryHiddenCellMap,
    mysteryRevealedCellMap,
  ]);

  useEffect(() => {
    let isDisposed = false;

    if (!level || !gridConfig) {
      setLoadError("This level is unavailable right now.");
      setLoading(false);
      return;
    }

    setLoadError(null);

    void (async () => {
      try {
        if (
          isDailyChallenge &&
          (dailyChallengeType === "speed" || dailyChallengeType === "noHint")
        ) {
          const progress = await getDailyChallengeProgress();
          const challengeProgress = progress[dailyChallengeType];

          if (
            challengeProgress &&
            challengeProgress.attemptsRemaining <= 0 &&
            !challengeProgress.completed
          ) {
            if (!isDisposed) {
              setLoadError("No attempts left for this challenge today.");
            }
            return;
          }
        }

        const result = gameService.startLevel(levelId, {
          forceNew: isDailyRetryAttempt,
          allowLocked: isDailyChallenge,
          skipProgressTracking: isDailyChallenge,
          isDailyChallenge,
          challengeType: dailyChallengeType,
        });

        if (!result.ok && !isDisposed) {
          setLoadError(result.message ?? "Unable to start this level.");
        }
      } catch {
        if (!isDisposed) {
          setLoadError("Unable to start this level.");
        }
      } finally {
        if (!isDisposed) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isDisposed = true;
    };
  }, [
    dailyChallengeType,
    gridConfig,
    isDailyChallenge,
    isDailyRetryAttempt,
    level,
    levelId,
  ]);

  useEffect(() => {
    if (!sessionStartKey) {
      return;
    }

    if (isPauseAdjustedSessionStart) {
      return;
    }

    startTimeRef.current = Date.now();
  }, [isPauseAdjustedSessionStart, sessionStartKey]);

  useEffect(() => {
    if (!isMysteryDailyChallenge || !currentSession || !gridConfig) {
      setMysteryHiddenCellMap({});
      setMysteryRevealedCellMap({});
      return;
    }

    const hiddenCellMap = createMysteryHiddenCellMap(currentSession.puzzle);
    setMysteryHiddenCellMap(hiddenCellMap);
    setMysteryRevealedCellMap(
      createInitialMysteryRevealedCellMap(
        currentSession.board,
        currentSession.solution,
        hiddenCellMap,
        gridConfig.boxRows,
        gridConfig.boxCols,
      ),
    );
  }, [
    currentSession?.startedAt,
    currentSession,
    gridConfig,
    isMysteryDailyChallenge,
  ]);

  useEffect(() => {
    activeThemeIdRef.current = activeTheme.id;
  }, [activeTheme.id]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setNotice(null);
    }, 2400);

    return () => {
      clearTimeout(timeout);
    };
  }, [notice]);

  useEffect(() => {
    void (async () => {
      try {
        await initializeAds();
        await preloadInterstitialAd();
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (isPauseAdjustedSessionStart) {
      return;
    }

    setRevealIncorrectValues(false);
    setHasFailed(false);
    setHintHighlight({});
    setHintErrors({});
    hintHighlightTimeoutsRef.current.forEach((timeout) => {
      clearTimeout(timeout);
    });
    hintHighlightTimeoutsRef.current.clear();
    setShowChallengeFailureModal(false);
    setChallengeFailureAttemptsRemaining(null);
    setShowCompletionModal(false);
    setIsNotesMode(false);
    setCompletionRewardCoins(0);
    setCompletionRewardMessages([]);
    lastChallengeFailureTrackingKeyRef.current = null;
  }, [currentSession?.startedAt, isPauseAdjustedSessionStart, levelId]);

  useEffect(() => {
    const highlightTimeouts = hintHighlightTimeoutsRef.current;

    return () => {
      highlightTimeouts.forEach((timeout) => {
        clearTimeout(timeout);
      });
      highlightTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    if (!currentSession || Object.keys(hintErrors).length === 0) {
      return;
    }

    setHintErrors((previous) => {
      let hasChanged = false;
      const next = { ...previous };

      Object.keys(previous).forEach((key) => {
        const parsedKey = parseHintStateKey(key);

        if (!parsedKey) {
          delete next[key];
          hasChanged = true;
          return;
        }

        const currentValue =
          currentSession.board[parsedKey.row]?.[parsedKey.col];
        const solutionValue =
          currentSession.solution[parsedKey.row]?.[parsedKey.col] ?? null;

        if (currentValue === null || currentValue === solutionValue) {
          delete next[key];
          hasChanged = true;
        }
      });

      return hasChanged ? next : previous;
    });
  }, [currentSession, hintErrors]);

  useEffect(() => {
    if (!loading && !loadError && !currentSession) {
      setLoadError("We couldn't load your puzzle.");
    }
  }, [currentSession, loadError, loading]);

  useEffect(() => {
    if (currentSession?.status === "completed") {
      setShowCompletionModal(true);
      setNotice(null);
    }
  }, [currentSession?.completedAt, currentSession?.status]);

  useEffect(() => {
    if (
      !isDailyChallengeHydrated ||
      !isDailyChallenge ||
      !isActive ||
      !currentSession ||
      currentSession.status !== "playing" ||
      !sessionStartKey
    ) {
      return;
    }

    if (dailyChallengeType !== "speed" && dailyChallengeType !== "noHint") {
      return;
    }

    if (hasFailed || elapsedSeconds <= dailyChallengeMaxTimeSeconds) {
      return;
    }

    setHasFailed(true);
    triggerChallengeFail(dailyChallengeType);
  }, [
    currentSession,
    dailyChallengeMaxTimeSeconds,
    dailyChallengeType,
    elapsedSeconds,
    hasFailed,
    isActive,
    isDailyChallenge,
    isDailyChallengeHydrated,
    sessionStartKey,
    triggerChallengeFail,
  ]);

  useEffect(() => {
    if (!sessionCompletionKey) {
      return;
    }

    if (lastWinFeedbackKeyRef.current === sessionCompletionKey) {
      return;
    }

    lastWinFeedbackKeyRef.current = sessionCompletionKey;
    void onGameWin();
    playSuccessSound();
  }, [sessionCompletionKey]);

  useEffect(() => {
    if (
      !isDailyChallengeHydrated ||
      !sessionStartKey ||
      isPauseAdjustedSessionStart
    ) {
      return;
    }

    let isDisposed = false;

    void (async () => {
      const claimedRewards = await claimStartRewards();

      if (isDisposed || !claimedRewards.length) {
        return;
      }

      setNotice(claimedRewards.map((result) => result.message).join(" "));
    })();

    return () => {
      isDisposed = true;
    };
  }, [
    claimStartRewards,
    isDailyChallengeHydrated,
    isPauseAdjustedSessionStart,
    sessionStartKey,
  ]);

  useEffect(() => {
    if (!isDailyChallengeHydrated || !sessionCompletionKey) {
      return;
    }

    let isDisposed = false;

    void (async () => {
      const claimedRewards = await claimWinRewards(levelId);

      if (isDisposed || !claimedRewards.length) {
        if (!isDisposed) {
          setCompletionRewardCoins(0);
          setCompletionRewardMessages([]);
        }
        return;
      }

      setCompletionRewardCoins(
        claimedRewards.reduce(
          (rewardSum, result) => rewardSum + result.reward,
          0,
        ),
      );
      setCompletionRewardMessages(
        claimedRewards.map((result) => result.message),
      );
    })();

    return () => {
      isDisposed = true;
    };
  }, [
    claimWinRewards,
    isDailyChallengeHydrated,
    levelId,
    sessionCompletionKey,
  ]);

  useEffect(() => {
    if (
      !isDailyChallengeHydrated ||
      !isDailyChallenge ||
      !dailyChallengeType ||
      !sessionCompletionKey ||
      !currentSession ||
      currentSession.status !== "completed"
    ) {
      return;
    }

    if (lastDailyCompletionTrackingKeyRef.current === sessionCompletionKey) {
      return;
    }

    lastDailyCompletionTrackingKeyRef.current = sessionCompletionKey;

    void (async () => {
      try {
        const timeTakenSeconds =
          currentSession.elapsedSeconds > 0
            ? currentSession.elapsedSeconds
            : (Date.now() - startTimeRef.current) / 1000;

        if (dailyChallengeType === "speed") {
          if (timeTakenSeconds <= dailyChallengeMaxTimeSeconds) {
            await markCompleted("speed", {
              playedLevelId: levelId,
            });
          } else {
            setHasFailed(true);
            triggerChallengeFail("speed");
          }
          return;
        }

        if (dailyChallengeType === "noHint") {
          if (timeTakenSeconds > dailyChallengeMaxTimeSeconds) {
            setHasFailed(true);
            triggerChallengeFail("noHint");
            return;
          }

          if (currentSession.hintsUsed === 0) {
            await markCompleted("noHint", {
              playedLevelId: levelId,
            });
          }
          return;
        }

        if (dailyChallengeType === "mystery") {
          await markCompleted("mystery", {
            playedLevelId: levelId,
          });
        }
      } catch {
        // Keep game completion stable if daily completion tracking fails.
      }
    })();
  }, [
    currentSession,
    dailyChallengeMaxTimeSeconds,
    dailyChallengeType,
    isDailyChallenge,
    isDailyChallengeHydrated,
    levelId,
    sessionCompletionKey,
    triggerChallengeFail,
  ]);

  useEffect(() => {
    if (!sessionCompletionKey) {
      return;
    }

    if (lastInterstitialCompletionKeyRef.current === sessionCompletionKey) {
      return;
    }

    lastInterstitialCompletionKeyRef.current = sessionCompletionKey;
    void (async () => {
      try {
        await showInterstitialAd();
      } catch {
        // Keep the completion flow stable if the interstitial is unavailable.
      }
    })();
  }, [sessionCompletionKey]);

  useEffect(() => {
    if (!showCompletionModal) {
      completionAnimation.setValue(0);
      return;
    }

    completionAnimation.setValue(0);
    Animated.spring(completionAnimation, {
      toValue: 1,
      friction: 8,
      tension: 85,
      useNativeDriver: true,
    }).start();
  }, [completionAnimation, showCompletionModal]);

  const completionReward =
    currentSession && level
      ? calculateStarsAndEfficiency({
          elapsedSeconds: currentSession.elapsedSeconds,
          targetTimeSeconds: getTimeGoal(level.tier),
          // The app doesn't currently track explicit mistake history; we compute
          // "mistakes" as incorrect entries in the final board (0 for solved boards).
          mistakes: gameService.validateBoard(currentSession).size,
        })
      : null;
  const completionScale = completionAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });
  const completionOpacity = completionAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const pushNotice = (message?: string | null) => {
    if (message) {
      setNotice(message);
    }
  };

  const handleNumberPress = (value: number) => {
    const selectedCellBeforeInput = currentSession?.selectedCell ?? null;
    const shouldCheckMysteryReveal =
      isMysteryDailyChallenge && !isNotesMode && !!selectedCellBeforeInput;

    try {
      const result = gameService.inputValue(value, { asNote: isNotesMode });

      if (!result.ok) {
        pushNotice(result.message ?? "Unable to enter that value.");
        return;
      }

      void playInputSound(activeThemeIdRef.current);

      if (shouldCheckMysteryReveal && selectedCellBeforeInput) {
        const latestSession = gameStore.getState().activeGame;

        if (
          latestSession &&
          latestSession.levelId === levelId &&
          latestSession.status === "playing"
        ) {
          const row = selectedCellBeforeInput.row;
          const col = selectedCellBeforeInput.col;
          const latestCellValue = latestSession.board[row]?.[col];
          const solutionCellValue = latestSession.solution[row]?.[col] ?? null;

          if (
            latestCellValue !== null &&
            latestCellValue === solutionCellValue
          ) {
            checkMysteryReveal(
              row,
              col,
              latestSession.board,
              latestSession.solution,
            );
          }
        }
      }

      setRevealIncorrectValues(false);
      pushNotice(result.message);
    } catch {
      pushNotice("Unable to place that number right now.");
    }
  };

  const handleErase = () => {
    try {
      const result = gameService.eraseSelectedCell();

      if (!result.ok) {
        pushNotice(result.message ?? "Pick an editable cell first.");
        return;
      }

      setRevealIncorrectValues(false);
      pushNotice(result.message);
    } catch {
      pushNotice("Unable to erase that cell right now.");
    }
  };

  const handleHint = () => {
    if (disableHints) {
      pushNotice("Hints are disabled in the No Hint challenge.");
      return;
    }

    playHintSound();

    if (!currentSession) {
      pushNotice("Start a level to use hints.");
      return;
    }

    try {
      const incorrectKeys = gameService.validateBoard(currentSession);
      const incorrectCount = incorrectKeys.size;
      const result = gameService.useHint();

      if (!result.ok) {
        pushNotice(result.message ?? "No hint available.");
        return;
      }

      if (incorrectKeys.size > 0) {
        setHintErrors((previous) => {
          const next = { ...previous };

          incorrectKeys.forEach((validatorKey) => {
            const hintKey = toHintStateKeyFromValidatorKey(validatorKey);

            if (hintKey) {
              next[hintKey] = true;
            }
          });

          return next;
        });
      }

      if (result.hintCell) {
        const hintKey = getHintStateKey(
          result.hintCell.row,
          result.hintCell.col,
        );

        setHintHighlight((previous) => ({
          ...previous,
          [hintKey]: true,
        }));

        const existingTimeout = hintHighlightTimeoutsRef.current.get(hintKey);

        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        const timeout = setTimeout(() => {
          setHintHighlight((previous) => {
            if (!previous[hintKey]) {
              return previous;
            }

            const next = { ...previous };
            delete next[hintKey];
            return next;
          });
          hintHighlightTimeoutsRef.current.delete(hintKey);
        }, 2000);

        hintHighlightTimeoutsRef.current.set(hintKey, timeout);
      }

      setRevealIncorrectValues(true);
      pushNotice(getValidationNotice(incorrectCount) ?? result.message);
    } catch {
      pushNotice("Unable to reveal a hint right now.");
    }
  };

  const handleReset = () => {
    try {
      const result = gameService.resetCurrentLevel();

      if (!result.ok) {
        pushNotice(result.message ?? "Unable to reset this level.");
        return;
      }

      setRevealIncorrectValues(false);
      pushNotice(result.message ?? "Level reset.");
    } catch {
      pushNotice("Unable to reset this level right now.");
    }
  };

  const handleNextLevel = () => {
    setShowCompletionModal(false);
    setRevealIncorrectValues(false);

    const nextLevelId = getNextLevelId(levelId);

    if (!nextLevelId) {
      navigation.navigate("LevelMap");
      return;
    }

    const nextLevel = getSafeLevelDefinition(nextLevelId);

    if (!nextLevel) {
      navigation.navigate("LevelMap");
      return;
    }

    navigation.replace("Game", { levelId: nextLevel.id });
  };

  const handleGoHome = () => {
    setShowCompletionModal(false);
    setRevealIncorrectValues(false);
    navigation.navigate("Home");
  };

  const handleChallengeFailureDismiss = () => {
    setShowChallengeFailureModal(false);
    navigation.goBack();
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (loadError || !level || !gridConfig || !currentSession) {
    return (
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <View style={styles.statusWrap}>
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Puzzle unavailable</Text>
            <Text style={styles.statusBody}>
              {loadError ?? "We couldn't prepare that level."}
            </Text>
            <CustomButton
              fullWidth
              label="Back to Levels"
              onPress={() => navigation.navigate("LevelMap")}
              style={styles.statusButton}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const gridNode = (
    <SudokuGrid
      boardSize={boardSize}
      size={level.size}
      board={boardForGrid ?? currentSession.board}
      solution={currentSession.solution}
      cellStates={currentSession.cellStates}
      puzzle={currentSession.puzzle}
      selectedCell={currentSession.selectedCell}
      selectedValue={highlights.selectedValue}
      incorrectCellKeys={highlights.incorrectCellKeys}
      completedSections={highlights.completedSections}
      hintHighlight={hintHighlight}
      hintErrors={hintErrors}
      onPressCell={(row, col) => gameService.selectCell(row, col)}
      gridImage={activeTheme.gridImage}
      gridViewport={activeTheme.gridViewport}
      themeId={activeTheme.id}
      themeColors={themeColors}
    />
  );

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        <Header
          title={isDailyChallenge ? "Daily Challenge" : `Level ${level.id}`}
          subtitle={`${level.title} | ${level.tier} | ${level.size}x${level.size}`}
          themeColors={themeColors}
          leftAction={{
            icon: (
              <Ionicons color={themeColors.text} name="arrow-back" size={20} />
            ),
            onPress: () => navigation.goBack(),
          }}
          rightAction={{
            icon: (
              <Ionicons
                color={themeColors.text}
                name="settings-outline"
                size={20}
              />
            ),
            onPress: () => navigation.navigate("Settings"),
          }}
        />

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>
              {showSpeedCountdown ? "Time Left" : "Time"}
            </Text>
            <Text style={styles.statValue}>
              {formatDuration(
                showSpeedCountdown ? remainingTimeSeconds : elapsedSeconds,
              )}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Hints Left</Text>
            <Text style={styles.statValue}>
              {disableHints ? 0 : currentSession.hintsRemaining}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Goal</Text>
            <Text style={styles.statValue}>
              {formatDuration(dailyChallengeMaxTimeSeconds)}
            </Text>
          </View>
        </View>

        {notice ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>{notice}</Text>
          </View>
        ) : null}

        <View style={styles.boardCard}>
          {frameImage ? (
            <View
              style={[
                styles.frameContainer,
                { width: framedBoardSize, height: framedBoardSize },
              ]}
            >
              <ImageBackground
                resizeMode="stretch"
                source={frameImage}
                style={styles.frame}
                imageStyle={styles.frameImage}
              >
                <View style={styles.innerGrid}>{gridNode}</View>
              </ImageBackground>
            </View>
          ) : (
            gridNode
          )}
        </View>

        <Text style={styles.selectionText}>
          {selectedCell
            ? selectedCellLocked
              ? "This clue is fixed. Choose an editable cell."
              : isNotesMode
                ? "Notes mode on. Tap numbers to add or remove pencil marks."
                : "Number mode on. Tap a number to place the final value."
            : "Tap any cell to start filling the board."}
        </Text>

        <View style={styles.notesModeWrap}>
          <CustomButton
            label={isNotesMode ? "Notes Mode: ON" : "Notes Mode: OFF"}
            onPress={() => setIsNotesMode((previous) => !previous)}
            variant={isNotesMode ? "primary" : "secondary"}
            fullWidth
          />
        </View>

        <NumberPad
          symbols={gridConfig.symbols}
          remainingCounts={remainingCounts}
          selectedValue={highlights.selectedValue}
          onPressValue={handleNumberPress}
          disabled={numberPadDisabled}
          themeColors={themeColors}
        />

        <View style={styles.controlsWrap}>
          <GameControls
            onErase={handleErase}
            onReset={handleReset}
            onHint={handleHint}
            onGuide={() => navigation.navigate("Tutorial", { fromGame: true })}
            disableActions={currentSession.status !== "playing"}
            disableHint={disableHints}
          />
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={handleChallengeFailureDismiss}
        transparent
        visible={showChallengeFailureModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Challenge Failed</Text>
            <Text style={styles.modalSubtitle}>
              Challenge Failed. Please try again.
            </Text>

            {typeof challengeFailureAttemptsRemaining === "number" ? (
              <Text style={styles.modalBody}>
                {getAttemptsRemainingLabel(challengeFailureAttemptsRemaining)}
              </Text>
            ) : null}

            {challengeFailureAttemptsRemaining === 0 ? (
              <Text style={styles.modalBody}>No attempts left.</Text>
            ) : null}

            <View style={styles.modalActions}>
              <CustomButton
                fullWidth
                label="Back to Challenges"
                onPress={handleChallengeFailureDismiss}
                style={styles.modalActionButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => undefined}
        transparent
        visible={showCompletionModal}
      >
        <View style={styles.modalBackdrop}>
          <Animated.View
            style={[
              styles.modalCard,
              {
                opacity: completionOpacity,
                transform: [{ scale: completionScale }],
              },
            ]}
          >
            <Text style={styles.modalTitle}>Level Complete {"\u{1F389}"}</Text>
            <Text style={styles.modalSubtitle}>
              {level.title} is cleared. Your next board is ready whenever you
              are.
            </Text>

            <Text style={styles.modalStarsText}>
              {Array.from(
                { length: currentSession.stars },
                () => "\u2605",
              ).join(" ")}
            </Text>

            <View style={styles.modalStatsGrid}>
              <View style={styles.modalStatCard}>
                <Text style={styles.modalStatLabel}>Time</Text>
                <Text style={styles.modalStatValue}>
                  {formatDuration(currentSession.elapsedSeconds)}
                </Text>
              </View>
              <View style={styles.modalStatCard}>
                <Text style={styles.modalStatLabel}>Hints Used</Text>
                <Text style={styles.modalStatValue}>
                  {currentSession.hintsUsed}
                </Text>
              </View>
              <View style={styles.modalStatCard}>
                <Text style={styles.modalStatLabel}>Efficiency</Text>
                <Text style={styles.modalStatValue}>
                  {completionReward ? `${completionReward.efficiency}%` : "0%"}
                </Text>
              </View>
            </View>

            {completionRewardCoins > 0 ? (
              <View style={styles.modalRewardBadge}>
                <CoinIcon size={16} />
                <Text style={styles.modalRewardBadgeText}>
                  Daily reward: +{completionRewardCoins} coins
                </Text>
              </View>
            ) : null}

            {completionRewardMessages.length > 0 ? (
              <View style={styles.modalRewardList}>
                {completionRewardMessages.map((message) => (
                  <Text key={message} style={styles.modalBody}>
                    {message}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <CustomButton
                label="Home"
                onPress={handleGoHome}
                variant="secondary"
                style={[styles.modalActionButton, styles.modalActionButtonLeft]}
              />
              <CustomButton
                label="Next Level"
                onPress={handleNextLevel}
                style={styles.modalActionButton}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createGameScreenStyles(colors: ThemeColors) {
  const border = hexToRgba(colors.text, 0.2);
  const textMuted = hexToRgba(colors.text, 0.65);
  const shadow = hexToRgba(colors.text, 0.25);

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      flexGrow: 1,
      padding: 16,
      paddingBottom: 24,
      backgroundColor: colors.background,
    },
    statusWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    statusCard: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.grid,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: border,
    },
    statusTitle: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
      textAlign: "center",
    },
    statusBody: {
      color: textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
      marginTop: 10,
    },
    statusButton: {
      marginTop: 18,
    },
    statsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.grid,
      borderRadius: 20,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: border,
    },
    statLabel: {
      color: textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    statValue: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      marginTop: 6,
    },
    noticeCard: {
      marginBottom: 12,
      backgroundColor: hexToRgba(colors.grid, 0.55),
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    noticeText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    boardCard: {
      alignSelf: "center",
      backgroundColor: "transparent",
      marginBottom: 12,
    },
    frameContainer: {
      alignSelf: "center",
      borderRadius: 20,
      overflow: "hidden",
      shadowColor: shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 18,
      elevation: 6,
    },
    frame: {
      width: "100%",
      height: "100%",
    },
    frameImage: {
      borderRadius: 20,
    },
    innerGrid: {
      flex: 1,
      padding: FRAME_THICKNESS,
      alignItems: "center",
      justifyContent: "center",
    },
    selectionText: {
      color: textMuted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
      marginBottom: 14,
    },
    controlsWrap: {
      marginTop: 18,
    },
    notesModeWrap: {
      marginBottom: 12,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: hexToRgba(colors.text, 0.45),
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    modalCard: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.grid,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: border,
      shadowColor: shadow,
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.18,
      shadowRadius: 28,
      elevation: 8,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 29,
      fontWeight: "900",
      textAlign: "center",
    },
    modalSubtitle: {
      marginTop: 10,
      color: textMuted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
    },
    modalBody: {
      color: textMuted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
    modalActions: {
      flexDirection: "row",
      marginTop: 22,
    },
    modalActionButtonLeft: {
      marginRight: 12,
    },
    modalActionButton: {
      flex: 1,
      minWidth: 0,
    },
    modalStarsText: {
      marginTop: 16,
      textAlign: "center",
      color: "#F4B53F",
      fontSize: 34,
      lineHeight: 40,
    },
    modalStatsGrid: {
      flexDirection: "row",
      gap: 10,
      marginTop: 18,
    },
    modalStatCard: {
      flex: 1,
      backgroundColor: hexToRgba(colors.background, 0.78),
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 10,
      borderWidth: 1,
      borderColor: hexToRgba(colors.text, 0.08),
      alignItems: "center",
    },
    modalStatLabel: {
      color: textMuted,
      fontSize: 11,
      fontWeight: "700",
      textAlign: "center",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    modalStatValue: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
      marginTop: 8,
      textAlign: "center",
    },
    modalRewardBadge: {
      alignSelf: "center",
      marginTop: 18,
      backgroundColor: hexToRgba(colors.text, 0.08),
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: hexToRgba(colors.text, 0.14),
      flexDirection: "row",
      alignItems: "center",
    },
    modalRewardBadgeText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
      textAlign: "center",
    },
    modalRewardList: {
      marginTop: 14,
      gap: 8,
    },
  });
}
