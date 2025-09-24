import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ImageBackground, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/authContext';
import { useUsersDirectory } from '../hooks/useUsersDirectory';
import { removeMatch, subscribeToUserMatches } from '../utils/matches';

const bg = require('../../assets/pic1.jpg');

export default function MatchesListScreen() {
  const [matches, setMatches] = useState([]);
  const { currentUser } = useAuth();
  const { userMap } = useUsersDirectory();

  useEffect(() => {
    if (!currentUser?.uid) {
      setMatches([]);
      return () => {};
    }
    const unsub = subscribeToUserMatches(currentUser.uid, (snapshot) => {
      const rows = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const participants = Array.isArray(data.participants) ? data.participants : [];
        if (Array.isArray(participants)) {
          const other = participants.find((id) => id && id !== currentUser.uid);
          if (other) {
            rows.push({
              matchId: docSnap.id,
              otherId: other,
              updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Number(data.updatedAt) || 0,
            });
          }
        }
      });
      rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setMatches(rows);
    }, (error) => {
      console.warn('Failed to load matches', error);
      setMatches([]);
    });
    return () => unsub?.();
  }, [currentUser?.uid]);

  const data = matches
    .map((entry) => {
      const user = userMap.get(entry.otherId);
      if (!user) return null;
      return { user, matchId: entry.matchId };
    })
    .filter(Boolean);

  const onRemove = (item) => {
    if (!currentUser?.uid || !item?.user?.id) return;
    Alert.alert(
      'Remove match?',
      `You will no longer be matched with ${item.user.name || 'this user'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMatch({ matchId: item.matchId, requesterUid: currentUser.uid, uidA: currentUser.uid, uidB: item.user.id });
            } catch (error) {
              Alert.alert('Unable to remove match', error?.message || 'Please try again later.');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View>
        <Text style={styles.name}>{item.user.name || 'Gym Bro'}</Text>
        <Text style={styles.meta}>{item.user.gym || 'Unknown Gym'} • {item.user.city || 'Unknown City'}</Text>
      </View>
      <Pressable style={styles.removeBtn} onPress={() => onRemove(item)}>
        <Text style={styles.removeText}>Remove</Text>
      </Pressable>
    </View>
  );

  return (
    <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
        <View style={{ flex: 1, padding: 16, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 12 }}>My Matches</Text>
          <FlatList
            data={data}
            keyExtractor={(x) => String(x.user.id)}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: '#fff', fontWeight: '800', fontSize: 16 },
  meta: { color: '#d8dbe3', marginTop: 2 },
  removeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.2)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.5)' },
  removeText: { color: '#fca5a5', fontWeight: '700' },
});
