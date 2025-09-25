import React, { useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/firebase';
import { cleanUsername, ensureUsernameRecord } from '../../utils/username';

const AuthContext = React.createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [isEmailUser, setIsEmailUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const loadUserProfile = async (user) => {
    if (!user) return null;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        return userDoc.data();
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
    return null;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser({ ...user });
        const isEmail = user.providerData?.some((p) => p.providerId === 'password');
        setIsEmailUser(!!isEmail);
        setUserLoggedIn(true);
        
        // Load user profile data including username
        const profile = await loadUserProfile(user);
        setUserProfile(profile);

        const handle = cleanUsername(profile?.username || user?.displayName || user?.email?.split('@')[0] || '');
        if (handle) {
          await ensureUsernameRecord(handle, user.uid, user.email || profile?.contactEmail || null);
        }

        const onboarded = !!profile?.onboarded;
        const firstSignIn = user.metadata?.creationTime === user.metadata?.lastSignInTime;
        setNeedsOnboarding(firstSignIn && !onboarded);
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setUserLoggedIn(false);
        setIsEmailUser(false);
        setNeedsOnboarding(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = { 
    currentUser, 
    userProfile, 
    setCurrentUser, 
    setUserProfile,
    userLoggedIn, 
    isEmailUser,
    needsOnboarding,
    setNeedsOnboarding,
  };
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

// After successful registration, navigate to AccountSetupScreen
const handleRegister = async (email, password) => {
  // ...existing registration logic...
  // Do NOT assign username here
  navigation.navigate('AccountSetupScreen');
};

// On sign-in, check if setup is complete before navigating
const handleLogin = async (email, password) => {
  // ...existing login logic...
  // Do NOT assign username here
  // Fetch user profile from Firestore
  const userProfile = await getUserProfileFromFirestore(user.uid);
  if (userProfile && userProfile.setupComplete) {
    navigation.navigate('HomeScreen');
  } else {
    navigation.navigate('AccountSetupScreen');
  }
};
