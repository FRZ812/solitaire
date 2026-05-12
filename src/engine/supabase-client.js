// Singleton Supabase client for the web build. Only imported transitively via
// `$api` and `$campaigns` aliased modules, so the artifact build never pulls
// in @supabase/supabase-js.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
});
