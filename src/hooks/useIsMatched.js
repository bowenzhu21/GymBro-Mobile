// gb-mobile/src/hooks/useIsMatched.js
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase';

// Deterministic match id — must match utils/matches.js logic
const matchIdFor = (a, b) => [a, b].sort().join('_');

export default function useIsMatched(myUid, otherUid) {
  const [isMatched, setMatched] = useState(false);

  useEffect(() => {
    if (!myUid || !otherUid || myUid === otherUid) {
      setMatched(false);
      return () => {};
    }
    const ref = doc(db, 'matches', matchIdFor(myUid, otherUid));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const ok = snap.exists() && (snap.data()?.status || 'active') === 'active';
        setMatched(ok);
      },
      () => setMatched(false)
    );
    return () => unsub();
  }, [myUid, otherUid]);

  return isMatched;
}