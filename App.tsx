import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "./src/firebase";
import AppNavigator from "./src/navigation/AppNavigator";
import { gameService } from "./src/services/gameService";
import { userStore } from "./src/store/userStore";

export default function App() {
  useEffect(() => {
    void gameService.hydrateSavedGame();
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

  return <AppNavigator />;
}
