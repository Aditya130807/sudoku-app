import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";

import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { auth } from "../firebase";
import { userStore } from "../store/userStore";

WebBrowser.maybeCompleteAuthSession();

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
