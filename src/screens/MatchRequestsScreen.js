// gb-mobile/src/screens/MatchRequestsScreen.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ImageBackground, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/authContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { acceptMatchRequest, declineMatchRequest } from '../utils/matches';
import { useUsersDirectory } from '../hooks/useUsersDirectory';

const bg = require('../../assets/pic1.jpg');

export default function MatchRequestsScreen() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState([]);
  const { userMap, loading } = useUsersDirectory();
  const inFlight = useRef(new Set()); // track items being processed

  // Subscribe only to *pending* incoming requests
  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(
      collection(db, 'matchRequests'),
      where('toUid', '==', currentUser.uid),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setRequests(items);
      },
      (err) => {
        console.warn('Failed to watch matchRequests', err);
      }
    );
    return () => unsub();
  }, [currentUser?.uid]);

  const removeFromList = useCallback((id) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const withGuard = useCallback(async (id, fn, onErrorRestore) => {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    try {
      await fn();
    } catch (e) {
      onErrorRestore?.();
      throw e;
    } finally {
      inFlight.current.delete(id);
    }
  }, []);

  const handleAccept = useCallback(
    async (item) => {
      const { id, fromUid, toUid } = item;
      // Optimistic: remove immediately for snappy UX
      removeFromList(id);
      try {
        await withGuard(
          id,
          () => acceptMatchRequest(fromUid, toUid),
          () => setRequests((prev) => [...prev, item]) // restore on error
        );
      } catch (error) {
        Alert.alert('Match request', error?.message || 'Failed to accept request');
      }
    },
    [removeFromList, withGuard]
  );

  const handleDecline = useCallback(
    async (item) => {
      const { id, fromUid, toUid } = item;
      removeFromList(id);
      try {
        await withGuard(
          id,
          () => declineMatchRequest(fromUid, toUid),
          () => setRequests((prev) => [...prev, item])
        );
      } catch (error) {
        Alert.alert('Match request', error?.message || 'Failed to decline request');
      }
    },
    [removeFromList, withGuard]
  );

  // Guard until user directory is ready
  if (loading) {
    return (
      <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#fff' }}>Loading…</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  const data = (requests || [])
    .map((request) => {
      const user = userMap?.get?.(request.fromUid);
      if (!user) return null;
      return { ...request, user };
    })
    .filter(Boolean);

  const renderItem = ({ item }) => {
    const disabled = inFlight.current.has(item.id);
    return (
      <View style={styles.card}>
        {/* Left: name + meta */}
        <View style={styles.infoCol}>
          <Text style={styles.name}>{item.user.name || 'Gym Bro'}</Text>
          <Text style={styles.meta}>
            {item.user.gym || 'Unknown Gym'} • {item.user.city || 'Unknown City'}
          </Text>
        </View>

        {/* Right: actions */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.accept, disabled && styles.disabled]}
            onPress={() => handleAccept(item)}
            disabled={disabled}
          >
            <Text style={styles.btnTxt}>Accept</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.decline, disabled && styles.disabled]}
            onPress={() => handleDecline(item)}
            disabled={disabled}
          >
            <Text style={[styles.btnTxt, { color: '#111827' }]}>Decline</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={{ flex: 1, padding: 16, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 12 }}>
            Match Requests
          </Text>
          <FlatList
            data={data}
            keyExtractor={(x) => x.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListEmptyComponent={
              <Text style={{ color: '#fff', opacity: 0.8, textAlign: 'center', marginTop: 24 }}>
                No pending requests
              </Text>
            }
          />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(27,27,30,0.9)',
    borderRadius: 12,
    padding: 12,
    // Put content side-by-side
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,

    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },

  infoCol: { flex: 1, minWidth: 0 }, // minWidth:0 lets text wrap/truncate correctly
  name: { color: '#fff', fontWeight: '700', fontSize: 16 },
  meta: { color: '#d8dbe3' },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },

  btn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  accept: { backgroundColor: '#111827', borderColor: '#111827' },
  decline: { backgroundColor: '#fff' },

  btnTxt: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.6 },
});