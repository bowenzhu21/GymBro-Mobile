// gb-mobile/src/hooks/usePendingRequest.js
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const requestIdFor = (fromUid, toUid) => `${fromUid}_${toUid}`;

export default function usePendingRequest(fromUid, toUid) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!fromUid || !toUid || fromUid === toUid) {
      setPending(false);
      return () => {};
    }
    const ref = doc(db, 'matchRequests', requestIdFor(fromUid, toUid));
    const unsub = onSnapshot(
      ref,
      (snap) => setPending(snap.exists() && snap.data()?.status === 'pending'),
      () => setPending(false)
    );
    return () => unsub();
  }, [fromUid, toUid]);

  return pending;
}