import React, { useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase/firebase';

const AuthContext = React.createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [isEmailUser, setIsEmailUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser({ ...user });
        const isEmail = user.providerData?.some((p) => p.providerId === 'password');
        setIsEmailUser(!!isEmail);
        setUserLoggedIn(true);
      } else {
        setCurrentUser(null);
        setUserLoggedIn(false);
        setIsEmailUser(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const value = { currentUser, setCurrentUser, userLoggedIn, isEmailUser };
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

