import { auth } from './firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  signOut,
} from 'firebase/auth';

export const doCreateUserWithEmailAndPassword = (email, password) =>
  createUserWithEmailAndPassword(auth, email, password);

export const doSignInWithEmailAndPassword = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const doSignOut = () => signOut(auth);

export const doPasswordReset = (email) => sendPasswordResetEmail(auth, email);

export const doPasswordChange = (password) => updatePassword(auth.currentUser, password);

