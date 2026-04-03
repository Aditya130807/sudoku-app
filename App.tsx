import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef, useState } from "react";

import { AuthStateProvider } from "./src/context/AuthStateContext";
import { CoinProvider } from "./src/context/CoinContext";
import { DailyChallengeProvider } from "./src/context/DailyChallengeContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { auth } from "./src/firebase";
import AppNavigator from "./src/navigation/AppNavigator";
import LoadingScreen from "./src/screens/LoadingScreen";
import {
  isAuthMigrationInProgress,
  subscribeToAuthMigration,
} from "./src/services/authMigrationGate";
import { gameService } from "./src/services/gameService";
import { PersistedUserDataSnapshot } from "./src/services/storageService";
import {
  hydrateStoresFromUserData,
  loadUserData,
  persistProgressAndStatsForCurrentUser,
} from "./src/services/userDataService";
import { gameStore } from "./src/store/gameStore";
import { userStore } from "./src/store/userStore";
import {
  preloadSounds,
  setSoundEnabled,
  unloadSounds,
} from "./utils/soundManager";

export default function App() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthLoadTimedOut, setIsAuthLoadTimedOut] = useState(false);
  const [isMigrating, setIsMigrating] = useState(isAuthMigrationInProgress());
  const [isGameStateHydrated, setIsGameStateHydrated] = useState(false);
  const [authSyncVersion, setAuthSyncVersion] = useState(0);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [latestUserData, setLatestUserData] =
    useState<PersistedUserDataSnapshot | null>(null);
  const authReadyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastProgressSignatureRef = useRef("");
  const lastStatsSignatureRef = useRef("");

  useEffect(() => {
    let isDisposed = false;

    setSoundEnabled(gameStore.getState().settings.soundEnabled);
    void preloadSounds().catch(() => {});

    const unsubscribe = gameStore.subscribe(() => {
      if (isDisposed) {
        return;
      }

      setSoundEnabled(gameStore.getState().settings.soundEnabled);
    });

    return () => {
      isDisposed = true;
      unsubscribe();
      void unloadSounds().catch(() => {});
    };
  }, []);

  useEffect(() => {
    let isDisposed = false;

    void (async () => {
      try {
        await gameService.hydrateSavedGame();
      } catch {
      } finally {
        if (!isDisposed) {
          setIsGameStateHydrated(true);
          gameStore.setState((currentState) => ({
            ...currentState,
            isGameStateHydrated: true,
          }));
        }
      }
    })();

    return () => {
      isDisposed = true;
    };
  }, []);

  useEffect(() => {
    let isDisposed = false;
    let authSyncVersion = 0;

    const clearAuthReadyTimeout = () => {
      if (!authReadyTimeoutRef.current) {
        return;
      }

      clearTimeout(authReadyTimeoutRef.current);
      authReadyTimeoutRef.current = null;
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      authSyncVersion += 1;
      const currentSyncVersion = authSyncVersion;
      clearAuthReadyTimeout();
      setIsAuthReady(false);
      setIsAuthLoadTimedOut(false);
      setAuthSyncVersion(currentSyncVersion);
      setAuthUserId(user?.uid ?? null);
      setLatestUserData(null);

      authReadyTimeoutRef.current = setTimeout(() => {
        if (isDisposed || currentSyncVersion !== authSyncVersion) {
          return;
        }

        setIsAuthLoadTimedOut(true);
        setIsAuthReady(true);
      }, 5000);

      void (async () => {
        try {
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
          setLatestUserData(loadResult.data);
        } catch {
          if (!user) {
            userStore.resetUser();
          }
        } finally {
          if (!isDisposed && currentSyncVersion === authSyncVersion) {
            clearAuthReadyTimeout();
            setIsAuthLoadTimedOut(false);
            setIsAuthReady(true);
          }
        }
      })();
    });

    return () => {
      isDisposed = true;
      clearAuthReadyTimeout();
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
      try {
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
      } catch {}
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
    <AuthStateProvider
      value={{
        authSyncVersion,
        userId: authUserId,
        latestUserData,
      }}
    >
      <CoinProvider>
        <DailyChallengeProvider>
          <ThemeProvider>
            {isAuthReady && !isMigrating && isGameStateHydrated ? (
              <AppNavigator />
            ) : (
              <LoadingScreen
                showFallback={isAuthLoadTimedOut}
                subtitle={
                  isAuthLoadTimedOut
                    ? "Startup is taking longer than expected. Continuing with limited sync..."
                    : "Preparing your puzzle..."
                }
              />
            )}
          </ThemeProvider>
        </DailyChallengeProvider>
      </CoinProvider>
    </AuthStateProvider>
  );
}
