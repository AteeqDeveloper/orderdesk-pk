"use client";

import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";

/**
 * Access the current user, their profile row, and the auth loading state
 * from any Client Component.
 *
 *   const { user, profile, loading } = useAuth();
 */
export function useAuth() {
  return useContext(AuthContext);
}
