import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ImageBackground, Alert } from 'react-native';
import { doCreateUserWithEmailAndPassword } from '../firebase/auth';
import { auth } from '../firebase/firebase';

const bg = require('../../assets/pic1.jpg');

export default function AuthRegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    if (isSubmitting) return;
    setError('');
    if (!email || !password || password !== confirm) {
      setError('Please enter a valid email and matching passwords.');
      return;
    }
    setIsSubmitting(true);
    try {
      const cred = await doCreateUserWithEmailAndPassword(email.trim(), password);
      const user = cred?.user || auth.currentUser;
      if (user) {
        // Restore logic to assign default username during registration
        const username = generateUsernameFromEmail(email);
        // Assign username to user profile or Firestore
        // Onboarding flow will collect profile details next
      }
    } catch (e) {
      setError(e?.message || 'Sign up failed');
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.35)', flex: 1 }] }>
        <Text style={[styles.title, { color: '#fff' }]}>Create a New Account</Text>
        <TextInput
  value={email}
  onChangeText={setEmail}
  placeholder="Email"
  placeholderTextColor="#aaa"   // light gray, or use "white" if you want pure white
  autoCapitalize="none"
  keyboardType="email-address"
  style={[styles.input, { color: 'white' }]}
/>

<TextInput
  value={password}
  onChangeText={setPassword}
  placeholder="Password"
  placeholderTextColor="#aaa"   // or "white" if you prefer pure white
  style={[styles.input, { color: 'white' }]}
/>

<TextInput
  value={confirm}
  onChangeText={setConfirm}
  placeholder="Confirm Password"
  placeholderTextColor="#aaa"
  style={[styles.input, { color: 'white' }]}
/>
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable onPress={onSubmit} disabled={isSubmitting} style={styles.button}>
          <Text style={styles.buttonText}>{isSubmitting ? 'Signing Up...' : 'Sign Up'}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Already have an account? Continue</Text>
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginBottom: 12 },
  button: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  link: { marginTop: 12, textAlign: 'center', color: '#fff', fontWeight: '600' },
  error: { color: '#fff', marginBottom: 12, textAlign: 'center' },
});
