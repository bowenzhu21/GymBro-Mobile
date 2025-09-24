import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase';

export function useUsersDirectory() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setUsers(list);
        setLoading(false);
      },
      () => {
        setUsers([]);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const userMap = useMemo(() => {
    const map = new Map();
    for (const user of users) {
      if (!user?.id) continue;
      map.set(user.id, user);
    }
    return map;
  }, [users]);

  return { users, userMap, loading };
}
