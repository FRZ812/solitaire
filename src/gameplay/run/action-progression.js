import {
  BASIC_ATTACK,
  getActionProgressionOffer,
  getActionReplacementFamily,
} from "../reference/actions.js";

export const MAX_ACTION_UPGRADE_LEVEL = 1_000;

function ownData(object, key) {
  if (!object || typeof object !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

function denseDataArray(value) {
  if (!Array.isArray(value)) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const dataKeys = Reflect.ownKeys(descriptors).filter((key) => key !== "length");
  if (dataKeys.some((key) => typeof key === "symbol") || dataKeys.length !== value.length) return null;
  const result = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
    result.push(descriptor.value);
  }
  return result;
}

function freezeState(actionId, upgrades, familyLock) {
  const frozenUpgrades = Object.freeze(upgrades.map((upgrade) => Object.freeze({
    offerId: upgrade.offerId,
    familyId: upgrade.familyId,
    level: upgrade.level,
  })));
  return Object.freeze({
    version: 1,
    actions: Object.freeze({
      attack: Object.freeze({ actionId, upgrades: frozenUpgrades }),
    }),
    actionFamilyLocks: Object.freeze({ attack: familyLock }),
  });
}

function canonicalState(state) {
  if (ownData(state, "version") !== 1) return null;
  const attack = ownData(ownData(state, "actions"), "attack");
  const actionId = ownData(attack, "actionId");
  const familyLock = ownData(ownData(state, "actionFamilyLocks"), "attack");
  const upgrades = denseDataArray(ownData(attack, "upgrades"));
  if (typeof actionId !== "string" || upgrades === null) return null;
  if (familyLock !== null && !getActionReplacementFamily(familyLock)) return null;
  if (familyLock === null && actionId !== BASIC_ATTACK.id) return null;
  if (familyLock !== null && getActionReplacementFamily(familyLock).replacementActionId !== actionId) {
    return null;
  }

  const normalized = [];
  const seen = new Set();
  for (const upgrade of upgrades) {
    const offerId = ownData(upgrade, "offerId");
    const familyId = ownData(upgrade, "familyId");
    const level = ownData(upgrade, "level");
    const offer = getActionProgressionOffer(offerId);
    if (
      !offer
      || offer.kind !== "upgrade"
      || offer.familyId !== familyId
      || !Number.isInteger(level)
      || level < 1
      || level > MAX_ACTION_UPGRADE_LEVEL
      || seen.has(offerId)
    ) return null;
    seen.add(offerId);
    normalized.push({ offerId, familyId, level });
  }
  return freezeState(actionId, normalized, familyLock);
}

function rejected(state, reason) {
  return Object.freeze({
    ok: false,
    reason,
    state,
    events: Object.freeze([]),
  });
}

export function createActionProgressionState() {
  return freezeState(BASIC_ATTACK.id, [], null);
}

export function isActionProgressionState(value) {
  return canonicalState(value) !== null;
}

export function filterActionProgressionOffers(state, offerIds) {
  const canonical = canonicalState(state);
  const ids = denseDataArray(offerIds);
  if (!canonical || ids === null || ids.some((id) => typeof id !== "string")) return [];
  const familyLock = canonical.actionFamilyLocks.attack;
  return ids.filter((offerId) => {
    const offer = getActionProgressionOffer(offerId);
    if (!offer) return false;
    if (familyLock === null) return true;
    return offer.kind === "upgrade" && offer.familyId === familyLock;
  });
}

export function chooseActionProgressionOffer(state, offerId) {
  const canonical = canonicalState(state);
  if (!canonical) return rejected(null, "invalid-action-progression-state");
  const offer = getActionProgressionOffer(offerId);
  if (!offer) return rejected(canonical, "unknown-action-offer");

  const familyLock = canonical.actionFamilyLocks.attack;
  if (familyLock !== null && offer.familyId !== familyLock) {
    return rejected(canonical, "action-family-locked");
  }
  if (familyLock !== null && offer.kind === "replacement") {
    return rejected(canonical, "action-already-replaced");
  }

  if (offer.kind === "replacement") {
    const nextState = freezeState(
      offer.replacementActionId,
      canonical.actions.attack.upgrades,
      offer.familyId,
    );
    return Object.freeze({
      ok: true,
      state: nextState,
      events: Object.freeze([Object.freeze({
        type: "action-replaced",
        slot: offer.slot,
        familyId: offer.familyId,
        offerId: offer.id,
        actionIdBefore: canonical.actions.attack.actionId,
        actionIdAfter: offer.replacementActionId,
      })]),
    });
  }

  const currentUpgrades = canonical.actions.attack.upgrades;
  const existing = currentUpgrades.find((upgrade) => upgrade.offerId === offer.id);
  if (existing?.level === MAX_ACTION_UPGRADE_LEVEL) {
    return rejected(canonical, "action-upgrade-limit-reached");
  }
  const upgrades = existing
    ? currentUpgrades.map((upgrade) => (
      upgrade.offerId === offer.id
        ? { ...upgrade, level: upgrade.level + 1 }
        : upgrade
    ))
    : [...currentUpgrades, {
      offerId: offer.id,
      familyId: offer.familyId,
      level: 1,
    }];
  const nextState = freezeState(
    canonical.actions.attack.actionId,
    upgrades,
    canonical.actionFamilyLocks.attack,
  );
  const levelBefore = existing?.level ?? 0;
  return Object.freeze({
    ok: true,
    state: nextState,
    events: Object.freeze([Object.freeze({
      type: "action-upgraded",
      slot: offer.slot,
      familyId: offer.familyId,
      offerId: offer.id,
      levelBefore,
      levelAfter: levelBefore + 1,
    })]),
  });
}
