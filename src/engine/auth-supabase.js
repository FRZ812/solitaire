// Auth wrappers for the web build. Thin layer over supabase.auth so the rest
// of the app doesn't have to know the SDK shape, and so anon-disabled errors
// can be surfaced clearly.
import { supabase } from "./supabase-client.js";

export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
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
