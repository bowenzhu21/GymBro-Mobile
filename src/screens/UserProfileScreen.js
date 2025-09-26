// gb-mobile/src/screens/UserProfileScreen.js
import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ImageBackground, Linking, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, setDoc, Timestamp, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/authContext';
import { acceptMatchRequest } from '../utils/matches';

const hero = require('../../assets/pic1.jpg');

// helpers
const computeAge = (birthday) => {
  if (!birthday) return null;
  const date = new Date(birthday);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age -= 1;
  return age >= 0 ? age : null;
};

const matchIdFor = (a, b) => [a, b].sort().join('_');
const requestIdFor = (fromUid, toUid) => `${fromUid}_${toUid}`;

export default function UserProfileScreen({ route }) {
  const navigation = useNavigation();
  const { currentUser } = useAuth();

  // Keep original param usage intact; prefer `route.params.user`
  const user = route?.params?.user ?? route?.params?.profile ?? {};

  // --- Match / Request state (self-contained, no new hooks files) ---
  const myUid = currentUser?.uid ?? null;
  const otherUid = user?.id ?? user?.uid ?? null;
  const isSelf = !!myUid && !!otherUid && myUid === otherUid;

  const [isMatched, setIsMatched] = useState(false);
  const [isPending, setIsPending] = useState(false); // pending in either direction
  const [incomingRequest, setIncomingRequest] = useState(false);

  // subscribe to match doc
  useEffect(() => {
    if (!myUid || !otherUid || isSelf) {
      setIsMatched(false);
      return () => {};
    }
    const ref = doc(db, 'matches', matchIdFor(myUid, otherUid));
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const ok = snap.exists() && (snap.data()?.status || 'active') === 'active';
        setIsMatched(ok);
      },
      () => setIsMatched(false)
    );
    return () => unsub();
  }, [myUid, otherUid, isSelf]);

  // subscribe to outgoing request (my pending request to them)
  useEffect(() => {
    if (!myUid || !otherUid || isSelf) {
      setIsPending(false);
      setIncomingRequest(false);
      return () => {};
    }
    const outRef = doc(db, 'matchRequests', requestIdFor(myUid, otherUid));
    const inRef  = doc(db, 'matchRequests', requestIdFor(otherUid, myUid));

    let outPending = false;
    let inPending  = false;

    const apply = () => {
      setIsPending(outPending);
      setIncomingRequest(inPending);
    };

    const unsubOut = onSnapshot(
      outRef,
      (snap) => {
        outPending = snap.exists() && snap.data()?.status === 'pending';
        // If declined, revert to match
        if (snap.exists() && snap.data()?.status === 'declined') {
          outPending = false;
        }
        apply();
      },
      () => {
        outPending = false;
        apply();
      }
    );

    const unsubIn = onSnapshot(
      inRef,
      (snap) => {
        inPending = snap.exists() && snap.data()?.status === 'pending';
        apply();
      },
      () => {
        inPending = false;
        apply();
      }
    );

    return () => {
      unsubOut();
      unsubIn();
    };
  }, [myUid, otherUid, isSelf]);

  const handleSendMatch = async () => {
    if (!myUid || !otherUid || isSelf || isMatched || isPending) return;
    try {
      const now = Timestamp.now();
      const matchRequest = {
        fromUid: myUid,
        toUid: otherUid,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'matchRequests', requestIdFor(myUid, otherUid)), matchRequest);
      setIsPending(true);
    } catch (error) {
      console.log('MatchRequest error:', error);
      Alert.alert('Error', error?.message || 'Could not send match request.');
    }
  };

  const handleAcceptMatch = async () => {
    if (!myUid || !otherUid) return;
    try {
      await acceptMatchRequest(otherUid, myUid);
      setIncomingRequest(false);
      // Optionally, create a match doc here
    } catch (error) {
      console.log('AcceptMatch error:', error);
      Alert.alert('Error', error?.message || 'Could not accept match request.');
    }
  };

  const openIG = () => {
    if (!user?.instagram) return;
    const ig = String(user.instagram).replace('@', '');
    Linking.openURL(`https://instagram.com/${ig}`);
  };

  if (!user || (!user.id && !user.uid)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 18 }}>User profile not found.</Text>
      </View>
    );
  }

  // Photo & display bits
  const photo = user?.photoUrl ? { uri: user.photoUrl } : require('../images/user.jpg');
  const handle = user?.username
    ? String(user.username).replace(/^@/, '')
    : (user?.instagram ? String(user.instagram).replace('@', '') : (user?.name ? String(user.name).toLowerCase().replace(/\s+/g, '') : ''));
  const displayHandle = handle ? `@${handle}` : '';

  const age = useMemo(() => computeAge(user?.birthday), [user?.birthday]);
  const matchCount = useMemo(() => {
    if (typeof user?.matchesCount === 'number') return user.matchesCount;
    if (Array.isArray(user?.matches)) return user.matches.length;
    return '—';
  }, [user?.matchesCount, user?.matches]);

  const statEntries = useMemo(() => ([
    { label: 'Height', value: user?.height ? `${user.height} cm` : '—' },
    { label: 'Weight', value: user?.weight ? `${user.weight} lbs` : '—' },
    { label: 'Bench', value: user?.benchPress ? `${user.benchPress} lbs` : '—' },
    { label: 'Squat', value: user?.squat ? `${user.squat} lbs` : '—' },
    { label: 'Gym', value: user?.gym || '—' },
    { label: 'City', value: user?.city || '—' },
    { label: 'Goal', value: user?.goal || '—' },
    { label: 'Experience', value: user?.experience || '—' },
    { label: 'Preferred Time', value: user?.preferredTime || '—' },
    { label: 'Prefers Matching With', value: user?.preferredMatchGender || 'Any' },
  ]), [user]);

  // Button mode & behavior
  let buttonMode = 'idle';
  if (isMatched) buttonMode = 'matched';
  else if (incomingRequest) buttonMode = 'accept';
  else if (isPending) buttonMode = 'pending';
  const buttonText = buttonMode === 'matched' ? 'Message' : buttonMode === 'accept' ? 'Accept' : buttonMode === 'pending' ? 'Requested' : 'Match';
  const buttonAction = buttonMode === 'matched'
    ? () => navigation.navigate('ChatRoom', { userId: otherUid, user })
    : buttonMode === 'accept'
    ? handleAcceptMatch
    : handleSendMatch;
  const buttonDisabled = isSelf || buttonMode === 'pending';
  const buttonStyle = [
    styles.button,
    buttonMode === 'matched' && styles.buttonMatched,
    buttonMode === 'pending' && styles.buttonPending,
    buttonMode === 'accept' && styles.buttonAccept
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ImageBackground source={hero} resizeMode="cover" style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}>
            <ScrollView contentContainerStyle={styles.container}>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <Image source={photo} style={styles.avatar} />
                <Text style={styles.name}>{user?.name}</Text>
                <Text style={styles.meta}>{user?.gender || '—'}</Text>
                <Text style={styles.meta}>{user?.gym || 'Unknown Gym'} • {user?.city || 'Unknown City'}</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Matches</Text>
                    <Text style={styles.summaryValue}>{matchCount}</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Age</Text>
                    <Text style={styles.summaryValue}>{age !== null ? age : '—'}</Text>
                  </View>
                </View>
                {!!displayHandle && <Text style={styles.handle}>{displayHandle}</Text>}
                {!!user?.bio && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.bioTitle}>Bio</Text>
                    <Text style={styles.bioText}>{user.bio}</Text>
                  </View>
                )}
              </View>
              <View style={styles.actionRow}>
                {!isSelf && (
                  <Pressable
                    style={[...buttonStyle, { flex: 1 }]}
                    onPress={buttonAction}
                    disabled={buttonDisabled}
                  >
                    <Text style={styles.buttonText}>{buttonText}</Text>
                  </Pressable>
                )}
                {!!user?.instagram && (
                  <Pressable style={[styles.button, styles.secondaryButton, { flex: 1 }]} onPress={openIG}>
                    <Text style={styles.buttonText}>View Instagram</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Stats</Text>
                <View style={styles.rowWrap}>
                  {statEntries.map(({ label, value }) => (
                    <Text key={label} style={styles.item}>
                      {label}: <Text style={styles.strong}>{value}</Text>
                    </Text>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#e5e7eb' },
  name: { marginTop: 8, fontSize: 22, fontWeight: '800', color: '#fff' },
  meta: { color: '#d8dbe3' },
  handle: { color: '#d8dbe3', marginTop: 4, textAlign: 'center' },
  card: {
    backgroundColor: 'rgba(27,27,30,0.9)',
    borderRadius: 12,
    padding: 12,
    // Add solid background for shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: '#fff' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  item: { width: '48%', color: '#d8dbe3', marginBottom: 4 },
  strong: { color: '#fff', fontWeight: '700' },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 16 },
  button: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonMatched: { backgroundColor: '#10b981', borderColor: '#10b981' }, // green when matched
  buttonPending: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }, // subtle when requested
  buttonAccept: { backgroundColor: '#047857', borderColor: '#047857' }, // darker green when accepting
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },

  bioTitle: { color: '#fff', fontWeight: '700', marginBottom: 4 },
  bioText: { color: '#d8dbe3', textAlign: 'center', lineHeight: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginTop: 12, marginBottom: 12 },
  summaryCard: { alignItems: 'center', minWidth: 120 },
  summaryLabel: { color: '#d8dbe3', fontSize: 14 },
  summaryValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
});