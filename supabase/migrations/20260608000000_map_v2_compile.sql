-- Map v2 — lossless columns + compile pipeline + read-cutover safety net.
--
-- The original v2 schema (20260607130000) captured terrain, the door graph,
-- and the core poi columns, and scripts/map-v2-db-parity.mjs proved the door
-- GRAPH + terrain reproduce the authored handcrafted_map blob. But the full
-- tile PAYLOAD also carries material, wallside, poi.area, poi.partName and
-- poi.parentName, plus a three-way poi presence (object / explicit null /
-- absent). Give those first-class homes, add the SQL compile that rebuilds the
-- monolithic tiles blob from the relational model, and keep the compiled blob
-- current if the legacy blob editor writes handcrafted_map.

-- 1. Lossless columns -------------------------------------------------------
alter table public.map_cell  add column if not exists area        text;
alter table public.map_cell  add column if not exists part_name   text;    -- poi.partName
alter table public.map_cell  add column if not exists parent_name text;    -- poi.parentName (independent of parent id)
alter table public.map_cell  add column if not exists material    text;    -- tile.material
alter table public.map_cell  add column if not exists wallside    boolean; -- tile.wallside
alter table public.map_cell  add column if not exists poi_state   text;    -- 'object' | 'null' | NULL(absent)
alter table public.map_place add column if not exists poi_anchor  boolean not null default false; -- place appears as a poi.parent

-- 2. Compile: relational model -> tiles blob --------------------------------
-- Doors: same-place adjacent neighbours ∪ gate edges − cut edges, emitted in
-- hex-direction order with {x,y} elements (door element ORDER is inert — the
-- engine reads doors via hasDoorTo()'s .some()). poi reassembled from columns,
-- omitting absent keys; parent emitted for poi_anchor places, parentName from
-- its own column. Pure function of map_cell + map_edge + map_place + map_prose.
create or replace function public.compile_map_v2(p_id text default 'whitemarch')
returns jsonb language sql stable as $$
with dirs(dx,dy,ord) as (values (1,0,1),(1,-1,2),(0,-1,3),(-1,0,4),(-1,1,5),(0,1,6)),
doors as (
  select c.x, c.y,
    jsonb_agg(jsonb_build_object('x', c.x+d.dx, 'y', c.y+d.dy) order by d.ord)
      filter (where
        ( exists (select 1 from public.map_cell n
                  where n.x=c.x+d.dx and n.y=c.y+d.dy
                    and n.place_id is not null and n.place_id=c.place_id)
          or exists (select 1 from public.map_edge g
                     where g.kind='gate' and g.ax=c.x and g.ay=c.y
                       and g.bx=c.x+d.dx and g.by=c.y+d.dy) )
        and not exists (select 1 from public.map_edge ct
                        where ct.kind='cut' and ct.ax=c.x and ct.ay=c.y
                          and ct.bx=c.x+d.dx and ct.by=c.y+d.dy)
      ) as arr
  from public.map_cell c join dirs d on true
  where c.door_controlled
  group by c.x, c.y
),
tiles as (
  select c.x, c.y,
    jsonb_build_object('terrain', c.terrain)
    || case when c.door_controlled then jsonb_build_object('doors', coalesce(dr.arr,'[]'::jsonb)) else '{}'::jsonb end
    || case when c.material is not null then jsonb_build_object('material', c.material) else '{}'::jsonb end
    || case when c.wallside is not null then jsonb_build_object('wallside', c.wallside) else '{}'::jsonb end
    || case
         when c.poi_state='null' then jsonb_build_object('poi', null::jsonb)
         when c.poi_state='object' then jsonb_build_object('poi',
           ( '{}'::jsonb
             || case when c.poi_type    is not null then jsonb_build_object('type', c.poi_type)        else '{}'::jsonb end
             || case when c.name        is not null then jsonb_build_object('name', c.name)            else '{}'::jsonb end
             || case when c.part        is not null then jsonb_build_object('part', c.part)            else '{}'::jsonb end
             || case when c.part_name   is not null then jsonb_build_object('partName', c.part_name)   else '{}'::jsonb end
             || case when c.service     is not null then jsonb_build_object('service', c.service)      else '{}'::jsonb end
             || case when c.access      is not null then jsonb_build_object('access', c.access)        else '{}'::jsonb end
             || case when c.area        is not null then jsonb_build_object('area', c.area)            else '{}'::jsonb end
             || case when p.poi_anchor  then jsonb_build_object('parent', c.place_id)                  else '{}'::jsonb end
             || case when c.parent_name is not null then jsonb_build_object('parentName', c.parent_name) else '{}'::jsonb end
             || case when pr.body       is not null then jsonb_build_object('description', pr.body)    else '{}'::jsonb end
           ))
         else '{}'::jsonb
       end as tile
  from public.map_cell c
  left join public.map_place p  on p.id  = c.place_id
  left join public.map_prose pr on pr.id = c.prose_id
  left join doors dr on dr.x = c.x and dr.y = c.y
)
select jsonb_object_agg(x||','||y, tile) from tiles;
$$;

create or replace function public.refresh_map_compiled(p_id text default 'whitemarch')
returns void language sql as $$
  insert into public.map_compiled (id, tiles, updated_at)
  values (p_id, public.compile_map_v2(p_id), now())
  on conflict (id) do update set tiles = excluded.tiles, updated_at = now();
$$;

-- 3. Read-cutover safety net ------------------------------------------------
-- hydrateMap() reads map_compiled, but the legacy MapEditor still writes the
-- authored blob. Mirror blob edits into map_compiled so reads never go stale
-- until the write path moves onto the relational tables. SECURITY DEFINER so it
-- can write map_compiled (no public write policy) for any authenticated editor.
create or replace function public.sync_map_compiled_from_blob()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.map_compiled (id, tiles, updated_at)
  values (NEW.id, NEW.tiles, now())
  on conflict (id) do update set tiles = excluded.tiles, updated_at = now();
  return NEW;
end $$;

drop trigger if exists trg_sync_map_compiled on public.handcrafted_map;
create trigger trg_sync_map_compiled
  after update of tiles on public.handcrafted_map
  for each row execute function public.sync_map_compiled_from_blob();
