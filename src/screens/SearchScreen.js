import React, { useMemo, useState } from 'react';
import { View, FlatList, Image, StyleSheet, TextInput, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/authContext';
import { useUsersDirectory } from '../hooks/useUsersDirectory';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigation = useNavigation();
  const { currentUser } = useAuth();
  const { users, loading } = useUsersDirectory();

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users
      .filter((user) => {
        if (!user || typeof user !== 'object') return false;
        if (currentUser?.uid && user.id === currentUser.uid) return false;
        if (user.deletedAt || user.disabled) return false;
        if (!q) return true;
        const name = String(user.name || '').toLowerCase();
        const username = String(user.username || '').toLowerCase();
        const gym = String(user.gym || '').toLowerCase();
        const city = String(user.city || '').toLowerCase();
        return (
          name.includes(q) ||
          username.includes(q) ||
          gym.includes(q) ||
          city.includes(q)
        );
      })
      .sort((a, b) => {
        const aName = String(a.name || '').toLowerCase();
        const bName = String(b.name || '').toLowerCase();
        return aName.localeCompare(bName);
      });
  }, [users, searchQuery, currentUser?.uid]);

  const openUserProfile = (user) => {
    if (user && user.id) {
      navigation.navigate('UserProfile', { user });
    }
  };

  const renderUserItem = ({ item: user }) => (
    <Pressable style={styles.userItem} onPress={() => openUserProfile(user)}>
      <Image
        source={user.photoUrl ? { uri: user.photoUrl } : require('../images/user.jpg')}
        style={styles.avatar}
      />
      <View style={styles.userInfo}>
        <Text style={styles.username}>
          {user.username ? `@${user.username}` : `@${user.name?.toLowerCase() || 'user'}`}
        </Text>
        <Text style={styles.name}>{user.name || 'Unknown User'}</Text>
        <Text style={styles.location}>
          {(user.gym || 'Unknown Gym')} • {(user.city || 'Unknown City')}
        </Text>
        {user.goal ? <Text style={styles.goal}>Goal: {user.goal}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top","left","right"]}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#6b7280" style={{ marginHorizontal: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search users..."
            placeholderTextColor="#9ca3af"
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
          />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderUserItem}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No users found' : 'Start typing to search for users'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    margin: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    color: '#fff',
    fontSize: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1f2937',
    marginHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#374151',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  name: {
    color: '#d1d5db',
    fontSize: 14,
    marginBottom: 2,
  },
  location: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 2,
  },
  goal: {
    color: '#9ca3af',
    fontSize: 12,
  },
  separator: {
    height: 8,
  },
  listContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
  },
});
