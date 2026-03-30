import { onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";

import { CoinProvider } from "./src/context/CoinContext";
import { DailyChallengeProvider } from "./src/context/DailyChallengeContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { auth } from "./src/firebase";
import AppNavigator from "./src/navigation/AppNavigator";
import { initializeAds } from "./src/services/adService";
import { gameService } from "./src/services/gameService";
import { userStore } from "./src/store/userStore";

export default function App() {
  useEffect(() => {
    void gameService.hydrateSavedGame();
    void initializeAds();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        userStore.setUser({
          id: user.uid,
          email: user.email,
        });
        return;
      }

      userStore.resetUser();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <CoinProvider>
      <DailyChallengeProvider>
        <ThemeProvider>
          <AppNavigator />
        </ThemeProvider>
      </DailyChallengeProvider>
    </CoinProvider>
  );
}
