import { collection, doc, getDoc, getDocs, limit, query, runTransaction, setDoc, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const sanitize = (value = '') => {
  const trimmed = String(value).trim().toLowerCase();
  return trimmed.replace(/[^a-z0-9_]/g, '').slice(0, 20);
};

const reserveHandle = async (handle, uid, email = null) => {
  const ref = doc(db, 'usernames', handle);
  try {
    const success = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) {
        const current = snap.data() || {};
        if (current.uid === uid) {
          if (email && current.email !== email) {
            tx.set(ref, { email, updatedAt: Date.now() }, { merge: true });
          }
          return true;
        }

        if (current.uid) {
          const existingUserRef = doc(db, 'users', current.uid);
          const existingUserSnap = await tx.get(existingUserRef);
          if (!existingUserSnap.exists()) {
            const data = { uid, createdAt: Date.now() };
            if (email) data.email = email;
            tx.set(ref, data, { merge: false });
            return true;
          }
        }

        return false;
      }

      const data = { uid, createdAt: Date.now() };
      if (email) data.email = email;
      tx.set(ref, data);
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
    const ok = await reserveHandle(cleaned, uid, email);
    if (ok) finalHandle = cleaned;
  }

  if (!finalHandle) {
    wasRandom = true;
    for (let attempt = 0; attempt < 8 && !finalHandle; attempt++) {
      const candidate = sanitize(generateRandomHandle());
      if (!candidate) continue;
      const ok = await reserveHandle(candidate, uid, email);
      if (ok) finalHandle = candidate;
    }
  }

  if (!finalHandle) {
    const fallback = sanitize(uid);
    if (fallback) {
      const ok = await reserveHandle(fallback, uid, email);
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

export const updateUsername = async (uid, desired, email = null) => {
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
        if (email && snap.data()?.email !== email) {
          tx.set(ref, { email, updatedAt: Date.now() }, { merge: true });
        }
      } else {
        const data = { uid, createdAt: Date.now() };
        if (email) data.email = email;
        tx.set(ref, data);
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
    const usernameData = { uid, createdAt: Date.now() };
    if (email) usernameData.email = email;
    tx.set(desiredRef, usernameData);
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

    const data = snap.data() || {};
    const uid = data.uid;
    const storedEmail = data.email;
    if (storedEmail) return storedEmail;

    let email = null;
    if (uid) {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        const userData = userSnap.data() || {};
        email = userData.email || userData.contactEmail || null;
      }
    }

    if (!email) {
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '==', clean),
        limit(1),
      );
      const querySnap = await getDocs(usersQuery);
      if (!querySnap.empty) {
        const userData = querySnap.docs[0].data() || {};
        email = userData.email || userData.contactEmail || null;
        if (!uid) {
          uid = querySnap.docs[0].id;
        }
      }
    }

    if (email) {
      try {
        const payload = { email, updatedAt: Date.now() };
        if (uid) payload.uid = uid;
        await setDoc(doc(db, 'usernames', clean), payload, { merge: true });
      } catch (_) {}
      return email;
    }

    return null;
  } catch (_) {
    return null;
  }
};

export { sanitize as cleanUsername };
