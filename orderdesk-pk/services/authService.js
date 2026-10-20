import { apiRequest } from "@/lib/api";

export async function registerUser({
  fullName,
  businessName,
  email,
  password,
}) {
  try {
    const data = await apiRequest("auth/register", {
      method: "POST",
      body: JSON.stringify({ fullName, businessName, email, password }),
    });
    await apiRequest("auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function loginUser({ email, password }) {
  try {
    const data = await apiRequest("auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    return { data, error: null };
  } catch (error) {
    return { data: null, error };
  }
}

export async function logoutUser() {
  try {
    await apiRequest("auth/logout", { method: "POST" });
    return { error: null };
  } catch (error) {
    return { error };
  }
}

export async function sendPasswordReset() {
  return {
    error: new Error("Password reset is not available from the backend yet."),
  };
}

export async function getCurrentUser() {
  try {
    const data = await apiRequest("auth/me");
    return data.user || null;
  } catch {
    return null;
  }
}
