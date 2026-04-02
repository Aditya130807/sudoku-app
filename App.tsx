import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef, useState } from "react";

import { CoinProvider } from "./src/context/CoinContext";
import { DailyChallengeProvider } from "./src/context/DailyChallengeContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { auth } from "./src/firebase";
import AppNavigator from "./src/navigation/AppNavigator";
import LoadingScreen from "./src/screens/LoadingScreen";
import { initializeAds } from "./src/services/adService";
import {
  isAuthMigrationInProgress,
  subscribeToAuthMigration,
} from "./src/services/authMigrationGate";
import { gameService } from "./src/services/gameService";
import {
  hydrateStoresFromUserData,
  loadUserData,
  persistProgressAndStatsForCurrentUser,
} from "./src/services/userDataService";
import { gameStore } from "./src/store/gameStore";
import { userStore } from "./src/store/userStore";

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isMigrating, setIsMigrating] = useState(isAuthMigrationInProgress());
  const lastProgressSignatureRef = useRef("");
  const lastStatsSignatureRef = useRef("");

  useEffect(() => {
    void gameService.hydrateSavedGame();
    void initializeAds();
  }, []);

  useEffect(() => {
    let isDisposed = false;
    let authSyncVersion = 0;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      authSyncVersion += 1;
      const currentSyncVersion = authSyncVersion;
      setIsAuthReady(false);

      void (async () => {
        if (user) {
          userStore.setUser({
            id: user.uid,
            email: user.email,
          });
        } else {
          userStore.resetUser();
        }

        const loadResult = await loadUserData(user?.uid ?? null);

        if (isDisposed || currentSyncVersion !== authSyncVersion) {
          return;
        }

        hydrateStoresFromUserData(loadResult.data);
        setIsAuthReady(true);
      })();
    });

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAuthMigration(() => {
      setIsMigrating(isAuthMigrationInProgress());
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    let isDisposed = false;

    const { progress: initialProgress, lastPlayedLevelId: initialLastPlayed } =
      gameStore.getState();
    const { completedLevels: initialCompletedLevels } = userStore.getState();

    lastProgressSignatureRef.current = JSON.stringify(initialProgress);
    lastStatsSignatureRef.current = JSON.stringify({
      completedLevels: initialCompletedLevels,
      lastPlayedLevelId: initialLastPlayed,
    });

    const persistProgressSnapshot = async () => {
      if (isDisposed) {
        return;
      }

      const { progress, lastPlayedLevelId } = gameStore.getState();
      const { completedLevels } = userStore.getState();
      const progressSignature = JSON.stringify(progress);

      const statsPayload = {
        completedLevels,
        lastPlayedLevelId,
      };
      const statsSignature = JSON.stringify(statsPayload);

      if (
        progressSignature === lastProgressSignatureRef.current &&
        statsSignature === lastStatsSignatureRef.current
      ) {
        return;
      }

      lastProgressSignatureRef.current = progressSignature;
      lastStatsSignatureRef.current = statsSignature;
      await persistProgressAndStatsForCurrentUser();
    };

    const unsubscribeGame = gameStore.subscribe(() => {
      void persistProgressSnapshot();
    });
    const unsubscribeUser = userStore.subscribe(() => {
      void persistProgressSnapshot();
    });

    return () => {
      isDisposed = true;
      unsubscribeGame();
      unsubscribeUser();
    };
  }, [isAuthReady]);

  return (
    <CoinProvider>
      <DailyChallengeProvider>
        <ThemeProvider>
          {isAuthReady && !isMigrating ? <AppNavigator /> : <LoadingScreen />}
        </ThemeProvider>
      </DailyChallengeProvider>
    </CoinProvider>
  );
}
