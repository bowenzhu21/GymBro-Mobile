// gb-mobile/src/screens/ChatsScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ImageBackground, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/authContext';
import { useUsersDirectory } from '../hooks/useUsersDirectory';
import { subscribeToUserMatches } from '../utils/matches';

const hero = require('../../assets/pic1.jpg');

export default function ChatsScreen({ navigation }) {
  const [matches, setMatches] = useState([]);
  const [query, setQuery] = useState('');
  const { currentUser } = useAuth();
  const { userMap } = useUsersDirectory();

  useEffect(() => {
    if (!currentUser?.uid) {
      setMatches([]);
      return () => {};
    }
    const unsub = subscribeToUserMatches(
      currentUser.uid,
      (snapshot) => {
        const entries = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const participants = Array.isArray(data.participants) ? data.participants : [];
          const other = participants.find((id) => id && id !== currentUser.uid);
          if (!other) return;

          const updatedAt = data.updatedAt?.toMillis
            ? data.updatedAt.toMillis()
            : Number(data.updatedAt) || 0;

          entries.push({
            otherId: other,
            matchId: docSnap.id,
            lastMessage: data.lastMessage || '',
            lastSenderId: data.lastSenderId || null,
            updatedAt,
          });
        });
        setMatches(entries);
      },
      (error) => {
        console.warn('Failed to load matches', error);
        setMatches([]);
      }
    );
    return () => unsub?.();
  }, [currentUser?.uid]);

  const rows = useMemo(() => {
    if (!currentUser?.uid) return [];
    return matches
      .map((entry) => {
        const user = userMap.get(entry.otherId);
        if (!user) return null;
        const updatedAt = entry.updatedAt || 0;
        const preview = entry.lastMessage ? String(entry.lastMessage) : '';
        // Treat “unread” as: last message was from the other user.
        const isUnread = !!entry.lastSenderId && entry.lastSenderId !== currentUser.uid;
        return { matchId: entry.matchId, user, updatedAt, preview, isUnread };
      })
      .filter(Boolean)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [matches, userMap, currentUser?.uid]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ user, preview }) => {
      const name = String(user?.name || '').toLowerCase();
      const handle = String(user?.username || '').toLowerCase();
      const pre = String(preview || '').toLowerCase();
      return name.includes(q) || handle.includes(q) || pre.includes(q);
    });
  }, [rows, query]);

  const openChat = (row) => {
    navigation.navigate('ChatRoom', {
      userId: row.user.id,
      user: row.user,
      matchId: row.matchId,
    });
  };

  const renderItem = ({ item }) => {
    const { user, isUnread, preview } = item;
    return (
      <Pressable style={styles.item} onPress={() => openChat(item)}>
        <View style={styles.left}>
          <Image
            source={user?.photoUrl ? { uri: user.photoUrl } : require('../images/user.jpg')}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user?.name || 'Unknown User'}</Text>
              {isUnread && (
                <View style={styles.unreadWrap}>
                  <View style={styles.dot} />
                  <Text style={styles.unreadText}>New message</Text>
                </View>
              )}
            </View>
            <Text numberOfLines={1} style={styles.meta}>
              {preview || `${user?.gym || 'Unknown Gym'} • ${user?.city || 'Unknown City'}`}
            </Text>
          </View>
        </View>
        <Text style={styles.link}>Open</Text>
      </Pressable>
    );
  };

  return (
    <ImageBackground source={hero} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={{ flex: 1, padding: 16, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <Text style={styles.title}>Messages</Text>

          {/* Search Bar */}
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your conversations"
            placeholderTextColor="#9ca3af"
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />

          {/* Vertical list of conversations */}
          <FlatList
            data={filtered.filter(x => x && x.user && x.user.id)}
            keyExtractor={(x) => String(x.user.id)}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.empty}>No conversations yet.</Text>
            }
          />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 12 },
  search: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 14,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(27,27,30,0.9)',
    borderRadius: 12,
    padding: 14,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5e7eb' },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: '#fff', fontWeight: '700', fontSize: 16 },
  meta: { color: '#d8dbe3', marginTop: 2 },

  unreadWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  unreadText: { color: '#22c55e', fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },

  link: {
    color: '#fff',
    fontWeight: '700',
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },

  empty: { color: '#d8dbe3', textAlign: 'center', marginTop: 24 },
});