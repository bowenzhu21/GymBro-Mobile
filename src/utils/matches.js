import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  orderBy,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

const matchesCollection = collection(db, 'matches');
const requestsCollection = collection(db, 'matchRequests');

const noop = () => {};

const matchIdFor = (uidA, uidB) => [uidA, uidB].sort().join('_');
const requestIdFor = (fromUid, toUid) => `${fromUid}_${toUid}`;

const matchRef = (uidA, uidB) => doc(matchesCollection, matchIdFor(uidA, uidB));
const requestRef = (fromUid, toUid) => doc(requestsCollection, requestIdFor(fromUid, toUid));

export async function sendMatchRequest(fromUid, toUid) {
  if (!fromUid || !toUid || fromUid === toUid) {
    throw new Error('Invalid match request');
  }

  return runTransaction(db, async (tx) => {
    const matchDocument = matchRef(fromUid, toUid);
    const existingMatch = await tx.get(matchDocument);
    if (existingMatch.exists()) {
      return { status: 'matched' };
    }

    const incomingRef = requestRef(toUid, fromUid);
    const incomingSnap = await tx.get(incomingRef);
    if (incomingSnap.exists() && incomingSnap.data()?.status === 'pending') {
      const stamp = serverTimestamp();
      const participants = [fromUid, toUid].sort();
      tx.set(incomingRef, { status: 'accepted', updatedAt: stamp }, { merge: true });
      tx.set(matchDocument, {
        participants,
        createdAt: stamp,
        updatedAt: stamp,
        status: 'active',
      }, { merge: false });
      return { status: 'matched' };
    }

    const outRef = requestRef(fromUid, toUid);
    const stamp = serverTimestamp();
    tx.set(outRef, {
      fromUid,
      toUid,
      status: 'pending',
      createdAt: stamp,
      updatedAt: stamp,
    }, { merge: false });
    return { status: 'requested' };
  });
}

export async function acceptMatchRequest(fromUid, toUid) {
  if (!fromUid || !toUid || fromUid === toUid) {
    throw new Error('Invalid match request');
  }

  await runTransaction(db, async (tx) => {
    const incoming = requestRef(fromUid, toUid);         // must exist 'pending'
    const matchDoc = matchRef(fromUid, toUid);           // may not exist yet
    const outgoing = requestRef(toUid, fromUid);         // may not exist

    // --- READS FIRST (only the incoming request) ---
    const incomingSnap = await tx.get(incoming);
    if (!incomingSnap.exists()) {
      throw new Error('Match request not found');
    }

    const stamp = serverTimestamp();

    // --- WRITES ---
    // 1) accept incoming (include fromUid/toUid so write rule passes)
    tx.set(incoming, { fromUid, toUid, status: 'accepted', updatedAt: stamp }, { merge: true });

    // 2) upsert match without reading it (no read -> no "get" rule needed)
    tx.set(
      matchDoc,
      {
        participants: [fromUid, toUid].sort(),
        status: 'active',
        // If createdAt already exists, this will overwrite it; acceptable tradeoff to avoid the read.
        createdAt: stamp,
        updatedAt: stamp,
      },
      { merge: true }
    );

    // 3) idempotently accept reciprocal request without reading it
    tx.set(
      outgoing,
      { fromUid: toUid, toUid: fromUid, status: 'accepted', updatedAt: stamp },
      { merge: true }
    );
  });
}

export async function declineMatchRequest(fromUid, toUid) {
  if (!fromUid || !toUid || fromUid === toUid) {
    throw new Error('Invalid match request');
  }
  await deleteDoc(requestRef(fromUid, toUid));
}

const subscribeWithPermissionGuard = (queryRef, handler, onError) => {
  let unsubscribe = noop;
  unsubscribe = onSnapshot(queryRef, handler, (error) => {
    if (onError) onError(error);
    if (error?.code === 'permission-denied') {
      unsubscribe?.();
    }
  });
  return unsubscribe;
};

export function subscribeToUserMatches(uid, handler, onError) {
  if (!uid) return noop;
  const q = query(
    matchesCollection,
    where('participants', 'array-contains', uid),
    orderBy('updatedAt', 'desc'),
  );
  return subscribeWithPermissionGuard(q, handler, onError);
}

export function subscribeToMatchMessages(matchId, handler, onError) {
  if (!matchId) return noop;
  const messagesRef = collection(db, 'matches', matchId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'));
  return subscribeWithPermissionGuard(q, handler, onError);
}

export function subscribeToIncomingRequests(uid, handler, onError) {
  if (!uid) return noop;
  const q = query(requestsCollection, where('toUid', '==', uid));
  return subscribeWithPermissionGuard(q, handler, onError);
}

export function subscribeToOutgoingRequests(uid, handler, onError) {
  if (!uid) return noop;
  const q = query(requestsCollection, where('fromUid', '==', uid));
  return subscribeWithPermissionGuard(q, handler, onError);
}

export async function deleteUserMatchData(uid) {
  if (!uid) return;
  const [incomingSnap, outgoingSnap, matchesSnap] = await Promise.all([
    getDocs(query(requestsCollection, where('toUid', '==', uid))),
    getDocs(query(requestsCollection, where('fromUid', '==', uid))),
    getDocs(query(matchesCollection, where('participants', 'array-contains', uid))),
  ]);

  const batch = writeBatch(db);
  incomingSnap.forEach((docSnap) => batch.delete(docSnap.ref));
  outgoingSnap.forEach((docSnap) => batch.delete(docSnap.ref));
  matchesSnap.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

export async function removeMatch({ matchId, uidA, uidB, requesterUid }) {
  if (!requesterUid) throw new Error('Missing requesting user');

  if (matchId) {
    const ref = doc(matchesCollection, matchId);
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return;
    const participants = Array.isArray(snapshot.data()?.participants) ? snapshot.data().participants : [];
    if (!participants.includes(requesterUid)) {
      throw new Error('Not authorized to remove this match');
    }
    await deleteDoc(ref);
    if (participants.length === 2) {
      const [first, second] = participants;
      const other = first === requesterUid ? second : first;
      if (other) {
        await Promise.all([
          deleteDoc(requestRef(requesterUid, other)).catch(() => {}),
          deleteDoc(requestRef(other, requesterUid)).catch(() => {}),
        ]);
      }
    }
    return;
  }

  if (!uidA || !uidB || uidA === uidB) return;
  const ref = matchRef(uidA, uidB);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return;
  const participants = Array.isArray(snapshot.data()?.participants) ? snapshot.data().participants : [];
  if (!participants.includes(requesterUid)) {
    throw new Error('Not authorized to remove this match');
  }
  await deleteDoc(ref);
  await Promise.all([
    deleteDoc(requestRef(uidA, uidB)).catch(() => {}),
    deleteDoc(requestRef(uidB, uidA)).catch(() => {}),
  ]);
}

export async function createMatch(fromUid, toUid) {
  if (!fromUid || !toUid || fromUid === toUid) {
    throw new Error('Invalid match participants');
  }
  const ref = matchRef(fromUid, toUid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    const stamp = serverTimestamp();
    await setDoc(ref, {
      participants: [fromUid, toUid].sort(),
      createdAt: stamp,
      updatedAt: stamp,
      status: 'active',
    });
  } else {
    await setDoc(ref, { updatedAt: serverTimestamp(), status: 'active' }, { merge: true });
  }
  return ref.id;
}

export async function sendMatchMessage(matchId, senderId, { text = '', attachments = [] } = {}) {
  if (!matchId || !senderId) {
    throw new Error('Invalid match message');
  }
  const trimmed = typeof text === 'string' ? text.trim() : '';
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  if (!trimmed && !hasAttachments) {
    throw new Error('Message must include text or attachments');
  }

  const payload = {
    senderId,
    createdAt: serverTimestamp(),
  };
  if (trimmed) payload.text = trimmed;
  if (hasAttachments) payload.attachments = attachments;

  await addDoc(collection(db, 'matches', matchId, 'messages'), payload);

  await setDoc(
    doc(matchesCollection, matchId),
    {
      updatedAt: serverTimestamp(),
      lastMessage: trimmed || null,
      lastSenderId: senderId,
    },
    { merge: true },
  );
}

export { matchIdFor, requestIdFor };
