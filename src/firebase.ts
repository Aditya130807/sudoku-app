import { initializeApp } from "firebase/app";
import { initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

import { secureAuthPersistence } from "./services/secureAuthPersistence";

type AuthDependencies = NonNullable<Parameters<typeof initializeAuth>[1]>;

const firebaseConfig = {
  apiKey: "AIzaSyCK7xcQwLbtXMgT-VB8DdeABePSloQSczc",
  authDomain: "sudoku-ryve-d13af.firebaseapp.com",
  projectId: "sudoku-ryve-d13af",
  storageBucket: "sudoku-ryve-d13af.firebasestorage.app",
  messagingSenderId: "312094184536",
  appId: "1:312094184536:web:c8325d6e26689c9162a62d",
  measurementId: "G-FCH2JGB8ZH"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = initializeAuth(app, {
  persistence:
    secureAuthPersistence as unknown as AuthDependencies["persistence"],
});
