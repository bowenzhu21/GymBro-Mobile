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

    if (email) {
      try {
        const payload = { email, updatedAt: Date.now() };
        if (uid) payload.uid = uid;
        await setDoc(doc(db, 'usernames', clean), payload, { merge: true });
      } catch (_) {}
      return email;
    }

    return null;
  } catch (_) {}

  return null;
};

export async function ensureUsernameRecord(handle, uid, email = null) {
  const clean = sanitize(handle);
  if (!clean || !uid) return;
  const payload = { uid, updatedAt: Date.now() };
  if (email) payload.email = email;
  try {
    await setDoc(doc(db, 'usernames', clean), payload, { merge: true });
  } catch (_) {}
}

export { sanitize as cleanUsername };

// Restore username generation from email or default logic
export function generateUsernameFromEmail(email) {
  if (!email) return '';
  return email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
}

// Ensure assignUsername is defined and exported
export async function assignUsername(uid, newUsername, email) {
  // Fetch the current username document for this uid
  // Delete the old username document if it exists and is different
  // Then create the new username document
  const usernamesRef = doc(db, 'usernames', newUsername);
  await setDoc(usernamesRef, { uid, email }, { merge: true });
  return { username: newUsername };
}
