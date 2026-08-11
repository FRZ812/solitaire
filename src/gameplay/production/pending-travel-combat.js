import { cloneJsonData } from "../kernel/json-data.js";
import { productionCombatContextChecksum } from "./pending-directive.js";

const VERSION = 1;
const MAX_KIND_LENGTH = 128;
const MAX_DESCRIPTION_LENGTH = 2_000;
const KEYS = new Set(["campaignId", "contextChecksum", "desc", "kind", "version"]);

function rejected(reason) {
  return { ok: false, reason, pending: null };
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function validCampaignId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function validKind(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_KIND_LENGTH;
}

function validDescription(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_DESCRIPTION_LENGTH;
}

function ownedPending({ campaignId, contextChecksum, kind, desc }) {
  return freeze({
    version: VERSION,
    campaignId,
    contextChecksum,
    kind,
    desc,
  });
}

export function createPendingTravelCombat({ campaignId, state, encounter } = {}) {
  let source;
  try {
    source = cloneJsonData(encounter, "invalid-pending-travel-combat");
  } catch {
    return rejected("invalid-pending-travel-combat");
  }
  if (!validCampaignId(campaignId)) return rejected("invalid-pending-combat-campaign");
  if (source?.posture !== "hostile") return rejected("invalid-travel-combat-posture");
  if (!validKind(source.kind)) return rejected("invalid-travel-combat-kind");
  const desc = source.desc ?? `Hostile ${source.kind.replace(/-/g, " ")} blocks the road.`;
  if (!validDescription(desc)) return rejected("invalid-travel-combat-description");
  let contextChecksum;
  try {
    contextChecksum = productionCombatContextChecksum(state, campaignId);
  } catch {
    return rejected("invalid-pending-combat-context");
  }
  return {
    ok: true,
    reason: null,
    pending: ownedPending({ campaignId, contextChecksum, kind: source.kind, desc }),
  };
}

export function readPendingTravelCombat(value, { campaignId, state } = {}) {
  let input;
  try {
    input = cloneJsonData(value, "invalid-pending-travel-combat");
  } catch {
    return rejected("invalid-pending-travel-combat");
  }
  if (
    !input
    || typeof input !== "object"
    || Array.isArray(input)
    || !Object.keys(input).every((key) => KEYS.has(key))
    || Object.keys(input).length !== KEYS.size
    || input.version !== VERSION
    || !validCampaignId(input.campaignId)
    || typeof input.contextChecksum !== "string"
    || !/^[0-9a-f]{16}$/.test(input.contextChecksum)
    || !validKind(input.kind)
    || !validDescription(input.desc)
  ) return rejected("invalid-pending-travel-combat");
  if (campaignId !== undefined && input.campaignId !== campaignId) {
    return rejected("pending-combat-campaign-mismatch");
  }
  if (state !== undefined) {
    let expected;
    try {
      expected = productionCombatContextChecksum(state, input.campaignId);
    } catch {
      return rejected("invalid-pending-combat-context");
    }
    if (expected !== input.contextChecksum) {
      return rejected("pending-combat-context-mismatch");
    }
  }
  return {
    ok: true,
    reason: null,
    pending: ownedPending(input),
  };
}
