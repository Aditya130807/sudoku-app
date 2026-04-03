import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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

export const auth = getAuth(app);
export const db = getFirestore(app);
