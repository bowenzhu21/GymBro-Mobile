import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet, ImageBackground, Linking, ScrollView, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, list, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/firebase';

const hero = require('../../assets/pic1.jpg');

export default function UserProfileScreen({ route }) {
  const navigation = useNavigation();
  const { user } = route.params;
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const photo = user?.photo ? { uri: user.photo } : require('../images/user.jpg');
  const handle = user?.username
    ? String(user.username).replace(/^@/, '')
    : (user?.instagram ? String(user.instagram).replace('@', '') : (user?.name ? String(user.name).toLowerCase().replace(/\s+/g, '') : ''));
  const displayHandle = handle ? `@${handle}` : '';

  useEffect(() => {
    loadUserPosts();
  }, [user]);

  const loadUserPosts = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const dir = ref(storage, `users/${user.id}/posts`);
      const res = await list(dir, { maxResults: 20 });
      const items = await Promise.all(
        res.items.map(async (item) => ({
          url: await getDownloadURL(item),
          path: item.fullPath,
          id: item.name
        }))
      );
      setPosts(items);
    } catch (error) {
      console.error('Error loading user posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const openIG = () => {
    if (!user?.instagram) return;
    const handle = String(user.instagram).replace('@', '');
    Linking.openURL(`https://instagram.com/${handle}`);
  };

  return (
    <ImageBackground source={hero} resizeMode="cover" style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <ScrollView contentContainerStyle={styles.container}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Image source={photo} style={styles.avatar} />
              <Text style={styles.name}>{user?.name}</Text>
              <Text style={styles.meta}>{user?.gender} • {user?.gym} • {user?.city}</Text>
              {!!displayHandle && <Text style={styles.handle}>{displayHandle}</Text>}
              <View style={{ marginTop: 8 }}>
                <Text style={styles.postsCount}>Posts: <Text style={styles.strong}>{posts.length}</Text></Text>
              </View>
            </View>
            <View style={styles.actionRow}>
              <Pressable style={[styles.button, { flex: 1 }]} onPress={() => navigation.navigate('ChatRoom', { userId: user.id, user })}>
                <Text style={styles.buttonText}>Message</Text>
              </Pressable>
              {!!user?.instagram && (
                <Pressable style={[styles.button, styles.secondaryButton, { flex: 1 }]} onPress={openIG}>
                  <Text style={styles.buttonText}>View Instagram</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Stats</Text>
              <View style={styles.rowWrap}>
                <Text style={styles.item}>Ht: <Text style={styles.strong}>{user?.height}</Text> cm</Text>
                <Text style={styles.item}>Wt: <Text style={styles.strong}>{user?.weight}</Text> lbs</Text>
                <Text style={styles.item}>Bench: <Text style={styles.strong}>{user?.benchPress}</Text></Text>
                <Text style={styles.item}>Squat: <Text style={styles.strong}>{user?.squat}</Text></Text>
                <Text style={styles.item}>Leg Press: <Text style={styles.strong}>{user?.legPress}</Text></Text>
                <Text style={styles.item}>Goal: <Text style={styles.strong}>{user?.goal}</Text></Text>
                <Text style={styles.item}>Experience: <Text style={styles.strong}>{user?.experience}</Text></Text>
                <Text style={styles.item}>Preferred Time: <Text style={styles.strong}>{user?.preferredTime}</Text></Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#e5e7eb' },
  name: { marginTop: 8, fontSize: 22, fontWeight: '800', color: '#fff' },
  meta: { color: '#d8dbe3' },
  handle: { color: '#d8dbe3', marginTop: 4 },
  card: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 12, padding: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: '#fff' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  item: { width: '48%', color: '#d8dbe3', marginBottom: 4 },
  strong: { color: '#fff', fontWeight: '700' },
  button: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryButton: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
});
