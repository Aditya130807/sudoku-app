import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import * as firebaseAuth from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const { getAuth, initializeAuth } = firebaseAuth;

type ReactNativePersistenceFactory = (storage: {
  setItem(key: string, value: string): Promise<unknown>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<unknown>;
}) => firebaseAuth.Persistence;

const getReactNativePersistence = (
  firebaseAuth as typeof firebaseAuth & {
    getReactNativePersistence?: ReactNativePersistenceFactory;
  }
).getReactNativePersistence;

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
  if (typeof getReactNativePersistence !== "function") {
    return getAuth(app);
  }

  try {
    const initializedAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    return initializedAuth;
  } catch {
    // Fast refresh or repeated init should reuse the existing auth instance.
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
export const functions = getFunctions(app);
