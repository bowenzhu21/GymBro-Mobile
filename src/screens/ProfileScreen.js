import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Alert,
  TextInput,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL, list, deleteObject } from 'firebase/storage';
import { db } from '../firebase/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { storage } from '../firebase/firebase';
import { useAuth } from '../contexts/authContext';
import { doSignOut, doPasswordChange, doDeleteCurrentUser } from '../firebase/auth';
import { getJSON, setJSON, remove } from '../utils/storage';
import { cleanUsername, checkUsernameAvailable, updateUsername } from '../utils/username';
import { deleteUserMatchData, subscribeToUserMatches } from '../utils/matches';

const DEFAULT_PROFILE = {
  username: '',
  name: '',
  gender: '',
  birthday: '',
  height: '',
  weight: '',
  benchPress: '',
  squat: '',
  gym: '',
  city: '',
  experience: '',
  goal: '',
  preferredTime: '',
  preferredMatchGender: '',
  instagram: '',
  contactEmail: '',
  bio: '',
};

const PROFILE_KEYS = Object.keys(DEFAULT_PROFILE);
const GOALS = ['General Fitness', 'Lose Weight', 'Build Muscle', 'Endurance', 'Powerlifting', 'Bodybuilding'];
const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const MATCH_PREFERENCES = ['Any', 'Male', 'Female', 'Other'];
const BIO_CHAR_LIMIT = 300;

// --- DOB helpers (match AccountSetupScreen) ---
const TODAY = new Date();
const THIS_YEAR = TODAY.getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => THIS_YEAR - 13 - i); // 13+ only
const MONTHS = [
  { label: 'Jan', value: 1 }, { label: 'Feb', value: 2 }, { label: 'Mar', value: 3 },
  { label: 'Apr', value: 4 }, { label: 'May', value: 5 }, { label: 'Jun', value: 6 },
  { label: 'Jul', value: 7 }, { label: 'Aug', value: 8 }, { label: 'Sep', value: 9 },
  { label: 'Oct', value: 10 }, { label: 'Nov', value: 11 }, { label: 'Dec', value: 12 },
];
function daysInMonth(year, month) {
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}
function pad2(n) {
  return String(n).padStart(2, '0');
}

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

export default function ProfileScreen() {
  const { currentUser, userProfile, setUserProfile } = useAuth();
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const [profileStats, setProfileStats] = useState(() => ({ ...DEFAULT_PROFILE }));
  const [currentStats, setCurrentStats] = useState(() => ({ ...DEFAULT_PROFILE }));
  const [showStatsEditor, setShowStatsEditor] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [statsOpen, setStatsOpen] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showInfoEditor, setShowInfoEditor] = useState(false);
  const [infoDraft, setInfoDraft] = useState({ gender: '', birthday: '' });
  const [showPreferencesEditor, setShowPreferencesEditor] = useState(false);
  const [preferencesDraft, setPreferencesDraft] = useState({ preferredMatchGender: '' });
  const [matchesCount, setMatchesCount] = useState(0);
  const uid = currentUser?.uid || null;
  const scope = uid ? { scope: uid } : undefined;

  // DOB local state for the Info modal
  const [dobYear, setDobYear] = useState(null);
  const [dobMonth, setDobMonth] = useState(null);
  const [dobDay, setDobDay] = useState(null);

  const mergeProfile = (data = {}) => {
    const merged = { ...DEFAULT_PROFILE };
    PROFILE_KEYS.forEach((key) => {
      if (data[key] !== undefined && data[key] !== null) merged[key] = data[key];
    });
    return merged;
  };

  const computedAge = useMemo(() => computeAge(profileStats?.birthday), [profileStats?.birthday]);

  const profileStatEntries = useMemo(() => ([
    { label: 'Name', value: profileStats.name || '-' },
    { label: 'Gender', value: profileStats.gender || '—' },
    { label: 'Age', value: computedAge !== null ? `${computedAge}` : '—' },
    { label: 'Height', value: profileStats.height ? `${profileStats.height} cm` : '—' },
    { label: 'Weight', value: profileStats.weight ? `${profileStats.weight} lbs` : '—' },
    { label: 'Bench', value: profileStats.benchPress ? `${profileStats.benchPress} lbs` : '—' },
    { label: 'Squat', value: profileStats.squat ? `${profileStats.squat} lbs` : '—' },
    { label: 'Gym', value: profileStats.gym || '—' },
    { label: 'City', value: profileStats.city || '—' },
    { label: 'Experience', value: profileStats.experience || '—' },
    { label: 'Goal', value: profileStats.goal || '—' },
    { label: 'Preferred Time', value: profileStats.preferredTime || '—' },
    { label: 'Prefers Matching With', value: profileStats.preferredMatchGender || 'Any' },
    { label: 'Email', value: profileStats.contactEmail || '-' },
  ]), [profileStats, computedAge]);

  useEffect(() => {
    setInfoDraft({ gender: profileStats.gender || '', birthday: profileStats.birthday || '' });
    setPreferencesDraft({ preferredMatchGender: profileStats.preferredMatchGender || '' });
  }, [profileStats.gender, profileStats.birthday, profileStats.preferredMatchGender]);

  // Prefill DOB pickers when opening the Personal Info editor
  useEffect(() => {
    if (!showInfoEditor) return;
    const b = (profileStats?.birthday || '').trim();
    if (b && /^\d{4}-\d{2}-\d{2}$/.test(b)) {
      const [y, m, d] = b.split('-').map((s) => parseInt(s, 10));
      setDobYear(y || null);
      setDobMonth(m || null);
      setDobDay(d || null);
    } else {
      setDobYear(null);
      setDobMonth(null);
      setDobDay(null);
    }
  }, [showInfoEditor, profileStats?.birthday]);

  // Keep infoDraft.birthday synced with pickers
  useEffect(() => {
    const maxDay = daysInMonth(dobYear, dobMonth);
    if (dobDay && dobDay > maxDay) {
      setDobDay(maxDay);
      return; // will retrigger
    }
    if (dobYear && dobMonth && dobDay) {
      setInfoDraft((prev) => ({ ...prev, birthday: `${dobYear}-${pad2(dobMonth)}-${pad2(dobDay)}` }));
    } else {
      setInfoDraft((prev) => ({ ...prev, birthday: '' }));
    }
  }, [dobYear, dobMonth, dobDay]);

  useEffect(() => {
    let mounted = true;
    async function loadProfilePhoto() {
      if (!currentUser) return;
      try {
        const fileRef = ref(storage, `users/${currentUser.uid}/profile.jpg`);
        const url = await getDownloadURL(fileRef);
        if (mounted) setImageUri(url);
      } catch (_) {}
    }
    async function loadRemoteProfile() {
      if (!currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          const data = snap.data() || {};
          const updates = {};
          PROFILE_KEYS.forEach((key) => {
            if (data[key] !== undefined && data[key] !== null) updates[key] = data[key];
          });
          if (data.photoUrl && !imageUri) setImageUri(data.photoUrl);
          if (Object.keys(updates).length && mounted) {
            setProfileStats((prev) => mergeProfile({ ...prev, ...updates }));
            setCurrentStats((prev) => ({ ...prev, ...updates }));
          }
        }
      } catch (_) {}
    }
    loadProfilePhoto();
    loadRemoteProfile();
    return () => { mounted = false; };
  }, [currentUser]);

  useEffect(() => {
    if (!uid) {
      const base = mergeProfile();
      setProfileStats(base);
      setCurrentStats(base);
      setMatchesCount(0);
      return;
    }
    let cancelled = false;
    (async () => {
      const saved = await getJSON('myProfile', null, scope);
      const base = mergeProfile(saved || userProfile || {});
      if (!cancelled) {
        setProfileStats(base);
        setCurrentStats(base);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, userProfile]);

  useEffect(() => {
    if (!uid) {
      setMatchesCount(0);
      return () => {};
    }
    const unsubscribe = subscribeToUserMatches(
      uid,
      (snapshot) => setMatchesCount(snapshot.size),
      (error) => { console.warn('Failed to watch matches', error); setMatchesCount(0); }
    );
    return () => unsubscribe?.();
  }, [uid]);

  useEffect(() => {
    if (!showProfileEditor) { setUsernameStatus(null); setCheckingUsername(false); return; }
    let active = true;
    const run = async () => {
      const raw = currentStats?.username || '';
      const clean = cleanUsername(raw);
      if (!raw) { if (active) setUsernameStatus(null); return; }
      if (!clean) { if (active) { setUsernameStatus('invalid'); setCheckingUsername(false); } return; }
      if (profileStats?.username && clean === profileStats.username) { if (active) { setUsernameStatus('current'); setCheckingUsername(false); } return; }
      setCheckingUsername(true);
      try {
        const available = await checkUsernameAvailable(clean);
        if (active) setUsernameStatus(available ? 'available' : 'taken');
      } finally {
        if (active) setCheckingUsername(false);
      }
    };
    run();
    return () => { active = false; };
  }, [showProfileEditor, currentStats?.username, profileStats?.username]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'We need access to your photos to upload a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      const asset = result.assets[0];
      await uploadImageAsync(asset.uri);
    }
  };

  const uploadImageAsync = async (uri) => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const res = await fetch(uri);
      const blob = await res.blob();
      const fileRef = ref(storage, `users/${currentUser.uid}/profile.jpg`);
      await uploadBytes(fileRef, blob, { contentType: blob.type || 'image/jpeg' });
      const url = await getDownloadURL(fileRef);
      setImageUri(url);
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Could not upload image');
    } finally {
      setLoading(false);
    }
  };

  const resetLocalState = () => {
    const base = mergeProfile();
    setProfileStats(base);
    setCurrentStats(base);
    setMatchesCount(0);
    setImageUri(null);
  };

  const clearStoredData = async () => {
    if (!scope) return;
    await Promise.all([
      remove('myProfile', scope),
      remove('matchFilters', scope),
      remove('matches', scope),
      remove('matchRequests', scope),
      remove('sentRequests', scope),
    ]);
  };

  const signOut = async () => {
    try { await doSignOut(); resetLocalState(); } catch (_) {}
  };

  const deleteAccount = async () => {
    if (!uid || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteUserMatchData(uid);
      const usernameHandle = cleanUsername(profileStats?.username || '');
      await Promise.all([
        deleteDoc(doc(db, 'users', uid)).catch(() => {}),
        deleteDoc(doc(db, 'publicProfiles', uid)).catch(() => {}),
        usernameHandle ? deleteDoc(doc(db, 'usernames', usernameHandle)).catch(() => {}) : Promise.resolve(),
      ]);
      try { await deleteObject(ref(storage, `users/${uid}/profile.jpg`)); } catch (_) {}
      try {
        const postsDir = ref(storage, `users/${uid}/posts`);
        const res = await list(postsDir);
        await Promise.all(res.items.map((item) => deleteObject(item).catch(() => {})));
      } catch (_) {}
      await clearStoredData();
      resetLocalState();
      await doDeleteCurrentUser();
    } catch (error) {
      const message = error?.code === 'auth/requires-recent-login'
        ? 'Please sign in again and then delete your account.'
        : (error?.message || 'Failed to delete account.');
      Alert.alert('Delete account', message);
    } finally { setIsDeleting(false); }
  };

  const confirmDeleteAccount = () => {
    if (isDeleting) return;
    Alert.alert('Delete account', 'Are you sure you want to delete your account? This cannot be undone.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: deleteAccount }]);
  };

  const persistProfileUpdates = async (updates = {}) => {
    const sanitized = { ...updates };
    if (sanitized.bio !== undefined) sanitized.bio = String(sanitized.bio || '').slice(0, BIO_CHAR_LIMIT);
    const next = mergeProfile({ ...profileStats, ...sanitized });
    setProfileStats(next);
    setCurrentStats((prev) => ({ ...prev, ...sanitized }));
    await setJSON('myProfile', next, scope);
    try {
      if (currentUser) await setDoc(doc(db, 'users', currentUser.uid), { ...sanitized, updatedAt: Date.now() }, { merge: true });
    } catch (_) {}
    if (setUserProfile) setUserProfile((prev) => ({ ...(prev || {}), ...sanitized, photoUrl: prev?.photoUrl }));
  };

  const handleChange = (k, v) => setCurrentStats((c) => ({ ...c, [k]: v }));

  const saveInfo = async () => {
    // Build/validate birthday from pickers (if any selected)
    let birthdayStr = infoDraft.birthday?.trim() || '';
    if (dobYear && dobMonth && dobDay) {
      birthdayStr = `${dobYear}-${pad2(dobMonth)}-${pad2(dobDay)}`;
    }
    if (birthdayStr) {
      const parsed = new Date(birthdayStr);
      if (Number.isNaN(parsed.getTime())) {
        Alert.alert('Invalid date', 'Please select a valid birthday.');
        return;
      }
      const today = new Date();
      const age = today.getFullYear() - parsed.getFullYear() -
        ((today.getMonth() < parsed.getMonth() || (today.getMonth() === parsed.getMonth() && today.getDate() < parsed.getDate())) ? 1 : 0);
      if (parsed > today) { Alert.alert('Invalid date', 'Birthday cannot be in the future.'); return; }
      if (age < 13) { Alert.alert('Age restriction', 'You must be at least 13 years old.'); return; }
    }

    await persistProfileUpdates({
      gender: infoDraft.gender || '',
      birthday: birthdayStr,
    });
    setShowInfoEditor(false);
  };

  const savePreferences = async () => {
    await persistProfileUpdates({ preferredMatchGender: preferencesDraft.preferredMatchGender || '' });
    setShowPreferencesEditor(false);
  };

  const onSave = async () => {
    let nextStats = mergeProfile(currentStats);
    const previousHandle = cleanUsername(profileStats?.username || '');
    if (currentUser && showProfileEditor) {
      const desiredHandle = cleanUsername(nextStats.username || '');
      if (!desiredHandle) {
        if (previousHandle) nextStats.username = previousHandle;
        else { Alert.alert('Username required', 'Please choose a username using letters, numbers, or underscores.'); return; }
      } else if (desiredHandle !== previousHandle) {
        try {
          const result = await updateUsername(currentUser.uid, desiredHandle, currentUser?.email || profileStats?.contactEmail || null);
          nextStats.username = result.username;
        } catch (e) {
          const message = e?.message === 'Username already taken'
            ? 'That username is already taken. Try another handle.'
            : (e?.message || 'Could not update username.');
          Alert.alert('Username error', message);
          return;
        }
      } else nextStats.username = desiredHandle;
    } else if (previousHandle && !nextStats.username) nextStats.username = previousHandle;

    nextStats.bio = (nextStats.bio || '').slice(0, BIO_CHAR_LIMIT);

    setProfileStats(nextStats);
    setCurrentStats(nextStats);
    await setJSON('myProfile', nextStats, scope);

    try {
      if (currentUser) {
        const payload = { updatedAt: Date.now(), photoUrl: imageUri || '' };
        PROFILE_KEYS.forEach((key) => { payload[key] = nextStats[key] ?? ''; });
        await setDoc(doc(db, 'users', currentUser.uid), payload, { merge: true });
      }
    } catch (_) {}
    if (setUserProfile) setUserProfile((prev) => ({ ...(prev || {}), ...nextStats, photoUrl: imageUri || prev?.photoUrl || '' }));

    setShowStatsEditor(false);
    setShowProfileEditor(false);
  };

  const bg = require('../../assets/backgroundImageMe.jpg');

  // Title should be the username without '@'; fallback to 'Profile' if empty
  const usernameTitle = String(currentStats?.username || 'Profile').replace(/^@/, '');

  return (
    <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
        <View style={styles.overlay} pointerEvents="none" />

        {/* Main page scroll */}
        <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.scrollContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Header now shows username (no @) */}
            <Text style={styles.title}>{usernameTitle}</Text>
            <Pressable style={styles.menuBtn} onPress={() => setShowMenu(true)}>
              <Text style={{ color: '#fff', fontSize: 18 }}>⋯</Text>
            </Pressable>
          </View>

          {showMenu && (
            <View style={styles.menuLayer} pointerEvents="box-none">
              <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)} />
              <View style={[styles.menuAnchor, { top: 56 }]}>
                <View style={styles.inlineMenu}>
                  <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); setInfoDraft({ gender: profileStats.gender || '', birthday: profileStats.birthday || '' }); setShowInfoEditor(true); }}>
                    <Text style={[styles.menuText, { color: '#fff' }]}>Personal Info</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); setPreferencesDraft({ preferredMatchGender: profileStats.preferredMatchGender || '' }); setShowPreferencesEditor(true); }}>
                    <Text style={[styles.menuText, { color: '#fff' }]}>Preferences</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); signOut(); }}>
                    <Text style={[styles.menuText, { color: '#fff' }]}>Sign Out</Text>
                  </Pressable>
                  <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); confirmDeleteAccount(); }}>
                    <Text style={[styles.menuText, { color: '#f87171' }]}>{isDeleting ? 'Deleting...' : 'Delete Account'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          <View style={styles.photoWrap}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.photo} />
            ) : (
              <Image source={require('../images/user.jpg')} style={styles.photo} />
            )}
          </View>

          <View style={styles.summaryRow}>
            <Pressable style={styles.summaryCard} onPress={() => navigation.navigate('MatchesList')}>
              <Text style={styles.summaryLabel}>Matches</Text>
              <Text style={styles.summaryValue}>{matchesCount}</Text>
            </Pressable>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Age</Text>
              <Text style={styles.summaryValue}>{computedAge !== null ? computedAge : '—'}</Text>
            </View>
          </View>

          {/* Removed lower @username */}

          {profileStats.bio ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={styles.bioTitle}>Bio</Text>
              <Text style={styles.bioText}>{profileStats.bio}</Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <Pressable style={[styles.button, styles.editTranslucent, { flex: 1 }]} onPress={() => setShowStatsEditor(true)}>
              <Text style={styles.buttonText}>Update Stats</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.editTranslucent, { flex: 1 }]} onPress={() => setShowProfileEditor(true)}>
              <Text style={styles.buttonText}>Update Profile</Text>
            </Pressable>
          </View>

          {profileStats && (
            <View style={[styles.card, { marginTop: 8 }]}>
              <Pressable onPress={() => setStatsOpen(!statsOpen)}>
                <Text style={styles.cardTitle}>{statsOpen ? 'My Stats ▲' : 'My Stats ▼'}</Text>
              </Pressable>
              {statsOpen && (
                <View style={styles.gridTwo}>
                  {profileStatEntries.map(({ label, value }) => (
                    <Text key={label} style={styles.item}>{label}: <Text style={styles.strong}>{value}</Text></Text>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={{ height: 12 }} />
        </ScrollView>

        {/* UPDATE STATS */}
        {showStatsEditor && (
          <View style={styles.modalWrap}>
            <Pressable style={styles.backdrop} onPress={() => setShowStatsEditor(false)} />
            <View style={styles.modalCard}>
              <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Update Stats</Text>
              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 8 }}>
                <View style={styles.gridTwo}>
                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>Experience</Text>
                    <View style={styles.pickerBox}>
                      <Picker selectedValue={currentStats.experience} onValueChange={(v)=> handleChange('experience', v)}>
                        <Picker.Item label="Select" value="" />
                        <Picker.Item label="Beginner" value="Beginner" />
                        <Picker.Item label="Intermediate" value="Intermediate" />
                        <Picker.Item label="Advanced" value="Advanced" />
                      </Picker>
                    </View>
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>Preferred Time</Text>
                    <View style={styles.pickerBox}>
                      <Picker selectedValue={currentStats.preferredTime} onValueChange={(v)=> handleChange('preferredTime', v)}>
                        <Picker.Item label="Select" value="" />
                        <Picker.Item label="Morning" value="Morning" />
                        <Picker.Item label="Afternoon" value="Afternoon" />
                        <Picker.Item label="Evening" value="Evening" />
                      </Picker>
                    </View>
                  </View>

                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>Goal</Text>
                    <View style={styles.pickerBox}>
                      <Picker selectedValue={currentStats.goal} onValueChange={(v)=> handleChange('goal', v)}>
                        <Picker.Item label="Select" value="" />
                        {GOALS.map((g) => <Picker.Item key={g} label={g} value={g} />)}
                      </Picker>
                    </View>
                  </View>

                  {[
                    ['Height (cm)','height','number-pad'],
                    ['Weight (lbs)','weight','number-pad'],
                    ['Bench Press (lbs)','benchPress','number-pad'],
                    ['Squat (lbs)','squat','number-pad'],
                    ['Gym','gym','default'],
                  ].map(([label, key, type]) => (
                    <View key={key} style={styles.fieldWrap}>
                      <Text style={styles.label}>{label}</Text>
                      <TextInput value={String(currentStats[key] ?? '')} onChangeText={(t)=> handleChange(key, t)} keyboardType={type} style={styles.input} />
                    </View>
                  ))}
                </View>
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={[styles.button, { flex: 1 }]} onPress={onSave}>
                  <Text style={styles.buttonText}>Save</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.signOut, { flex: 1 }]} onPress={() => setShowStatsEditor(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* UPDATE PROFILE */}
        {showProfileEditor && (
          <View style={styles.modalWrap}>
            <Pressable style={styles.backdrop} onPress={() => setShowProfileEditor(false)} />
            <View style={styles.modalCard}>
              <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Update Profile</Text>
              <View style={styles.gridTwo}>
                <View style={[styles.fieldWrap, { width: '100%' }]}>
                  <Text style={styles.label}>Username</Text>
                  <TextInput value={String(currentStats.username ?? '')} onChangeText={(t)=> handleChange('username', t)} style={styles.input} autoCapitalize='none' />
                </View>

                {showProfileEditor && (checkingUsername || ['invalid','taken','available','current'].includes(String(usernameStatus))) && (
                  <View style={{ width: '100%' }}>
                    {checkingUsername && <Text style={styles.usernameInfo}>Checking availability…</Text>}
                    {!checkingUsername && usernameStatus === 'invalid' && <Text style={styles.usernameError}>Usernames can only use letters, numbers, and underscores.</Text>}
                    {!checkingUsername && usernameStatus === 'taken' && <Text style={styles.usernameError}>That username is taken. Try another.</Text>}
                    {!checkingUsername && usernameStatus === 'available' && <Text style={styles.usernameSuccess}>Great! That username is available.</Text>}
                  </View>
                )}

                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput value={String(currentStats.name ?? '')} onChangeText={(t)=> handleChange('name', t)} style={styles.input} />
                </View>

                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>City</Text>
                  <TextInput value={String(currentStats.city ?? '')} onChangeText={(t) => handleChange('city', t)} style={styles.input} placeholder="City" autoCapitalize="words" returnKeyType="done" />
                </View>

                {/* Instagram */}
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Instagram</Text>
                  <TextInput value={String(currentStats.instagram ?? '')} onChangeText={(t)=> handleChange('instagram', t)} style={styles.input} placeholder='@handle' />
                </View>

                {/* Bio */}
                <View style={styles.fieldWrapFull}>
                  <Text style={styles.label}>Bio</Text>
                  <TextInput multiline value={String(currentStats.bio ?? '')} onChangeText={(t) => handleChange('bio', t.slice(0, BIO_CHAR_LIMIT))} style={[styles.input, styles.bioInput]} maxLength={BIO_CHAR_LIMIT} placeholder="Tell others about your goals, gym schedule, or favorite lifts." />
                  <Text style={styles.charCount}>{(currentStats.bio || '').length}/{BIO_CHAR_LIMIT}</Text>
                </View>

                {/* Update Photo */}
                <View style={[styles.fieldWrap, { width: '100%' }]}>
                  <Pressable style={[styles.button, styles.editTranslucent]} onPress={pickImage} disabled={loading}>
                    <Text style={styles.buttonText}>{loading ? 'Uploading...' : 'Update Profile Photo'}</Text>
                  </Pressable>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={[styles.button, { flex: 1 }]} onPress={onSave}>
                  <Text style={styles.buttonText}>Save</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.signOut, { flex: 1 }]} onPress={() => setShowProfileEditor(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Change Password */}
        {showPw && (
          <View style={styles.modalWrap}>
            <Pressable style={styles.backdrop} onPress={() => setShowPw(false)} />
            <View style={styles.modalCard}>
              <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Change Password</Text>
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>New Password</Text>
                <TextInput value={newPw} onChangeText={setNewPw} secureTextEntry style={styles.input} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={[styles.button, { flex: 1 }]} onPress={async () => {
                  try { if (newPw) { await doPasswordChange(newPw); Alert.alert('Success','Password updated'); setNewPw(''); setShowPw(false); } }
                  catch(e){ Alert.alert('Error', e?.message || 'Failed to update'); }
                }}>
                  <Text style={styles.buttonText}>Save</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.signOut, { flex: 1 }]} onPress={() => setShowPw(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Personal Info (now with DOB pickers) */}
        {showInfoEditor && (
          <View style={styles.modalWrap}>
            <Pressable style={styles.backdrop} onPress={() => setShowInfoEditor(false)} />
            <View style={styles.modalCard}>
              <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Personal Info</Text>

              <View style={styles.fieldWrapFull}>
                <Text style={styles.label}>Gender</Text>
                <View style={styles.pickerBox}>
                  <Picker selectedValue={infoDraft.gender} onValueChange={(v) => setInfoDraft((prev) => ({ ...prev, gender: v }))}>
                    <Picker.Item label="Select" value="" />
                    {GENDER_OPTIONS.map((option) => (<Picker.Item key={option} label={option} value={option} />))}
                  </Picker>
                </View>
              </View>

              {/* BIRTHDAY: Month/Day/Year pickers */}
              <View style={styles.fieldWrapFull}>
                <Text style={styles.label}>Birthday</Text>
                <View style={styles.dobRow}>
                  {/* Month */}
                  <View style={styles.dobPicker}>
                    <Picker selectedValue={dobMonth} onValueChange={(v) => setDobMonth(v)}>
                      <Picker.Item label="MM" value={null} style={styles.pickerItem} />
                      {MONTHS.map((m) => (
                        <Picker.Item key={m.value} label={m.label} value={m.value} style={styles.pickerItem} />
                      ))}
                    </Picker>
                  </View>
                  {/* Day */}
                  <View style={styles.dobPicker}>
                    <Picker
                      selectedValue={dobDay}
                      onValueChange={(v) => setDobDay(v)}
                      enabled={!!dobMonth && !!dobYear}
                    >
                      <Picker.Item label="DD" value={null} style={styles.pickerItem} />
                      {(() => {
                        const count = daysInMonth(dobYear, dobMonth);
                        return Array.from({ length: count }, (_, i) => i + 1).map((d) => (
                          <Picker.Item key={d} label={String(d)} value={d} style={styles.pickerItem} />
                        ));
                      })()}
                    </Picker>
                  </View>
                  {/* Year */}
                  <View style={styles.dobPickerWide}>
                    <Picker selectedValue={dobYear} onValueChange={(v) => setDobYear(v)}>
                      <Picker.Item label="YYYY" value={null} style={styles.pickerItem} />
                      {YEARS.map((y) => (
                        <Picker.Item key={y} label={String(y)} value={y} style={styles.pickerItem} />
                      ))}
                    </Picker>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={[styles.button, { flex: 1 }]} onPress={saveInfo}>
                  <Text style={styles.buttonText}>Save</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.signOut, { flex: 1 }]} onPress={() => setShowInfoEditor(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Match Preferences */}
        {showPreferencesEditor && (
          <View style={styles.modalWrap}>
            <Pressable style={styles.backdrop} onPress={() => setShowPreferencesEditor(false)} />
            <View style={styles.modalCard}>
              <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Match Preferences</Text>
              <View style={styles.fieldWrapFull}>
                <Text style={styles.label}>Show users who identify as</Text>
                <View style={styles.pickerBox}>
                  <Picker selectedValue={preferencesDraft.preferredMatchGender} onValueChange={(v) => setPreferencesDraft((prev) => ({ ...prev, preferredMatchGender: v }))}>
                    {MATCH_PREFERENCES.map((option) => (<Picker.Item key={option} label={option} value={option === 'Any' ? '' : option} />))}
                  </Picker>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Pressable style={[styles.button, { flex: 1 }]} onPress={savePreferences}>
                  <Text style={styles.buttonText}>Save</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.signOut, { flex: 1 }]} onPress={() => setShowPreferencesEditor(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 0 },
  scrollContent: { padding: 24, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 16, color: '#fff' },
  photoWrap: { alignItems: 'center', marginBottom: 16 },
  photo: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#e5e7eb' },
  card: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 12, padding: 12, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: '#fff' },
  gridTwo: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  fieldWrap: { width: '48%', marginBottom: 8 },
  fieldWrapFull: { width: '100%', marginBottom: 8 },
  label: { color: '#d8dbe3', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff' },
  item: { width: '48%', color: '#d8dbe3', marginBottom: 4 },
  strong: { color: '#fff', fontWeight: '700' },
  button: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  editTranslucent: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  signOut: { backgroundColor: '#b91c1c' },
  buttonText: { color: '#fff', fontWeight: '700' },
  modalWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { width: '92%', backgroundColor: 'rgba(27,27,30,0.98)', borderRadius: 14, padding: 14 },
  pickerBox: { backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  menuBtn: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', marginTop: -20 },
  menuLayer: { ...StyleSheet.absoluteFillObject, zIndex: 6 },
  menuOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  menuAnchor: { position: 'absolute', right: 12, zIndex: 7 },
  inlineMenu: { backgroundColor: 'rgba(27,27,30,0.95)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  menuItem: { paddingVertical: 10, paddingHorizontal: 12 },
  menuText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
  bioTitle: { color: '#fff', fontWeight: '700', marginBottom: 3 },
  bioText: { color: '#d8dbe3', lineHeight: 20 },
  bioInput: { minHeight: 100, textAlignVertical: 'top' },
  charCount: { color: '#9ca3af', fontSize: 12, textAlign: 'right', marginTop: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginBottom: 20 },
  summaryCard: { alignItems: 'center', minWidth: 120 },
  summaryLabel: { color: '#d8dbe3', fontSize: 14 },
  summaryValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 4 },

  // DOB pickers (same feel as AccountSetupScreen with 2.5x height)
  dobRow: { flexDirection: 'row', gap: 8 },
  dobPicker: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    overflow: 'hidden',
    height: 100,           // 2.5x taller
    justifyContent: 'center',
  },
  dobPickerWide: {
    flex: 1.4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    overflow: 'hidden',
    height: 100,           // 2.5x taller
    justifyContent: 'center',
  },
  pickerItem: { fontSize: 18 },
});