import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Image, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ref, list, getDownloadURL } from 'firebase/storage';
import { storage, db } from '../firebase/firebase';
import { collectionGroup, getDocs, query, orderBy, limit, where } from 'firebase/firestore';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [images, setImages] = useState([]); // [{url, ts}]

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try Firestore first: collection group 'posts' with fields (imageUrl, ts, username)
        let all = [];
        try {
          const q = query(collectionGroup(db, 'posts'), orderBy('ts', 'desc'), limit(60));
          const snap = await getDocs(q);
          all = snap.docs.map(d => ({ url: d.data().imageUrl, ts: d.data().ts || 0, username: d.data().username || '' })).filter(x => !!x.url);
        } catch (_) {}

        if (all.length === 0) {
          // Fallback to Storage listing by user folders
          const usersRef = ref(storage, 'users');
          const usersList = await list(usersRef, { maxResults: 50 });
          for (const p of usersList.prefixes) {
            const postsRef = ref(storage, `${p.fullPath}/posts`);
            try {
              const posts = await list(postsRef, { maxResults: 12 });
              for (const it of posts.items) {
                const name = it.name.split('.')[0];
                const ts = Number(name);
                const url = await getDownloadURL(it);
                all.push({ url, ts: Number.isFinite(ts) ? ts : 0, username: p.name });
              }
            } catch (_) { /* user may not have posts */ }
          }
        }

        all.sort((a,b) => b.ts - a.ts);
        if (!cancelled) setImages(all);
      } catch (_) {
        if (!cancelled) setImages([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return images;
    return images.filter(it => (it.username || '').toLowerCase().includes(q) || (it.name || '').toLowerCase().includes(q));
  }, [images, query]);
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#6b7280" style={{ marginHorizontal: 8 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
        <FlatList
          data={filtered.length ? filtered : Array.from({ length: 24 }, (_, i) => ({ placeholder: true, key: i }))}
          keyExtractor={(_, i) => String(i)}
          numColumns={4}
          columnWrapperStyle={{ gap: 2 }}
          contentContainerStyle={{ gap: 2, padding: 2 }}
          renderItem={({ item }) => (
            item.placeholder ? (
              <Image source={require('../images/user.jpg')} style={styles.tile} />
            ) : (
              <Image source={{ uri: item.url }} style={styles.tile} />
            )
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tile: { width: '100%', aspectRatio: 1 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 8, borderRadius: 12, overflow: 'hidden' },
  searchInput: { flex: 1, paddingVertical: 10, paddingRight: 12, color: '#111827' },
});
