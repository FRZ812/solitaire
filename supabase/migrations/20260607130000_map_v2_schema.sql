-- World map data model v2 — relational schema (see docs/MAP_DATA_MODEL.md).
--
-- ADDITIVE and inert: these tables sit alongside the live public.handcrafted_map
-- blob and do not change the running game. The migration cutover (pointing
-- hydrateMap at map_compiled) is a separate, later change. Parity between this
-- model and the live blob is proven by scripts/map-v2-parity.mjs.
--
-- Layers: map_place (structures, hierarchical) · map_cell (one row per hex,
-- membership = a single FK) · map_edge (only door-graph exceptions: gates + cuts)
-- · map_prose (narrative text, pulled out of geometry) · map_compiled (the
-- assembled tiles dict, so the runtime keeps doing one fetch).

create table if not exists public.map_prose (
  id   text primary key,
  body text not null
);

create table if not exists public.map_place (
  id             text primary key,
  name           text not null,
  kind           text not null default 'building',   -- city|district|building|gate|market|wall|river|feature
  parent_place   text references public.map_place(id) on delete set null,
  sealed         boolean not null default true,       -- interior (perimeter-sealed) vs open
  access_default text not null default 'public',      -- public|guarded|conditional|restricted|hidden
  prose_id       text references public.map_prose(id) on delete set null,
  meta           jsonb not null default '{}'
);

create table if not exists public.map_cell (
  x        integer not null,
  y        integer not null,
  terrain  text not null,                             -- src/data/terrains.js id
  place_id text references public.map_place(id) on delete set null,
  poi_type text,
  name     text,
  part     text,
  service  text,
  access   text,
  role     text,                                      -- gate|threshold|sanctum|yard… (door-derivation hint)
  door_controlled boolean not null default false,     -- true = connectivity is door-gated; false = freely-open (no doors emitted)
  prose_id text references public.map_prose(id) on delete set null,
  flags    jsonb not null default '{}',
  primary key (x, y)
);
create index if not exists map_cell_place_idx on public.map_cell (place_id);

-- ONLY the door-graph exceptions. Default connectivity (computed by the loader):
-- adjacent cells sharing a non-null place_id are connected; everything else is
-- sealed. A 'gate' opens a normally-sealed boundary edge; a 'cut' seals a
-- normally-open in-place edge. Edges are undirected; store a<b canonical order.
create table if not exists public.map_edge (
  ax integer not null, ay integer not null,
  bx integer not null, by integer not null,
  kind text not null check (kind in ('gate','cut')),
  primary key (ax, ay, bx, by, kind)
);

-- Runtime cache: the compiled "x,y" -> {terrain,poi,doors} dict. Refreshed from
-- the layers above (by a function/trigger, added at cutover) so boot stays one
-- fetch. updated_at carries the optimistic-concurrency baseline (replaces the
-- handcrafted_map.updated_at guard).
create table if not exists public.map_compiled (
  id         text primary key default 'whitemarch',
  tiles      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- RLS: map data is public-by-design for READ (same as handcrafted_map — the game
-- reads it with the anon key, RLS protects writes). No write policy here, so only
-- the service role (migrations/seed) can write until the editor cutover adds
-- owner-scoped write policies.
alter table public.map_prose    enable row level security;
alter table public.map_place    enable row level security;
alter table public.map_cell     enable row level security;
alter table public.map_edge     enable row level security;
alter table public.map_compiled enable row level security;

do $$
declare t text;
begin
  foreach t in array array['map_prose','map_place','map_cell','map_edge','map_compiled'] loop
    execute format(
      'create policy %I on public.%I for select using (true)',
      t || '_read', t);
  end loop;
end $$;
