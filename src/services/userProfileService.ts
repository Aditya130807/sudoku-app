import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "../firebase";
import { LevelProgress } from "../game/types";
import { GuestStatsSnapshot, storageService } from "./storageService";
import {
  applyCoinDeltaForCurrentUser,
  type CoinMutationReason,
} from "./userDataService";

const MAX_COIN_MUTATION_DELTA = 5000;

function normalizeCoins(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
}

function toOperationToken(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48);
  return sanitized || "op";
}

function createGuestMigrationOperationPrefix(userId: string, guestId: string) {
  return `guest-migration-${toOperationToken(userId)}-${toOperationToken(guestId)}`;
}

function createProfileSeedOperationPrefix(userId: string) {
  return `profile-seed-${toOperationToken(userId)}`;
}

async function applyCoinDeltaInChunksForCurrentUser(
  userId: string,
  totalDelta: number,
  reason: CoinMutationReason,
  operationPrefix: string,
): Promise<void> {
  let remainingDelta = Math.trunc(totalDelta);

  if (remainingDelta === 0) {
    return;
  }

  const activeUserId = auth.currentUser?.uid ?? null;

  if (!activeUserId || activeUserId !== userId) {
    throw new Error("Authenticated user mismatch during coin mutation.");
  }

  let chunkIndex = 0;

  while (remainingDelta !== 0) {
    chunkIndex += 1;
    const chunkAmount = Math.min(
      Math.abs(remainingDelta),
      MAX_COIN_MUTATION_DELTA,
    );
    const chunkDelta = remainingDelta > 0 ? chunkAmount : -chunkAmount;

    await applyCoinDeltaForCurrentUser(chunkDelta, {
      reason,
      operationId: `${operationPrefix}-${chunkIndex}`,
    });

    remainingDelta -= chunkDelta;
  }
}

function getUserDoc(userId: string) {
  return doc(db, "users", userId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeProgressPreservingExisting(
  remoteProgress: unknown,
  guestProgress: Record<number, LevelProgress>,
): Record<string, unknown> | null {
  const guestEntries = Object.entries(guestProgress);

  if (guestEntries.length === 0) {
    return null;
  }

  if (!isRecord(remoteProgress)) {
    return guestProgress as unknown as Record<string, unknown>;
  }

  const mergedProgress: Record<string, unknown> = { ...remoteProgress };
  let changed = false;

  guestEntries.forEach(([levelId, guestLevelProgress]) => {
    if (!Object.prototype.hasOwnProperty.call(mergedProgress, levelId)) {
      mergedProgress[levelId] = guestLevelProgress;
      changed = true;
    }
  });

  return changed ? mergedProgress : null;
}

function mergeStatsPreservingExisting(
  remoteStats: unknown,
  guestStats: GuestStatsSnapshot,
): Record<string, unknown> | null {
  if (!isRecord(remoteStats)) {
    return {
      ...guestStats,
    };
  }

  const mergedStats: Record<string, unknown> = { ...remoteStats };
  let changed = false;

  if (
    typeof mergedStats.completedLevels !== "number" ||
    !Number.isFinite(mergedStats.completedLevels)
  ) {
    mergedStats.completedLevels = guestStats.completedLevels;
    changed = true;
  }

  if (
    mergedStats.lastPlayedLevelId == null &&
    guestStats.lastPlayedLevelId != null
  ) {
    mergedStats.lastPlayedLevelId = guestStats.lastPlayedLevelId;
    changed = true;
  }

  if (
    !Array.isArray(mergedStats.claimedChallengeIds) ||
    mergedStats.claimedChallengeIds.length === 0
  ) {
    mergedStats.claimedChallengeIds = guestStats.claimedChallengeIds;
    changed = true;
  }

  if (
    typeof mergedStats.streakCount !== "number" ||
    !Number.isFinite(mergedStats.streakCount)
  ) {
    mergedStats.streakCount = guestStats.streakCount;
    changed = true;
  }

  if (
    (typeof mergedStats.lastClaimDate !== "string" ||
      !mergedStats.lastClaimDate) &&
    guestStats.lastClaimDate
  ) {
    mergedStats.lastClaimDate = guestStats.lastClaimDate;
    changed = true;
  }

  return changed ? mergedStats : null;
}

export async function migrateGuestSessionToUserProfile(
  userId: string,
): Promise<void> {
  const guestSnapshot = await storageService.loadGuestSessionSnapshot();

  if (!guestSnapshot) {
    return;
  }

  const userDoc = getUserDoc(userId);
  const existingUserSnapshot = await getDoc(userDoc);
  const safeGuestCoins = normalizeCoins(guestSnapshot.coins);
  const guestMigrationOperationPrefix = createGuestMigrationOperationPrefix(
    userId,
    guestSnapshot.guestId,
  );

  if (!existingUserSnapshot.exists()) {
    if (safeGuestCoins > 0) {
      await applyCoinDeltaInChunksForCurrentUser(
        userId,
        safeGuestCoins,
        "guest_migration",
        guestMigrationOperationPrefix,
      );
    }

    await setDoc(
      userDoc,
      {
        progress: guestSnapshot.progress,
        stats: guestSnapshot.stats,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        migratedFromGuest: true,
        migratedGuestId: guestSnapshot.guestId,
      },
      { merge: true },
    );

    await storageService.clearGuestSessionSnapshot();
    return;
  }

  const existingData = existingUserSnapshot.data();

  if (existingData.migratedGuestId === guestSnapshot.guestId) {
    await storageService.clearGuestSessionSnapshot();
    return;
  }

  const remoteCoins = normalizeCoins(existingData.coins);
  const mergedProgress = mergeProgressPreservingExisting(
    existingData.progress,
    guestSnapshot.progress,
  );
  const mergedStats = mergeStatsPreservingExisting(
    existingData.stats,
    guestSnapshot.stats,
  );
  const mergedCoins = Math.max(remoteCoins, safeGuestCoins);
  const coinDeltaToGrant = Math.max(0, mergedCoins - remoteCoins);

  if (coinDeltaToGrant > 0) {
    await applyCoinDeltaInChunksForCurrentUser(
      userId,
      coinDeltaToGrant,
      "guest_migration",
      guestMigrationOperationPrefix,
    );
  }

  const updatePayload: {
    progress?: Record<string, unknown>;
    stats?: Record<string, unknown>;
    createdAt?: ReturnType<typeof serverTimestamp>;
    lastLogin: ReturnType<typeof serverTimestamp>;
    migratedFromGuest: boolean;
    migratedGuestId: string;
  } = {
    lastLogin: serverTimestamp(),
    migratedFromGuest: true,
    migratedGuestId: guestSnapshot.guestId,
  };

  if (mergedProgress) {
    updatePayload.progress = mergedProgress;
  }

  if (mergedStats) {
    updatePayload.stats = mergedStats;
  }

  if (!Object.prototype.hasOwnProperty.call(existingData, "createdAt")) {
    updatePayload.createdAt = serverTimestamp();
  }

  await setDoc(userDoc, updatePayload, { merge: true });

  await storageService.clearGuestSessionSnapshot();
}

export async function ensureUserProfile(
  userId: string,
  seedCoins = 0,
): Promise<number> {
  const safeSeedCoins = normalizeCoins(seedCoins);
  const userDoc = getUserDoc(userId);
  const snapshot = await getDoc(userDoc);
  const profileSeedOperationPrefix = createProfileSeedOperationPrefix(userId);

  if (!snapshot.exists()) {
    if (safeSeedCoins > 0) {
      await applyCoinDeltaInChunksForCurrentUser(
        userId,
        safeSeedCoins,
        "profile_seed",
        profileSeedOperationPrefix,
      );
    }

    await setDoc(
      userDoc,
      {
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      },
      { merge: true },
    );

    return safeSeedCoins;
  }

  const data = snapshot.data();
  const remoteCoins = normalizeCoins(data.coins);
  const seedCoinDelta = Math.max(0, safeSeedCoins - remoteCoins);

  if (seedCoinDelta > 0) {
    await applyCoinDeltaInChunksForCurrentUser(
      userId,
      seedCoinDelta,
      "profile_seed",
      profileSeedOperationPrefix,
    );
  }

  const hasCreatedAt = Object.prototype.hasOwnProperty.call(data, "createdAt");
  const updatePayload: {
    lastLogin: ReturnType<typeof serverTimestamp>;
    createdAt?: ReturnType<typeof serverTimestamp>;
  } = {
    lastLogin: serverTimestamp(),
  };

  if (!hasCreatedAt) {
    updatePayload.createdAt = serverTimestamp();
  }

  await setDoc(userDoc, updatePayload, { merge: true });

  return Math.max(remoteCoins, safeSeedCoins);
}

export async function saveUserCoins(
  userId: string,
  coins: number,
): Promise<void> {
  const safeCoins = normalizeCoins(coins);
  const userDoc = getUserDoc(userId);
  const snapshot = await getDoc(userDoc);

  const currentCoins = snapshot.exists()
    ? normalizeCoins(snapshot.data().coins)
    : 0;
  const coinDelta = safeCoins - currentCoins;

  if (coinDelta !== 0) {
    const mutationReason: CoinMutationReason =
      coinDelta > 0 ? "profile_seed" : "theme_purchase";
    const operationPrefix = `save-coins-${toOperationToken(userId)}-${safeCoins.toString(36)}`;

    await applyCoinDeltaInChunksForCurrentUser(
      userId,
      coinDelta,
      mutationReason,
      operationPrefix,
    );
  }

  const updatePayload: {
    lastLogin: ReturnType<typeof serverTimestamp>;
    createdAt?: ReturnType<typeof serverTimestamp>;
  } = {
    lastLogin: serverTimestamp(),
  };

  if (
    !snapshot.exists() ||
    !Object.prototype.hasOwnProperty.call(snapshot.data(), "createdAt")
  ) {
    updatePayload.createdAt = serverTimestamp();
  }

  await setDoc(userDoc, updatePayload, { merge: true });
}
