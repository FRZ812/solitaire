-- Web-build narrator backend as a Postgres RPC — SLIM.
--
-- Supersedes 20260518000000_narrate_rpc.sql. The earlier version embedded
-- the whole 27 KB system prompt as a seed, which made the file too big to
-- paste into the SQL editor on a phone. The prompt is NOT secret (it ships
-- in the artifact build verbatim) and the web client already bundles it, so
-- the client now passes it in as an argument. This migration is small.
--
-- ============================ ONE-TIME SETUP ============================
--   1. Enable the http extension (this migration tries; if it fails on
--      permissions, enable "http" in Dashboard -> Database -> Extensions).
--   2. Store the Gemini key in Vault (NEVER in git):
--        select vault.create_secret('YOUR_GEMINI_KEY', 'gemini_api_key');
--      Rotate later:
--        select vault.update_secret((select id from vault.secrets where name = 'gemini_api_key'), 'NEW_KEY');
--   3. Grant yourself access (manual allowlist):
--        insert into public.subscriptions (user_id, is_subscribed, note)
--        values ('<your auth.users id>', true, 'owner')
--        on conflict (user_id) do update
--          set is_subscribed = excluded.is_subscribed;
--
-- ===================== TWEAKS FROM YOUR PHONE (tiny SQL) ================
--   model     : update public.narrator_config set model = 'gemini-x' where id = 1;
--   token cap : update public.narrator_config set max_output_tokens = 4000 where id = 1;
--   prompt    : edit src/system-prompt.js and redeploy the web app
--               (the client sends it; it is no longer stored here).
--
-- Note: blocking (non-streaming) call. The client buffers the whole
-- response before parsing, so behaviour is unchanged.

create extension if not exists http with schema extensions;

-- subscriptions: created idempotently so this migration stands alone.
-- DDL is kept on single lines too: a mobile SQL-editor paste was dropping
-- lines that ended in a bare "(", so column lists are inlined here.
create table if not exists public.subscriptions (user_id uuid primary key references auth.users (id) on delete cascade, is_subscribed boolean not null default false, note text, updated_at timestamptz not null default now());
alter table public.subscriptions enable row level security;
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription" on public.subscriptions for select using (auth.uid() = user_id);

-- Tiny config: model + token cap only. No prompt column.
create table if not exists public.narrator_config (id int primary key default 1, model text not null default 'gemini-3.1-pro-preview', max_output_tokens int not null default 4000, constraint narrator_config_singleton check (id = 1));
-- Drop the prompt column if the older (oversized) migration created it.
alter table public.narrator_config drop column if exists system_prompt;
insert into public.narrator_config (id) values (1) on conflict (id) do nothing;
alter table public.narrator_config enable row level security;

-- Remove the older 3-arg signature so there is no overload ambiguity.
drop function if exists public.narrate(text, text, jsonb);

create or replace function public.narrate(state_context text, user_msg text, history jsonb default '[]'::jsonb, system_prompt text default '')
returns text
language plpgsql
security definer
set search_path = public, extensions, vault
as $FN$
declare
  v_uid      uuid := auth.uid();
  v_cfg      public.narrator_config%rowtype;
  v_key      text;
  v_contents jsonb;
  v_user     jsonb;
  v_body     jsonb;
  v_status   int;
  v_resp     text;
  v_json     jsonb;
  v_text     text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- NOTE: every multi-token expression below is kept on ONE line on
  -- purpose. Mobile SQL-editor paste was dropping lines that ended in a
  -- bare "(", which silently removed clauses like "from jsonb_array_elements(".
  -- Long lines are ugly but paste-safe; Postgres ignores the length.

  if not exists (select 1 from public.subscriptions where user_id = v_uid and is_subscribed) then
    raise exception 'subscription required' using errcode = '42501';
  end if;

  if system_prompt is null or length(system_prompt) = 0 then
    raise exception 'system_prompt is required';
  end if;

  select * into v_cfg from public.narrator_config where id = 1;
  if not found then
    raise exception 'narrator_config not seeded';
  end if;

  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'gemini_api_key';
  if v_key is null then
    raise exception 'gemini_api_key not set in Vault';
  end if;

  -- Anthropic-style history [{role,content}] -> Gemini contents.
  select coalesce(jsonb_agg(jsonb_build_object('role', case when e->>'role' = 'assistant' then 'model' else 'user' end, 'parts', jsonb_build_array(jsonb_build_object('text', coalesce(e->>'content', ''))))), '[]'::jsonb) into v_contents from jsonb_array_elements(coalesce(history, '[]'::jsonb)) e;

  v_user := jsonb_build_array(jsonb_build_object('role', 'user', 'parts', jsonb_build_array(jsonb_build_object('text', state_context || chr(10) || chr(10) || user_msg))));
  v_contents := v_contents || v_user;

  v_body := jsonb_build_object('systemInstruction', jsonb_build_object('parts', jsonb_build_array(jsonb_build_object('text', system_prompt))), 'contents', v_contents, 'generationConfig', jsonb_build_object('maxOutputTokens', v_cfg.max_output_tokens));

  perform set_config('statement_timeout', '120000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '115');

  select r.status, r.content into v_status, v_resp from extensions.http(row('POST', 'https://generativelanguage.googleapis.com/v1beta/models/' || v_cfg.model || ':generateContent', array[extensions.http_header('x-goog-api-key', v_key)], 'application/json', v_body::text)::extensions.http_request) r;

  if v_status is null or v_status < 200 or v_status >= 300 then
    raise exception 'gemini % : %', coalesce(v_status, 0), left(coalesce(v_resp, ''), 500);
  end if;

  v_json := v_resp::jsonb;

  select string_agg(p->>'text', '') into v_text from jsonb_array_elements(coalesce(v_json->'candidates'->0->'content'->'parts', '[]'::jsonb)) p;

  if v_text is null or v_text = '' then
    raise exception 'gemini returned no text: %', left(v_resp, 500);
  end if;

  return v_text;
end;
$FN$;

revoke all on function public.narrate(text, text, jsonb, text) from public, anon;
grant execute on function public.narrate(text, text, jsonb, text) to authenticated;
