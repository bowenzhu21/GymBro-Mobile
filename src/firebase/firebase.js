import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const db = getFirestore(app);

export { app, auth, storage, db };
