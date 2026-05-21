// Auth shim for the artifact build. The artifact pane has no notion of users;
// the game just runs in localStorage. We return a synthetic user so the auth
// gate in App.jsx falls straight through to the game.
const SYNTHETIC_USER = { id: "artifact-local", is_anonymous: true };

export async function getCurrentUser() {
  return SYNTHETIC_USER;
}

// Artifact build runs in the Claude artifact pane on subscription auth;
// there is no Supabase user or Gemini key to abuse. Always allowed.
export async function isSubscribed() {
  return true;
}

export function onAuthChange(cb) {
  queueMicrotask(() => cb(SYNTHETIC_USER));
  return () => {};
}

export async function signInAnonymously() {
  // already "signed in" via the synthetic user
}

export async function signInWithEmail() {
  throw new Error("Email sign-in is not available in artifact mode.");
}

export async function signInWithGoogle() {
  throw new Error("Google sign-in is not available in artifact mode.");
}

export async function signOut() {
  // no-op
}

export async function linkEmail() {
  throw new Error("Account linking is not available in artifact mode.");
}
