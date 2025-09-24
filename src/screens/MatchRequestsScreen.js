import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, ImageBackground, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/authContext';
import { useUsersDirectory } from '../hooks/useUsersDirectory';
import {
  acceptMatchRequest,
  declineMatchRequest,
  subscribeToIncomingRequests,
} from '../utils/matches';

const bg = require('../../assets/pic1.jpg');

export default function MatchRequestsScreen() {
  const [requests, setRequests] = useState([]);
  const { currentUser } = useAuth();
  const { userMap } = useUsersDirectory();

  useEffect(() => {
    if (!currentUser?.uid) {
      setRequests([]);
      return () => {};
    }

    const unsubscribe = subscribeToIncomingRequests(currentUser.uid, (snapshot) => {
      const next = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data?.status === 'pending') {
          next.push({ id: docSnap.id, ...data });
        }
      });
      setRequests(next);
    }, (error) => {
      console.warn('Failed to load match requests', error);
      setRequests([]);
    });

    return () => unsubscribe?.();
  }, [currentUser?.uid]);

  const handleAccept = async (fromId) => {
    if (!currentUser?.uid) return;
    try {
      await acceptMatchRequest(fromId, currentUser.uid);
    } catch (error) {
      Alert.alert('Match request', error?.message || 'Failed to accept request');
    }
  };

  const handleDecline = async (fromId) => {
    if (!currentUser?.uid) return;
    try {
      await declineMatchRequest(fromId, currentUser.uid);
    } catch (error) {
      Alert.alert('Match request', error?.message || 'Failed to decline request');
    }
  };

  const data = requests
    .map((request) => {
      const user = userMap.get(request.fromUid);
      if (!user) return null;
      return { ...request, user };
    })
    .filter(Boolean);

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View>
        <Text style={styles.name}>{item.user.name || 'Gym Bro'}</Text>
        <Text style={styles.meta}>{item.user.gym || 'Unknown Gym'} • {item.user.city || 'Unknown City'}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable style={[styles.btn, styles.accept]} onPress={() => handleAccept(item.user.id)}>
          <Text style={styles.btnTxt}>Accept</Text>
        </Pressable>
        <Pressable style={[styles.btn]} onPress={() => handleDecline(item.user.id)}>
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
