import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TypeScript resolves the generic auth typings here, but the React Native bundle
// exports this helper and Metro uses that bundle in Expo.
// @ts-ignore
import { getAuth, initializeAuth } from "@firebase/auth";

import { secureAuthPersistence } from "./services/secureAuthPersistence";

const firebaseConfig = {
  apiKey: "AIzaSyCK7xcQwLbtXMgT-VB8DdeABePSloQSczc",
  authDomain: "sudoku-ryve-d13af.firebaseapp.com",
  projectId: "sudoku-ryve-d13af",
  storageBucket: "sudoku-ryve-d13af.firebasestorage.app",
  messagingSenderId: "312094184536",
  appId: "1:312094184536:web:c8325d6e26689c9162a62d",
  measurementId: "G-FCH2JGB8ZH",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: secureAuthPersistence,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "auth/already-initialized"
    ) {
      return getAuth(app);
    }

    throw error;
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
