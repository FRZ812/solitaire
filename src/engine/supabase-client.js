// Singleton Supabase client. Imported by api / auth / campaigns / map
// modules. The artifact build that used to swap these out for local-only
// variants has been retired (the editor and game now talk to Supabase
// directly).
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env");
}

// Auth options chosen for the installed-PWA case:
//   - persistSession + autoRefreshToken: the session lives in localStorage
//     and the refresh token is silently rotated before expiry, so returning
//     users skip the AuthScreen entirely (auto-login).
//   - detectSessionInUrl: needed for OAuth — supabase-js picks up the auth
//     code from the redirect-back URL and exchanges it for a session.
//   - flowType "pkce": the right flow for SPAs/PWAs. The default ("implicit")
//     puts tokens in the URL fragment which can be dropped in PWA redirect
//     chains; PKCE puts an authorization code in the query string and stores
//     a verifier in localStorage, which survives the PWA hop reliably.
//   - storage: explicit localStorage so a future supabase-js default change
//     can't quietly swap the persistence layer out from under us.
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
