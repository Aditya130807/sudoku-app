const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

const TOTAL_LEVELS_DEFAULT = 30;
const DAILY_CHALLENGE_MAX_ATTEMPTS = 2;
const DAILY_ALL_COMPLETE_BONUS_COINS = 25;
const MIN_REQUEST_INTERVAL_MS = 1000;
const MIN_REWARDED_AD_INTERVAL_MS = 25000;
const GLOBAL_COMPLETE_RATE_LIMIT_MS = 1000;
const GLOBAL_CLAIM_RATE_LIMIT_MS = 1000;
const GLOBAL_COIN_RATE_LIMIT_MS = 2000;
const MIN_DAILY_CHALLENGE_PLAY_MS = 5000;
const USER_DATA_DELETE_BATCH_SIZE = 50;
const USER_DATA_DELETE_TIMEOUT_MS = 50000;
const DAILY_REWARD_COIN_CAP = 5000;
const SUSPICIOUS_COIN_DELTA_THRESHOLD = 10000;

const CHALLENGE_IDS = [
  "play_1_game",
  "win_1_game",
  "featured_daily_board",
  "speed",
  "noHint",
  "mystery",
];
const REWARD_CHALLENGE_IDS = [
  "play_1_game",
  "win_1_game",
  "featured_daily_board",
];
const PUZZLE_CHALLENGE_IDS = ["speed", "noHint", "mystery"];
const ATTEMPT_LIMITED_CHALLENGES = new Set(["speed", "noHint"]);
const LEVEL_BOUND_CHALLENGE_IDS = [
  "featured_daily_board",
  "speed",
  "noHint",
  "mystery",
];
const LEVEL_BOUND_CHALLENGES = new Set(LEVEL_BOUND_CHALLENGE_IDS);

const REWARD_BY_ID = {
  play_1_game: 10,
  win_1_game: 20,
  featured_daily_board: 25,
  speed: 10,
  noHint: 15,
  mystery: 20,
};

const REWARD_MAP = Object.freeze({
  PLAY_GAME: 10,
  WIN_GAME: 25,
  DAILY_CHALLENGE: 50,
  REWARDED_AD: 20,
});
const COIN_ACTIONS = new Set(Object.keys(REWARD_MAP));
const DIRECT_COIN_ACTIONS = ["REWARDED_AD"];
const SERVER_ONLY_ACTIONS = ["WIN_GAME", "PLAY_GAME", "DAILY_CHALLENGE"];
const DIRECT_COIN_ACTION_SET = new Set(DIRECT_COIN_ACTIONS);
const SERVER_ONLY_ACTION_SET = new Set(SERVER_ONLY_ACTIONS);
const LEGACY_ACTION_BY_REASON = Object.freeze({
  rewarded_ad: "REWARDED_AD",
});
const LEGACY_SPEND_REASON = "theme_purchase";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toInt(value, fallback = 0, minimum = Number.MIN_SAFE_INTEGER) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(value));
}

function getTodayDateKeyUTC() {
  return new Date().toISOString().split("T")[0];
}

function toDateKeyUTC(date) {
  return date.toISOString().split("T")[0];
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getYesterdayKey(dateKey) {
  if (!isDateKey(dateKey)) {
    return null;
  }

  const parsedDate = new Date(`${dateKey}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const yesterday = new Date(parsedDate.getTime() - 24 * 60 * 60 * 1000);
  return toDateKeyUTC(yesterday);
}

function hashStringToNumber(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRange(start, end) {
  if (end < start) {
    return [];
  }

  const values = [];

  for (let value = start; value <= end; value += 1) {
    values.push(value);
  }

  return values;
}

function buildPools(totalLevels) {
  const allLevels = createRange(1, totalLevels);

  const easyPool = allLevels.filter((levelId) => levelId <= 10);
  const hardPool = allLevels.filter((levelId) => levelId > 20);
  const specialPool = allLevels.filter(
    (levelId) => levelId > 10 && levelId <= 20,
  );

  return {
    easyPool: easyPool.length ? easyPool : allLevels,
    hardPool: hardPool.length ? hardPool : allLevels,
    specialPool: specialPool.length ? specialPool : allLevels,
  };
}

function pickFromPool(pool, dateSeed, challengeType, excludedIds = new Set()) {
  if (!pool.length) {
    throw new Error(`${challengeType} pool is empty`);
  }

  const startIndex =
    hashStringToNumber(`${dateSeed}:${challengeType}`) % pool.length;

  for (let offset = 0; offset < pool.length; offset += 1) {
    const candidate = pool[(startIndex + offset) % pool.length];

    if (!excludedIds.has(candidate)) {
      return candidate;
    }
  }

  return pool[startIndex];
}

function generateChallengeSet(dateKey, totalLevels) {
  const pools = buildPools(totalLevels);
  const speed = pickFromPool(pools.easyPool, dateKey, "speed");
  const noHint = pickFromPool(pools.hardPool, dateKey, "noHint");
  const mystery = pickFromPool(
    pools.specialPool,
    dateKey,
    "mystery",
    new Set([speed, noHint]),
  );

  return {
    speed,
    noHint,
    mystery,
  };
}

function generateLevelFromSeed(dateKey, totalLevels) {
  const dayPart = Number(dateKey.split("-")[2]);
  const safeDay = Number.isInteger(dayPart) && dayPart > 0 ? dayPart : 1;

  return (safeDay % totalLevels) + 1;
}

function createChallengeStates(challengeSet, dailyLevelId) {
  return {
    play_1_game: {
      completed: false,
      claimed: false,
      reward: REWARD_BY_ID.play_1_game,
      levelId: null,
      attemptsRemaining: null,
    },
    win_1_game: {
      completed: false,
      claimed: false,
      reward: REWARD_BY_ID.win_1_game,
      levelId: null,
      attemptsRemaining: null,
    },
    featured_daily_board: {
      completed: false,
      claimed: false,
      reward: REWARD_BY_ID.featured_daily_board,
      levelId: dailyLevelId,
      attemptsRemaining: null,
    },
    speed: {
      completed: false,
      claimed: false,
      reward: REWARD_BY_ID.speed,
      levelId: challengeSet.speed,
      attemptsRemaining: DAILY_CHALLENGE_MAX_ATTEMPTS,
    },
    noHint: {
      completed: false,
      claimed: false,
      reward: REWARD_BY_ID.noHint,
      levelId: challengeSet.noHint,
      attemptsRemaining: DAILY_CHALLENGE_MAX_ATTEMPTS,
    },
    mystery: {
      completed: false,
      claimed: false,
      reward: REWARD_BY_ID.mystery,
      levelId: challengeSet.mystery,
      attemptsRemaining: null,
    },
  };
}

function createBaseDailyState(dateKey, totalLevels, streakCarry = 0) {
  const challengeSet = generateChallengeSet(dateKey, totalLevels);
  const dailyLevelId = generateLevelFromSeed(dateKey, totalLevels);
  const safeStreakCarry = Math.max(0, Math.floor(streakCarry));

  return {
    date: dateKey,
    dailyLevelId,
    challengeSet: {
      ...challengeSet,
      featuredDailyBoard: dailyLevelId,
    },
    challenges: createChallengeStates(challengeSet, dailyLevelId),
    allCompleteBonusClaimed: false,
    streak: safeStreakCarry,
    streakCount: safeStreakCarry,
    lastClaimDate: null,
  };
}

function normalizeChallengeEntry(rawEntry, fallbackEntry) {
  if (!isRecord(rawEntry)) {
    return { ...fallbackEntry };
  }

  const claimed = rawEntry.claimed === true;
  const completed = claimed || rawEntry.completed === true;

  let attemptsRemaining = null;

  if (fallbackEntry.attemptsRemaining !== null) {
    attemptsRemaining = toInt(
      rawEntry.attemptsRemaining,
      fallbackEntry.attemptsRemaining,
      0,
    );
    attemptsRemaining = Math.min(
      DAILY_CHALLENGE_MAX_ATTEMPTS,
      attemptsRemaining,
    );
  }

  return {
    completed,
    claimed,
    reward: fallbackEntry.reward,
    levelId: fallbackEntry.levelId,
    attemptsRemaining,
  };
}

function normalizeDailyState(rawState, dateKey, totalLevels) {
  const defaults = createBaseDailyState(dateKey, totalLevels);

  if (!isRecord(rawState)) {
    return defaults;
  }

  const dailyLevelId =
    toInt(rawState.dailyLevelId, defaults.dailyLevelId, 1) ||
    defaults.dailyLevelId;
  const challengeSetRaw = isRecord(rawState.challengeSet)
    ? rawState.challengeSet
    : {};
  const challengeSet = {
    speed: toInt(challengeSetRaw.speed, defaults.challengeSet.speed, 1),
    noHint: toInt(challengeSetRaw.noHint, defaults.challengeSet.noHint, 1),
    mystery: toInt(challengeSetRaw.mystery, defaults.challengeSet.mystery, 1),
    featuredDailyBoard: toInt(
      challengeSetRaw.featuredDailyBoard,
      dailyLevelId,
      1,
    ),
  };
  const challengeDefaults = createChallengeStates(
    {
      speed: challengeSet.speed,
      noHint: challengeSet.noHint,
      mystery: challengeSet.mystery,
    },
    challengeSet.featuredDailyBoard,
  );
  const challengeRaw = isRecord(rawState.challenges) ? rawState.challenges : {};

  const challenges = {
    play_1_game: normalizeChallengeEntry(
      challengeRaw.play_1_game,
      challengeDefaults.play_1_game,
    ),
    win_1_game: normalizeChallengeEntry(
      challengeRaw.win_1_game,
      challengeDefaults.win_1_game,
    ),
    featured_daily_board: normalizeChallengeEntry(
      challengeRaw.featured_daily_board,
      challengeDefaults.featured_daily_board,
    ),
    speed: normalizeChallengeEntry(challengeRaw.speed, challengeDefaults.speed),
    noHint: normalizeChallengeEntry(
      challengeRaw.noHint,
      challengeDefaults.noHint,
    ),
    mystery: normalizeChallengeEntry(
      challengeRaw.mystery,
      challengeDefaults.mystery,
    ),
  };

  const streakCount = toInt(
    rawState.streakCount,
    toInt(rawState.streak, defaults.streakCount, 0),
    0,
  );
  const lastClaimDate =
    typeof rawState.lastClaimDate === "string" &&
    isDateKey(rawState.lastClaimDate)
      ? rawState.lastClaimDate
      : null;

  return {
    date: dateKey,
    dailyLevelId,
    challengeSet,
    challenges,
    allCompleteBonusClaimed: rawState.allCompleteBonusClaimed === true,
    streak: streakCount,
    streakCount,
    lastClaimDate,
  };
}

function toDailyWritePayload(state, includeCreateFields = false) {
  const payload = {
    date: state.date,
    dailyLevelId: state.dailyLevelId,
    challengeSet: {
      speed: state.challengeSet.speed,
      noHint: state.challengeSet.noHint,
      mystery: state.challengeSet.mystery,
      featuredDailyBoard: state.challengeSet.featuredDailyBoard,
    },
    challenges: {
      play_1_game: { ...state.challenges.play_1_game },
      win_1_game: { ...state.challenges.win_1_game },
      featured_daily_board: { ...state.challenges.featured_daily_board },
      speed: { ...state.challenges.speed },
      noHint: { ...state.challenges.noHint },
      mystery: { ...state.challenges.mystery },
    },
    allCompleteBonusClaimed: state.allCompleteBonusClaimed === true,
    streak: Math.max(0, Math.floor(state.streakCount)),
    streakCount: Math.max(0, Math.floor(state.streakCount)),
    lastClaimDate: state.lastClaimDate ?? null,
    lastUpdated: FieldValue.serverTimestamp(),
  };

  if (includeCreateFields) {
    payload.generatedAt = FieldValue.serverTimestamp();
    payload.createdAt = FieldValue.serverTimestamp();
  }

  return payload;
}

function toPublicSnapshot(state) {
  return {
    date: state.date,
    dailyLevelId: state.dailyLevelId,
    challengeSet: {
      speed: state.challengeSet.speed,
      noHint: state.challengeSet.noHint,
      mystery: state.challengeSet.mystery,
      featuredDailyBoard: state.challengeSet.featuredDailyBoard,
    },
    challenges: {
      play_1_game: { ...state.challenges.play_1_game },
      win_1_game: { ...state.challenges.win_1_game },
      featured_daily_board: { ...state.challenges.featured_daily_board },
      speed: { ...state.challenges.speed },
      noHint: { ...state.challenges.noHint },
      mystery: { ...state.challenges.mystery },
    },
    allCompleteBonusClaimed: state.allCompleteBonusClaimed === true,
    streak: Math.max(0, Math.floor(state.streakCount)),
    streakCount: Math.max(0, Math.floor(state.streakCount)),
    lastClaimDate: state.lastClaimDate ?? null,
  };
}

function getDailyChallengeSessionRef(userRef, dateKey, challengeId) {
  return userRef
    .collection("_internal")
    .doc(`daily-session:${dateKey}:${challengeId}`);
}

function parseDailyChallengeSession(snapshot) {
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data();

  if (!isRecord(data)) {
    return null;
  }

  const challengeId =
    typeof data.challengeId === "string" &&
    CHALLENGE_IDS.includes(data.challengeId)
      ? data.challengeId
      : null;
  const dateKey =
    typeof data.dateKey === "string" && isDateKey(data.dateKey)
      ? data.dateKey
      : null;
  const levelId = toInt(data.levelId, 0, 1);
  const startedAtMs = toInt(data.startedAtMs, 0, 1);

  if (!challengeId || !dateKey || levelId <= 0 || startedAtMs <= 0) {
    return null;
  }

  return {
    challengeId,
    dateKey,
    levelId,
    startedAtMs,
  };
}

async function upsertDailyChallengeSessionInTransaction(
  tx,
  userRef,
  dateKey,
  challengeId,
  levelId,
  nowMs,
  options = {},
) {
  const sessionRef = getDailyChallengeSessionRef(userRef, dateKey, challengeId);
  const sessionSnapshot = await tx.get(sessionRef);
  const currentSession = parseDailyChallengeSession(sessionSnapshot);
  const forceRefresh = options.forceRefresh === true;

  if (
    !forceRefresh &&
    currentSession &&
    currentSession.challengeId === challengeId &&
    currentSession.dateKey === dateKey &&
    currentSession.levelId === levelId
  ) {
    return currentSession;
  }

  const payload = {
    challengeId,
    dateKey,
    levelId,
    startedAtMs: nowMs,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!sessionSnapshot.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
  }

  tx.set(sessionRef, payload, { merge: true });

  return {
    challengeId,
    dateKey,
    levelId,
    startedAtMs: nowMs,
  };
}

function deleteDailyChallengeSessionInTransaction(
  tx,
  userRef,
  dateKey,
  challengeId,
) {
  tx.delete(getDailyChallengeSessionRef(userRef, dateKey, challengeId));
}

async function syncDailyChallengeSessionsInTransaction(
  tx,
  userRef,
  dateKey,
  state,
  nowMs,
) {
  for (const levelBoundChallengeId of LEVEL_BOUND_CHALLENGE_IDS) {
    const challenge = state.challenges[levelBoundChallengeId];

    if (!challenge || challenge.levelId === null) {
      deleteDailyChallengeSessionInTransaction(
        tx,
        userRef,
        dateKey,
        levelBoundChallengeId,
      );
      continue;
    }

    if (challenge.completed || challenge.claimed) {
      deleteDailyChallengeSessionInTransaction(
        tx,
        userRef,
        dateKey,
        levelBoundChallengeId,
      );
      continue;
    }

    await upsertDailyChallengeSessionInTransaction(
      tx,
      userRef,
      dateKey,
      levelBoundChallengeId,
      challenge.levelId,
      nowMs,
    );
  }
}

function isPuzzleChallengeFullyClaimed(state) {
  return PUZZLE_CHALLENGE_IDS.every(
    (challengeId) => state.challenges[challengeId]?.claimed === true,
  );
}

function updateStreakOnClaim(state, todayKey) {
  const currentStreak = Math.max(0, Math.floor(state.streakCount || 0));
  const previousClaimDate = state.lastClaimDate;
  const yesterdayKey = getYesterdayKey(todayKey);

  if (previousClaimDate === todayKey) {
    state.streakCount = Math.max(1, currentStreak);
    state.streak = state.streakCount;
    state.lastClaimDate = todayKey;
    return;
  }

  if (previousClaimDate && yesterdayKey && previousClaimDate === yesterdayKey) {
    state.streakCount = Math.max(1, currentStreak) + 1;
    state.streak = state.streakCount;
    state.lastClaimDate = todayKey;
    return;
  }

  state.streakCount = 1;
  state.streak = 1;
  state.lastClaimDate = todayKey;
}

function assertAuthenticated(request) {
  const userId = request.auth?.uid;

  if (!userId) {
    throw new HttpsError("unauthenticated", "Invalid request");
  }

  return userId;
}

function parseTotalLevels(input) {
  if (!isRecord(input)) {
    return TOTAL_LEVELS_DEFAULT;
  }

  const parsed = toInt(input.totalLevels, TOTAL_LEVELS_DEFAULT, 1);
  return parsed > 0 ? parsed : TOTAL_LEVELS_DEFAULT;
}

function parseChallengeId(input) {
  const challengeId = isRecord(input) ? input.challengeId : null;

  if (typeof challengeId !== "string" || !CHALLENGE_IDS.includes(challengeId)) {
    throw new HttpsError("invalid-argument", "Invalid request");
  }

  return challengeId;
}

function parsePlayedLevelId(input) {
  if (!isRecord(input) || input.playedLevelId === undefined) {
    return null;
  }

  const levelId = toInt(input.playedLevelId, 0, 1);
  return levelId > 0 ? levelId : null;
}

function parseCoinDelta(input) {
  if (!isRecord(input)) {
    throw new HttpsError("invalid-argument", "Invalid request");
  }

  const delta = toInt(input.delta, 0);

  if (delta === 0 || delta < -5000 || delta > 5000) {
    throw new HttpsError("invalid-argument", "Invalid request");
  }

  return delta;
}

function parseCoinAction(input) {
  if (!isRecord(input) || input.action === undefined) {
    return null;
  }

  if (typeof input.action !== "string" || !input.action.trim()) {
    throw new HttpsError("invalid-argument", "Invalid action");
  }

  const action = input.action.trim().toUpperCase();

  if (!COIN_ACTIONS.has(action)) {
    throw new HttpsError("invalid-argument", "Invalid action");
  }

  return action;
}

function parseLegacyAction(input) {
  if (!isRecord(input) || typeof input.reason !== "string") {
    return null;
  }

  const reason = input.reason.trim();

  if (!Object.prototype.hasOwnProperty.call(LEGACY_ACTION_BY_REASON, reason)) {
    return null;
  }

  return LEGACY_ACTION_BY_REASON[reason];
}

function parseLegacySpendDelta(input) {
  if (!isRecord(input) || typeof input.reason !== "string") {
    return null;
  }

  const reason = input.reason.trim();

  if (reason !== LEGACY_SPEND_REASON) {
    return null;
  }

  const delta = parseCoinDelta(input);

  if (delta >= 0) {
    throw new HttpsError("invalid-argument", "Invalid request");
  }

  return {
    delta,
    reason,
    kind: "legacy_spend",
    action: null,
  };
}

function parseCoinMutation(input, parsedAction = null) {
  const action =
    parsedAction ?? parseCoinAction(input) ?? parseLegacyAction(input);

  if (action) {
    if (!DIRECT_COIN_ACTION_SET.has(action)) {
      throw new HttpsError("invalid-argument", "Invalid request");
    }

    return {
      delta: REWARD_MAP[action],
      reason: `action:${action.toLowerCase()}`,
      kind: "reward_action",
      action,
    };
  }

  const legacySpend = parseLegacySpendDelta(input);

  if (legacySpend) {
    return legacySpend;
  }

  throw new HttpsError("invalid-argument", "Invalid request");
}

function parseOperationId(input) {
  if (!isRecord(input) || typeof input.operationId !== "string") {
    return null;
  }

  const operationId = input.operationId.trim();

  if (!/^[A-Za-z0-9_-]{8,120}$/.test(operationId)) {
    throw new HttpsError("invalid-argument", "Invalid request");
  }

  return operationId;
}

function getGlobalRateLimitRef(userId, action) {
  return db.collection("rateLimits").doc(`${userId}_${action}`);
}

async function checkRateLimit(
  userId,
  action,
  limitMs = MIN_REQUEST_INTERVAL_MS,
) {
  const ref = getGlobalRateLimitRef(userId, action);
  const now = Date.now();

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const lastCall = snapshot.exists
      ? toInt(snapshot.data().lastCall, 0, 0)
      : 0;

    if (now - lastCall < limitMs) {
      throw new HttpsError("resource-exhausted", "Too many requests");
    }

    tx.set(
      ref,
      {
        userId,
        action,
        lastCall: now,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

function getErrorReason(error) {
  if (error instanceof HttpsError) {
    return `${error.code}:${error.message}`;
  }

  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }

  return "unknown_error";
}

async function logSecurityEvent(event) {
  try {
    const payload = {
      ...event,
      timestamp: FieldValue.serverTimestamp(),
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined) {
        delete payload[key];
      }
    });

    await db.collection("securityLogs").add(payload);
  } catch (logError) {
    console.error("Failed to write security log", {
      reason: getErrorReason(logError),
    });
  }
}

function getDailyCoinCapRef(userRef, dateKey) {
  return userRef.collection("_internal").doc(`daily-coin-cap:${dateKey}`);
}

async function assertDailyRewardCapInTransaction(
  tx,
  userRef,
  dateKey,
  incomingCoins,
) {
  const safeIncomingCoins = toInt(incomingCoins, 0, 0);

  if (safeIncomingCoins <= 0) {
    return;
  }

  const capRef = getDailyCoinCapRef(userRef, dateKey);
  const capSnapshot = await tx.get(capRef);
  const currentDailyCoins = capSnapshot.exists
    ? toInt(capSnapshot.data().totalDailyCoins, 0, 0)
    : 0;
  const nextDailyCoins = currentDailyCoins + safeIncomingCoins;

  if (nextDailyCoins > DAILY_REWARD_COIN_CAP) {
    throw new HttpsError("resource-exhausted", "Daily reward limit reached");
  }

  tx.set(
    capRef,
    {
      dateKey,
      totalDailyCoins: nextDailyCoins,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function appendCoinHistoryInTransaction(tx, userRef, input) {
  const delta = toInt(input?.delta, 0);

  if (delta === 0) {
    return;
  }

  const historyPayload = {
    delta,
    type:
      typeof input?.type === "string" && input.type.trim()
        ? input.type.trim()
        : "coin_delta",
    createdAt: FieldValue.serverTimestamp(),
  };

  if (typeof input?.challengeId === "string") {
    historyPayload.challengeId = input.challengeId;
  }

  if (typeof input?.reason === "string") {
    historyPayload.reason = input.reason;
  }

  if (typeof input?.operationId === "string") {
    historyPayload.operationId = input.operationId;
  }

  tx.set(userRef.collection("coinHistory").doc(), historyPayload);
}

// eslint-disable-next-line no-unused-vars
async function rollbackCoins(userId, amount) {
  const safeAmount = toInt(amount, 0, 1);

  if (typeof userId !== "string" || !userId || safeAmount <= 0) {
    return;
  }

  const userRef = db.collection("users").doc(userId);

  await userRef.update({
    coins: FieldValue.increment(-safeAmount),
    lastCoinDelta: -safeAmount,
    lastLogin: FieldValue.serverTimestamp(),
  });

  await logSecurityEvent({
    type: "coin_rollback",
    userId,
    amount: safeAmount,
    success: true,
  });
}

function getRateLimitRef(userRef, key) {
  return userRef.collection("_internal").doc(`rate:${key}`);
}

async function assertRateLimit(tx, rateLimitRef, minimumIntervalMs, nowMs) {
  const snapshot = await tx.get(rateLimitRef);
  const data = snapshot.exists ? snapshot.data() : null;
  const previousRequestAtMs = data ? toInt(data.lastRequestAtMs, 0, 0) : 0;

  if (
    previousRequestAtMs > 0 &&
    nowMs - previousRequestAtMs < minimumIntervalMs
  ) {
    throw new HttpsError("resource-exhausted", "Too many requests");
  }

  tx.set(
    rateLimitRef,
    {
      lastRequestAtMs: nowMs,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function safeHandleError(error) {
  if (error instanceof HttpsError) {
    throw error;
  }

  console.error("Daily challenge function failure", error);
  throw new HttpsError("internal", "Try again later");
}

async function deleteCollection(
  path,
  batchSize = USER_DATA_DELETE_BATCH_SIZE,
  options = {},
) {
  const safeBatchSize = Math.max(
    1,
    toInt(batchSize, USER_DATA_DELETE_BATCH_SIZE, 1),
  );
  const startedAtMs = toInt(options.startedAtMs, Date.now(), 0);
  const timeoutMs = toInt(options.timeoutMs, USER_DATA_DELETE_TIMEOUT_MS, 1000);

  if (Date.now() - startedAtMs > timeoutMs) {
    throw new HttpsError("deadline-exceeded", "Deletion timeout");
  }

  const snapshot = await db.collection(path).limit(safeBatchSize).get();

  if (snapshot.empty) {
    return 0;
  }

  const batch = db.batch();
  snapshot.docs.forEach((docSnapshot) => {
    batch.delete(docSnapshot.ref);
  });
  await batch.commit();

  const deletedFromNextBatch = await deleteCollection(path, safeBatchSize, {
    startedAtMs,
    timeoutMs,
  });

  return snapshot.size + deletedFromNextBatch;
}

async function ensureDailyStateInTransaction(
  tx,
  userRef,
  dateKey,
  totalLevels,
) {
  const dailyRef = userRef.collection("dailyChallenges").doc(dateKey);
  const [userSnapshot, dailySnapshot] = await Promise.all([
    tx.get(userRef),
    tx.get(dailyRef),
  ]);

  if (dailySnapshot.exists) {
    return {
      userRef,
      userSnapshot,
      dailyRef,
      didCreateDailyDoc: false,
      state: normalizeDailyState(dailySnapshot.data(), dateKey, totalLevels),
    };
  }

  let streakCarry = 0;
  const yesterdayKey = getYesterdayKey(dateKey);

  if (yesterdayKey) {
    const yesterdayRef = userRef
      .collection("dailyChallenges")
      .doc(yesterdayKey);
    const yesterdaySnapshot = await tx.get(yesterdayRef);

    if (yesterdaySnapshot.exists) {
      const yesterdayState = normalizeDailyState(
        yesterdaySnapshot.data(),
        yesterdayKey,
        totalLevels,
      );

      if (yesterdayState.lastClaimDate === yesterdayKey) {
        streakCarry = yesterdayState.streakCount;
      }
    }
  }

  const state = createBaseDailyState(dateKey, totalLevels, streakCarry);
  tx.set(dailyRef, toDailyWritePayload(state, true), { merge: true });

  return {
    userRef,
    userSnapshot,
    dailyRef,
    didCreateDailyDoc: true,
    state,
  };
}

function updateUserCoinsInTransaction(
  tx,
  userRef,
  userSnapshot,
  coinDelta,
  historyInput,
) {
  if (coinDelta <= 0) {
    return;
  }

  appendCoinHistoryInTransaction(tx, userRef, {
    delta: coinDelta,
    type: historyInput?.type ?? "daily_reward",
    challengeId: historyInput?.challengeId,
    reason: historyInput?.reason,
    operationId: historyInput?.operationId,
  });

  if (userSnapshot.exists) {
    tx.set(
      userRef,
      {
        coins: FieldValue.increment(coinDelta),
        lastCoinDelta: coinDelta,
        lastLogin: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  tx.set(
    userRef,
    {
      coins: coinDelta,
      lastCoinDelta: coinDelta,
      createdAt: FieldValue.serverTimestamp(),
      lastLogin: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function readUserCoins(snapshot) {
  if (!snapshot.exists) {
    return 0;
  }

  return toInt(snapshot.data().coins, 0, 0);
}
exports.generateDailyChallenges = onCall(async (request) => {
  try {
    const userId = assertAuthenticated(request);
    const totalLevels = parseTotalLevels(request.data);
    const todayKey = getTodayDateKeyUTC();
    const nowMs = Date.now();
    const userRef = db.collection("users").doc(userId);

    const snapshot = await db.runTransaction(async (tx) => {
      const transactionState = await ensureDailyStateInTransaction(
        tx,
        userRef,
        todayKey,
        totalLevels,
      );

      await syncDailyChallengeSessionsInTransaction(
        tx,
        userRef,
        todayKey,
        transactionState.state,
        nowMs,
      );

      return toPublicSnapshot(transactionState.state);
    });

    return {
      success: true,
      message: "Daily challenge ready",
      snapshot,
    };
  } catch (error) {
    safeHandleError(error);
  }
});

exports.completeChallenge = onCall(async (request) => {
  let userId = "unknown";
  let challengeId = null;
  let playedLevelId = null;

  try {
    userId = assertAuthenticated(request);
    await checkRateLimit(userId, "complete", GLOBAL_COMPLETE_RATE_LIMIT_MS);
    challengeId = parseChallengeId(request.data);
    const totalLevels = parseTotalLevels(request.data);
    playedLevelId = parsePlayedLevelId(request.data);
    const todayKey = getTodayDateKeyUTC();
    const nowMs = Date.now();
    const userRef = db.collection("users").doc(userId);

    const rawResult = await db.runTransaction(async (tx) => {
      const transactionState = await ensureDailyStateInTransaction(
        tx,
        userRef,
        todayKey,
        totalLevels,
      );
      const challenge = transactionState.state.challenges[challengeId];

      const invalidResponse = (reasonCode, extra = {}) => ({
        success: false,
        message: "Invalid request",
        reasonCode,
        ...extra,
        snapshot: toPublicSnapshot(transactionState.state),
      });

      if (!challenge) {
        return invalidResponse("invalid_challenge");
      }

      if (challenge.completed) {
        if (LEVEL_BOUND_CHALLENGES.has(challengeId)) {
          deleteDailyChallengeSessionInTransaction(
            tx,
            userRef,
            todayKey,
            challengeId,
          );
        }

        return {
          success: true,
          alreadyCompleted: true,
          reasonCode: "already_completed",
          message: "Already completed",
          snapshot: toPublicSnapshot(transactionState.state),
        };
      }

      let shouldDeleteSession = false;

      if (LEVEL_BOUND_CHALLENGES.has(challengeId)) {
        if (!playedLevelId || challenge.levelId === null) {
          return invalidResponse("missing_played_level");
        }

        if (playedLevelId !== challenge.levelId) {
          return invalidResponse("played_level_mismatch");
        }

        const sessionRef = getDailyChallengeSessionRef(
          userRef,
          todayKey,
          challengeId,
        );
        const sessionSnapshot = await tx.get(sessionRef);
        const session = parseDailyChallengeSession(sessionSnapshot);

        if (!session) {
          return invalidResponse("session_missing");
        }

        if (
          session.challengeId !== challengeId ||
          session.dateKey !== todayKey
        ) {
          return invalidResponse("session_mismatch");
        }

        if (session.levelId !== challenge.levelId) {
          return invalidResponse("session_level_mismatch");
        }

        const elapsedMs = nowMs - session.startedAtMs;

        if (elapsedMs < MIN_DAILY_CHALLENGE_PLAY_MS) {
          return invalidResponse("completion_too_fast", { elapsedMs });
        }

        shouldDeleteSession = true;
      }

      challenge.completed = true;
      tx.set(
        transactionState.dailyRef,
        toDailyWritePayload(
          transactionState.state,
          transactionState.didCreateDailyDoc,
        ),
        { merge: true },
      );

      if (shouldDeleteSession) {
        deleteDailyChallengeSessionInTransaction(
          tx,
          userRef,
          todayKey,
          challengeId,
        );
      }

      return {
        success: true,
        alreadyCompleted: false,
        reasonCode: "completed",
        message: "Challenge completed",
        snapshot: toPublicSnapshot(transactionState.state),
      };
    });

    const { reasonCode = null, elapsedMs = null, ...result } = rawResult;

    const logType = result.success
      ? result.alreadyCompleted
        ? "daily_complete_duplicate"
        : "daily_complete"
      : "failed_complete";

    await logSecurityEvent({
      type: logType,
      userId,
      challengeId,
      playedLevelId,
      success: result.success === true,
      reason: reasonCode ?? result.message,
      elapsedMs: typeof elapsedMs === "number" ? elapsedMs : undefined,
    });

    return result;
  } catch (error) {
    await logSecurityEvent({
      type: "failed_complete",
      userId,
      challengeId,
      playedLevelId,
      success: false,
      reason: getErrorReason(error),
    });
    safeHandleError(error);
  }
});

exports.registerDailyChallengeFailure = onCall(async (request) => {
  try {
    const userId = assertAuthenticated(request);
    const challengeId = parseChallengeId(request.data);

    if (!ATTEMPT_LIMITED_CHALLENGES.has(challengeId)) {
      return {
        success: false,
        message: "Invalid request",
      };
    }

    const totalLevels = parseTotalLevels(request.data);
    const todayKey = getTodayDateKeyUTC();
    const nowMs = Date.now();
    const userRef = db.collection("users").doc(userId);

    const result = await db.runTransaction(async (tx) => {
      const transactionState = await ensureDailyStateInTransaction(
        tx,
        userRef,
        todayKey,
        totalLevels,
      );
      const challenge = transactionState.state.challenges[challengeId];

      if (!challenge || challenge.attemptsRemaining === null) {
        return {
          success: false,
          message: "Invalid request",
          attemptsRemaining: 0,
          snapshot: toPublicSnapshot(transactionState.state),
        };
      }

      if (challenge.completed || challenge.claimed) {
        deleteDailyChallengeSessionInTransaction(
          tx,
          userRef,
          todayKey,
          challengeId,
        );

        return {
          success: true,
          message: "Challenge already finished",
          attemptsRemaining: challenge.attemptsRemaining,
          snapshot: toPublicSnapshot(transactionState.state),
        };
      }

      if (challenge.attemptsRemaining <= 0) {
        deleteDailyChallengeSessionInTransaction(
          tx,
          userRef,
          todayKey,
          challengeId,
        );

        return {
          success: true,
          message: "No attempts left",
          attemptsRemaining: 0,
          snapshot: toPublicSnapshot(transactionState.state),
        };
      }

      challenge.attemptsRemaining = Math.max(
        0,
        challenge.attemptsRemaining - 1,
      );

      if (challenge.attemptsRemaining > 0 && challenge.levelId !== null) {
        await upsertDailyChallengeSessionInTransaction(
          tx,
          userRef,
          todayKey,
          challengeId,
          challenge.levelId,
          nowMs,
          { forceRefresh: true },
        );
      } else {
        deleteDailyChallengeSessionInTransaction(
          tx,
          userRef,
          todayKey,
          challengeId,
        );
      }

      tx.set(
        transactionState.dailyRef,
        toDailyWritePayload(
          transactionState.state,
          transactionState.didCreateDailyDoc,
        ),
        { merge: true },
      );

      return {
        success: true,
        message: "Attempt recorded",
        attemptsRemaining: challenge.attemptsRemaining,
        snapshot: toPublicSnapshot(transactionState.state),
      };
    });

    return result;
  } catch (error) {
    safeHandleError(error);
  }
});

exports.claimDailyReward = onCall(async (request) => {
  let userId = "unknown";
  let challengeId = null;

  try {
    userId = assertAuthenticated(request);
    await checkRateLimit(userId, "claim", GLOBAL_CLAIM_RATE_LIMIT_MS);
    challengeId = parseChallengeId(request.data);
    const totalLevels = parseTotalLevels(request.data);
    const todayKey = getTodayDateKeyUTC();
    const userRef = db.collection("users").doc(userId);
    const nowMs = Date.now();

    const result = await db.runTransaction(async (tx) => {
      await assertRateLimit(
        tx,
        getRateLimitRef(userRef, "daily-claim"),
        MIN_REQUEST_INTERVAL_MS,
        nowMs,
      );
      const transactionState = await ensureDailyStateInTransaction(
        tx,
        userRef,
        todayKey,
        totalLevels,
      );

      await syncDailyChallengeSessionsInTransaction(
        tx,
        userRef,
        todayKey,
        transactionState.state,
        nowMs,
      );

      const challenge = transactionState.state.challenges[challengeId];

      if (!challenge) {
        return {
          success: false,
          message: "Invalid request",
          coinsAdded: 0,
          challengeReward: 0,
          allCompleteBonus: 0,
          totalCoins: transactionState.userSnapshot.exists
            ? toInt(transactionState.userSnapshot.data().coins, 0, 0)
            : 0,
          snapshot: toPublicSnapshot(transactionState.state),
        };
      }

      if (!challenge.completed) {
        return {
          success: false,
          message: "Challenge not completed",
          coinsAdded: 0,
          challengeReward: 0,
          allCompleteBonus: 0,
          totalCoins: transactionState.userSnapshot.exists
            ? toInt(transactionState.userSnapshot.data().coins, 0, 0)
            : 0,
          snapshot: toPublicSnapshot(transactionState.state),
        };
      }

      if (challenge.claimed) {
        return {
          success: false,
          message: "Already claimed",
          coinsAdded: 0,
          challengeReward: 0,
          allCompleteBonus: 0,
          totalCoins: transactionState.userSnapshot.exists
            ? toInt(transactionState.userSnapshot.data().coins, 0, 0)
            : 0,
          snapshot: toPublicSnapshot(transactionState.state),
        };
      }

      challenge.claimed = true;
      const challengeReward = Math.max(0, toInt(challenge.reward, 0, 0));
      let allCompleteBonus = 0;

      if (
        PUZZLE_CHALLENGE_IDS.includes(challengeId) &&
        !transactionState.state.allCompleteBonusClaimed &&
        isPuzzleChallengeFullyClaimed(transactionState.state)
      ) {
        transactionState.state.allCompleteBonusClaimed = true;
        allCompleteBonus = DAILY_ALL_COMPLETE_BONUS_COINS;
      }

      updateStreakOnClaim(transactionState.state, todayKey);

      tx.set(
        transactionState.dailyRef,
        toDailyWritePayload(
          transactionState.state,
          transactionState.didCreateDailyDoc,
        ),
        { merge: true },
      );

      const currentCoins = transactionState.userSnapshot.exists
        ? toInt(transactionState.userSnapshot.data().coins, 0, 0)
        : 0;
      const totalAwarded = challengeReward + allCompleteBonus;
      const totalCoins = currentCoins + totalAwarded;

      if (totalAwarded > 0) {
        await assertDailyRewardCapInTransaction(
          tx,
          transactionState.userRef,
          todayKey,
          totalAwarded,
        );
      }

      updateUserCoinsInTransaction(
        tx,
        transactionState.userRef,
        transactionState.userSnapshot,
        totalAwarded,
        {
          type: "daily_reward",
          challengeId,
        },
      );

      return {
        success: true,
        message: "Reward claimed",
        challengeId,
        coinsAdded: totalAwarded,
        challengeReward,
        allCompleteBonus,
        totalCoins,
        snapshot: toPublicSnapshot(transactionState.state),
      };
    });

    await logSecurityEvent({
      type: result.success ? "daily_claim" : "failed_claim",
      userId,
      challengeId,
      amount: toInt(result.coinsAdded, 0),
      challengeReward: toInt(result.challengeReward, 0),
      allCompleteBonus: toInt(result.allCompleteBonus, 0),
      success: result.success === true,
      reason: result.message,
    });

    return result;
  } catch (error) {
    await logSecurityEvent({
      type: "failed_claim",
      userId,
      challengeId,
      success: false,
      reason: getErrorReason(error),
    });
    safeHandleError(error);
  }
});

exports.applyCoinDelta = onCall(async (request) => {
  let userId = "unknown";
  let delta = 0;
  let reason = null;
  let action = null;
  let mutationKind = null;
  let operationId = null;

  try {
    userId = assertAuthenticated(request);
    await checkRateLimit(userId, "coin", GLOBAL_COIN_RATE_LIMIT_MS);

    const payload = isRecord(request.data) ? request.data : {};
    const explicitAction = parseCoinAction(payload);

    if (explicitAction && !DIRECT_COIN_ACTION_SET.has(explicitAction)) {
      const blockedReason = SERVER_ONLY_ACTION_SET.has(explicitAction)
        ? "server_only_action"
        : "action_not_allowed_from_client";

      console.warn("BLOCKED_ACTION_ATTEMPT", {
        userId,
        action: explicitAction,
        timestamp: Date.now(),
      });
      await logSecurityEvent({
        type: "blocked_action_attempt",
        userId,
        action: explicitAction,
        success: false,
        reason: blockedReason,
      });
      throw new HttpsError(
        "permission-denied",
        "This action is not allowed from client",
      );
    }

    const rawDelta = payload.delta;

    if (
      typeof rawDelta === "number" &&
      Number.isFinite(rawDelta) &&
      Math.abs(rawDelta) > SUSPICIOUS_COIN_DELTA_THRESHOLD
    ) {
      console.warn("Suspicious large coin delta", {
        userId,
        amount: rawDelta,
      });
      await logSecurityEvent({
        type: "suspicious_coin_delta",
        userId,
        amount: Math.floor(rawDelta),
        success: false,
        reason: "delta_exceeds_threshold",
      });
    }

    const mutation = parseCoinMutation(payload, explicitAction);
    delta = mutation.delta;
    reason = mutation.reason;
    action = mutation.action;
    mutationKind = mutation.kind;
    operationId = parseOperationId(payload);

    const userRef = db.collection("users").doc(userId);
    const nowMs = Date.now();
    const todayKey = getTodayDateKeyUTC();

    const result = await db.runTransaction(async (tx) => {
      const opRef = operationId
        ? userRef.collection("_internal").doc(`coin-op:${operationId}`)
        : null;

      const [userSnapshot, opSnapshot] = await Promise.all([
        tx.get(userRef),
        opRef ? tx.get(opRef) : Promise.resolve(null),
      ]);

      if (opSnapshot && opSnapshot.exists) {
        const previousResult = opSnapshot.data();
        return {
          success: previousResult.success === true,
          message:
            typeof previousResult.message === "string"
              ? previousResult.message
              : "Request already processed",
          coins: toInt(previousResult.coins, readUserCoins(userSnapshot), 0),
          appliedDelta: toInt(previousResult.appliedDelta, 0),
          idempotent: true,
        };
      }

      await assertRateLimit(
        tx,
        getRateLimitRef(userRef, "coin-mutation"),
        GLOBAL_COIN_RATE_LIMIT_MS,
        nowMs,
      );

      if (action === "REWARDED_AD") {
        await assertRateLimit(
          tx,
          getRateLimitRef(userRef, "rewarded-ad"),
          MIN_REWARDED_AD_INTERVAL_MS,
          nowMs,
        );
      }

      const currentCoins = readUserCoins(userSnapshot);
      const nextCoins = currentCoins + delta;

      if (action === "REWARDED_AD" && delta > 0) {
        await assertDailyRewardCapInTransaction(tx, userRef, todayKey, delta);
      }

      if (nextCoins < 0) {
        const insufficientResult = {
          success: false,
          message: "Not enough coins",
          coins: currentCoins,
          appliedDelta: 0,
          idempotent: false,
        };

        if (opRef) {
          tx.set(
            opRef,
            {
              ...insufficientResult,
              reason,
              action,
              mutationKind,
              createdAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }

        return insufficientResult;
      }

      if (userSnapshot.exists) {
        tx.set(
          userRef,
          {
            coins: FieldValue.increment(delta),
            lastCoinDelta: delta,
            lastLogin: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } else {
        tx.set(
          userRef,
          {
            coins: nextCoins,
            lastCoinDelta: delta,
            createdAt: FieldValue.serverTimestamp(),
            lastLogin: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      appendCoinHistoryInTransaction(tx, userRef, {
        delta,
        type: "coin_delta",
        reason,
        operationId,
      });

      const successResult = {
        success: true,
        message: "Coins updated",
        coins: nextCoins,
        appliedDelta: delta,
        idempotent: false,
      };

      if (opRef) {
        tx.set(
          opRef,
          {
            ...successResult,
            reason,
            action,
            mutationKind,
            createdAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      return successResult;
    });

    await logSecurityEvent({
      type: result.success ? "coin_delta" : "failed_coin_delta",
      userId,
      amount: delta,
      action,
      mutationKind,
      reason,
      operationId,
      success: result.success === true,
      appliedDelta: toInt(result.appliedDelta, 0),
      idempotent: result.idempotent === true,
      message: result.message,
    });

    return result;
  } catch (error) {
    await logSecurityEvent({
      type: "failed_coin_delta",
      userId,
      amount: delta,
      action,
      mutationKind,
      reason,
      operationId,
      success: false,
      message: getErrorReason(error),
    });
    safeHandleError(error);
  }
});

exports.migrateLegacyDailyStats = onCall(async (request) => {
  try {
    const userId = assertAuthenticated(request);
    const payload = isRecord(request.data) ? request.data : {};
    const totalLevels = parseTotalLevels(payload);
    const claimedChallengeIds = Array.isArray(payload.claimedChallengeIds)
      ? payload.claimedChallengeIds
          .filter((entry) => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter((entry) => REWARD_CHALLENGE_IDS.includes(entry))
      : [];
    const legacyStreak = toInt(payload.streakCount, 0, 0);
    const legacyLastClaimDate =
      typeof payload.lastClaimDate === "string" &&
      isDateKey(payload.lastClaimDate)
        ? payload.lastClaimDate
        : null;

    const todayKey = getTodayDateKeyUTC();
    const userRef = db.collection("users").doc(userId);

    const result = await db.runTransaction(async (tx) => {
      const transactionState = await ensureDailyStateInTransaction(
        tx,
        userRef,
        todayKey,
        totalLevels,
      );
      let didChange = false;

      if (legacyLastClaimDate === todayKey) {
        claimedChallengeIds.forEach((challengeId) => {
          const challenge = transactionState.state.challenges[challengeId];

          if (!challenge) {
            return;
          }

          if (!challenge.completed) {
            challenge.completed = true;
            didChange = true;
          }

          if (!challenge.claimed) {
            challenge.claimed = true;
            didChange = true;
          }
        });

        if (legacyStreak > transactionState.state.streakCount) {
          transactionState.state.streakCount = legacyStreak;
          transactionState.state.streak = legacyStreak;
          didChange = true;
        }

        if (
          claimedChallengeIds.length > 0 &&
          transactionState.state.lastClaimDate !== todayKey
        ) {
          transactionState.state.lastClaimDate = todayKey;
          didChange = true;
        }
      }

      if (didChange) {
        tx.set(
          transactionState.dailyRef,
          toDailyWritePayload(
            transactionState.state,
            transactionState.didCreateDailyDoc,
          ),
          { merge: true },
        );
      }

      return {
        success: true,
        migrated: didChange,
        message: didChange ? "Migration complete" : "No migration needed",
        snapshot: toPublicSnapshot(transactionState.state),
      };
    });

    return result;
  } catch (error) {
    safeHandleError(error);
  }
});

exports.deleteUserData = onCall(async (request) => {
  let userId = "unknown";

  try {
    userId = assertAuthenticated(request);
    const startedAtMs = Date.now();
    const userRef = db.collection("users").doc(userId);
    const knownSubcollections = ["dailyChallenges", "coinHistory", "_internal"];
    let deletedDocs = 0;

    for (const subcollectionId of knownSubcollections) {
      deletedDocs += await deleteCollection(
        `users/${userId}/${subcollectionId}`,
        USER_DATA_DELETE_BATCH_SIZE,
        {
          startedAtMs,
          timeoutMs: USER_DATA_DELETE_TIMEOUT_MS,
        },
      );
    }

    const remainingSubcollections = await userRef.listCollections();

    for (const subcollectionRef of remainingSubcollections) {
      if (knownSubcollections.includes(subcollectionRef.id)) {
        continue;
      }

      deletedDocs += await deleteCollection(
        `users/${userId}/${subcollectionRef.id}`,
        USER_DATA_DELETE_BATCH_SIZE,
        {
          startedAtMs,
          timeoutMs: USER_DATA_DELETE_TIMEOUT_MS,
        },
      );
    }

    await userRef.delete();

    await logSecurityEvent({
      type: "user_data_deleted",
      userId,
      success: true,
      deletedDocs,
    });

    return { success: true };
  } catch (error) {
    await logSecurityEvent({
      type: "failed_user_data_delete",
      userId,
      success: false,
      reason: getErrorReason(error),
    });
    safeHandleError(error);
  }
});
