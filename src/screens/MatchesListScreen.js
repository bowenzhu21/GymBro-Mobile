// gb-mobile/src/screens/MatchesListScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ImageBackground, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/authContext';
import { useUsersDirectory } from '../hooks/useUsersDirectory';
import { removeMatch, subscribeToUserMatches } from '../utils/matches';
import { useNavigation } from '@react-navigation/native';

const bg = require('../../assets/pic1.jpg');

export default function MatchesListScreen() {
  const [matches, setMatches] = useState([]);
  const { currentUser } = useAuth();
  const { userMap } = useUsersDirectory();
  const navigation = useNavigation();

  useEffect(() => {
    if (!currentUser?.uid) {
      setMatches([]);
      return () => {};
    }
    const unsub = subscribeToUserMatches(
      currentUser.uid,
      (snapshot) => {
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
      },
      (error) => {
        console.warn('Failed to load matches', error);
        setMatches([]);
      }
    );
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
              await removeMatch({
                matchId: item.matchId,
                requesterUid: currentUser.uid,
                uidA: currentUser.uid,
                uidB: item.user.id,
              });
            } catch (error) {
              Alert.alert('Unable to remove match', error?.message || 'Please try again later.');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.cardShadowWrap}>
      <View style={[styles.cardInner, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 12 }]}> 
        {/* Left column: name + meta */}
        <View style={styles.infoCol}>
          <Text style={styles.name} numberOfLines={1}>{item.user.name || 'Gym Bro'}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {item.user.gym || 'Unknown Gym'} • {item.user.city || 'Unknown City'}
          </Text>
        </View>
        {/* Right: actions on same row */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.viewBtn]}
            onPress={() => navigation.navigate('UserProfile', { user: item.user })}
          >
            <Text style={styles.viewTxt}>View</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.removeBtn]} onPress={() => onRemove(item)}>
            <Text style={styles.removeTxt}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <ImageBackground source={bg} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
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
  cardShadowWrap: {
    backgroundColor: '#1b1b1e',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  cardInner: {
    backgroundColor: 'rgba(27,27,30,0.9)',
    borderRadius: 12,
    padding: 12,
  },

  infoCol: { flex: 1, minWidth: 0 },
  name: { color: '#fff', fontWeight: '800', fontSize: 16 },
  meta: { color: '#d8dbe3', marginTop: 2 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },

  btn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  viewBtn: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  viewTxt: { color: '#fff', fontWeight: '700' },

  removeBtn: {
    backgroundColor: '#ef4444', // bright red background
    borderColor: '#ef4444',
  },
  removeTxt: { color: '#fff', fontWeight: '700' },
});