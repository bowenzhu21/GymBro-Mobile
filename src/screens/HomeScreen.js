import React from 'react';
import { View, Text, ImageBackground, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/authContext';
import {
  subscribeToIncomingRequests,
  subscribeToUserMatches,
} from '../utils/matches';

const hero = require('../../assets/pic1.jpg');

export default function HomeScreen() {
  const navigation = useNavigation();
  const [matchesCount, setMatchesCount] = React.useState(0);
  const [requestsCount, setRequestsCount] = React.useState(0);
  const { currentUser } = useAuth();

  React.useEffect(() => {
    if (!currentUser?.uid) {
      setMatchesCount(0);
      setRequestsCount(0);
      return () => {};
    }

    const uid = currentUser.uid;
    const unsubMatches = subscribeToUserMatches(uid, (snapshot) => {
      setMatchesCount(snapshot.size);
    }, (error) => {
      console.warn('Failed to watch matches', error);
      setMatchesCount(0);
    });

    const unsubRequests = subscribeToIncomingRequests(uid, (snapshot) => {
      let count = 0;
      snapshot.forEach((docSnap) => {
        if (docSnap.data()?.status === 'pending') count += 1;
      });
      setRequestsCount(count);
    }, (error) => {
      console.warn('Failed to watch match requests', error);
      setRequestsCount(0);
    });

    return () => {
      unsubMatches?.();
      unsubRequests?.();
    };
  }, [currentUser?.uid]);
  return (
    <ImageBackground source={hero} resizeMode="cover" style={styles.bg}>
      <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
        <View style={styles.overlay} pointerEvents="none" />
        <View style={styles.content}>
          <Text style={styles.title}>Find Your Perfect Gym Bro</Text>
          <Text style={styles.subtitle}>Match with lifters by stats, goals, and schedule.</Text>
          <View style={styles.ctaRow}>
            <Pressable style={styles.btn} onPress={() => navigation.navigate('Profile')}>
              <Text style={styles.btnText}>Set My Stats</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => navigation.navigate('Bros')}>
              <Text style={[styles.btnText, styles.btnSecondaryText]}>Explore Matches</Text>
            </Pressable>
          </View>
          <View style={{ alignItems: 'center', marginTop: 36 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable style={[styles.pill]} onPress={() => navigation.navigate('MatchesList')}>
                <Text style={styles.pillText}>Matches: {matchesCount}</Text>
              </Pressable>
              <Pressable style={[styles.pill]} onPress={() => navigation.navigate('MatchRequests')}>
                <Text style={styles.pillText}>Requests: {requestsCount}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 0 },
  content: { 
    padding: 24, 
    zIndex: 2, 
    position: 'relative',
    flex: 1,
    justifyContent: 'center',
    paddingTop: 0,
    paddingBottom: 100
  },
  title: { fontSize: 32, fontWeight: '800', color: '#fff' },
  subtitle: { marginTop: 8, color: '#e6e8ee' },
  ctaRow: { flexDirection: 'row', gap: 12, marginTop: 20, justifyContent: 'flex-start' },
  btn: { backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnSecondary: { backgroundColor: '#fff' },
  btnSecondaryText: { color: '#111827' },
  pill: { backgroundColor: 'rgba(255,255,255,0.9)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },
  pillText: { color: '#111827', fontWeight: '700' },
});
