// gb-mobile/src/screens/UserProfileScreen.js
import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ImageBackground, Linking, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, setDoc, Timestamp, updateDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { useAuth } from '../contexts/authContext';
import { acceptMatchRequest } from '../utils/matches';

const hero = require('../../assets/pic1.jpg');

/** Robust date parser for Firestore/strings/numbers/Date */
const toDate = (input) => {
  if (!input) return null;
  try {
    if (typeof input?.toDate === 'function') return input.toDate();
    if (typeof input === 'object' && typeof input.seconds === 'number') {
      return new Date(input.seconds * 1000);
    }
    if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
    if (typeof input === 'number') {
      const d = new Date(input);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof input === 'string') {
      const trimmed = input.trim();
      const d = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
        ? new Date(`${trimmed}T00:00:00Z`)
        : new Date(trimmed);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  } catch (_) {}
  return null;
};

const computeAge = (birthday) => {
  const date = toDate(birthday);
  if (!date) return null;
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

  const routeUser = route?.params?.user ?? route?.params?.profile ?? {};
  const myUid = currentUser?.uid ?? null;
  const otherUid = routeUser?.id ?? routeUser?.uid ?? null;
  const isSelf = !!myUid && !!otherUid && myUid === otherUid;

  const [isMatched, setIsMatched] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState(false);
  const [otherMatchCount, setOtherMatchCount] = useState(null);
  const [otherUserDoc, setOtherUserDoc] = useState(null);

  useEffect(() => {
    if (!otherUid) { setOtherUserDoc(null); return () => {}; }
    const ref = doc(db, 'users', otherUid);
    const unsub = onSnapshot(ref, (snap) => setOtherUserDoc(snap.exists() ? { id: otherUid, ...snap.data() } : null), () => setOtherUserDoc(null));
    return () => unsub();
  }, [otherUid]);

  useEffect(() => {
    if (!myUid || !otherUid || isSelf) { setIsMatched(false); return () => {}; }
    const ref = doc(db, 'matches', matchIdFor(myUid, otherUid));
    const unsub = onSnapshot(ref, (snap) => {
      const ok = snap.exists() && (snap.data()?.status || 'active') === 'active';
      setIsMatched(ok);
    }, () => setIsMatched(false));
    return () => unsub();
  }, [myUid, otherUid, isSelf]);

  useEffect(() => {
    if (!myUid || !otherUid || isSelf) { setIsPending(false); setIncomingRequest(false); return () => {}; }
    const outRef = doc(db, 'matchRequests', requestIdFor(myUid, otherUid));
    const inRef  = doc(db, 'matchRequests', requestIdFor(otherUid, myUid));
    let outPending = false; let inPending = false;
    const apply = () => { setIsPending(outPending); setIncomingRequest(inPending); };
    const unsubOut = onSnapshot(outRef, (snap) => {
      outPending = snap.exists() && snap.data()?.status === 'pending';
      if (snap.exists() && snap.data()?.status === 'declined') outPending = false;
      apply();
    }, () => { outPending = false; apply(); });
    const unsubIn = onSnapshot(inRef, (snap) => { inPending = snap.exists() && snap.data()?.status === 'pending'; apply(); }, () => { inPending = false; apply(); });
    return () => { unsubOut(); unsubIn(); };
  }, [myUid, otherUid, isSelf]);

  useEffect(() => {
    if (!otherUid) { setOtherMatchCount(null); return () => {}; }
    const q = query(collection(db, 'matches'), where('participants', 'array-contains', otherUid), where('status', '==', 'active'));
    const unsub = onSnapshot(q, (snap) => setOtherMatchCount(snap.size), () => setOtherMatchCount(null));
    return () => unsub();
  }, [otherUid]);

  const handleSendMatch = async () => {
    if (!myUid || !otherUid || isSelf || isMatched || isPending) return;
    try {
      const now = Timestamp.now();
      await setDoc(doc(db, 'matchRequests', requestIdFor(myUid, otherUid)), {
        fromUid: myUid, toUid: otherUid, status: 'pending', createdAt: now, updatedAt: now,
      });
      setIsPending(true);
    } catch (error) {
      console.log('MatchRequest error:', error);
      Alert.alert('Error', error?.message || 'Could not send match request.');
    }
  };

  const handleAcceptMatch = async () => {
    if (!myUid || !otherUid) return;
    try { await acceptMatchRequest(otherUid, myUid); setIncomingRequest(false); }
    catch (error) { console.log('AcceptMatch error:', error); Alert.alert('Error', error?.message || 'Could not accept match request.'); }
  };

  const handleCancelRequest = async () => {
    if (!myUid || !otherUid || isSelf || !isPending) return;
    try {
      const ref = doc(db, 'matchRequests', requestIdFor(myUid, otherUid));
      await updateDoc(ref, { status: 'cancelled', updatedAt: Timestamp.now() });
      setIsPending(false);
    } catch (error) {
      console.log('CancelMatchRequest error:', error);
      Alert.alert('Error', error?.message || 'Could not cancel match request.');
    }
  };

  const openIG = () => {
    const igField = (routeUser?.instagram ?? otherUserDoc?.instagram);
    if (!igField) return;
    const ig = String(igField).replace('@', '');
    Linking.openURL(`https://instagram.com/${ig}`);
  };

  const displayUser = useMemo(() => ({ ...(routeUser || {}), ...(otherUserDoc || {}) }), [routeUser, otherUserDoc]);

  if (!displayUser || (!displayUser.id && !displayUser.uid)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 18 }}>User profile not found.</Text>
      </View>
    );
  }

  const photo = displayUser?.photoUrl ? { uri: displayUser.photoUrl } : require('../images/user.jpg');
  const age = useMemo(() => computeAge(displayUser?.birthday), [displayUser?.birthday]);

  const matchCountFromUser = useMemo(() => {
    if (typeof displayUser?.matchesCount === 'number') return displayUser.matchesCount;
    if (Array.isArray(displayUser?.matches)) return displayUser.matches.length;
    return '—';
  }, [displayUser?.matchesCount, displayUser?.matches]);

  const effectiveMatchCount = matchCountFromUser === '—' ? (otherMatchCount ?? '—') : matchCountFromUser;

  const statEntries = useMemo(() => ([
    { label: 'Height', value: displayUser?.height ? `${displayUser.height} cm` : '—' },
    { label: 'Weight', value: displayUser?.weight ? `${displayUser.weight} lbs` : '—' },
    { label: 'Bench', value: displayUser?.benchPress ? `${displayUser.benchPress} lbs` : '—' },
    { label: 'Squat', value: displayUser?.squat ? `${displayUser.squat} lbs` : '—' },
    { label: 'Gym', value: displayUser?.gym || '—' },
    { label: 'City', value: displayUser?.city || '—' },
    { label: 'Goal', value: displayUser?.goal || '—' },
    { label: 'Experience', value: displayUser?.experience || '—' },
    {
      label: 'Preferred Time(s)',
      value: Array.isArray(displayUser?.preferredTimes)
        ? (displayUser.preferredTimes.length ? displayUser.preferredTimes.join(', ') : '—')
        : (displayUser?.preferredTime || '—'),
    },
    { label: 'Prefers Matching With', value: displayUser?.preferredMatchGender || 'Any' },
  ]), [displayUser]);

  let buttonMode = 'idle';
  if (isMatched) buttonMode = 'matched';
  else if (incomingRequest) buttonMode = 'accept';
  else if (isPending) buttonMode = 'pending';

  const buttonText =
    buttonMode === 'matched' ? 'Message' :
    buttonMode === 'accept'  ? 'Accept'   :
    buttonMode === 'pending' ? 'Requested' :
    'Match';

  const buttonAction =
    buttonMode === 'matched' ? () => navigation.navigate('ChatRoom', { userId: otherUid, user: displayUser }) :
    buttonMode === 'accept'  ? handleAcceptMatch :
    buttonMode === 'pending' ? handleCancelRequest :
    handleSendMatch;

  const buttonDisabled = isSelf;

  const buttonStyle = [
    styles.button,
    buttonMode === 'matched' && styles.buttonMatched,
    buttonMode === 'pending' && styles.buttonPending,
    buttonMode === 'accept'  && styles.buttonAccept,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ImageBackground source={hero} resizeMode="cover" style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}>
            <ScrollView contentContainerStyle={styles.container}>
              <View style={{ alignItems: 'center', marginBottom: 16 }}>
                <Image source={photo} style={styles.avatar} />
                <Text style={styles.name}>{displayUser?.name}</Text>
                <Text style={styles.meta}>{displayUser?.gender || '—'}</Text>
                <Text style={styles.meta}>{displayUser?.gym || 'Unknown Gym'} • {displayUser?.city || 'Unknown City'}</Text>

                {/* Summary: Matches + Age */}
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Matches</Text>
                    <Text style={styles.summaryValue}>{effectiveMatchCount}</Text>
                  </View>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Age</Text>
                    <Text style={styles.summaryValue}>{age !== null ? age : '—'}</Text>
                  </View>
                </View>

                {!!displayUser?.bio && (
                  <View style={{ marginTop: 12, alignSelf: 'stretch' }}>
                    <Text style={styles.bioTitle}>Bio</Text>
                    <Text style={styles.bioText}>{displayUser.bio}</Text>
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
                {!!displayUser?.instagram && (
                  <Pressable style={[styles.button, styles.secondaryButton, { flex: 1 }]} onPress={openIG}>
                    <Text style={styles.buttonText}>View Instagram</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.cardShadowWrap}>
                <View style={styles.cardInner}>
                  <Text style={styles.cardTitle}>Stats</Text>
                  <View style={styles.rowWrap}>
                    {statEntries.map(({ label, value }) => (
                      <Text key={label} style={styles.item}>
                        {label}: <Text style={styles.strong}>{value}</Text>
                      </Text>
                    ))}
                  </View>
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

  cardShadowWrap: {
    backgroundColor: '#1b1b1e',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  cardInner: {
    backgroundColor: 'rgba(27,27,30,0.9)',
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: '#fff' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  item: { width: '48%', color: '#d8dbe3', marginBottom: 4 },
  strong: { color: '#fff', fontWeight: '700' },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 16 },
  button: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonMatched: { backgroundColor: '#10b981', borderColor: '#10b981' },
  buttonPending: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  buttonAccept: { backgroundColor: '#047857', borderColor: '#047857' },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },

  bioTitle: { color: '#fff', fontWeight: '700', marginBottom: 4, textAlign: 'left' },
  bioText: { color: '#d8dbe3', lineHeight: 20, textAlign: 'left' }, // <-- left-aligned now

  summaryRow: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginTop: 12, marginBottom: 12 },
  summaryCard: { alignItems: 'center', minWidth: 120 },
  summaryLabel: { color: '#d8dbe3', fontSize: 14 },
  summaryValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
});