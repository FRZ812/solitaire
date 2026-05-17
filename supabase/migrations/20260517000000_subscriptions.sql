-- Subscription gate (manual allowlist).
--
-- One row per user. `is_subscribed` is flipped BY HAND (Supabase SQL editor
-- or dashboard) — there is intentionally no insert/update/delete RLS policy,
-- so only the service role can write. The web client reads its own row to
-- gate the UI; the `narrate` edge function reads it to hard-gate the API.
--
-- To grant access to a user:
--   insert into public.subscriptions (user_id, is_subscribed, note)
--   values ('<auth.users.id>', true, 'paid 2026-05 / manual')
--   on conflict (user_id) do update
--     set is_subscribed = excluded.is_subscribed, note = excluded.note;
--
-- To revoke:  update public.subscriptions set is_subscribed = false where user_id = '<id>';

create table if not exists public.subscriptions (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  is_subscribed boolean     not null default false,
  note          text,
  updated_at    timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Users may read ONLY their own subscription row (drives the UI gate).
drop policy if exists "read own subscription" on public.subscriptions;
create policy "read own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy: writes are service-role only (manual
-- allowlist via the dashboard / SQL editor).

create or replace function public.touch_subscriptions_updated_at()
  returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_touch_updated_at on public.subscriptions;
create trigger subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_subscriptions_updated_at();
