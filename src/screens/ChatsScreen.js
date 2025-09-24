import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ImageBackground, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/authContext';
import { useUsersDirectory } from '../hooks/useUsersDirectory';
import { subscribeToUserMatches } from '../utils/matches';

const hero = require('../../assets/pic1.jpg');

export default function ChatsScreen({ navigation }) {
  const [matches, setMatches] = useState([]);
  const { currentUser } = useAuth();
  const { userMap } = useUsersDirectory();

  useEffect(() => {
    if (!currentUser?.uid) {
      setMatches([]);
      return () => {};
    }
    const unsub = subscribeToUserMatches(currentUser.uid, (snapshot) => {
      const entries = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const participants = Array.isArray(data.participants) ? data.participants : [];
        const other = participants.find((id) => id && id !== currentUser.uid);
        if (!other) return;
        const updatedAt = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Number(data.updatedAt) || 0;
        entries.push({
          otherId: other,
          matchId: docSnap.id,
          lastMessage: data.lastMessage || '',
          lastSenderId: data.lastSenderId || null,
          updatedAt,
        });
      });
      setMatches(entries);
    }, (error) => {
      console.warn('Failed to load matches', error);
      setMatches([]);
    });
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
        const isUnread = entry.lastSenderId && entry.lastSenderId !== currentUser.uid;
        return {
          matchId: entry.matchId,
          user,
          updatedAt,
          preview,
          isUnread,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [matches, userMap, currentUser?.uid]);

  const openChat = (row) => {
    navigation.navigate('ChatRoom', { userId: row.user.id, user: row.user, matchId: row.matchId });
  };

  const renderItem = ({ item }) => {
    const { user, isUnread, preview } = item;
    return (
      <Pressable style={styles.item} onPress={() => openChat(item)}>
        <View>
          <Text style={styles.name}>
            {user.name}
            {isUnread ? ' • New' : ''}
          </Text>
          <Text style={styles.meta}>{preview || `${user.gym || 'Unknown Gym'} • ${user.city || 'Unknown City'}`}</Text>
        </View>
        <Text style={styles.link}>Open</Text>
      </Pressable>
    );
  };

  return (
    <ImageBackground source={hero} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
        <View style={{ flex: 1, padding: 16, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 6 }}>Messages</Text>
          <Text style={{ color: '#e5e7eb', marginBottom: 4 }}></Text>
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.user.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
            contentContainerStyle={{ paddingBottom: 0 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => openChat(item)} style={styles.avatarWrap}>
                <Image
                  source={item.user?.photoUrl ? { uri: item.user.photoUrl } : require('../images/user.jpg')}
                  style={styles.avatar}
                />
                <Text style={styles.avatarName}>{item.user.name}</Text>
              </Pressable>
            )}
          />
          <Text style={{ color: '#e5e7eb', marginTop: 0, marginBottom: -450}}></Text>
          <FlatList
            data={rows}
            keyExtractor={(x) => String(x.user.id)}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 12, padding: 14 },
  name: { color: '#fff', fontWeight: '700', fontSize: 16 },
  meta: { color: '#d8dbe3' },
  link: { color: '#fff', fontWeight: '700', backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  avatarWrap: { alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#e5e7eb' },
  avatarName: { color: '#fff', marginTop: 4, fontSize: 12 },
});
