import React, { useMemo } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ImageBackground, Linking, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/authContext';

const hero = require('../../assets/pic1.jpg');

const computeAge = (birthday) => {
  if (!birthday) return null;
  const date = new Date(birthday);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
};

export default function UserProfileScreen({ route }) {
  const { currentUser } = useAuth();
  const profile = route?.params?.profile;

  const navigation = useNavigation();
  const { user } = route.params;
  
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

  const statEntries = useMemo(() => (
    [
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
    ]
  ), [user]);

  const openIG = () => {
    if (!user?.instagram) return;
    const handle = String(user.instagram).replace('@', '');
    Linking.openURL(`https://instagram.com/${handle}`);
  };

  const isMatched = false; // Replace with actual matched status
  const handleMatch = async () => {
    console.log('handleMatch called');
    if (!currentUser?.uid || !profile?.uid) return;
    try {
      const now = Timestamp.now();
      const matchRequest = {
        fromUid: currentUser.uid,
        toUid: profile.uid,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      console.log('MatchRequest payload:', matchRequest);
      await setDoc(doc(db, 'matchRequests', `${currentUser.uid}_${profile.uid}`), matchRequest);
      Alert.alert('Match request sent!');
    } catch (error) {
      console.log('MatchRequest error:', error);
      Alert.alert('Error', error?.message || 'Could not send match request.');
    }
  };

  return (
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
              <Pressable style={[styles.button, { flex: 1 }]} onPress={() => navigation.navigate('ChatRoom', { userId: user.id, user })}>
                <Text style={styles.buttonText}>Message</Text>
              </Pressable>
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
                  <Text key={label} style={styles.item}>{label}: <Text style={styles.strong}>{value}</Text></Text>
                ))}
              </View>
            </View>
            {/* Add match button for users not already matched */}
            {!isMatched && (
              <Pressable style={styles.matchButton} onPress={handleMatch}>
                <Text style={styles.matchButtonText}>Match</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#e5e7eb' },
  name: { marginTop: 8, fontSize: 22, fontWeight: '800', color: '#fff' },
  meta: { color: '#d8dbe3' },
  handle: { color: '#d8dbe3', marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 12, padding: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: '#fff' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  item: { width: '48%', color: '#d8dbe3', marginBottom: 4 },
  strong: { color: '#fff', fontWeight: '700' },
  button: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  bioTitle: { color: '#fff', fontWeight: '700', marginBottom: 4 },
  bioText: { color: '#d8dbe3', textAlign: 'center', lineHeight: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginTop: 12, marginBottom: 12 },
  summaryCard: { alignItems: 'center', minWidth: 120 },
  summaryLabel: { color: '#d8dbe3', fontSize: 14 },
  summaryValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },
  matchButton: {
    backgroundColor: '#ef4444', // app's red
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  matchButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
