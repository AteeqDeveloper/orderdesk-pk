"use client";

import { createContext, useEffect, useState } from "react";
import { getCurrentUser } from "@/services/authService";

export const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getCurrentUser().then((currentUser) => {
      if (isMounted) {
        setUser(currentUser);
        setProfile(currentUser ? {
          full_name: currentUser.fullName,
          business_name: currentUser.businessName,
        } : null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
