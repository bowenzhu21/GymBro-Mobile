import { getApp, getApps, initializeApp } from 'firebase/app';
import { Platform } from 'react-native';
import { getAuth, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

// Reuse the web app's Firebase project configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

import { getReactNativePersistence } from 'firebase/auth';

let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  const persistence = getReactNativePersistence(AsyncStorage);
  auth = globalThis.__gbFirebaseAuth ?? initializeAuth(app, { persistence });
  globalThis.__gbFirebaseAuth = auth;
}
const storage = getStorage(app);
const db = getFirestore(app);

export { app, auth, storage, db };