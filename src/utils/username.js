import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const sanitize = (value = '') => {
  const trimmed = String(value).trim().toLowerCase();
  return trimmed.replace(/[^a-z0-9_]/g, '').slice(0, 20);
};

const reserveHandle = async (handle, uid) => {
  const ref = doc(db, 'usernames', handle);
  try {
    const success = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) return false;
      tx.set(ref, { uid, createdAt: Date.now() });
      return true;
    });
    return success;
  } catch (_) {
    return false;
  }
};

const generateRandomHandle = () => `bro${Math.floor(1000 + Math.random() * 9000)}`;

export const assignUsername = async (uid, desired, email = null) => {
  if (!uid) return { username: '', wasRandom: false };
  let cleaned = sanitize(desired);
  let finalHandle = '';
  let wasRandom = false;

  if (cleaned) {
    const ok = await reserveHandle(cleaned, uid);
    if (ok) finalHandle = cleaned;
  }

  if (!finalHandle) {
    wasRandom = true;
    for (let attempt = 0; attempt < 8 && !finalHandle; attempt++) {
      const candidate = sanitize(generateRandomHandle());
      if (!candidate) continue;
      const ok = await reserveHandle(candidate, uid);
      if (ok) finalHandle = candidate;
    }
  }

  if (!finalHandle) {
    const fallback = sanitize(uid);
    if (fallback) {
      const ok = await reserveHandle(fallback, uid);
      if (ok) finalHandle = fallback;
    }
  }

  if (!finalHandle) finalHandle = `bro${Date.now()}`;

  const userData = {
    username: finalHandle,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Store email if provided
  if (email) {
    userData.email = email;
  }

  await setDoc(doc(db, 'users', uid), userData, { merge: true });

  return { username: finalHandle, wasRandom };
};

export const checkUsernameAvailable = async (value) => {
  const candidate = sanitize(value);
  if (!candidate) return false;
  try {
    const snap = await getDoc(doc(db, 'usernames', candidate));
    return !snap.exists();
  } catch (_) {
    return false;
  }
};

export const updateUsername = async (uid, desired) => {
  if (!uid) throw new Error('Missing user');
  const next = sanitize(desired);
  if (!next) throw new Error('Username must use letters, numbers, or underscores');

  const result = await runTransaction(db, async (tx) => {
    const userRef = doc(db, 'users', uid);
    const userSnap = await tx.get(userRef);
    const currentRaw = userSnap.exists() ? sanitize(userSnap.data()?.username) : '';

    const ensureReservation = async (handle) => {
      if (!handle) return;
      const ref = doc(db, 'usernames', handle);
      const snap = await tx.get(ref);
      if (snap.exists()) {
        if (snap.data()?.uid !== uid) {
          throw new Error('Username already taken');
        }
      } else {
        tx.set(ref, { uid, createdAt: Date.now() });
      }
    };

    const releaseHandle = async (handle) => {
      if (!handle) return;
      const ref = doc(db, 'usernames', handle);
      const snap = await tx.get(ref);
      if (snap.exists() && snap.data()?.uid === uid) {
        tx.delete(ref);
      }
    };

    if (currentRaw === next) {
      await ensureReservation(next);
      tx.set(userRef, { username: next, updatedAt: Date.now() }, { merge: true });
      return { username: next, changed: false };
    }

    const desiredRef = doc(db, 'usernames', next);
    const desiredSnap = await tx.get(desiredRef);
    if (desiredSnap.exists() && desiredSnap.data()?.uid !== uid) {
      throw new Error('Username already taken');
    }

    await releaseHandle(currentRaw);
    tx.set(desiredRef, { uid, createdAt: Date.now() });
    tx.set(userRef, { username: next, updatedAt: Date.now() }, { merge: true });
    return { username: next, changed: true };
  });

  return result;
};

export const getEmailFromUsername = async (username) => {
  const clean = sanitize(username);
  if (!clean) return null;
  
  try {
    const snap = await getDoc(doc(db, 'usernames', clean));
    if (!snap.exists()) return null;
    
    const uid = snap.data()?.uid;
    if (!uid) return null;
    
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (!userSnap.exists()) return null;
    
    return userSnap.data()?.email || null;
  } catch (_) {
    return null;
  }
};

export { sanitize as cleanUsername };
