// gb-mobile/src/screens/AccountSetupScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Image,
  ImageBackground,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { uploadBytesResumable, getDownloadURL, ref } from 'firebase/storage';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/authContext';
import {
  cleanUsername,
  assignUsername,
  ensureUsernameRecord,
} from '../utils/username';
import { setJSON } from '../utils/storage';
import { storage, db } from '../firebase/firebase';
import { Picker } from '@react-native-picker/picker';

const bg = require('../../assets/backgroundImageMe.jpg');

const EXPERIENCE_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'];
const MATCH_PREFERENCES = ['Any', 'Male', 'Female', 'Other'];
const BIO_CHAR_LIMIT = 300;
const GOALS = ['General Fitness', 'Lose Weight', 'Build Muscle', 'Endurance', 'Powerlifting', 'Bodybuilding'];

// NEW: canonical workout time options (multiselect)
const WORKOUT_TIMES = ['Morning', 'Noon', 'Afternoon', 'Evening', 'Night'];
const normalizeTimeLabel = (v) => {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  const map = {
    morning: 'Morning',
    noon: 'Noon',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Night',
  };
  return map[s] || null;
};

// DOB helpers
const now = new Date();
const THIS_YEAR = now.getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => THIS_YEAR - 13 - i); // 13yo min
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

const initialState = {
  name: '',
  username: '', // restore username field
  photoUrl: '',
  gender: '',
  birthday: '',
  height: '',
  weight: '',
  benchPress: '',
  squat: '',
  experience: '',
  gym: '',
  goal: '',
  // REPLACED: preferredTime (string) -> preferredTimes (array)
  preferredTimes: [],
  bio: '',
  instagram: '',
  preferredMatchGender: '',
};

const StepIndicator = ({ step }) => (
  <View style={styles.stepRow}>
    {[1, 2, 3, 4].map((s) => (
      <View key={s} style={[styles.stepDot, step === s && styles.stepDotActive]} />
    ))}
  </View>
);

export default function AccountSetupScreen() {
  const navigation = useNavigation();
  const {
    currentUser,
    userProfile,
    setUserProfile,
    setNeedsOnboarding,
  } = useAuth();
  const uid = currentUser?.uid;
  const scope = uid ? { scope: uid } : undefined;

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialState);
  const [saving, setSaving] = useState(false);

  // DOB picker states
  const [dobYear, setDobYear] = useState(null);
  const [dobMonth, setDobMonth] = useState(null);
  const [dobDay, setDobDay] = useState(null);

  // Pre-populate username/photo/etc. (+ migrate legacy preferredTime -> preferredTimes)
  useEffect(() => {
    if (!userProfile) return;

    // migrate legacy single value if present
    const legacyTime = userProfile.preferredTime;
    const incomingTimes = Array.isArray(userProfile.preferredTimes)
      ? userProfile.preferredTimes
      : legacyTime
      ? [legacyTime]
      : [];

    const normalizedTimes = Array.from(
      new Set(incomingTimes.map(normalizeTimeLabel).filter(Boolean))
    );

    setForm((prev) => ({
      ...prev,
      name: userProfile.name || prev.name,
      username: userProfile.username || prev.username,
      photoUrl: userProfile.photoUrl || prev.photoUrl,
      gender: userProfile.gender || prev.gender,
      birthday: userProfile.birthday || prev.birthday,
      height: userProfile.height || prev.height,
      weight: userProfile.weight || prev.weight,
      benchPress: userProfile.benchPress || prev.benchPress,
      squat: userProfile.squat || prev.squat,
      experience: userProfile.experience || prev.experience,
      gym: userProfile.gym || prev.gym,
      goal: userProfile.goal || prev.goal,
      preferredTimes: normalizedTimes.length ? normalizedTimes : prev.preferredTimes,
      bio: userProfile.bio || prev.bio,
      instagram: userProfile.instagram || prev.instagram,
      preferredMatchGender: userProfile.preferredMatchGender || prev.preferredMatchGender,
    }));

    const b = (userProfile?.birthday || '').trim();
    if (b && /^\d{4}-\d{2}-\d{2}$/.test(b)) {
      const [y, m, d] = b.split('-').map((s) => parseInt(s, 10));
      setDobYear(y || null);
      setDobMonth(m || null);
      setDobDay(d || null);
    }
  }, [userProfile, currentUser?.email]);

  // Keep birthday in sync as three pickers change
  useEffect(() => {
    const maxDay = daysInMonth(dobYear, dobMonth);
    if (dobDay && dobDay > maxDay) setDobDay(maxDay);
    if (dobYear && dobMonth && dobDay) {
      updateField('birthday', `${dobYear}-${pad2(dobMonth)}-${pad2(dobDay)}`);
    } else {
      updateField('birthday', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dobYear, dobMonth, dobDay]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Toggle multiselect preferred times
  const togglePreferredTime = (label) => {
    const canon = normalizeTimeLabel(label);
    if (!canon) return;
    setForm((prev) => {
      const cur = Array.isArray(prev.preferredTimes) ? prev.preferredTimes : [];
      const has = cur.includes(canon);
      const next = has ? cur.filter((t) => t !== canon) : [...cur, canon];
      return { ...prev, preferredTimes: next };
    });
  };

  // SAFER image picker/uploader (resizes → JPEG → resumable upload)
  const pickProfilePhoto = async () => {
    if (!currentUser || !currentUser.uid) {
      Alert.alert('Not signed in', 'You must be signed in to upload a profile photo.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to upload a profile image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.length && uid) {
      try {
        setSaving(true);
        const asset = result.assets[0];
        // Resize/compress image
        const manipResult = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 512, height: 512 } }],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        const response = await fetch(manipResult.uri);
        const blob = await response.blob();
        const fileRefPath = `users/${uid}/profile.jpg`;
        const fileRef = ref(storage, fileRefPath);
        const uploadTask = uploadBytesResumable(fileRef, blob, { contentType: blob.type || 'image/jpeg' });
        await uploadTask;
        const url = await getDownloadURL(fileRef);
        updateField('photoUrl', url);
        await setDoc(doc(db, 'users', uid), { photoUrl: url }, { merge: true });
      } catch (error) {
        console.log('Profile photo upload error:', error);
        if (error && error.serverResponse) console.log('Server response:', error.serverResponse);
        Alert.alert('Upload failed', error?.message || 'Unable to upload photo.');
      } finally {
        setSaving(false);
      }
    }
  };

  // Step validation
  const validateStep = async () => {
    if (step === 1) {
      if (!form.gender) {
        Alert.alert('Gender required', 'Select your gender.');
        return false;
      }
      if (!form.birthday) {
        Alert.alert('Birthday required', 'Select your birthday.');
        return false;
      }
      const parsed = new Date(form.birthday);
      if (Number.isNaN(parsed.getTime())) {
        Alert.alert('Invalid birthday', 'Please select a valid date.');
        return false;
      }
      const today = new Date();
      const age = today.getFullYear() - parsed.getFullYear() -
        ((today.getMonth() < parsed.getMonth() || (today.getMonth() === parsed.getMonth() && today.getDate() < parsed.getDate())) ? 1 : 0);
      if (parsed > today) {
        Alert.alert('Invalid birthday', 'Birthday cannot be in the future.');
        return false;
      }
      if (age < 13) {
        Alert.alert('Age restriction', 'You must be at least 13 years old.');
        return false;
      }
    }
    return true;
  };

  const nextStep = async () => {
    const ok = await validateStep();
    if (!ok) return;
    setStep((prev) => Math.min(prev + 1, 4));
  };

  const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

  // Finalize onboarding
  const finish = async () => {
    if (!uid || saving) return;
    const cleanHandle = cleanUsername(form.username);
    if (!cleanHandle) {
      Alert.alert('Username required', 'Enter a username before finishing.');
      return;
    }
    try {
      setSaving(true);
      const oldUsername = userProfile?.username;
      const result = await assignUsername(uid, cleanHandle, currentUser?.email || null);
      const finalHandle = result?.username || cleanHandle;
      await ensureUsernameRecord(finalHandle, uid, currentUser?.email || null);
      if (oldUsername && oldUsername !== finalHandle) {
        await deleteDoc(doc(db, 'usernames', oldUsername));
      }

      // normalize preferredTimes before save
      const prefTimes = Array.from(
        new Set((Array.isArray(form.preferredTimes) ? form.preferredTimes : [])
          .map(normalizeTimeLabel)
          .filter(Boolean))
      );

      const profilePayload = {
        username: finalHandle,
        name: form.name || '',
        photoUrl: form.photoUrl || '',
        gender: form.gender || '',
        birthday: form.birthday || '',
        height: form.height || '',
        weight: form.weight || '',
        benchPress: form.benchPress || '',
        squat: form.squat || '',
        experience: form.experience || '',
        gym: form.gym || '',
        goal: form.goal || '',
        preferredTimes: prefTimes, // <-- array saved
        instagram: form.instagram || '',
        bio: (form.bio || '').slice(0, BIO_CHAR_LIMIT),
        preferredMatchGender: form.preferredMatchGender || '',
        onboarded: true,
        updatedAt: Date.now(),
      };

      await setDoc(doc(db, 'users', uid), profilePayload, { merge: true });
      if (scope) {
        await setJSON('myProfile', profilePayload, scope);
      }
      if (setUserProfile) {
        setUserProfile((prev) => ({ ...(prev || {}), ...profilePayload }));
      }
      if (setNeedsOnboarding) setNeedsOnboarding(false);
      // Optionally navigate:
      // navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    } catch (error) {
      Alert.alert('Setup failed', error?.message || 'We could not finish setting up your account.');
    } finally {
      setSaving(false);
    }
  };

  // Render steps
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View>
            <Text style={styles.heading}>Step 1 of 4</Text>
            <Text style={styles.subheading}>Set up your basic info</Text>
            <Pressable style={styles.photoCircle} onPress={pickProfilePhoto}>
              {form.photoUrl ? (
                <Image source={{ uri: form.photoUrl }} style={styles.photoCircle} />
              ) : (
                <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                  <Text style={styles.photoPlaceholder}>Add Photo</Text>
                </View>
              )}
            </Pressable>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                value={form.name}
                onChangeText={(t) => updateField('name', t)}
                placeholder="Your name"
                style={styles.input}
              />
            </View>

            {/* Birthday Pickers */}
            <View style={styles.formGroup}>
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

            <View style={styles.formGroup}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.pickerRow}>
                {['Male', 'Female', 'Other'].map((option) => (
                  <Pressable
                    key={option}
                    style={[styles.choiceChip, form.gender === option && styles.choiceChipActive]}
                    onPress={() => setForm((prev) => ({ ...prev, gender: option }))}
                  >
                    <Text style={[styles.choiceText, form.gender === option && styles.choiceTextActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                value={form.username}
                onChangeText={(t) => updateField('username', t)}
                placeholder="Username"
                style={styles.input}
                autoCapitalize="none"
              />
            </View>
          </View>
        );
      case 2:
        return (
          <View>
            <Text style={styles.heading}>Step 2 of 4</Text>
            <Text style={styles.subheading}>Share your stats</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                value={form.height}
                onChangeText={(t) => setForm((p) => ({ ...p, height: t }))}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Weight (lbs)</Text>
              <TextInput
                value={form.weight}
                onChangeText={(t) => setForm((p) => ({ ...p, weight: t }))}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Bench Press (lbs)</Text>
              <TextInput
                value={form.benchPress}
                onChangeText={(t) => setForm((p) => ({ ...p, benchPress: t }))}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Squat (lbs)</Text>
              <TextInput
                value={form.squat}
                onChangeText={(t) => setForm((p) => ({ ...p, squat: t }))}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Experience Level</Text>
              <View style={styles.pickerRow}>
                {EXPERIENCE_OPTIONS.map((option) => (
                  <Pressable
                    key={option}
                    style={[styles.choiceChip, form.experience === option && styles.choiceChipActive]}
                    onPress={() => setForm((p) => ({ ...p, experience: option }))}
                  >
                    <Text style={[styles.choiceText, form.experience === option && styles.choiceTextActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Gym</Text>
              <TextInput
                value={form.gym}
                onChangeText={(t) => setForm((p) => ({ ...p, gym: t }))}
                placeholder="Gold's Gym"
                style={styles.input}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Primary Goal</Text>
              <View style={styles.pickerBox}>
                <Picker
                  selectedValue={form.goal}
                  onValueChange={(value) => setForm((p) => ({ ...p, goal: value }))}
                >
                  <Picker.Item label="Select" value="" style={styles.pickerItem} />
                  {GOALS.map((goal) => (
                    <Picker.Item key={goal} label={goal} value={goal} style={styles.pickerItem} />
                  ))}
                </Picker>
              </View>
            </View>

            {/* NEW: Preferred Workout Times (multiselect chips) */}
            <View className="formGroup" style={styles.formGroup}>
              <Text style={styles.label}>Preferred Workout Times</Text>
              <View style={styles.pickerRow}>
                {WORKOUT_TIMES.map((option) => {
                  const active = Array.isArray(form.preferredTimes) && form.preferredTimes.includes(option);
                  return (
                    <Pressable
                      key={option}
                      style={[styles.choiceChip, active && styles.choiceChipActive]}
                      onPress={() => togglePreferredTime(option)}
                    >
                      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.infoText}>
                {form.preferredTimes.length
                  ? `Selected: ${form.preferredTimes.join(', ')}`
                  : 'Select as many as apply'}
              </Text>
            </View>
          </View>
        );
      case 3:
        return (
          <View>
            <Text style={styles.heading}>Step 3 of 4</Text>
            <Text style={styles.subheading}>Tell others about you</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                multiline
                value={form.bio}
                onChangeText={(t) => setForm((p) => ({ ...p, bio: t.slice(0, BIO_CHAR_LIMIT) }))}
                style={[styles.input, styles.textarea]}
                placeholder="Your training style, schedule, favorite lifts..."
                maxLength={BIO_CHAR_LIMIT}
              />
              <Text style={styles.charCount}>{(form.bio || '').length}/{BIO_CHAR_LIMIT}</Text>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Instagram</Text>
              <TextInput
                value={form.instagram}
                onChangeText={(t) => setForm((p) => ({ ...p, instagram: t }))}
                placeholder="@username"
                style={styles.input}
                autoCapitalize="none"
              />
            </View>
          </View>
        );
      case 4:
        return (
          <View>
            <Text style={styles.heading}>Step 4 of 4</Text>
            <Text style={styles.subheading}>Who do you want to match with?</Text>
            <View style={styles.pickerRow}>
              {MATCH_PREFERENCES.map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.choiceChipLarge,
                    (form.preferredMatchGender || 'Any') === option && styles.choiceChipActive,
                  ]}
                  onPress={() =>
                    setForm((p) => ({ ...p, preferredMatchGender: option === 'Any' ? '' : option }))
                  }
                >
                  <Text
                    style={[
                      styles.choiceText,
                      styles.choiceTextLarge,
                      (form.preferredMatchGender || 'Any') === option && styles.choiceTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <StepIndicator step={step} />
            {renderStep()}
          </ScrollView>
          <View style={styles.navRow}>
            {step > 1 ? (
              <Pressable style={[styles.navButton, styles.navSecondary]} onPress={() => setStep((p) => Math.max(p - 1, 1))} disabled={saving}>
                <Text style={styles.navButtonText}>Back</Text>
              </Pressable>
            ) : <View style={{ flex: 1 }} />}
            <View style={{ width: 12 }} />
            <Pressable
              style={[styles.navButton, saving && { opacity: 0.7 }]}
              onPress={step === 4 ? finish : nextStep}
              disabled={saving}
            >
              <Text style={styles.navButtonText}>
                {step === 4 ? 'Done' : step === 3 ? 'Preferences' : 'Next'}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 32, gap: 16 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  subheading: { color: '#d1d5db', marginBottom: 16 },
  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 12 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.3)' },
  stepDotActive: { backgroundColor: '#fff' },
  formGroup: { marginBottom: 16 },
  label: { color: '#d1d5db', marginBottom: 6, fontWeight: '600' },
  input: { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#111827' },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  charCount: { color: '#9ca3af', fontSize: 12, textAlign: 'right', marginTop: 4 },
  infoText: { color: '#9ca3af', marginTop: 4 },
  errorText: { color: '#fca5a5', marginTop: 4 },
  photoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    alignSelf: 'center',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  photoPlaceholder: { color: '#fff', fontWeight: '700' },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  choiceChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'transparent' },
  choiceChipLarge: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'transparent' },
  choiceChipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  choiceText: { color: '#fff', fontWeight: '600' },
  choiceTextLarge: { fontSize: 16 },
  choiceTextActive: { color: '#111827' },
  navRow: { flexDirection: 'row', padding: 16, paddingBottom: 24 },
  navButton: { flex: 1, backgroundColor: '#111827', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  navSecondary: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  navButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  pickerBox: { backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  dobRow: { flexDirection: 'row', gap: 8 },
  dobPicker: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    overflow: 'hidden',
    height: 60,
    justifyContent: 'center',
  },
  dobPickerWide: {
    flex: 1.4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    overflow: 'hidden',
    height: 60,
    justifyContent: 'center',
  },
  pickerItem: { fontSize: 16 },
});