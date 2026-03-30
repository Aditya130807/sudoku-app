import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "../components/CustomButton";
import GameControls from "../components/GameControls";
import Header from "../components/Header";
import NumberPad from "../components/NumberPad";
import SudokuGrid from "../components/SudokuGrid";
import { getLevelDefinition } from "../constants/levels";
import type { ThemeColors } from "../constants/themes";
import { useDailyChallenges } from "../context/DailyChallengeContext";
import { useAppTheme } from "../context/ThemeContext";
import { getGridConfig } from "../game/difficulty";
import { calculateStarsAndEfficiency } from "../game/reward";
import { getTimeGoal } from "../game/timeGoals";
import { SectionCompletion } from "../game/types";
import { RootStackParamList } from "../navigation/types";
import { initializeAds, showInterstitialAd } from "../services/adService";
import { gameService } from "../services/gameService";
import { useGameStore } from "../store/gameStore";
import { hexToRgba } from "../utils/colorUtils";
import { formatDuration, useLiveElapsedSeconds } from "../utils/timer";
import LoadingScreen from "./LoadingScreen";

type Props = NativeStackScreenProps<RootStackParamList, "Game">;

const FRAME_THICKNESS = 22;

const EMPTY_COMPLETION: SectionCompletion = {
  rows: [],
  columns: [],
  boxes: [],
};

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

export default function GameScreen({ navigation, route }: Props) {
  const { levelId } = route.params;
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
  const [isNotesMode, setIsNotesMode] = useState(false);
  const [revealIncorrectValues, setRevealIncorrectValues] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionRewardCoins, setCompletionRewardCoins] = useState(0);
  const [completionRewardMessages, setCompletionRewardMessages] = useState<
    string[]
  >([]);
  const lastInterstitialCompletionKeyRef = useRef<string | null>(null);
  const claimStartRewards = useCallback(
    () => registerGameStarted().filter((result) => result.ok),
    [registerGameStarted],
  );
  const claimWinRewards = useCallback(
    (currentLevelId: number) =>
      registerGameWon(currentLevelId).filter((result) => result.ok),
    [registerGameWon],
  );

  const currentSession =
    activeGame && activeGame.levelId === levelId ? activeGame : null;
  const elapsedSeconds = useLiveElapsedSeconds(currentSession ?? null);
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
  const sessionStartKey =
    currentSessionStatus === "playing" && currentSession
      ? `${currentSession.levelId}-${currentSession.startedAt}`
      : null;
  const sessionCompletionKey =
    currentSessionStatus === "completed"
      ? (currentSession?.completedAt ?? null)
      : null;

  useEffect(() => {
    if (!level || !gridConfig) {
      setLoadError("This level is unavailable right now.");
      setLoading(false);
      return;
    }

    setLoadError(null);

    try {
      const result = gameService.startLevel(levelId);

      if (!result.ok) {
        setLoadError(result.message ?? "Unable to start this level.");
      }
    } catch {
      setLoadError("Unable to start this level.");
    } finally {
      setLoading(false);
    }
  }, [gridConfig, level, levelId]);

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
    void initializeAds();
  }, []);

  useEffect(() => {
    setRevealIncorrectValues(false);
    setShowCompletionModal(false);
    setIsNotesMode(false);
    setCompletionRewardCoins(0);
    setCompletionRewardMessages([]);
  }, [currentSession?.startedAt, levelId]);

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
    if (!isDailyChallengeHydrated || !sessionStartKey) {
      return;
    }

    const claimedRewards = claimStartRewards();

    if (!claimedRewards.length) {
      return;
    }

    setNotice(claimedRewards.map((result) => result.message).join(" "));
  }, [claimStartRewards, isDailyChallengeHydrated, sessionStartKey]);

  useEffect(() => {
    if (!isDailyChallengeHydrated || !sessionCompletionKey) {
      return;
    }

    const claimedRewards = claimWinRewards(levelId);

    if (!claimedRewards.length) {
      setCompletionRewardCoins(0);
      setCompletionRewardMessages([]);
      return;
    }

    setCompletionRewardCoins(
      claimedRewards.reduce(
        (rewardSum, result) => rewardSum + result.reward,
        0,
      ),
    );
    setCompletionRewardMessages(claimedRewards.map((result) => result.message));
  }, [
    claimWinRewards,
    isDailyChallengeHydrated,
    levelId,
    sessionCompletionKey,
  ]);

  useEffect(() => {
    if (!sessionCompletionKey) {
      return;
    }

    if (lastInterstitialCompletionKeyRef.current === sessionCompletionKey) {
      return;
    }

    lastInterstitialCompletionKeyRef.current = sessionCompletionKey;
    void showInterstitialAd();
  }, [sessionCompletionKey]);

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

  const pushNotice = (message?: string | null) => {
    if (message) {
      setNotice(message);
    }
  };

  const handleNumberPress = (value: number) => {
    try {
      const result = gameService.inputValue(value, { asNote: isNotesMode });

      if (!result.ok) {
        pushNotice(result.message ?? "Unable to enter that value.");
        return;
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
    if (!currentSession) {
      pushNotice("Start a level to use hints.");
      return;
    }

    try {
      const incorrectCount = gameService.validateBoard(currentSession).size;
      const result = gameService.useHint();

      if (!result.ok) {
        pushNotice(result.message ?? "No hint available.");
        return;
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

  const handleRetry = () => {
    setShowCompletionModal(false);
    setRevealIncorrectValues(false);
    navigation.replace("Game", { levelId });
  };

  const handleNextLevel = () => {
    setShowCompletionModal(false);
    setRevealIncorrectValues(false);

    const nextLevelId = levelId + 1;
    const nextLevel = getLevelDefinition(nextLevelId);

    if (!nextLevel) {
      navigation.navigate("LevelMap");
      return;
    }

    navigation.replace("Game", { levelId: nextLevelId });
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
      board={currentSession.board}
      cellStates={currentSession.cellStates}
      puzzle={currentSession.puzzle}
      selectedCell={currentSession.selectedCell}
      selectedValue={highlights.selectedValue}
      incorrectCellKeys={highlights.incorrectCellKeys}
      completedSections={highlights.completedSections}
      onPressCell={(row, col) => gameService.selectCell(row, col)}
      gridImage={activeTheme.gridImage}
      gridViewport={activeTheme.gridViewport}
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
          title={`Level ${level.id}`}
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
            <Text style={styles.statLabel}>Time</Text>
            <Text style={styles.statValue}>
              {formatDuration(elapsedSeconds)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Hints Left</Text>
            <Text style={styles.statValue}>
              {currentSession.hintsRemaining}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Goal</Text>
            <Text style={styles.statValue}>
              {formatDuration(level.targetTimeSeconds)}
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
          />
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => undefined}
        transparent
        visible={showCompletionModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Level Complete</Text>

            {completionRewardCoins > 0 ? (
              <Text style={styles.dailyRewardText}>
                +{completionRewardCoins} Coins
              </Text>
            ) : null}

            {completionRewardMessages.map((message) => (
              <Text key={message} style={styles.modalBody}>
                {message}
              </Text>
            ))}

            <Text style={styles.modalStarsText}>
              {completionReward
                ? Array.from(
                    { length: completionReward.stars },
                    () => "\u2605",
                  ).join(" ")
                : ""}
            </Text>

            <View style={styles.modalStats}>
              <Text style={styles.modalStatText}>
                Time taken:{" "}
                {currentSession
                  ? formatDuration(currentSession.elapsedSeconds)
                  : formatDuration(0)}
              </Text>
              <Text style={[styles.modalStatText, styles.modalStatTextSpacing]}>
                Efficiency: {completionReward ? completionReward.efficiency : 0}
                %
              </Text>
            </View>

            <View style={styles.modalActions}>
              <CustomButton
                label="Retry"
                onPress={handleRetry}
                variant="secondary"
                style={[styles.modalActionButton, styles.modalActionButtonLeft]}
              />
              <CustomButton
                label="Next Level"
                onPress={handleNextLevel}
                style={styles.modalActionButton}
              />
            </View>
          </View>
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
      borderRadius: 28,
      padding: 24,
      borderWidth: 1,
      borderColor: border,
      shadowColor: shadow,
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 8,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
      textAlign: "center",
    },
    dailyRewardText: {
      marginTop: 10,
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
      textAlign: "center",
    },
    modalBody: {
      color: textMuted,
      fontSize: 15,
      lineHeight: 22,
      textAlign: "center",
      marginTop: 12,
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
      marginTop: 14,
      textAlign: "center",
      fontSize: 44,
      lineHeight: 52,
    },
    modalStats: {
      marginTop: 10,
      alignItems: "center",
    },
    modalStatText: {
      color: textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    modalStatTextSpacing: {
      marginTop: 4,
    },
  });
}
