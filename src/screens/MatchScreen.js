import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ImageBackground, Image, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { sampleUsers, computeDistance, percent } from '../utils/match';
import { getJSON, setJSON } from '../utils/storage';
import { addUnique } from '../utils/storage';

const DEFAULT_WEIGHTS = { height: 0.5, weight: 0.5, benchPress: 1, squat: 1, legPress: 0.5 };

export default function MatchScreen() {
  const navigation = useNavigation();
  const defaultUserUrl = null;
  const [myProfile, setMyProfile] = useState(null);
  const [weights] = useState(DEFAULT_WEIGHTS);
  const [filters, setFilters] = useState({ gym: '', gender: '', goal: '', experience: '', preferredTime: '' });
  const [topN] = useState(10);
  const [filterOpen, setFilterOpen] = useState(false);
  const [matchedIds, setMatchedIds] = useState(new Set());
  const [pendingIds, setPendingIds] = useState(new Set());

  useEffect(() => {
    (async () => {
      setMyProfile(await getJSON('myProfile', null));
      setFilters(await getJSON('matchFilters', { gym: '', gender: '', goal: '', experience: '', preferredTime: '' }));
      await refreshBlocks();
    })();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      refreshBlocks();
    }, [])
  );

  const refreshBlocks = async () => {
    const matches = await getJSON('matches', []);
    const sent = await getJSON('sentRequests', []);
    const incoming = await getJSON('matchRequests', []);
    const m = new Set(matches.map((x) => (typeof x === 'object' ? x.id : x)));
    const p = new Set([
      ...sent.map((x) => x.to),
      ...incoming.map((x) => x.from),
    ]);
    setMatchedIds(m);
    setPendingIds(p);
  };

  useEffect(() => { setJSON('matchFilters', filters); }, [filters]);

  const data = useMemo(() => {
    if (!myProfile) return [];
    return sampleUsers
      .filter(u => !myProfile?.name || u.name !== myProfile.name)
      .filter(u => !matchedIds.has(u.id))
      .filter(u => !pendingIds.has(u.id))
      .filter(u => (filters.gender ? u.gender === filters.gender : true))
      .filter(u => (filters.gym ? u.gym === filters.gym : true))
      .filter(u => (filters.goal ? u.goal === filters.goal : true))
      .filter(u => (filters.experience ? u.experience === filters.experience : true))
      .filter(u => (filters.preferredTime ? u.preferredTime === filters.preferredTime : true))
      .map(user => ({ user, distance: computeDistance(myProfile, user, weights) }))
      .filter(x => Number.isFinite(x.distance))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, topN);
  }, [myProfile, filters, topN, matchedIds, pendingIds]);

  // favorites feature removed

  const navToProfile = (user) => navigation.navigate('UserProfile', { user });

  const sendMatchRequest = async (user) => {
    if (matchedIds.has(user.id) || pendingIds.has(user.id)) return;
    await addUnique('sentRequests', { to: user.id });
    // Seed incoming for demo if none exist
    const incoming = await getJSON('matchRequests', []);
    if (!Array.isArray(incoming) || incoming.length === 0) {
      await addUnique('matchRequests', { from: user.id });
    }
    await refreshBlocks();
  };

  const renderItem = ({ item }) => {
    const { user, distance } = item;
    const photo = user?.photo ? { uri: user.photo } : defaultUserUrl ? { uri: defaultUserUrl } : require('../images/user.jpg');
    return (
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Image source={photo} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.name}>{user.name}</Text>
                <Text style={styles.meta}>{user.gender} • {user.gym} • {user.city}</Text>
              </View>
            </View>
            <Text style={styles.simSmall}>Match: {percent(distance)}%</Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.stat}>Ht: <Text style={styles.statStrong}>{user.height}</Text> cm</Text>
          <Text style={styles.stat}>Wt: <Text style={styles.statStrong}>{user.weight}</Text> lbs</Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.stat}>Bench: <Text style={styles.statStrong}>{user.benchPress}</Text></Text>
          <Text style={styles.stat}>Squat: <Text style={styles.statStrong}>{user.squat}</Text></Text>
          <Text style={styles.stat}>Leg: <Text style={styles.statStrong}>{user.legPress}</Text></Text>
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
          <Pressable onPress={() => sendMatchRequest(user)} style={styles.matchCircle}>
            <Image source={require('../images/match.png')} style={styles.matchIcon} />
          </Pressable>
        </View>
      </View>
    );
  };

  const allGyms = useMemo(() => Array.from(new Set(sampleUsers.map(u => u.gym))), []);
  const allGoals = useMemo(() => Array.from(new Set(sampleUsers.map(u => u.goal))), []);
  const allExp = useMemo(() => Array.from(new Set(sampleUsers.map(u => u.experience))), []);
  const allTimes = useMemo(() => Array.from(new Set(sampleUsers.map(u => u.preferredTime))), []);

  const bg = require('../../assets/backgroundImage.jpg');

  const ListHeader = useCallback(() => (
    <View>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Bros</Text>
        <Pressable style={styles.filterBtn} onPress={() => setFilterOpen(true)}>
          <Text style={styles.filterText}>Filter ▾</Text>
        </Pressable>
      </View>
      {!myProfile && (
        <Text style={{ color: '#fff', marginBottom: 12 }}>Set your stats in Profile to see matches.</Text>
      )}
    </View>
  ), [myProfile]);

  return (
    <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
        <View style={styles.container}>
          <FlatList
            data={myProfile && data.length > 0 ? data : []}
            keyExtractor={(x) => String(x.user.id)}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            ListHeaderComponent={ListHeader}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
          <Modal visible={filterOpen} animationType="fade" transparent onRequestClose={() => setFilterOpen(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setFilterOpen(false)} />
            <View style={styles.modalPanel}>
              {/* Scrollable content */}
              <ScrollView
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 12 }}
              >
                <Text style={styles.toolbarTitle}>Filters</Text>

                <View style={styles.pickerWrap}>
                  <Text style={styles.pickerLabel}>Gender</Text>
                  <Picker
                    selectedValue={filters.gender}
                    onValueChange={(v)=> setFilters({ ...filters, gender: v })}
                    style={{ color: 'white' }}
                    dropdownIconColor="white"
                  >
                    <Picker.Item label="Any" value="" color="white" />
                    {['Male','Female','Other'].map(g => (
                      <Picker.Item key={g} label={g} value={g} color="white" />
                    ))}
                  </Picker>
                </View>

                <View style={styles.pickerWrap}>
                  <Text style={styles.pickerLabel}>Gym</Text>
                  <Picker
                    selectedValue={filters.gym}
                    onValueChange={(v)=> setFilters({ ...filters, gym: v })}
                    style={{ color: 'white' }}
                    dropdownIconColor="white"
                  >
                    <Picker.Item label="Any" value="" color="white" />
                    {allGyms.map(g => (
                      <Picker.Item key={g} label={g} value={g} color="white" />
                    ))}
                  </Picker>
                </View>

                <View style={styles.pickerWrap}>
                  <Text style={styles.pickerLabel}>Experience</Text>
                  <Picker
                    selectedValue={filters.experience}
                    onValueChange={(v)=> setFilters({ ...filters, experience: v })}
                    style={{ color: 'white' }}
                    dropdownIconColor="white"
                  >
                    <Picker.Item label="Any" value="" color="white" />
                    {['Beginner','Intermediate','Advanced'].map(g => (
                      <Picker.Item key={g} label={g} value={g} color="white" />
                    ))}
                  </Picker>
                </View>

                <View style={styles.pickerWrap}>
                  <Text style={styles.pickerLabel}>Preferred Time</Text>
                  <Picker
                    selectedValue={filters.preferredTime}
                    onValueChange={(v)=> setFilters({ ...filters, preferredTime: v })}
                    style={{ color: 'white' }}
                    dropdownIconColor="white"
                  >
                    <Picker.Item label="Any" value="" color="white" />
                    {['Morning','Afternoon','Evening'].map(g => (
                      <Picker.Item key={g} label={g} value={g} color="white" />
                    ))}
                  </Picker>
                </View>

              </ScrollView>

              {/* Sticky buttons under the scroller */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={[styles.saveBtn, { flex: 1, backgroundColor: '#111827', borderColor: '#111827' }]} onPress={() => setFilterOpen(false)}>
                  <Text style={[styles.saveTxt, { color: '#fff' }]}>Apply</Text>
                </Pressable>
                <Pressable style={[styles.saveBtn, { flex: 1 }]} onPress={() => { setFilters({ gym: '', gender: '', goal: '', experience: '', preferredTime: '' }); setFilterOpen(false); }}>
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
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  filterBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.85)' },
  filterText: { color: '#111827', fontWeight: '700' },
  card: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 12, padding: 12 },
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
  saveBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#fff' },
  saveBtnActive: { backgroundColor: '#111827', borderColor: '#111827' },
  saveTxt: { color: '#111827', fontWeight: '700' },
  saveTxtActive: { color: '#fff' },
  toolbarTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: '#fff' },
  pickerLabel: { color: '#d8dbe3', marginBottom: 4 },
  pickerWrap: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 12, padding: 8, marginBottom: 8 },
  visitBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.9)', marginTop: 8, alignItems: 'center' },
  visitTxt: { color: '#111827', fontWeight: '700' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalPanel: { position: 'absolute', top: '20%', left: '5%', right: '5%', backgroundColor: 'rgba(27,27,30,0.98)', borderRadius: 12, padding: 12, maxHeight: '75%' }, // 👈 cap height so ScrollView kicks in
  matchCircle: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  matchIcon: { width: 44, height: 44 },
});