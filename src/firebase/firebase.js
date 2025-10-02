import { getApp, getApps, initializeApp } from 'firebase/app';
import { Platform } from 'react-native';
import { getAuth, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getStorage } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';

// Reuse the web app's Firebase project configuration
const firebaseConfig = {
  apiKey: 'AIzaSyDAEn62b1VgMOytUmzkYrGHlDanvRAQhv8',
  authDomain: 'gymbro-21.firebaseapp.com',
  projectId: 'gymbro-21',
  storageBucket: 'gymbro-21.appspot.com',
  messagingSenderId: '489929062828',
  appId: '1:489929062828:web:7d63908e6df1b6835ca209',
  measurementId: 'G-W4ZSGK78ZD',
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