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

let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  let persistenceFactory;
  try {
    const rnAuth = require('@firebase/auth');
    persistenceFactory = rnAuth?.getReactNativePersistence;
    if (!persistenceFactory) {
      const fallback = require('@firebase/auth/dist/rn/index.js');
      persistenceFactory = fallback?.getReactNativePersistence;
    }
  } catch (_) {
    // leave persistenceFactory undefined; Auth will fall back to memory persistence
  }

  const persistence = persistenceFactory ? persistenceFactory(AsyncStorage) : undefined;
  auth = globalThis.__gbFirebaseAuth ?? initializeAuth(app, persistence ? { persistence } : undefined);
  globalThis.__gbFirebaseAuth = auth;
}
const storage = getStorage(app);
const db = getFirestore(app);

export { app, auth, storage, db };
