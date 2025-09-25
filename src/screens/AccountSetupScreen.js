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
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/authContext';
import { cleanUsername, checkUsernameAvailable, assignUsername, ensureUsernameRecord } from '../utils/username';
import { setJSON } from '../utils/storage';
import { storage, db } from '../firebase/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { Picker } from '@react-native-picker/picker';

const bg = require('../../assets/backgroundImageMe.jpg');

const EXPERIENCE_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'];
const MATCH_PREFERENCES = ['Any', 'Male', 'Female', 'Other'];
const BIO_CHAR_LIMIT = 300;
const GOALS = ['General Fitness', 'Lose Weight', 'Build Muscle', 'Endurance', 'Powerlifting', 'Bodybuilding'];
const WORKOUT_TIMES = ['Morning', 'Afternoon', 'Evening', 'Weekends'];

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
  username: '',
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
  preferredTime: '',
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
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [saving, setSaving] = useState(false);

  // DOB picker states
  const [dobYear, setDobYear] = useState(null);
  const [dobMonth, setDobMonth] = useState(null);
  const [dobDay, setDobDay] = useState(null);

  // Restore logic to pre-populate username from userProfile or email
  useEffect(() => {
    if (!userProfile) return;
    setForm((prev) => ({
      ...prev,
      username: userProfile.username || generateUsernameFromEmail(currentUser?.email) || prev.username,
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
      preferredTime: userProfile.preferredTime || prev.preferredTime,
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
  }, [userProfile]);

  useEffect(() => {
    const clean = cleanUsername(form.username);
    if (!form.username) {
      setUsernameStatus(null);
      setCheckingUsername(false);
      return;
    }
    if (!clean) {
      setUsernameStatus('invalid');
      setCheckingUsername(false);
      return;
    }
    if (userProfile?.username && clean === cleanUsername(userProfile.username)) {
      setUsernameStatus('current');
      setCheckingUsername(false);
      return;
    }
    let active = true;
    setCheckingUsername(true);
    checkUsernameAvailable(clean)
      .then((available) => {
        if (!active) return;
        setUsernameStatus(available ? 'available' : 'taken');
      })
      .finally(() => {
        if (active) setCheckingUsername(false);
      });
    return () => {
      active = false;
    };
  }, [form.username, userProfile]);

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

  const pickProfilePhoto = async () => {
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
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const fileRef = ref(storage, `users/${uid}/profile.jpg`);
        await uploadBytes(fileRef, blob, { contentType: blob.type || 'image/jpeg' });
        const url = await getDownloadURL(fileRef);
        updateField('photoUrl', url);
      } catch (error) {
        Alert.alert('Upload failed', error?.message || 'Unable to upload photo.');
      } finally {
        setSaving(false);
      }
    }
  };

  const validateStep = async () => {
    if (step === 1) {
      const clean = cleanUsername(form.username);
      if (!clean) {
        Alert.alert('Username required', 'Enter a username using letters, numbers, or underscores.');
        return false;
      }
      if (usernameStatus === 'taken') {
        Alert.alert('Username unavailable', 'Please choose another username.');
        return false;
      }
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

  const finish = async () => {
    if (!uid || saving) return;
    const cleanHandle = cleanUsername(form.username);
    if (!cleanHandle) {
      Alert.alert('Username required', 'Enter a username before finishing.');
      return;
    }
    try {
      setSaving(true);
      const result = await assignUsername(uid, cleanHandle, currentUser?.email || null);
      const finalHandle = result?.username || cleanHandle;
      await ensureUsernameRecord(finalHandle, uid, currentUser?.email || null);

      const profilePayload = {
        username: finalHandle,
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
        preferredTime: form.preferredTime || '',
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

      // Optional: navigate to main app
      // navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    } catch (error) {
      Alert.alert('Setup failed', error?.message || 'We could not finish setting up your account.');
    } finally {
      setSaving(false);
    }
  };

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
                <Text style={styles.photoPlaceholder}>Add Photo</Text>
              )}
            </Pressable>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                value={form.username}
                onChangeText={(t) => updateField('username', t)}
                autoCapitalize="none"
                placeholder="gymbro123"
                style={styles.input}
              />
              {checkingUsername && <Text style={styles.infoText}>Checking availability…</Text>}
              {!checkingUsername && usernameStatus === 'invalid' && (
                <Text style={styles.errorText}>Use only letters, numbers, and underscores.</Text>
              )}
              {!checkingUsername && usernameStatus === 'taken' && (
                <Text style={styles.errorText}>That username is taken.</Text>
              )}
            </View>

            {/* Birthday Pickers */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Birthday</Text>
              <View style={styles.dobRow}>
                {/* Month */}
                <View style={styles.dobPicker}>
                  <Picker
                    selectedValue={dobMonth}
                    onValueChange={(v) => setDobMonth(v)}
                  >
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
                  <Picker
                    selectedValue={dobYear}
                    onValueChange={(v) => setDobYear(v)}
                  >
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
                    onPress={() => updateField('gender', option)}
                  >
                    <Text style={[styles.choiceText, form.gender === option && styles.choiceTextActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
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
                onChangeText={(t) => updateField('height', t)}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Weight (lbs)</Text>
              <TextInput
                value={form.weight}
                onChangeText={(t) => updateField('weight', t)}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Bench Press (lbs)</Text>
              <TextInput
                value={form.benchPress}
                onChangeText={(t) => updateField('benchPress', t)}
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Squat (lbs)</Text>
              <TextInput
                value={form.squat}
                onChangeText={(t) => updateField('squat', t)}
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
                    onPress={() => updateField('experience', option)}
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
                onChangeText={(t) => updateField('gym', t)}
                placeholder="Gold's Gym"
                style={styles.input}
              />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Primary Goal</Text>
              <View style={styles.pickerBox}>
                <Picker
                  selectedValue={form.goal}
                  onValueChange={(value) => updateField('goal', value)}
                >
                  <Picker.Item label="Select" value="" style={styles.pickerItem} />
                  {GOALS.map((goal) => (
                    <Picker.Item key={goal} label={goal} value={goal} style={styles.pickerItem} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Preferred Workout Time</Text>
              <View style={styles.pickerRow}>
                {WORKOUT_TIMES.map((option) => (
                  <Pressable
                    key={option}
                    style={[styles.choiceChip, form.preferredTime === option && styles.choiceChipActive]}
                    onPress={() => updateField('preferredTime', option)}
                  >
                    <Text style={[styles.choiceText, form.preferredTime === option && styles.choiceTextActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
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
                onChangeText={(t) => updateField('bio', t.slice(0, BIO_CHAR_LIMIT))}
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
                onChangeText={(t) => updateField('instagram', t)}
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
                  onPress={() => updateField('preferredMatchGender', option === 'Any' ? '' : option)}
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
              <Pressable style={[styles.navButton, styles.navSecondary]} onPress={prevStep} disabled={saving}>
                <Text style={styles.navButtonText}>Back</Text>
              </Pressable>
            ) : <View style={{ flex: 1 }} />}
            <View style={{ width: 12 }} />
            <Pressable
              style={[styles.navButton, saving && { opacity: 0.7 }]}
              onPress={step === 4 ? finish : nextStep}
              disabled={saving || (step === 1 && checkingUsername)}
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
  photoCircle: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', alignSelf: 'center', marginBottom: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.2)' },
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

  // Picker container for Goal
  pickerBox: { backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },

  // DOB pickers (compact)
  dobRow: { flexDirection: 'row', gap: 8 },
  dobPicker: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    overflow: 'hidden',
    height: 60, // ensure enough height for scrolling
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
  pickerItem: {
    fontSize: 16,
    // Removed textAlign: 'center' for better dropdown formatting
  },
});