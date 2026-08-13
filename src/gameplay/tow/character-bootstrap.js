// The one character bootstrap compiler.
//
// The plan's invariant is that ready-made templates, custom creation, Quick Start,
// creation practice and developer fixtures all arrive through the same validator. Today
// each caller assembles character state its own way, which is how two entry paths drift
// into producing subtly different characters.
//
// So a bootstrap is compiled into a receipt first and applied second. The receipt carries
// a deterministic identity derived from its own content, which buys three things the
// phase gate asks for: applying the same receipt twice is a no-op, applying a *different*
// receipt to an already-started character is refused, and a partially initialised state
// is refused rather than half-written.

import { gameplayChecksum } from "../kernel/replay.js";
import { createTowBuild, isTowBuild, startingBuild } from "./build.js";
import { FALLBACK_PROFESSION_ID, startingPackage } from "./starting-packages.js";
import { getStartingArchetype } from "./starting-archetypes.js";

export const CHARACTER_BOOTSTRAP_VERSION = 2;
const RECEIPT_KEYS = Object.freeze(["archetypeId", "build", "id", "origin", "professionId", "version"]);
const ORIGINS = new Set(["archetype", "template", "custom", "quick-start", "practice", "fixture"]);

function rejected(reason) {
  return { ok: false, reason, receipt: null };
}

/**
 * Compile a bootstrap request into a receipt.
 *
 * @param {{archetypeId?: string, professionId?: string, level?: number, origin?: string, build?: object}} request
 */
export function compileCharacterBootstrap(request = {}) {
  const origin = request.origin ?? "custom";
  if (!ORIGINS.has(origin)) return rejected("invalid-bootstrap-origin");

  const archetype = request.archetypeId == null ? null : getStartingArchetype(request.archetypeId);
  if (request.archetypeId != null && !archetype) return rejected("unknown-starting-archetype");

  const level = request.level ?? 1;
  if (!Number.isSafeInteger(level) || level < 1 || level > 100) {
    return rejected("invalid-bootstrap-level");
  }

  const professionId = archetype?.professionId || (
    typeof request.professionId === "string" && startingPackage(request.professionId)
      ? request.professionId
      : FALLBACK_PROFESSION_ID
  );

  let build;
  try {
    const requestedBuild = archetype?.build || request.build;
    // An explicit build wins — that is how a fixture or a resumed draft pins an exact
    // loadout — but it is validated by the same constructor as a fresh one.
    build = requestedBuild
      ? createTowBuild({ ...requestedBuild, professionId })
      : startingBuild(professionId, { level });
  } catch (error) {
    return rejected(String(error?.message || "invalid-bootstrap-build"));
  }
  if (!build || !isTowBuild(build)) return rejected("invalid-bootstrap-build");

  // Identity is derived from content, so the same request always compiles to the same
  // receipt and a changed request never collides with the old one.
  const archetypeId = archetype?.id || null;
  const id = gameplayChecksum({
    version: CHARACTER_BOOTSTRAP_VERSION,
    origin,
    archetypeId,
    professionId,
    build,
  });

  return {
    ok: true,
    reason: null,
    receipt: Object.freeze({
      version: CHARACTER_BOOTSTRAP_VERSION,
      id,
      origin,
      archetypeId,
      professionId,
      build: Object.freeze(build),
    }),
  };
}

export function isCharacterBootstrapReceipt(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  if (keys.length !== RECEIPT_KEYS.length || keys.some((key, at) => key !== RECEIPT_KEYS[at])) {
    return false;
  }
  return value.version === CHARACTER_BOOTSTRAP_VERSION
    && typeof value.id === "string"
    && /^[0-9a-f]{16}$/.test(value.id)
    && ORIGINS.has(value.origin)
    && (value.archetypeId === null || Boolean(getStartingArchetype(value.archetypeId)))
    && typeof value.professionId === "string"
    && isTowBuild(value.build);
}

/**
 * Apply a receipt to campaign mechanics state.
 *
 * Returns the unchanged state when the same receipt is applied again, and refuses when a
 * different receipt meets an already-bootstrapped character. Nothing is written on a
 * refusal.
 */
export function applyCharacterBootstrap(mechanics, receipt) {
  if (!isCharacterBootstrapReceipt(receipt)) {
    return { ok: false, reason: "invalid-bootstrap-receipt", mechanics: null };
  }
  const current = mechanics ?? {};
  const existingId = current.bootstrapId ?? null;
  const existingBuild = current.build ?? null;

  if (existingId !== null) {
    if (existingId === receipt.id) {
      // Same receipt, already applied. A no-op, not an error — a retried save or a
      // double-mounted component must not be able to reroll a character.
      return { ok: true, reason: null, applied: false, mechanics: current };
    }
    return { ok: false, reason: "bootstrap-already-applied", mechanics: null };
  }

  // A build without a receipt id means something wrote character state outside this
  // compiler. Refuse rather than overwrite it.
  if (existingBuild !== null) {
    return { ok: false, reason: "partial-bootstrap-state", mechanics: null };
  }

  return {
    ok: true,
    reason: null,
    applied: true,
    mechanics: {
      ...current,
      bootstrapId: receipt.id,
      bootstrapOrigin: receipt.origin,
      build: receipt.build,
    },
  };
}
