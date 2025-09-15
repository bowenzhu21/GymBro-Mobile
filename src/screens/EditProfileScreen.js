import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getJSON, setJSON } from '../utils/storage';

const hero = require('../../assets/backgroundImageMe.jpg');

const initial = {
  name: '', age: '', gender: '', height: '', weight: '', benchPress: '', squat: '', legPress: '',
  gym: '', city: '', experience: '', goal: '', preferredTime: '', instagram: '', contactEmail: ''
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

  return (
    <ImageBackground source={hero} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', position: 'relative' }}>
          <ScrollView style={{ zIndex: 2 }} contentContainerStyle={styles.container}>
          <Text style={styles.title}>Update Profile</Text>
          <View style={styles.card}>
            <View style={styles.grid}> 
              <Field label="Name" k="name" />
              <Field label="Age" k="age" keyboardType="number-pad" />
              <Field label="Gender" k="gender" />
              <Field label="Experience" k="experience" />
              <Field label="Height (cm)" k="height" keyboardType="number-pad" />
              <Field label="Weight (lbs)" k="weight" keyboardType="number-pad" />
              <Field label="Bench (lbs)" k="benchPress" keyboardType="number-pad" />
              <Field label="Squat (lbs)" k="squat" keyboardType="number-pad" />
              <Field label="Leg Press (lbs)" k="legPress" keyboardType="number-pad" />
              <Field label="Gym" k="gym" />
              <Field label="City" k="city" />
              <Field label="Goal" k="goal" />
              <Field label="Preferred Time" k="preferredTime" />
              <Field label="Instagram" k="instagram" />
              <Field label="Contact Email" k="contactEmail" keyboardType="email-address" />
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
});
