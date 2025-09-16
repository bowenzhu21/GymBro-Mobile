import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const placeholder = require('../images/user.jpg');

export default function SearchPhotoScreen({ route }) {
  const { url, username, ts } = route.params || {};
  const handle = username ? `@${username.replace(/^@+/, '')}` : '@gymbro';
  const date = ts ? new Date(ts) : null;
  const dateLabel = date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : 'Date unknown';

  return (
    <SafeAreaView style={styles.safe} edges={["top","left","right","bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <Image source={url ? { uri: url } : placeholder} style={styles.image} resizeMode="cover" />
        <View style={styles.meta}>
          <Text style={styles.username}>{handle}</Text>
          <Text style={styles.timestamp}>{dateLabel}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { padding: 16, gap: 12 },
  image: { width: '100%', borderRadius: 16, aspectRatio: 3 / 4, backgroundColor: '#1f2937' },
  meta: { backgroundColor: 'rgba(17,24,39,0.85)', borderRadius: 12, padding: 16 },
  username: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  timestamp: { color: '#d1d5db' },
});
