-- Map v2 — curated place layer (the human-authored hierarchy).
--
-- The mechanical layers (map_prose / map_cell / map_edge) are seeded from the
-- live handcrafted_map blob: prose + cells + parent-places via server-side
-- INSERT ... SELECT over jsonb_each(tiles); synthesized place groups + the
-- gate/cut edges via `node scripts/map-v2-parity.mjs --live --emit seed.json`.
-- door_controlled is set from `(tile ? 'doors')`. End-to-end parity with the
-- blob is asserted by scripts/map-v2-db-parity.mjs (0 terrain + 0 door-graph
-- mismatches).
--
-- THIS file is the hand-curated overlay on top of that: a top-level Whitemarch
-- city, meaningful names/kinds for the synthesized groups, and the parent_place
-- hierarchy. It is parity-neutral (names/kinds/hierarchy don't affect the door
-- compile; the orphaned open street fabric is given a home but emits no doors).

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
