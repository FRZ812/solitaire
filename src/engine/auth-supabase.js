// Auth wrappers for the web build. Thin layer over supabase.auth so the rest
// of the app doesn't have to know the SDK shape, and so anon-disabled errors
// can be surfaced clearly.
import { supabase } from "./supabase-client.js";

export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

// Manual-allowlist subscription gate. Reads the caller's own row in
// public.subscriptions (RLS lets a user read only their own). Returns true
// only for an explicit is_subscribed=true row. The narrate edge function
// enforces the same check server-side — this is just for the UI.
export async function isSubscribed() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("subscriptions")
    .select("is_subscribed")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return false;
  return data?.is_subscribed === true;
}

export function onAuthChange(cb) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => cb(session?.user ?? null)
  );
  return () => subscription.unsubscribe();
}

export async function signInAnonymously() {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    if (/anonymous|disabled|provider/i.test(error.message)) {
      throw new Error(
        "Anonymous sign-ins are disabled on this project. Enable them in the Supabase dashboard under Auth → Sign In / Up → Anonymous Sign-Ins."
      );
    }
    throw error;
  }
}

// Starts Google OAuth. The supabase-js call returns immediately and then
// redirects the browser to Google's consent screen; on success Google
// redirects back to `redirectTo`, supabase-js exchanges the code, and the
// onAuthChange listener picks up the new session. No session is set here
// synchronously.
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) {
    if (/provider|disabled|google/i.test(error.message)) {
      throw new Error(
        "Google sign-in is not enabled on this project. Turn it on in Supabase: Auth → Sign In / Providers → Google (you need a Google Cloud OAuth Client ID + Secret)."
      );
    }
    throw error;
  }
}

export async function signInWithEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Attach an email to an anonymous user. Preserves the user_id, so campaigns
// table rows owned by the anon user remain owned by the same uuid after the
// email is verified. Redirect URL comes from the Supabase dashboard Site URL
// configuration.
export async function linkEmail(email) {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
}
