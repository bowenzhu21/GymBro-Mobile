// gb-mobile/src/screens/MatchScreen.js
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ImageBackground,
  Image,
  Modal,
  ScrollView,
  Alert,
  Animated,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
// Removed Picker: preferred time is multiselect chips now
import { computeDistance, percent } from '../utils/match';
import { getJSON, setJSON } from '../utils/storage';
import { db } from '../firebase/firebase';
import { Timestamp, setDoc, doc } from 'firebase/firestore';
import { useAuth } from '../contexts/authContext';
import { useUsersDirectory } from '../hooks/useUsersDirectory';
import {
  subscribeToIncomingRequests,
  subscribeToOutgoingRequests,
  subscribeToUserMatches,
} from '../utils/matches';

const DEFAULT_WEIGHTS = { height: 0.5, weight: 0.5, benchPress: 1, squat: 1 };

// Match Account/Profile screens options
const TIME_OPTIONS = ['Morning', 'Noon', 'Afternoon', 'Evening', 'Night'];

// Normalizes strings so "GoodLife Fitness" => "goodlifefitness"
const norm = (s = '') => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

export default function MatchScreen({ route }) {
  const navigation = useNavigation();
  const { currentUser, userProfile } = useAuth();
  const { users: directoryUsers } = useUsersDirectory();
  const defaultUserUrl = null;

  const [myProfile, setMyProfile] = useState(null);
  const [weights] = useState(DEFAULT_WEIGHTS);

  // Filters now: gym (text), city (text), preferredTimes (array)
  const [filters, setFilters] = useState({ gym: '', city: '', preferredTimes: [] });

  const [topN] = useState(10);
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState(''); // name search

  const [matchedIds, setMatchedIds] = useState(new Set());
  const [incomingPendingIds, setIncomingPendingIds] = useState(new Set());
  const [outgoingPendingIds, setOutgoingPendingIds] = useState(new Set());
  const [pendingIds, setPendingIds] = useState(new Set());

  const [localPendingIds, setLocalPendingIds] = useState(new Set());
  const [animatingIds, setAnimatingIds] = useState(new Set());

  const animRefs = useRef({}); // { [id]: { fistScale, cardScale, cardOpacity } }

  const uid = currentUser?.uid || null;
  const scope = uid ? { scope: uid } : undefined;

  const ensureAnim = (id) => {
    if (!animRefs.current[id]) {
      animRefs.current[id] = {
        fistScale: new Animated.Value(1),
        cardScale: new Animated.Value(1),
        cardOpacity: new Animated.Value(1),
      };
    }
    return animRefs.current[id];
  };

  // Migration helper for stored filters structure
  const migrateFilters = (raw) => {
    if (!raw || typeof raw !== 'object') return { gym: '', city: '', preferredTimes: [] };
    const gym = raw.gym ?? '';
    const city = raw.city ?? '';
    // previous versions used preferredTime: 'Evening' or ''
    let preferredTimes = Array.isArray(raw.preferredTimes) ? raw.preferredTimes : [];
    if (!preferredTimes.length && typeof raw.preferredTime === 'string' && raw.preferredTime) {
      preferredTimes = [raw.preferredTime];
    }
    // sanitize to known options
    preferredTimes = preferredTimes.filter((t) => TIME_OPTIONS.includes(String(t)));
    return { gym, city, preferredTimes };
  };

  useEffect(() => {
    if (!uid) {
      setMyProfile(null);
      setFilters({ gym: '', city: '', preferredTimes: [] });
      setMatchedIds(new Set());
      setIncomingPendingIds(new Set());
      setOutgoingPendingIds(new Set());
      setPendingIds(new Set());
      setLocalPendingIds(new Set());
      setAnimatingIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const storedProfile = await getJSON('myProfile', null, scope);
      const storedFilters = await getJSON('matchFilters', { gym: '', preferredTime: '' }, scope);
      if (!cancelled) {
        setFilters(migrateFilters(storedFilters));
        if (storedProfile) setMyProfile(storedProfile);
        else if (userProfile) setMyProfile(userProfile);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, userProfile]);

  useEffect(() => {
    if (!uid) return;
    const unsubMatches = subscribeToUserMatches(
      uid,
      (snapshot) => {
        const next = new Set();
        snapshot.forEach((docSnap) => {
          const participants = docSnap.data()?.participants || [];
          const other = Array.isArray(participants) ? participants.find((p) => p && p !== uid) : null;
          if (other) next.add(other);
        });
        setMatchedIds(next);
      },
      () => setMatchedIds(new Set())
    );

    const unsubIncoming = subscribeToIncomingRequests(
      uid,
      (snapshot) => {
        const next = new Set();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.status === 'pending' && typeof data.fromUid === 'string') next.add(data.fromUid);
        });
        setIncomingPendingIds(next);
      },
      () => setIncomingPendingIds(new Set())
    );

    const unsubOutgoing = subscribeToOutgoingRequests(
      uid,
      (snapshot) => {
        const next = new Set();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data?.status === 'pending' && typeof data.toUid === 'string') next.add(data.toUid);
        });
        setOutgoingPendingIds(next);
      },
      () => setOutgoingPendingIds(new Set())
    );

    return () => { unsubMatches?.(); unsubIncoming?.(); unsubOutgoing?.(); };
  }, [uid]);

  useEffect(() => {
    const combined = new Set();
    incomingPendingIds.forEach((v) => combined.add(v));
    outgoingPendingIds.forEach((v) => combined.add(v));
    setPendingIds(combined);
  }, [incomingPendingIds, outgoingPendingIds]);

  // Persist filters
  useEffect(() => {
    if (!uid) return;
    const payload = {
      gym: filters.gym || '',
      city: filters.city || '',
      preferredTimes: Array.isArray(filters.preferredTimes) ? filters.preferredTimes : [],
    };
    setJSON('matchFilters', payload, scope);
  }, [filters, uid]);

  const otherUsers = useMemo(
    () => directoryUsers.filter((user) => user?.id && user.id !== uid),
    [directoryUsers, uid]
  );

  const normalizedUsers = useMemo(() => {
    return otherUsers.map((user) => ({
      id: user.id,
      name: user.name || user.displayName || 'Gym Bro',
      gender: user.gender || '—',
      height: Number(user.height) || null,
      weight: Number(user.weight) || null,
      benchPress: Number(user.benchPress) || null,
      squat: Number(user.squat) || null,
      gym: user.gym || 'Unknown Gym',
      city: user.city || 'Unknown City',
      goal: user.goal || '—',
      experience: user.experience || '—',
      preferredTime: user.preferredTime || '—',
      photoUrl: user.photoUrl || '',
      instagram: user.instagram || '',
    }));
  }, [otherUsers]);

  const preferredMatchGender = useMemo(() => {
    const value = myProfile?.preferredMatchGender;
    if (!value || value === 'Any') return '';
    return value;
  }, [myProfile?.preferredMatchGender]);

  const data = useMemo(() => {
    const baseProfile = myProfile || userProfile;
    if (!baseProfile) return [];
    return normalizedUsers
      .filter((u) => !matchedIds.has(u.id))
      .filter((u) => !(pendingIds.has(u.id) && !animatingIds.has(u.id)))
      .filter((u) => !localPendingIds.has(u.id))
      .filter((u) => (preferredMatchGender ? u.gender === preferredMatchGender : true))
      // Gym fuzzy contains
      .filter((u) => {
        const q = filters.gym.trim();
        return q ? norm(u.gym).includes(norm(q)) : true;
      })
      // City fuzzy contains
      .filter((u) => {
        const q = filters.city.trim();
        return q ? norm(u.city).includes(norm(q)) : true;
      })
      // Preferred times multiselect: if any selected, user.preferredTime must be one of them
      .filter((u) => {
        const list = filters.preferredTimes || [];
        return list.length ? list.includes(u.preferredTime) : true;
      })
      // Name search
      .filter((u) => u.name?.toLowerCase().includes(search.toLowerCase()))
      .map((user) => ({ user, distance: computeDistance(baseProfile, user, weights) }))
      .filter((e) => Number.isFinite(e.distance))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, topN);
  }, [
    normalizedUsers, matchedIds, pendingIds, animatingIds, localPendingIds,
    filters, topN, myProfile, userProfile, weights, preferredMatchGender, search
  ]);

  const actuallySendMatch = async (user) => {
    if (!uid) return;
    try {
      const now = Timestamp.now();
      const matchRequest = {
        fromUid: uid,
        toUid: user.id,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'matchRequests', `${uid}_${user.id}`), matchRequest);
    } catch (error) {
      console.log('MatchRequest error:', error);
      Alert.alert('Error', error?.message || 'Could not send match request.');
    }
  };

  const playBumpThenRemove = (user) =>
    new Promise((resolve) => {
      const { fistScale, cardScale, cardOpacity } = ensureAnim(user.id);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(fistScale, { toValue: 1.2, duration: 110, useNativeDriver: true }),
          Animated.spring(fistScale, { toValue: 0.92, friction: 5, useNativeDriver: true }),
          Animated.spring(fistScale, { toValue: 1, friction: 5, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(cardScale, { toValue: 1.03, duration: 110, useNativeDriver: true }),
          Animated.spring(cardScale, { toValue: 1, friction: 6, useNativeDriver: true }),
        ]),
      ]).start(() => {
        Animated.timing(cardOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
          setLocalPendingIds((prev) => new Set(prev).add(user.id));
          cardOpacity.setValue(1);
          resolve();
        });
      });
    });

  const onMatchPress = async (user) => {
    if (!uid || matchedIds.has(user.id) || localPendingIds.has(user.id)) return;
    setAnimatingIds((prev) => { const n = new Set(prev); n.add(user.id); return n; });
    actuallySendMatch(user);
    playBumpThenRemove(user).then(() => {
      setAnimatingIds((prev) => { const n = new Set(prev); n.delete(user.id); return n; });
    });
  };

  const navToProfile = (user) => navigation.navigate('UserProfile', { user });

  const renderItem = ({ item }) => {
    const { user, distance } = item;
    const photo = user?.photoUrl ? { uri: user.photoUrl } : require('../images/user.jpg');
    const matchPct = Number.isFinite(distance) ? percent(distance) : 0;
    const { fistScale, cardScale, cardOpacity } = ensureAnim(user.id);

    return (
      <Animated.View style={[styles.cardShadowWrap, { transform: [{ scale: cardScale }], opacity: cardOpacity }]}> 
        <View style={styles.cardInner}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Image source={photo} style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.name}>{user.name}</Text>
                  <Text style={styles.meta}>{user.gender} • {user.gym} • {user.city}</Text>
                </View>
              </View>
              <Text style={styles.simSmall}>Match: {matchPct}%</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.stat}>Ht: <Text style={styles.statStrong}>{user.height ?? '—'}</Text> cm</Text>
            <Text style={styles.stat}>Wt: <Text style={styles.statStrong}>{user.weight ?? '—'}</Text> lbs</Text>
            <Text style={styles.stat}>Bench: <Text style={styles.statStrong}>{user.benchPress ?? '—'}</Text></Text>
            <Text style={styles.stat}>Squat: <Text style={styles.statStrong}>{user.squat ?? '—'}</Text></Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>Goal: <Text style={styles.metaStrong}>{user.goal}</Text></Text>
            <Text style={styles.meta}>Exp: <Text style={styles.metaStrong}>{user.experience}</Text></Text>
            <Text style={styles.meta}>Time: <Text style={styles.metaStrong}>{user.preferredTime}</Text></Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <Pressable style={[styles.visitBtn, { flex: 1, backgroundColor: '#111827' }]} onPress={() => navToProfile(user)}>
              <Text style={[styles.visitTxt, { color: '#fff' }]}>Visit Profile</Text>
            </Pressable>
            <Pressable
              onPressIn={() => Animated.spring(ensureAnim(user.id).fistScale, { toValue: 0.95, useNativeDriver: true }).start()}
              onPressOut={() => Animated.spring(ensureAnim(user.id).fistScale, { toValue: 1, useNativeDriver: true }).start()}
              onPress={() => onMatchPress(user)}
              style={styles.matchCircle}
            >
              <Animated.Image
                source={require('../images/match.png')}
                style={[styles.matchIcon, { transform: [{ scale: fistScale }] }]} />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  };

  const bg = require('../../assets/backgroundImageBroUp.jpg');

  // Helpers to toggle multiselect chips
  const toggleTime = (value) => {
    setFilters((prev) => {
      const set = new Set(prev.preferredTimes || []);
      if (set.has(value)) set.delete(value); else set.add(value);
      return { ...prev, preferredTimes: Array.from(set) };
    });
  };

  return (
    <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top','left','right']}>
        {/* Top header: Bros + Filter */}
        <View style={{ padding: 16, paddingBottom: 0 }}>
          <View style={styles.headerBar}>
            <Text style={styles.headerTitle}>Bros</Text>
            <Pressable style={styles.filterBtn} onPress={() => setFilterOpen(true)}>
              <Text style={styles.filterText}>Filter ▾</Text>
            </Pressable>
          </View>

          {/* Search directly under header (name search) */}
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search gym bros..."
            placeholderTextColor="#6b7280"
            style={styles.searchInput}
          />
        </View>

        {/* List */}
        <View style={styles.container}>
          <FlatList
            data={myProfile && data.length > 0 ? data : []}
            keyExtractor={(x) => String(x.user.id)}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ paddingBottom: 24 }}
          />

          {/* Filter modal */}
          <Modal visible={filterOpen} animationType="fade" transparent onRequestClose={() => setFilterOpen(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setFilterOpen(false)} />
            <View style={styles.modalPanel}>
              <ScrollView showsVerticalScrollIndicator keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
                <Text style={styles.toolbarTitle}>Filters</Text>

                {/* GYM: text search */}
                <View style={styles.pickerWrap}>
                  <Text style={styles.pickerLabel}>Gym</Text>
                  <TextInput
                    value={filters.gym}
                    onChangeText={(v) => setFilters({ ...filters, gym: v })}
                    placeholder="Type a gym name…"
                    placeholderTextColor="#9ca3af"
                    style={styles.textField}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* CITY: text search */}
                <View style={styles.pickerWrap}>
                  <Text style={styles.pickerLabel}>City</Text>
                  <TextInput
                    value={filters.city}
                    onChangeText={(v) => setFilters({ ...filters, city: v })}
                    placeholder="Type a city…"
                    placeholderTextColor="#9ca3af"
                    style={styles.textField}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Preferred Time: multiselect chips */}
                <View style={styles.pickerWrap}>
                  <Text style={styles.pickerLabel}>Preferred Time</Text>
                  <View style={styles.chipsRow}>
                    {TIME_OPTIONS.map((opt) => {
                      const active = (filters.preferredTimes || []).includes(opt);
                      return (
                        <Pressable
                          key={opt}
                          onPress={() => toggleTime(opt)}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipTxt, active && styles.chipTxtActive]}>{opt}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable
                  style={[styles.saveBtn, { flex: 1, backgroundColor: '#111827', borderColor: '#111827' }]}
                  onPress={() => setFilterOpen(false)}
                >
                  <Text style={[styles.saveTxt, { color: '#fff' }]}>Apply</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveBtn, { flex: 1 }]}
                  onPress={() => {
                    setFilters({ gym: '', city: '', preferredTimes: [] });
                    setFilterOpen(false);
                  }}
                >
                  <Text style={styles.saveTxt}>Clear</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 0 },
  container: { flex: 1, padding: 16, zIndex: 2, position: 'relative' },

  // Header row with title + filter button
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },

  searchInput: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#111827',
    fontSize: 16,
    marginBottom: 8,
  },

  filterBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  filterText: { color: '#111827', fontWeight: '700' },

  card: {
    backgroundColor: 'rgba(27,27,30,0.9)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#e5e7eb' },
  name: { fontSize: 18, fontWeight: '700', color: '#fff' },
  meta: { color: '#d8dbe3' },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 4, flexWrap: 'wrap' },
  metaStrong: { color: '#fff', fontWeight: '700' },
  simSmall: { color: '#d8dbe3', marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 16, marginTop: 6, flexWrap: 'wrap' },
  stat: { color: '#d8dbe3' },
  statStrong: { color: '#fff', fontWeight: '700' },

  saveBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  saveTxt: { color: '#111827', fontWeight: '700' },

  toolbarTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: '#fff' },
  pickerLabel: { color: '#d8dbe3', marginBottom: 4 },
  pickerWrap: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 12, padding: 8, marginBottom: 8 },

  textField: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
  },

  visitBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    marginTop: 8,
    alignItems: 'center',
  },
  visitTxt: { color: '#111827', fontWeight: '700' },

  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalPanel: { position: 'absolute', top: '20%', left: '5%', right: '5%', backgroundColor: 'rgba(27,27,30,0.98)', borderRadius: 12, padding: 12, maxHeight: '75%' },

  matchCircle: {
    width: 44, height: 44, borderRadius: 22, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 2, borderColor: '#111827',
  },
  matchIcon: { width: 44, height: 44 },

  // Chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  chipTxt: { color: '#fff', fontWeight: '600' },
  chipTxtActive: { color: '#111827' },
});