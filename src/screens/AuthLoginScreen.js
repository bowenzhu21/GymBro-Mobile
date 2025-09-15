import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { doSignInWithEmailAndPassword } from '../firebase/auth';

const bg = require('../../assets/pic1.jpg');

export default function AuthLoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    if (isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await doSignInWithEmailAndPassword(email.trim(), password);
    } catch (e) {
      setError(e?.message || 'Sign in failed');
      setIsSubmitting(false);
    }
  };

  return (
    <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: 'rgba(0,0,0,0.35)', flex: 1 }] }>
        <Text style={[styles.title, { color: '#fff' }]}>Welcome Back</Text>
        <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
        <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable onPress={onSubmit} disabled={isSubmitting} style={styles.button}>
          <Text style={styles.buttonText}>{isSubmitting ? 'Signing In...' : 'Sign In'}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>Don’t have an account? Sign up</Text>
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
  link: { marginTop: 12, textAlign: 'center', color: '#2563eb', fontWeight: '600' },
  error: { color: '#b91c1c', marginBottom: 12, textAlign: 'center' },
});
