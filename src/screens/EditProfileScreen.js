import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getJSON, setJSON } from '../utils/storage';
import * as ImagePicker from 'expo-image-picker';
import { uploadProfilePhoto } from '../utils/storageUpload';

const hero = require('../../assets/backgroundImageMe.jpg');

const BIO_CHAR_LIMIT = 300;

const initial = {
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

export default function EditProfileScreen({ navigation }) {
  const [current, setCurrent] = useState(initial);

  useEffect(() => { (async () => {
    const saved = await getJSON('myProfile', initial);
    setCurrent(saved || initial);
  })(); }, []);

  const onSave = async () => {
    await setJSON('myProfile', current);
    navigation.goBack();
  };

  const set = (k, v) => setCurrent((c) => ({ ...c, [k]: v }));

  const Field = ({ label, k, keyboardType='default' }) => (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={String(current[k] ?? '')} onChangeText={(t)=> set(k, t)} style={styles.input} keyboardType={keyboardType} />
    </View>
  );

  // Example function for picking and uploading profile photo
  async function pickAndUploadProfilePhoto(user, setUploadProgress) {
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: [ImagePicker.MediaType.Images],
      allowsEditing: true,
      quality: 0.9,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const manipulatedUri = asset.uri;
      // Upload and track progress
      const { url } = await uploadProfilePhoto(user.uid, manipulatedUri, {
        onProgress: p => setUploadProgress?.(p),
      });
      // Save url to Firestore or user profile doc here
      return url;
    }
    return null;
  }

  return (
    <ImageBackground source={hero} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', position: 'relative' }}>
          <ScrollView style={{ zIndex: 2 }} contentContainerStyle={styles.container}>
          <Text style={styles.title}>Update Profile</Text>
          <View style={styles.card}>
            <View style={styles.grid}> 
              <Field label="Name" k="name" />
              <Field label="Experience" k="experience" />
              <Field label="Height (cm)" k="height" keyboardType="number-pad" />
              <Field label="Weight (lbs)" k="weight" keyboardType="number-pad" />
              <Field label="Bench Press (lbs)" k="benchPress" keyboardType="number-pad" />
              <Field label="Squat (lbs)" k="squat" keyboardType="number-pad" />
              <Field label="Gym" k="gym" />
              <Field label="City" k="city" />
              <Field label="Goal" k="goal" />
              <Field label="Preferred Time" k="preferredTime" />
              <Field label="Instagram" k="instagram" />
              <Field label="Contact Email" k="contactEmail" keyboardType="email-address" />
              <View style={styles.formGroup}>
                <Text style={styles.label}>Bio</Text>
                <TextInput
                  value={String(current.bio ?? '')}
                  onChangeText={(t) => set('bio', t.slice(0, BIO_CHAR_LIMIT))}
                  style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
                  multiline
                  maxLength={BIO_CHAR_LIMIT}
                />
                <Text style={styles.charCount}>{(current.bio || '').length}/{BIO_CHAR_LIMIT}</Text>
              </View>
            </View>
            <Pressable style={styles.button} onPress={onSave}>
              <Text style={styles.buttonText}>Save</Text>
            </Pressable>
          </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 12 },
  card: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 12, padding: 16 },
  grid: { gap: 8 },
  formGroup: {},
  label: { color: '#d8dbe3', marginBottom: 4 },
  input: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  button: { marginTop: 12, backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  charCount: { color: '#9ca3af', fontSize: 12, textAlign: 'right', marginTop: 4 },
});
