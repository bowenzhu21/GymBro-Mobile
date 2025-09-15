import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ImageBackground } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getJSON, setJSON } from '../utils/storage';
import { sampleUsers } from '../utils/match';

const bg = require('../../assets/pic1.jpg');

export default function ChatRoomScreen({ route, navigation }) {
  const { userId } = route.params;
  const user = sampleUsers.find(u => u.id === userId);
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const listRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: user ? user.name : 'Chat' });
  }, [navigation, user]);

  useEffect(() => {
    (async () => {
      const initial = await getJSON(`chat:${userId}`, []);
      setMessages(initial);
    })();
  }, [userId]);

  const send = async () => {
    if (!text.trim()) return;
    const msg = { id: Date.now(), from: 'me', text: text.trim(), ts: Date.now() };
    const next = [...messages, msg];
    setMessages(next);
    setText('');
    await setJSON(`chat:${userId}`, next);
  };

  const renderItem = ({ item }) => {
    const mine = item.from === 'me';
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
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={insets.top + 8}>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(x) => String(x.id)}
              renderItem={renderItem}
              contentContainerStyle={{ padding: 16, gap: 8 }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            />
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Message"
                placeholderTextColor="#9ca3af"
                value={text}
                onChangeText={setText}
                returnKeyType="send"
                onSubmitEditing={send}
              />
              <Pressable style={styles.sendBtn} onPress={send}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>
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
});
