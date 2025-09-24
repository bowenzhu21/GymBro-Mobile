import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/authContext';
import { useUsersDirectory } from '../hooks/useUsersDirectory';
import { matchIdFor, sendMatchMessage, subscribeToMatchMessages, createMatch } from '../utils/matches';

const bg = require('../../assets/pic1.jpg');

export default function ChatRoomScreen({ route, navigation }) {
  const { userId, user: initialUser, matchId: providedMatchId } = route.params;
  const { currentUser } = useAuth();
  const { userMap } = useUsersDirectory();

  const resolvedUser = useMemo(() => {
    if (initialUser?.id) return initialUser;
    return userMap.get(userId) || null;
  }, [initialUser, userMap, userId]);

  const matchId = useMemo(() => {
    if (providedMatchId) return providedMatchId;
    if (!currentUser?.uid || !userId) return null;
    return matchIdFor(currentUser.uid, userId);
  }, [providedMatchId, currentUser?.uid, userId]);

  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: resolvedUser ? resolvedUser.name : 'Chat' });
  }, [navigation, resolvedUser]);

  useEffect(() => {
    if (!currentUser?.uid || !matchId) {
      setMessages([]);
      return () => {};
    }
    const unsub = subscribeToMatchMessages(
      matchId,
      (snapshot) => {
        const next = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : Number(data.createdAt) || 0;
          next.push({
            id: docSnap.id,
            senderId: data.senderId || null,
            text: data.text || '',
            createdAt,
          });
        });
        setMessages(next);
      },
      (error) => {
        console.warn('Failed to load conversation', error);
        setMessages([]);
      }
    );
    return () => unsub?.();
  }, [matchId, currentUser?.uid]);

  const send = async () => {
    if (!text.trim() || !currentUser?.uid || !matchId) return;
    const content = text.trim();
    setText('');
    setSending(true);
    try {
      await createMatch(currentUser.uid, userId);
      await sendMatchMessage(matchId, currentUser.uid, { text: content });
    } catch (error) {
      console.error('Failed to send message', error);
      Alert.alert('Message failed', error?.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }) => {
    const mine = item.senderId === currentUser?.uid;
    return (
      <View style={[styles.bubble, mine ? styles.me : styles.them]}>
        <Text style={[styles.bubbleText, !mine && { color: '#111827' }]}>{item.text}</Text>
      </View>
    );
  };

  return (
    <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={insets.top + 8}
          >
            <View style={{ flex: 1 }}>
              {resolvedUser && (
                <Pressable style={styles.chatHeader} onPress={() => navigation.navigate('UserProfile', { user: resolvedUser })}>
                  <Image
                    source={resolvedUser?.photoUrl ? { uri: resolvedUser.photoUrl } : require('../images/user.jpg')}
                    style={styles.chatAvatar}
                  />
                  <View>
                    <Text style={styles.chatName}>{resolvedUser?.name || 'Gym Bro'}</Text>
                    <Text style={styles.chatHandle}>
                      {resolvedUser?.username ? `@${String(resolvedUser.username).replace(/^@/, '')}` : ''}
                    </Text>
                  </View>
                </Pressable>
              )}
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(x) => String(x.id)}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 16, gap: 8 }}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
              />
            </View>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Message"
                placeholderTextColor="#9ca3af"
                value={text}
                onChangeText={setText}
                returnKeyType="send"
                onSubmitEditing={send}
                editable={!sending}
              />
              <Pressable style={[styles.sendBtn, sending && { opacity: 0.65 }]} onPress={send} disabled={sending}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{sending ? 'Sending…' : 'Send'}</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '75%', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16 },
  me: { backgroundColor: '#111827', alignSelf: 'flex-end' },
  them: { backgroundColor: 'rgba(255,255,255,0.85)', alignSelf: 'flex-start' },
  bubbleText: { color: '#fff' },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: 'rgba(27,27,30,0.9)' },
  input: { flex: 1, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  sendBtn: { backgroundColor: '#2563eb', paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  chatAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb' },
  chatName: { color: '#fff', fontWeight: '700', fontSize: 18 },
  chatHandle: { color: '#d8dbe3' },
});
