import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import HomeScreen from './src/screens/HomeScreen';
// Favorites screen removed
import MatchScreen from './src/screens/MatchScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AuthLoginScreen from './src/screens/AuthLoginScreen';
import AuthRegisterScreen from './src/screens/AuthRegisterScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import ChatsScreen from './src/screens/ChatsScreen';
import ChatRoomScreen from './src/screens/ChatRoomScreen';
import UserProfileScreen from './src/screens/UserProfileScreen';
import MatchRequestsScreen from './src/screens/MatchRequestsScreen';
import MatchesListScreen from './src/screens/MatchesListScreen';
import SearchScreen from './src/screens/SearchScreen';
import SearchPhotoScreen from './src/screens/SearchPhotoScreen';
import { AuthProvider, useAuth } from './src/contexts/authContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          const m = { Home: 'home', Messages: 'chatbubble', Search: 'search', Bros: 'people', Profile: 'person' };
          const name = m[route.name] || 'ellipse';
          return <Ionicons name={name} size={24} color={color} />;
        },
        tabBarStyle: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 10,
          borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.92)',
          borderTopWidth: 0,
          elevation: 8,
          shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
          height: 70,
          paddingVertical: 8,
        },
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: { fontWeight: '700', paddingBottom: 2 },
        tabBarItemStyle: { height: 56 },
        tabBarIconStyle: { marginTop: 2 },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Bros" component={MatchScreen} />
      <Tab.Screen name="Messages" component={ChatsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Login" component={AuthLoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={AuthRegisterScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { userLoggedIn } = useAuth();
  if (!userLoggedIn) return <AuthStack />;
  return (
    <RootStack.Navigator>
      <RootStack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      <RootStack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
      <RootStack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: 'Chat' }} />
      <RootStack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profile' }} />
      <RootStack.Screen name="MatchRequests" component={MatchRequestsScreen} options={{ title: 'Match Requests' }} />
      <RootStack.Screen name="MatchesList" component={MatchesListScreen} options={{ title: 'Matches' }} />
      <RootStack.Screen name="SearchPhoto" component={SearchPhotoScreen} options={{ title: 'Photo' }} />
    </RootStack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </AuthProvider>
  );
}
