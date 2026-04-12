import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

import { AuthStateProvider } from "./src/context/AuthStateContext";
import { CoinProvider } from "./src/context/CoinContext";
import { DailyChallengeProvider } from "./src/context/DailyChallengeContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { auth } from "./src/firebase";
import AppNavigator from "./src/navigation/AppNavigator";
import LoadingScreen from "./src/screens/LoadingScreen";
import { initializeAds, safeInitializeConsent } from "./src/services/adService";
import { hasRecentInteractiveAuthAttempt } from "./src/services/authService";
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
  const [authResolved, setAuthResolved] = useState(false);
  const [consentResolved, setConsentResolved] = useState(false);
  const [isGameStateHydrated, setIsGameStateHydrated] = useState(false);
  const [requiresEmailVerification, setRequiresEmailVerification] =
    useState(false);
  const [authSyncVersion, setAuthSyncVersion] = useState(0);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [latestUserData, setLatestUserData] =
    useState<PersistedUserDataSnapshot | null>(null);
  const [userDataLoadMessage, setUserDataLoadMessage] = useState<string | null>(
    null,
  );
  const lastProgressSignatureRef = useRef("");
  const lastStatsSignatureRef = useRef("");

  useEffect(() => {
    let isDisposed = false;
    let consentTimer: ReturnType<typeof setTimeout> | null = null;

    consentTimer = setTimeout(() => {
      void (async () => {
        try {
          if (Platform.OS === "android") {
            await safeInitializeConsent();
          }
        } catch (error) {
          console.warn("Consent init failed", error);
        } finally {
          if (!isDisposed) {
            setConsentResolved(true);
          }
        }
      })();
    }, 500);

    return () => {
      isDisposed = true;

      if (consentTimer) {
        clearTimeout(consentTimer);
      }
    };
  }, []);

  useEffect(() => {
    if (!consentResolved) {
      return;
    }

    void initializeAds().catch(() => {
      // Keep startup resilient if ad SDK warm-up fails.
    });
  }, [consentResolved]);

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
    let authEventVersion = 0;

    const resolveAuthState = (user: User | null) => {
      authEventVersion += 1;
      const currentEventVersion = authEventVersion;

      void (async () => {
        let resolvedUser: User | null = user;
        let isResolvedUserUnverified = false;
        let shouldRequireVerification = false;
        let nextAuthUserId: string | null = null;
        let nextUserData: PersistedUserDataSnapshot | null = null;
        let nextUserDataLoadMessage: string | null = null;

        try {
          if (resolvedUser) {
            try {
              await resolvedUser.reload();
            } catch {
              // Keep auth startup resilient when refresh fails temporarily.
            }

            resolvedUser = auth.currentUser ?? resolvedUser;
            isResolvedUserUnverified = !resolvedUser.emailVerified;

            if (isResolvedUserUnverified) {
              const shouldRouteVerification = hasRecentInteractiveAuthAttempt();
              shouldRequireVerification = shouldRouteVerification;

              if (!shouldRouteVerification) {
                try {
                  await signOut(auth);
                } catch {
                  // Keep startup stable if stale-session cleanup fails.
                }

                resolvedUser = null;
                isResolvedUserUnverified = false;
              }
            }
          }

          if (isDisposed || currentEventVersion !== authEventVersion) {
            return;
          }

          nextAuthUserId = isResolvedUserUnverified
            ? null
            : (resolvedUser?.uid ?? null);

          if (resolvedUser && !isResolvedUserUnverified) {
            userStore.setUser({
              id: resolvedUser.uid,
              email: resolvedUser.email,
            });
          } else if (userStore.getState().mode === "signed_in") {
            userStore.resetUser();
          }

          const loadResult = await loadUserData(nextAuthUserId);

          if (isDisposed || currentEventVersion !== authEventVersion) {
            return;
          }

          hydrateStoresFromUserData(loadResult.data);
          nextUserData = loadResult.data;
        } catch {
          if (resolvedUser && !shouldRequireVerification) {
            nextUserDataLoadMessage = "Failed to load data, retry";
          } else if (userStore.getState().mode === "signed_in") {
            userStore.resetUser();
          }
        } finally {
          if (!isDisposed && currentEventVersion === authEventVersion) {
            setRequiresEmailVerification(shouldRequireVerification);
            setAuthUserId(nextAuthUserId);
            setLatestUserData(nextUserData);
            setUserDataLoadMessage(nextUserDataLoadMessage);
            setAuthSyncVersion(currentEventVersion);
            setAuthResolved(true);
          }
        }
      })();
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      resolveAuthState(user);
    });

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userDataLoadMessage) {
      return;
    }

    Alert.alert("Data Sync", userDataLoadMessage, [
      {
        text: "OK",
        onPress: () => {
          setUserDataLoadMessage(null);
        },
      },
    ]);
  }, [userDataLoadMessage]);

  useEffect(() => {
    if (!authResolved) {
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
  }, [authResolved]);

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
            {authResolved && isGameStateHydrated ? (
              <AppNavigator
                requiresEmailVerification={requiresEmailVerification}
              />
            ) : (
              <LoadingScreen subtitle="Preparing your puzzle..." />
            )}
          </ThemeProvider>
        </DailyChallengeProvider>
      </CoinProvider>
    </AuthStateProvider>
  );
}
