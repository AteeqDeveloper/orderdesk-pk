"use client";

import { createContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getCurrentUser } from "@/services/authService";

export const AuthContext = createContext({
  user: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }) {
  const pathname = usePathname();
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
  }, [pathname]);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
