import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getJSON, setJSON, addUnique, removeItem } from '../utils/storage';
import { sampleUsers } from '../utils/match';

const bg = require('../../assets/pic1.jpg');

export default function MatchRequestsScreen() {
  const [requests, setRequests] = useState([]);

  useEffect(() => { (async () => setRequests(await getJSON('matchRequests', [])))(); }, []);

  const accept = async (fromId) => {
    await addUnique('matches', { id: fromId });
    const next = await removeItem('matchRequests', (x) => x.from === fromId);
    setRequests(next);
  };
  const decline = async (fromId) => {
    const next = await removeItem('matchRequests', (x) => x.from === fromId);
    setRequests(next);
  };

  const data = requests.map((r) => ({ ...r, user: sampleUsers.find(u => u.id === r.from) })).filter(x => x.user);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View>
        <Text style={styles.name}>{item.user.name}</Text>
        <Text style={styles.meta}>{item.user.gym} • {item.user.city}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable style={[styles.btn, styles.accept]} onPress={() => accept(item.user.id)}>
          <Text style={styles.btnTxt}>Accept</Text>
        </Pressable>
        <Pressable style={[styles.btn]} onPress={() => decline(item.user.id)}>
          <Text style={[styles.btnTxt, { color: '#111827' }]}>Decline</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
        <View style={{ flex: 1, padding: 16, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 12 }}>Match Requests</Text>
          <FlatList data={data} keyExtractor={(x, i)=> String(x.user.id)} renderItem={renderItem} ItemSeparatorComponent={() => <View style={{ height: 10 }} />} />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: '#fff', fontWeight: '700', fontSize: 16 },
  meta: { color: '#d8dbe3' },
  btn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: '#fff', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  accept: { backgroundColor: '#111827', borderColor: '#111827' },
  btnTxt: { color: '#fff', fontWeight: '700' },
});

