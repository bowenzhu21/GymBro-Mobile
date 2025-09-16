import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ImageBackground, Alert } from 'react-native';
import { doCreateUserWithEmailAndPassword } from '../firebase/auth';
import { auth } from '../firebase/firebase';
import { assignUsername, cleanUsername, checkUsernameAvailable } from '../utils/username';

const bg = require('../../assets/pic1.jpg');

export default function AuthRegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const clean = cleanUsername(username);
      if (!username) {
        if (active) setCheckingUsername(false);
        if (active) setUsernameStatus(null);
        return;
      }
      if (!clean) {
        if (active) setCheckingUsername(false);
        if (active) setUsernameStatus('invalid');
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
    return () => { active = false; };
  }, [username]);

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
        const desiredHandle = cleanUsername(username);
        const { username: finalHandle, wasRandom } = await assignUsername(user.uid, username, email.trim());
        if (wasRandom) {
          const message = desiredHandle && desiredHandle !== finalHandle
            ? `That handle was taken, so we reserved "${finalHandle}" for you.`
            : `We reserved the username "${finalHandle}" for you.`;
          Alert.alert('Username assigned', message);
        }
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
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
        <TextInput
        value={username}
        onChangeText={setUsername}
        placeholder="Username (letters, numbers, underscore)"
        autoCapitalize="none"
        style={styles.input}
      />
        {usernameStatus === 'invalid' && (
          <Text style={styles.usernameError}>Usernames can only use letters, numbers, and underscores.</Text>
        )}
        {usernameStatus === 'taken' && (
          <Text style={styles.usernameWarning}>That username is taken. We'll generate one for you unless you choose a different handle.</Text>
        )}
        {usernameStatus === 'available' && (
          <Text style={styles.usernameOk}>{checkingUsername ? 'Checking…' : 'Nice! That username is available.'}</Text>
        )}
        <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />
        <TextInput
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Confirm Password"
        secureTextEntry
        style={styles.input}
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
  usernameError: { color: '#fff', marginTop: -8, marginBottom: 8 },
  usernameWarning: { color: '#fff', marginTop: -8, marginBottom: 8 },
  usernameOk: { color: '#fff', marginTop: -8, marginBottom: 8 },
});
