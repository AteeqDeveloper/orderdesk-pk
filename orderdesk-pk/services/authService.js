import { createClient } from "@/lib/supabase/client";

/**
 * Registers a new user in Supabase Auth, then creates their profile row.
 * The profiles table already exists — we only insert into it here, we
 * never create or alter tables from the app.
 */
export async function registerUser({
  fullName,
  businessName,
  email,
  password,
}) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        business_name: businessName,
      },
    },
  });

  if (error) {
    return { error };
  }

  const user = data.user;

  // If email confirmation is off, we get a session back immediately and can
  // write the profile now. If confirmation is required, `user` still exists
  // but there is no session yet — the upsert only succeeds once RLS allows
  // it (i.e. after the user is authenticated), so we attempt it either way
  // and ignore a failure here rather than blocking registration on it.
  if (user) {
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        full_name: fullName,
        business_name: businessName,
      },
      { onConflict: "id" }
    );
  }

  return { data, error: null };
}

export async function loginUser({ email, password }) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

export async function logoutUser() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function sendPasswordReset(email) {
  const supabase = createClient();

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/login`
      : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  return { error };
}

export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
