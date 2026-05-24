// Riding & attachment — who rides what, bound by WEIGHT, not headcount.
//
// Every codex character carries two links: `ridingOn` (the mount it sits on, or
// null) and `riders` (the ids sitting on IT, the first being the driver). The
// player rides as "wanderer". Because the links nest, a mount can ride a bigger
// mount: a horse can sit on a dragon, bringing its own riders along as cargo.
//
// The ONE rule is weight: a carrier bears riders up to its `rideCapacity`, where a
// rider's cost is its `effectiveLoad` — its body + worn gear + pack (the player) +
// everyone riding IT, recursively. So "a dragon carries a horse and three people"
// and "a horse cannot carry a dragon" both fall straight out of the numbers, with
// no exploitable headcount cap.

import { wornWeight, carriedWeight, bodyWeightForRace } from "./weight.js";

export function resolveEntity(state, id) {
  return state?.world?.codex?.characters?.[id] || null;
}

export function isMount(entity) {
  return entity?.kind === "mount";
}

export function isMounted(entity) {
  return !!entity?.ridingOn;
}

export function bodyWeightOf(entity) {
  if (!entity) return 0;
  if (typeof entity.bodyWeight === "number") return entity.bodyWeight;
  return bodyWeightForRace(entity.race);
}

// What an entity weighs as cargo on a carrier: body + worn gear + (the player's
// pack) + everyone riding it, transitively.
export function effectiveLoad(entity, state) {
  if (!entity) return 0;
  const codexItems = state.world.codex.items;
  let w = bodyWeightOf(entity) + wornWeight(entity, codexItems);
  if (entity.id === "wanderer") w += carriedWeight(state.character.inventory, codexItems);
  for (const rid of entity.riders || []) {
    const r = resolveEntity(state, rid);
    if (r) w += effectiveLoad(r, state);
  }
  return w;
}

// Weight a mount is already bearing from its direct riders (each rider's full
// nested load).
export function currentRideLoad(mount, state) {
  return (mount?.riders || []).reduce((sum, rid) => {
    const r = resolveEntity(state, rid);
    return sum + (r ? effectiveLoad(r, state) : 0);
  }, 0);
}

// A mount's effective carrying limit: its base rideCapacity plus any TRANSIENT
// buff (`rideCapacityBonus` — a strength spell, a harness). Apply a buff by
// setting that field and clearing it when it lapses; the checks below read it
// live, so when it clears an over-loaded mount is flagged at once (isOverloaded)
// rather than carrying a stale "still fits" verdict.
export function rideCapacityOf(mount) {
  return (mount?.rideCapacity || 0) + (mount?.rideCapacityBonus || 0);
}

export function freeCapacity(mount, state) {
  return rideCapacityOf(mount) - currentRideLoad(mount, state);
}

export function carrierOf(state, riderId) {
  const e = resolveEntity(state, riderId);
  return e?.ridingOn ? resolveEntity(state, e.ridingOn) : null;
}

// The topmost carrier above an entity (what's actually doing the moving/flying).
export function outermostCarrier(state, id) {
  let cur = resolveEntity(state, id);
  let guard = 0;
  while (cur?.ridingOn && guard++ < 64) {
    const next = resolveEntity(state, cur.ridingOn);
    if (!next || next.id === cur.id) break;
    cur = next;
  }
  return cur && cur.id !== id ? cur : null;
}

// id + everyone in its rider subtree (transitive) — used for cycle checks.
function subtree(state, id) {
  const out = new Set([id]);
  const stack = [id];
  let guard = 0;
  while (stack.length && guard++ < 256) {
    const e = resolveEntity(state, stack.pop());
    for (const rid of e?.riders || []) if (!out.has(rid)) { out.add(rid); stack.push(rid); }
  }
  return out;
}

const isDead = (e) => e?.combatState?.status === "dead";

// Every carrier from `mountId` up the saddle-chain: the mount itself, the mount it
// rides, and so on. Adding a rider to `mountId` adds its weight to ALL of these,
// so each must have room (this is what stops a stack of nested mounts overloading
// the dragon at the bottom).
function carrierChain(state, mountId) {
  const chain = [];
  let cur = resolveEntity(state, mountId);
  let guard = 0;
  while (cur && guard++ < 64) {
    chain.push(cur);
    cur = cur.ridingOn ? resolveEntity(state, cur.ridingOn) : null;
  }
  return chain;
}

// Is a mount bearing more than it can carry RIGHT NOW? (e.g. its rider picked up
// heavy loot after mounting — engine/weight.js makes the pack count.)
export function isOverloaded(mount, state) {
  return !!mount && currentRideLoad(mount, state) > rideCapacityOf(mount);
}

// Every mount in the party currently over its ride capacity.
export function overloadedMounts(state) {
  return (state.party || [])
    .map((id) => resolveEntity(state, id))
    .filter((c) => isMount(c) && isOverloaded(c, state));
}

// Can `riderId` mount `mountId`? Returns { ok, reason }. Enforces weight up the
// WHOLE carrier chain, not just the immediate mount, so nesting can't be abused.
export function canMount(state, riderId, mountId) {
  if (riderId === mountId) return { ok: false, reason: "It can't ride itself." };
  const rider = resolveEntity(state, riderId);
  const mount = resolveEntity(state, mountId);
  if (!rider) return { ok: false, reason: "No such rider." };
  if (!mount) return { ok: false, reason: "No such mount." };
  if (!isMount(mount)) return { ok: false, reason: `${mount.name} is not a mount.` };
  if (isDead(mount)) return { ok: false, reason: `${mount.name} is in no state to be ridden.` };
  if (isDead(rider)) return { ok: false, reason: `${rider.name} cannot mount.` };
  if (rider.ridingOn === mountId) return { ok: false, reason: "Already mounted." };
  // A loop: you can't ride something that (transitively) rides you.
  if (subtree(state, riderId).has(mountId)) return { ok: false, reason: "That would loop the saddle-chain." };
  // Probe on a state where the rider has been lifted off whatever it currently
  // rides, so a re-seat within the same chain isn't double-counted; then the
  // rider's full weight must fit the mount AND every carrier above it.
  const probe = detach(state, riderId);
  const need = effectiveLoad(resolveEntity(probe, riderId), probe);
  for (const carrier of carrierChain(probe, mountId)) {
    const free = freeCapacity(carrier, probe);
    if (need > free) {
      const who = carrier.id === mountId ? mount.name : `${carrier.name} (bearing ${mount.name})`;
      return { ok: false, reason: `Too heavy — ${who} can bear ${Math.max(0, Math.round(free))} more, but ${rider.name} is ${Math.round(need)}.` };
    }
  }
  return { ok: true };
}

// Detach a rider from whatever it's on (no-op if afoot). Returns new state.
function detach(state, riderId) {
  const rider = resolveEntity(state, riderId);
  if (!rider?.ridingOn) return state;
  const carrierId = rider.ridingOn;
  const chars = { ...state.world.codex.characters };
  chars[riderId] = { ...chars[riderId], ridingOn: null };
  const carrier = chars[carrierId];
  if (carrier) chars[carrierId] = { ...carrier, riders: (carrier.riders || []).filter((x) => x !== riderId) };
  return { ...state, world: { ...state.world, codex: { ...state.world.codex, characters: chars } } };
}

// Seat `riderId` on `mountId` (detaching from any prior carrier first).
export function mount(state, riderId, mountId) {
  const check = canMount(state, riderId, mountId);
  if (!check.ok) return { ok: false, reason: check.reason, state };
  const s = detach(state, riderId);
  const chars = { ...s.world.codex.characters };
  chars[riderId] = { ...chars[riderId], ridingOn: mountId };
  const m = chars[mountId];
  const riders = [...(m.riders || [])];
  if (!riders.includes(riderId)) riders.push(riderId);
  chars[mountId] = { ...m, riders };
  return { ok: true, state: { ...s, world: { ...s.world, codex: { ...s.world.codex, characters: chars } } } };
}

// Get a rider off its mount.
export function dismount(state, riderId) {
  return { ok: true, state: detach(state, riderId) };
}

// Force everyone off a mount (e.g. it died, or it's being dismissed). Riders end
// up afoot; nested riders stay on their immediate carrier.
export function dismountAllFrom(state, mountId) {
  const m = resolveEntity(state, mountId);
  let s = state;
  for (const rid of [...(m?.riders || [])]) s = detach(s, rid);
  // Also get the mount itself off anything it was riding.
  s = detach(s, mountId);
  return s;
}

// The flying mount actually carrying the player aloft (outermost carrier that can
// fly), or null. This is what powers mount-flight travel (App.handleFly).
export function playerFlightMount(state) {
  const outer = outermostCarrier(state, "wanderer");
  return outer && outer.moveProfile?.canFly ? outer : null;
}

// The mount the player is directly riding (their seat), for ground travel-speed.
export function playerGroundMount(state) {
  return carrierOf(state, "wanderer");
}
