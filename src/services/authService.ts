import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth } from "../firebase";
import { userStore } from "../store/userStore";

export const authService = {
  // 🟢 Guest mode (keep this)
  async continueAsGuest() {
    await signOut(auth);
    userStore.continueAsGuest();
  },

  // 🟢 Email login
  async login(email: string, password: string) {
    const res = await signInWithEmailAndPassword(auth, email, password);

    userStore.setUser({
      id: res.user.uid,
      email: res.user.email,
    });

    return res.user;
  },

  // 🟢 Signup
  async signUp(email: string, password: string) {
    const res = await createUserWithEmailAndPassword(auth, email, password);

    userStore.setUser({
      id: res.user.uid,
      email: res.user.email,
    });

    return res.user;
  },

  // 🔵 Google login
  async loginWithGoogle(idToken: string) {
    if (!idToken) {
      throw new Error("Google Sign-In failed: missing id_token");
    }

    const credential = GoogleAuthProvider.credential(idToken);

    const res = await signInWithCredential(auth, credential);

    userStore.setUser({
      id: res.user.uid,
      email: res.user.email,
    });

    return res.user;
  },
  // 🔴 Logout
  async logout() {
    await signOut(auth);
    userStore.resetUser();
  },
};
