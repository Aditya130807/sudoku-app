import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { db } from "../firebase";
import { LevelProgress } from "../game/types";
import { GuestStatsSnapshot, storageService } from "./storageService";

function normalizeCoins(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.floor(value);
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

  if (!existingUserSnapshot.exists()) {
    await setDoc(
      userDoc,
      {
        coins: safeGuestCoins,
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
  const mergedCoins = Math.max(remoteCoins, safeGuestCoins);
  const mergedProgress = mergeProgressPreservingExisting(
    existingData.progress,
    guestSnapshot.progress,
  );
  const mergedStats = mergeStatsPreservingExisting(
    existingData.stats,
    guestSnapshot.stats,
  );

  const updatePayload: {
    coins?: number;
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

  if (mergedCoins > remoteCoins) {
    updatePayload.coins = mergedCoins;
  }

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

  if (!snapshot.exists()) {
    await setDoc(
      userDoc,
      {
        coins: safeSeedCoins,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      },
      { merge: true },
    );

    return safeSeedCoins;
  }

  const data = snapshot.data();
  const remoteCoins = normalizeCoins(data.coins);
  const mergedCoins = Math.max(remoteCoins, safeSeedCoins);
  const hasCreatedAt = Object.prototype.hasOwnProperty.call(data, "createdAt");
  const updatePayload: {
    coins: number;
    lastLogin: ReturnType<typeof serverTimestamp>;
    createdAt?: ReturnType<typeof serverTimestamp>;
  } = {
    coins: mergedCoins,
    lastLogin: serverTimestamp(),
  };

  if (!hasCreatedAt) {
    updatePayload.createdAt = serverTimestamp();
  }

  await setDoc(userDoc, updatePayload, { merge: true });

  return mergedCoins;
}

export async function saveUserCoins(
  userId: string,
  coins: number,
): Promise<void> {
  const safeCoins = normalizeCoins(coins);

  await setDoc(
    getUserDoc(userId),
    {
      coins: safeCoins,
      lastLogin: serverTimestamp(),
    },
    { merge: true },
  );
}
