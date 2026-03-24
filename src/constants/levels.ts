import { TIER_DESCRIPTIONS } from "../game/difficulty";
import { DifficultyTier, LevelDefinition } from "../game/types";
import { getTimeGoal } from "../game/timeGoals";

interface TierBlueprint {
  tier: DifficultyTier;
  titles: string[];
  rewards: string[];
  size: 6 | 9;
  clues: number[];
  hints: number[];
  times: number[];
  seedBase: number;
}

const BLUEPRINTS: TierBlueprint[] = [
  {
    tier: "Beginner",
    titles: [
      "Soft Launch",
      "Morning Grid",
      "Fresh Focus",
      "Lucky Thread",
      "Green Lane",
      "Swift Spark",
      "Clear Steps",
      "Calm Rush",
    ],
    rewards: [
      "Warm Up",
      "Steady Start",
      "Clean Sweep",
      "Flow Finder",
      "Focus Up",
      "Quick Learner",
      "Sharp Eyes",
      "Starter Star",
    ],
    size: 9,
    clues: [44, 43, 43, 42, 42, 41, 40, 40],
    hints: [4, 4, 3, 3, 3, 2, 2, 2],
    times: [150, 160, 170, 180, 190, 210, 220, 240],
    seedBase: 6100,
  },
  {
    tier: "Intermediate",
    titles: [
      "Classic Bloom",
      "Ocean Route",
      "Steady Pulse",
      "Bright Paths",
      "Logic Lift",
      "Glass Current",
      "Blue Orbit",
      "Grid Groove",
    ],
    rewards: [
      "9x9 Ready",
      "Pattern Pilot",
      "Cool Head",
      "Row Runner",
      "Map Climber",
      "Sharp Flow",
      "Logic Pulse",
      "Midway Ace",
    ],
    size: 9,
    clues: [39, 38, 37, 36, 36, 35, 35, 34],
    hints: [4, 4, 3, 3, 3, 2, 2, 2],
    times: [300, 320, 340, 360, 390, 420, 450, 480],
    seedBase: 9200,
  },
  {
    tier: "Advanced",
    titles: [
      "Deep Current",
      "Signal Shift",
      "Tight Corners",
      "Crosswind",
      "Late Bloom",
      "Narrow Edge",
      "Crystal Maze",
      "Final Push",
    ],
    rewards: [
      "Risk Reader",
      "Pattern Hunter",
      "Section Scout",
      "Grid Tactician",
      "Chain Builder",
      "Advanced Calm",
      "Sharp Finish",
      "Elite Focus",
    ],
    size: 9,
    clues: [33, 32, 31, 30, 29, 28, 28, 27],
    hints: [3, 3, 2, 2, 2, 2, 1, 1],
    times: [510, 540, 570, 600, 630, 660, 690, 720],
    seedBase: 9600,
  },
  {
    tier: "Expert",
    titles: [
      "Quiet Storm",
      "Signal Maze",
      "Night Shift",
      "Critical Path",
      "Silent Run",
      "Ryve Crown",
    ],
    rewards: [
      "Edge Walker",
      "Mind Anchor",
      "Zero Rush",
      "Expert Control",
      "Precision Peak",
      "Ryve Legend",
    ],
    size: 9,
    clues: [27, 26, 25, 25, 24, 24],
    hints: [2, 2, 1, 1, 1, 1],
    times: [780, 810, 840, 870, 900, 960],
    seedBase: 9900,
  },
];

function createLevels(): LevelDefinition[] {
  const levels: LevelDefinition[] = [];
  let nextId = 1;

  for (const blueprint of BLUEPRINTS) {
    blueprint.titles.forEach((title, index) => {
      levels.push({
        id: nextId,
        order: nextId,
        title,
        theme: `${blueprint.tier} ${String(index + 1).padStart(2, "0")}`,
        tier: blueprint.tier,
        size: blueprint.size,
        targetClues: blueprint.clues[index],
        hintLimit: blueprint.hints[index],
        // Use difficulty-based goals so puzzles don't feel rushed.
        targetTimeSeconds: getTimeGoal(blueprint.tier),
        unlocksAt: nextId === 1 ? null : nextId - 1,
        seed: blueprint.seedBase + index * 37,
        rewardLabel: blueprint.rewards[index],
        description: TIER_DESCRIPTIONS[blueprint.tier],
      });
      nextId += 1;
    });
  }

  return levels;
}

export const LEVELS = createLevels();
export const TOTAL_LEVELS = LEVELS.length;

export function getLevelDefinition(levelId: number): LevelDefinition {
  const level = LEVELS.find((entry) => entry.id === levelId);

  if (!level) {
    throw new Error(`Unknown level: ${levelId}`);
  }

  return level;
}

export function getNextLevelId(levelId: number): number | null {
  const nextLevel = LEVELS.find((entry) => entry.id === levelId + 1);
  return nextLevel ? nextLevel.id : null;
}
