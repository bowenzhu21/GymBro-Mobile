import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, ImageBackground, Linking, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const hero = require('../../assets/pic1.jpg');

export default function UserProfileScreen({ route }) {
  const navigation = useNavigation();
  const { user } = route.params;
  const photo = user?.photo ? { uri: user.photo } : require('../images/user.jpg');

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
            </View>
            <Pressable style={[styles.button, { marginTop: 8 }]} onPress={() => navigation.navigate('ChatRoom', { userId: user.id })}>
              <Text style={styles.buttonText}>Message</Text>
            </Pressable>
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
              {!!user?.instagram && (
                <Pressable style={[styles.button, { marginTop: 12 }]} onPress={openIG}>
                  <Text style={styles.buttonText}>View Instagram</Text>
                </Pressable>
              )}
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
  card: { backgroundColor: 'rgba(27,27,30,0.9)', borderRadius: 12, padding: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: '#fff' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
  item: { width: '48%', color: '#d8dbe3', marginBottom: 4 },
  strong: { color: '#fff', fontWeight: '700' },
  button: { backgroundColor: '#111827', padding: 14, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
