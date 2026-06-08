-- Map v2 — data layer: curated place hierarchy + lossless cell backfill.
--
-- The mechanical layers (map_prose / map_cell / map_edge) are seeded from the
-- live handcrafted_map blob: prose + cells + parent-places via server-side
-- INSERT ... SELECT over jsonb_each(tiles); synthesized place groups + the
-- gate/cut edges via `node scripts/map-v2-parity.mjs --live --emit seed.json`.
-- door_controlled is set from `(tile ? 'doors')`. Door-graph + terrain parity
-- is asserted by scripts/map-v2-db-parity.mjs; full compiled parity (the whole
-- tile payload) by scripts/map-v2-compiled-parity.mjs.
--
-- THIS file is the hand/blob-derived data overlay on top of that: (A) a curated
-- top-level Whitemarch city with names/kinds and the parent_place hierarchy,
-- and (B) the lossless backfill of the tile-payload fields the decompiler did
-- not capture (material, wallside, poi.area/partName/parentName, poi presence,
-- and which places are poi anchors). Run after the schema/compile migration
-- (20260608000000_map_v2_compile.sql); it ends by compiling map_compiled.

-- (A) curated place hierarchy ----------------------------------------------

insert into public.map_place (id,name,kind,sealed,access_default) values
  ('whitemarch','Whitemarch','city',false,'public')
on conflict (id) do update set name=excluded.name, kind=excluded.kind, sealed=excluded.sealed;

update public.map_place set name='Whitemarch City Core',  kind='district', sealed=false where id='grp:-5,-1';
update public.map_place set name='Wallside Almshouses',    kind='building', sealed=true  where id='grp:-6,4';
update public.map_place set name='Crown Road Approach',    kind='road',     sealed=false where id='grp:0,-6';
update public.map_place set name='Crown Stair',            kind='wall',     sealed=false where id='grp:5,8';
update public.map_place set name='The Leaning Tankard',    kind='building', sealed=true  where id='grp:-15,25';
update public.map_place set name='Bonepicker''s Chapel',   kind='building', sealed=true  where id='grp:-16,29';
update public.map_place set name='Almshouse Overflow',     kind='building', sealed=true  where id='grp:-20,25';

update public.map_place set kind='river',   sealed=false where id='The Whitewend';
update public.map_place set kind='wall',    sealed=false where id='Whitemarch walls';
update public.map_place set kind='market'   where id in ('whitemarch-grand-market','whitemarch-chain-market-steps');
update public.map_place set kind='gate'     where id in ('whitemarch-crown-gate','whitemarch-prison-gate');
update public.map_place set kind='citadel'  where id='whitemarch-citadel';
update public.map_place set kind='estate'   where id='whitemarch-house-drelan';
update public.map_place set kind='compound' where id in ('whitemarch-caravanserai','whitemarch-outer-works','whitemarch-caravan-yard');
update public.map_place set kind='building' where id in ('whitemarch-registry-hall','whitemarch-guild-court');

-- nest every structure under the city, and give the open street fabric a home
update public.map_place set parent_place='whitemarch' where id <> 'whitemarch';
update public.map_cell  set place_id='whitemarch'     where place_id is null;

-- (B) lossless tile-payload backfill from the blob --------------------------
with t as (select tiles from public.handcrafted_map where id='whitemarch'),
 e as (select split_part(key,',',1)::int x, split_part(key,',',2)::int y, value v
       from t, jsonb_each((select tiles from t)))
update public.map_cell c set
  area        = e.v->'poi'->>'area',
  part_name   = e.v->'poi'->>'partName',
  parent_name = e.v->'poi'->>'parentName',
  material    = e.v->>'material',
  wallside    = (e.v->>'wallside')::boolean,
  poi_state   = case jsonb_typeof(e.v->'poi') when 'object' then 'object' when 'null' then 'null' else null end
from e where c.x = e.x and c.y = e.y;

with t as (select tiles from public.handcrafted_map where id='whitemarch'),
 parents as (select distinct value->'poi'->>'parent' pid
             from t, jsonb_each((select tiles from t))
             where value->'poi'->>'parent' is not null)
update public.map_place p set poi_anchor = true where p.id in (select pid from parents);

-- compile the relational model into map_compiled (what hydrateMap reads)
select public.refresh_map_compiled('whitemarch');
