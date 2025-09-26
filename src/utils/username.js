// gb-mobile/src/utils/username.js
import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

/** Normalize/limit a username (lowercase, a-z0-9_, max 20 chars). */
const sanitize = (value = '') => {
  const trimmed = String(value).trim().toLowerCase();
  return trimmed.replace(/[^a-z0-9_]/g, '').slice(0, 20);
};

/**
 * INTERNAL: Claims a handle in /usernames/{handle} for uid, optionally setting email.
 * This is used only via updateUsername (transaction).
 */
const claimHandleTx = async (tx, handle, uid, email = null) => {
  if (!handle) return;
  const ref = doc(db, 'usernames', handle);
  const snap = await tx.get(ref);
  if (snap.exists()) {
    // If taken by someone else, block.
    if (snap.data()?.uid !== uid) {
      throw new Error('Username already taken');
    }
    // If it's ours, refresh email if needed.
    if (email && snap.data()?.email !== email) {
      tx.set(ref, { email, updatedAt: serverTimestamp() }, { merge: true });
    }
  } else {
    const data = { uid, createdAt: serverTimestamp() };
    if (email) data.email = email;
    tx.set(ref, data, { merge: false });
  }
};

/** INTERNAL: Releases a handle if current uid owns it. */
const releaseHandleTx = async (tx, handle, uid) => {
  if (!handle) return;
  const ref = doc(db, 'usernames', handle);
  const snap = await tx.get(ref);
  if (snap.exists() && snap.data()?.uid === uid) {
    tx.delete(ref);
  }
};

/**
 * PUBLIC: Quick availability check (non-transactional).
 */
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

/**
 * PUBLIC: Atomically switch the current user's username to `desired`.
 * - Claims /usernames/{desired} for uid (error if owned by someone else)
 * - Updates /users/{uid}.username
 * - Releases the previous handle if the same uid owned it
 *
 * Returns: { username: <new>, changed: boolean }
 */
export const updateUsername = async (uid, desired, email = null) => {
  if (!uid) throw new Error('Missing user');
  const next = sanitize(desired);
  if (!next) throw new Error('Username must use letters, numbers, or underscores');

  const result = await runTransaction(db, async (tx) => {
    const userRef = doc(db, 'users', uid);
    const userSnap = await tx.get(userRef);
    const currentRaw = userSnap.exists() ? sanitize(userSnap.data()?.username) : '';

    // If no change, ensure reservation is consistent and touch user doc.
    if (currentRaw === next) {
      await claimHandleTx(tx, next, uid, email);
      tx.set(userRef, { username: next, updatedAt: serverTimestamp() }, { merge: true });
      return { username: next, changed: false };
    }

    // Claim desired first (will throw if owned by someone else)
    await claimHandleTx(tx, next, uid, email);

    // Release previous (only if we owned it)
    await releaseHandleTx(tx, currentRaw, uid);

    // Update user doc
    tx.set(
      userRef,
      { username: next, updatedAt: serverTimestamp() },
      { merge: true }
    );

    return { username: next, changed: true };
  });

  return result;
};

/**
 * PUBLIC: Ensure a /usernames/{handle} record exists (non-transactional).
 * (Useful for backfill/repair; not used for switching usernames.)
 */
export async function ensureUsernameRecord(handle, uid, email = null) {
  const clean = sanitize(handle);
  if (!clean || !uid) return;
  const payload = { uid, updatedAt: serverTimestamp() };
  if (email) payload.email = email;
  try {
    await setDoc(doc(db, 'usernames', clean), payload, { merge: true });
  } catch (_) {}
}

/**
 * PUBLIC: Reserve a handle for this uid.
 * Historically returned boolean; keep that behavior, but now use the same
 * atomic path as updateUsername (so it actually updates the user doc and
 * releases previous).
 *
 * Returns true on success, false on any failure.
 */
const reserveHandle = async (handle, uid, email = null) => {
  const clean = sanitize(handle);
  if (!clean || !uid) return false;
  try {
    await updateUsername(uid, clean, email);
    return true;
  } catch (_) {
    return false;
  }
};

export { sanitize as cleanUsername };

/** Helper: generate a username candidate from email. */
export function generateUsernameFromEmail(email) {
  if (!email) return '';
  return email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().slice(0, 20);
}

/**
 * PUBLIC: Assign a username during setup (or later) and replace any current one.
 * Previously this only wrote /usernames/{new} blindly; now it delegates to
 * updateUsername so the old handle is released and the user doc is updated.
 *
 * Returns { username }
 */
export async function assignUsername(uid, newUsername, email) {
  const { username } = await updateUsername(uid, newUsername, email);
  return { username };
}

/**
 * PUBLIC: Read an email for a username, backfilling /usernames/{handle}.email if found.
 * (Preserved from your original with small serverTimestamp improvements.)
 */
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
        const payload = { email, updatedAt: serverTimestamp() };
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

// Also export the legacy name for compatibility (if other modules import it)
export { reserveHandle };