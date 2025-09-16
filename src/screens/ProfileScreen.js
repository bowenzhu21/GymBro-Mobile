import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ActivityIndicator, Alert, TextInput, ImageBackground, FlatList } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL, list, deleteObject } from 'firebase/storage';
import { db } from '../firebase/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { storage } from '../firebase/firebase';
import { useAuth } from '../contexts/authContext';
import { doSignOut, doPasswordChange } from '../firebase/auth';
import { getJSON, setJSON } from '../utils/storage';
import { cleanUsername, checkUsernameAvailable, updateUsername } from '../utils/username';

const DEFAULT_PROFILE = {
  username: '',
  name: '',
  age: '',
  gender: '',
  height: '',
  weight: '',
  benchPress: '',
  squat: '',
  legPress: '',
  gym: '',
  city: '',
  experience: '',
  goal: '',
  preferredTime: '',
  instagram: '',
  contactEmail: ''
};

const PROFILE_KEYS = Object.keys(DEFAULT_PROFILE);

export default function ProfileScreen() {
  const { currentUser } = useAuth();
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
  const [posts, setPosts] = useState([]); // {url, path}
  const [matchesCount, setMatchesCount] = useState(0);
  const [nextToken, setNextToken] = useState(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const mergeProfile = (data = {}) => {
    const merged = { ...DEFAULT_PROFILE };
    PROFILE_KEYS.forEach((key) => {
      if (data[key] !== undefined && data[key] !== null) {
        merged[key] = data[key];
      }
    });
    return merged;
  };

  useEffect(() => {
    let mounted = true;
    async function loadProfilePhoto() {
      if (!currentUser) return;
      try {
        const fileRef = ref(storage, `users/${currentUser.uid}/profile.jpg`);
        const url = await getDownloadURL(fileRef);
        if (mounted) setImageUri(url);
      } catch (_) {
        // no photo yet; ignore
      }
    }

    async function loadRemoteProfile() {
      if (!currentUser) return;
      try {
        const snap = await getDoc(doc(db, 'users', currentUser.uid));
        if (snap.exists()) {
          const data = snap.data() || {};
          const updates = {};
          PROFILE_KEYS.forEach((key) => {
            if (data[key] !== undefined && data[key] !== null) {
              updates[key] = data[key];
            }
          });
          if (data.photoUrl && !imageUri) {
            setImageUri(data.photoUrl);
          }
          if (Object.keys(updates).length) {
            if (mounted) {
              setProfileStats((prev) => mergeProfile({ ...prev, ...updates }));
              setCurrentStats((prev) => ({ ...prev, ...updates }));
            }
          }
        }
      } catch (_) {}
    }

    loadProfilePhoto();
    loadRemoteProfile();
    return () => {
      mounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    (async () => {
      const saved = await getJSON('myProfile', null);
      const base = saved ? mergeProfile(saved) : mergeProfile();
      setProfileStats(base);
      setCurrentStats(base);
      const matches = await getJSON('matches', []);
      setMatchesCount(Array.isArray(matches) ? matches.length : 0);
    })();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        const matches = await getJSON('matches', []);
        setMatchesCount(Array.isArray(matches) ? matches.length : 0);
      })();
    }, [])
  );

  useEffect(() => {
    (async () => {
      if (!currentUser) return;
      await loadMorePosts(true);
    })();
  }, [currentUser]);

  useEffect(() => {
    if (!showProfileEditor) {
      setUsernameStatus(null);
      setCheckingUsername(false);
      return;
    }
    let active = true;
    const run = async () => {
      const raw = currentStats?.username || '';
      const clean = cleanUsername(raw);
      if (!raw) {
        if (active) setUsernameStatus(null);
        return;
      }
      if (!clean) {
        if (active) {
          setUsernameStatus('invalid');
          setCheckingUsername(false);
        }
        return;
      }
      if (profileStats?.username && clean === profileStats.username) {
        if (active) {
          setUsernameStatus('current');
          setCheckingUsername(false);
        }
        return;
      }
      setCheckingUsername(true);
      try {
        const available = await checkUsernameAvailable(clean);
        if (active) setUsernameStatus(available ? 'available' : 'taken');
      } finally {
        if (active) setCheckingUsername(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [showProfileEditor, currentStats?.username, profileStats?.username]);

  const loadMorePosts = async (reset = false) => {
    if (!currentUser) return;
    try {
      const dir = ref(storage, `users/${currentUser.uid}/posts`);
      const res = await list(dir, { maxResults: 15, pageToken: reset ? undefined : nextToken || undefined });
      const items = await Promise.all(res.items.map(async (it) => ({ url: await getDownloadURL(it), path: it.fullPath })));
      setPosts((p) => reset ? items : [...p, ...items]);
      setNextToken(res.nextPageToken || null);
    } catch (_) {}
  };

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
      // Fetch the file into a blob
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

  const addPost = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'We need access to your photos to add a post.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
      });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        await uploadPostAsync(asset.uri);
      }
    } catch (error) {
      console.error('Error adding post:', error);
      Alert.alert('Error', 'Failed to add post. Please try again.');
    }
  };

  const uploadPostAsync = async (uri) => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const res = await fetch(uri);
      const blob = await res.blob();
      const ts = Date.now();
      const fullPath = `users/${currentUser.uid}/posts/${ts}.jpg`;
      const fileRef = ref(storage, fullPath);
      await uploadBytes(fileRef, blob, { contentType: blob.type || 'image/jpeg' });
      const url = await getDownloadURL(fileRef);
      setPosts((p) => [{ url, path: fullPath }, ...p]);
      // Firestore doc for discovery/search
      const handle = cleanUsername(currentStats?.username || '') || cleanUsername(currentStats?.name || '');
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'posts', String(ts)), {
          imageUrl: url,
          ts,
          username: handle,
          name: currentStats?.name || ''
        }, { merge: true });
      } catch (_) {}
    } catch (e) {
      Alert.alert('Post failed', e?.message || 'Could not upload post image');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try { await doSignOut(); } catch (_) {}
  };

  const handleChange = (k, v) => setCurrentStats((c) => ({ ...c, [k]: v }));

  const onSave = async () => {
    let nextStats = mergeProfile(currentStats);
    const previousHandle = cleanUsername(profileStats?.username || '');

    if (currentUser && showProfileEditor) {
      const desiredHandle = cleanUsername(nextStats.username || '');
      if (!desiredHandle) {
        if (previousHandle) {
          nextStats.username = previousHandle;
        } else {
          Alert.alert('Username required', 'Please choose a username using letters, numbers, or underscores.');
          return;
        }
      } else if (desiredHandle !== previousHandle) {
        try {
          const result = await updateUsername(currentUser.uid, desiredHandle);
          nextStats.username = result.username;
        } catch (e) {
          const message = e?.message === 'Username already taken'
            ? 'That username is already taken. Try another handle.'
            : (e?.message || 'Could not update username.');
          Alert.alert('Username error', message);
          return;
        }
      } else {
        nextStats.username = desiredHandle;
      }
    } else if (previousHandle && !nextStats.username) {
      nextStats.username = previousHandle;
    }

    setProfileStats(nextStats);
    setCurrentStats(nextStats);
    await setJSON('myProfile', nextStats);

    try {
      if (currentUser) {
        const payload = { updatedAt: Date.now(), photoUrl: imageUri || '' };
        PROFILE_KEYS.forEach((key) => {
          payload[key] = nextStats[key] ?? '';
        });
        await setDoc(doc(db, 'users', currentUser.uid), payload, { merge: true });
      }
    } catch (_) {}

    setShowStatsEditor(false);
    setShowProfileEditor(false);
  };

  const bg = require('../../assets/backgroundImageMe.jpg');
  const profileHandle = currentStats?.username
    ? `@${String(currentStats.username).replace(/^@/, '')}`
    : '@user';

  return (
    <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
        <View style={styles.overlay} pointerEvents="none" />
        <View style={styles.container}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.title}>My Profile</Text>
            <Pressable style={styles.menuBtn} onPress={() => setShowMenu(true)}>
              <Text style={{ color: '#fff', fontSize: 18 }}>⋯</Text>
            </Pressable>
          </View>
      <View style={styles.photoWrap}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.photo} />
        ) : (
          <Image source={require('../images/user.jpg')} style={styles.photo} />
        )}
      </View>
      {/* Username and counters */}
      <View style={{ marginBottom: 6 }}>
        <Text style={{ color: '#d8dbe3' }}>{profileHandle}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
        <Pressable onPress={() => navigation.navigate('MatchesList')}>
          <Text style={{ color: '#d8dbe3' }}>Matches: <Text style={{ color: '#fff', fontWeight: '800' }}>{matchesCount}</Text></Text>
        </Pressable>
        <Text style={{ color: '#d8dbe3' }}>Posts: <Text style={{ color: '#fff', fontWeight: '800' }}>{posts.length}</Text></Text>
      </View>
      {/* grid appears before stats card */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <Pressable style={[styles.button, styles.editTranslucent, { flex: 1 }]} onPress={() => setShowStatsEditor(true)}>
            <Text style={styles.buttonText}>Update Stats</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.editTranslucent, { flex: 1 }]} onPress={() => setShowProfileEditor(true)}>
            <Text style={styles.buttonText}>Update Profile</Text>
          </Pressable>
        </View>
        {profileStats && (
          <View style={[styles.card, { marginTop: 16 }]}>
            <Pressable onPress={() => setStatsOpen(!statsOpen)}>
              <Text style={styles.cardTitle}>{statsOpen ? 'My Stats ▲' : 'My Stats ▼'}</Text>
            </Pressable>
            {statsOpen && (
            <View style={styles.gridTwo}>
              <Text style={styles.item}>Name: <Text style={styles.strong}>{profileStats.name || '-'}</Text></Text>
              <Text style={styles.item}>Age: <Text style={styles.strong}>{profileStats.age || '-'}</Text></Text>
              <Text style={styles.item}>Gender: <Text style={styles.strong}>{profileStats.gender || '-'}</Text></Text>
              <Text style={styles.item}>Height: <Text style={styles.strong}>{profileStats.height || '-'}</Text> cm</Text>
              <Text style={styles.item}>Weight: <Text style={styles.strong}>{profileStats.weight || '-'}</Text> lbs</Text>
              <Text style={styles.item}>Bench: <Text style={styles.strong}>{profileStats.benchPress || '-'}</Text> lbs</Text>
              <Text style={styles.item}>Squat: <Text style={styles.strong}>{profileStats.squat || '-'}</Text> lbs</Text>
              <Text style={styles.item}>Gym: <Text style={styles.strong}>{profileStats.gym || '-'}</Text></Text>
              <Text style={styles.item}>City: <Text style={styles.strong}>{profileStats.city || '-'}</Text></Text>
              <Text style={styles.item}>Experience: <Text style={styles.strong}>{profileStats.experience || '-'}</Text></Text>
              <Text style={styles.item}>Goal: <Text style={styles.strong}>{profileStats.goal || '-'}</Text></Text>
              <Text style={styles.item}>Preferred Time: <Text style={styles.strong}>{profileStats.preferredTime || '-'}</Text></Text>
              <Text style={styles.item}>Email: <Text style={styles.strong}>{profileStats.contactEmail || '-'}</Text></Text>
            </View>
            )}
          </View>
        )}
        <View style={[styles.card, { backgroundColor: 'transparent', padding: 0, marginTop: 16 }]}>
          <FlatList
            data={[{ type: 'add' }, ...posts]}
            keyExtractor={(item, i) => item.type === 'add' ? 'add' : item.path}
            numColumns={3}
            onEndReached={() => nextToken && loadMorePosts(false)}
            onEndReachedThreshold={0.5}
            columnWrapperStyle={{ gap: 6, paddingHorizontal: 0 }}
            contentContainerStyle={{ gap: 6 }}
            renderItem={({ item }) => (
              item.type === 'add' ? (
                <Pressable onPress={addPost} style={styles.addTile}>
                  <Text style={{ color: '#9ca3af', fontSize: 28, fontWeight: '800' }}>＋</Text>
                </Pressable>
              ) : (
                <Pressable onLongPress={() => Alert.alert('Delete post?', 'This cannot be undone', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deletePost(item.path) },
                ])}>
                  <Image source={{ uri: item.url }} style={styles.gridImage} />
                </Pressable>
              )
            )}
          />
        </View>
        </View>

        {showStatsEditor && (
          <View style={styles.modalWrap}>
            <Pressable style={styles.backdrop} onPress={() => setShowStatsEditor(false)} />
            <View style={styles.modalCard}>
              <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Update Stats</Text>
              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 8 }}>
                <View style={styles.gridTwo}>
                  <View style={styles.fieldWrap}>
                    <Text style={styles.label}>Gender</Text>
                    <View style={styles.pickerBox}>
                      <Picker selectedValue={currentStats.gender} onValueChange={(v)=> handleChange('gender', v)}>
                        <Picker.Item label="Select" value="" />
                        <Picker.Item label="Male" value="Male" />
                        <Picker.Item label="Female" value="Female" />
                        <Picker.Item label="Other" value="Other" />
                      </Picker>
                    </View>
                  </View>
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
                  {[
                    ['Height (cm)','height','number-pad'],['Weight (lbs)','weight','number-pad'],['Bench Press (lbs)','benchPress','number-pad'],
                    ['Squat (lbs)','squat','number-pad'],['Gym','gym','default'],['City','city','default'],
                    ['Goal','goal','default']
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
                {showProfileEditor && (checkingUsername || ['invalid', 'taken', 'available'].includes(usernameStatus)) && (
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
                  <Text style={styles.label}>Age</Text>
                  <TextInput value={String(currentStats.age ?? '')} onChangeText={(t)=> handleChange('age', t)} keyboardType='number-pad' style={styles.input} />
                </View>
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Gender</Text>
                  <View style={styles.pickerBox}>
                    <Picker selectedValue={currentStats.gender} onValueChange={(v)=> handleChange('gender', v)}>
                      <Picker.Item label="Select" value="" />
                      <Picker.Item label="Male" value="Male" />
                      <Picker.Item label="Female" value="Female" />
                      <Picker.Item label="Other" value="Other" />
                    </Picker>
                  </View>
                </View>
                <View style={styles.fieldWrap}>
                  <Text style={styles.label}>Instagram</Text>
                  <TextInput value={String(currentStats.instagram ?? '')} onChangeText={(t)=> handleChange('instagram', t)} style={styles.input} placeholder='@handle' />
                </View>
                <View style={[styles.fieldWrap, { width: '100%' }]}>
                  <Pressable style={[styles.button, styles.post]} onPress={pickImage} disabled={loading}>
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

        {showMenu && (
          <View style={styles.menuModal}>
            <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)} />
            <View style={styles.menuPanel}>
              {/*
              <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); setShowPw(true); }}>
                <Text style={styles.menuText}>Change Password</Text>
              </Pressable>
              */}
              <Pressable style={styles.menuItem} onPress={() => { setShowMenu(false); signOut(); }}>
                <Text style={[styles.menuText, { color: '#ef4444' }]}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        )}

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
                <Pressable style={[styles.button, { flex: 1 }]} onPress={async () => { try { if(newPw){ await doPasswordChange(newPw); Alert.alert('Success','Password updated'); setNewPw(''); setShowPw(false);} } catch(e){ Alert.alert('Error', e?.message || 'Failed to update'); } }}>
                  <Text style={styles.buttonText}>Save</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.signOut, { flex: 1 }]} onPress={() => setShowPw(false)}>
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
  container: { padding: 24, zIndex: 2, position: 'relative' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 16, color: '#fff' },
  photoWrap: { alignItems: 'center', marginBottom: 16 },
  photo: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#e5e7eb' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 12, padding: 12, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: '#fff' },
  gridTwo: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  fieldWrap: { width: '48%', marginBottom: 8 },
  label: { color: '#d8dbe3', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff' },
  item: { width: '48%', color: '#d8dbe3', marginBottom: 4 },
  strong: { color: '#fff', fontWeight: '700' },
  button: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  edit: { backgroundColor: '#2563eb' },
  editSecondary: { backgroundColor: '#374151' },
  editTranslucent: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  save: { backgroundColor: '#0f766e', marginTop: 8 },
  post: { backgroundColor: '#1f2937' },
  signOut: { backgroundColor: '#b91c1c' },
  buttonText: { color: '#fff', fontWeight: '700' },
  gridImage: { width: '100%', aspectRatio: 1, borderRadius: 6 },
  modalWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { width: '92%', backgroundColor: 'rgba(27,27,30,0.98)', borderRadius: 14, padding: 14 },
  pickerBox: { backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  addTile: { flex: 1, aspectRatio: 1, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(27,27,30,0.6)' },
  menuBtn: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  menuModal: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  menuPanel: { position: 'absolute', top: 44, right: 12, backgroundColor: 'rgba(27,27,30,0.98)', borderRadius: 10, paddingVertical: 6, minWidth: 180, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  menuItem: { paddingVertical: 10, paddingHorizontal: 12 },
  menuText: { color: '#fff', fontWeight: '600' },
});
