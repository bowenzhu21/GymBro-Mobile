import React, { useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/firebase';

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
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setUserLoggedIn(false);
        setIsEmailUser(false);
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
    isEmailUser 
  };
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

