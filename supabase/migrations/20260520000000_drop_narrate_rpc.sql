-- The narrate backend is back on a Deno edge function (supabase/functions/
-- narrate) now that CLI/MCP deployment is available. Drop the RPC + the
-- tiny config table; keep public.subscriptions (the edge function still
-- reads it for the allowlist gate).

drop function if exists public.narrate(text, text, jsonb, text);
drop function if exists public.narrate(text, text, jsonb);
drop table if exists public.narrator_config;
