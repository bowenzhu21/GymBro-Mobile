import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getJSON } from '../utils/storage';
import { sampleUsers } from '../utils/match';

const bg = require('../../assets/pic1.jpg');

export default function MatchesListScreen() {
  const [matches, setMatches] = useState([]);
  useEffect(() => { (async () => setMatches(await getJSON('matches', [])))(); }, []);
  const data = matches.map(m => ({ ...m, user: sampleUsers.find(u => u.id === (m.id || m)) })).filter(x => x.user);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.user.name}</Text>
      <Text style={styles.meta}>{item.user.gym} • {item.user.city}</Text>
    </View>
  );

  return (
    <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
        <View style={{ flex: 1, padding: 16, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 12 }}>My Matches</Text>
          <FlatList data={data} keyExtractor={(x,i)=> String(x.user.id)} renderItem={renderItem} ItemSeparatorComponent={() => <View style={{ height: 10 }} />} />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 12, padding: 12 },
  name: { color: '#fff', fontWeight: '800', fontSize: 16 },
  meta: { color: '#d8dbe3' },
});

