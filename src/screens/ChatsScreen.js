import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ImageBackground, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getJSON } from '../utils/storage';
import { sampleUsers } from '../utils/match';

const hero = require('../../assets/pic1.jpg');

export default function ChatsScreen({ navigation }) {
  const [matches, setMatches] = useState([]); // ids
  const [rows, setRows] = useState([]); // [{user, lastTs, new}]

  useEffect(() => { (async () => {
    const m = await getJSON('matches', []);
    const ids = (Array.isArray(m) ? m : []).map(x => (typeof x === 'object' ? x.id : x));
    setMatches(ids);
    const rows = [];
    for (const id of ids) {
      const user = sampleUsers.find(u => u.id === id);
      if (!user) continue;
      const chat = await getJSON(`chat:${id}`, []);
      const lastTs = chat.length ? chat[chat.length - 1].ts : 0;
      rows.push({ user, lastTs, new: chat.length === 0 });
    }
    rows.sort((a,b) => b.lastTs - a.lastTs);
    setRows(rows);
  })(); }, []);

  const openChat = (user) => {
    navigation.navigate('ChatRoom', { userId: user.id });
  };

  const renderItem = ({ item }) => {
    const { user, new: isNew } = item;
    return (
      <Pressable style={styles.item} onPress={() => openChat(user)}>
        <View>
          <Text style={styles.name}>{user.name} {isNew ? '• New' : ''}</Text>
          <Text style={styles.meta}>{user.gym} • {user.city}</Text>
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
          <Text style={{ color: '#e5e7eb', marginBottom: 6 }}>Matches</Text>
          <FlatList
            data={matches.map(id => sampleUsers.find(u => u.id === id)).filter(Boolean)}
            keyExtractor={(x) => String(x.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
            renderItem={({ item }) => (
              <Pressable onPress={() => openChat(item)} style={styles.avatarWrap}>
                <Image source={require('../images/user.jpg')} style={styles.avatar} />
                <Text style={styles.avatarName}>{item.name}</Text>
              </Pressable>
            )}
          />
          <Text style={{ color: '#e5e7eb', marginTop: 10, marginBottom: 6 }}>Recent</Text>
          <FlatList
            data={rows}
            keyExtractor={(x) => String(x.id)}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
