import React from 'react';
import { StyleSheet } from 'react-native';
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
import AccountSetupScreen from './src/screens/AccountSetupScreen';
import { AuthProvider, useAuth } from './src/contexts/authContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          const m = { Home: 'home', Messages: 'chatbubble', Bros: 'people', Profile: 'person' };
          const name = m[route.name] || 'ellipse';
          return <Ionicons name={name} size={24} color={color} />;
        },
        tabBarStyle: tabBarStyles.bar,
        tabBarActiveTintColor: '#111827',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: { fontWeight: '700', paddingBottom: 2 },
        tabBarItemStyle: { height: 56 },
        tabBarIconStyle: { marginTop: 2 },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
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

function AccountSetupStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AccountSetup" component={AccountSetupScreen} />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: 'Chat' }} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="MatchRequests" component={MatchRequestsScreen} options={{ title: 'Match Requests' }} />
      <Stack.Screen name="MatchesList" component={MatchesListScreen} options={{ title: 'Matches' }} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { userLoggedIn, needsOnboarding } = useAuth();
  if (!userLoggedIn) return <AuthStack />;
  return needsOnboarding ? <AccountSetupStack /> : <MainStack />;
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

const tabBarStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopWidth: 0,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    height: 70,
    paddingVertical: 8,
  },
});
