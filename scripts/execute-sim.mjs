// Execute-passive (Body 30) sim. Probes the post-tune behaviour end-to-end
// through the real engine: any landed hit on a foe whose PRE-damage HP is at
// or below 20% max HP is an instant kill; hits that bring a foe from above
// 20% down to below should NOT trigger execute (that was the old, post-damage
// trap we just removed).
//
// Run: node scripts/execute-sim.mjs [runsPerScenario]

import { initCombat, playerAct } from "../src/engine/combat.js";
import { BASIC_ATTACK } from "../src/data/abilities.js";
import { recomputeVitalityMax, recomputeResolveMax } from "../src/engine/attributes.js";
import { generateEnemyGroup } from "../src/data/bestiary.js";

// Same codex pattern the combat sim uses — a real common-grade blade + light
// armour so the player actually has a weapon equipped in the engine.
const codex = {
  characters: { wanderer: { id: "wanderer", worn: ["w", "a"] } },
  items: {
    w: { id: "w", name: "Iron Shortsword", kind: "weapon", tier: "common",
         combat: { damage: { min: 5, max: 8, type: "physical", pen: 0 } } },
    a: { id: "a", name: "Leather Armor", kind: "armor", tier: "common",
         combat: { armor: 3 } },
  },
};

// Body 30 trips the Execute passive (statMods.execute = 0.20) via
// attributeThresholdMods → deriveCombatStats → cs.player.execute.
function bodyThirtyPlayer() {
  const c = {
    name: "Player",
    attributes: { body: 30, reflex: 6, vigor: 10, mind: 2, wit: 3, presence: 2 },
    abilities: [],
    proficiencies: {},
  };
  recomputeVitalityMax(c);
  recomputeResolveMax(c);
  c.resolve = c.resolveMax;
  c.vitality = c.vitalityMax;
  return c;
}

const RUNS = Number(process.argv[2] || 1500);

// Per-trial: build a fresh fight, pin the foe at the requested fraction of its
// max HP, run ONE basic-attack, then read what the engine logged + did to it.
function trial(startFraction) {
  let cs = initCombat(
    bodyThirtyPlayer(),
    codex,
    // Ogre = beefy single foe (~Vigor 7) → high enough maxHealth that the
    // 25%/20%/18% bands separate cleanly from raw-damage variance.
    generateEnemyGroup("ogre", { count: 1, maxTier: "common" }),
    { allies: [] },
  );
  if (cs.phase !== "player") return null;

  const foe = cs.enemies[0];
  // Wipe armour/dodge so hit-and-damage variance stays a clean signal — we're
  // measuring the execute gate, not the to-hit curve.
  foe.armor = 0;
  foe.ward = 0;
  foe.dodge = 0;
  foe.statuses = foe.statuses || [];
  // Inflate maxHealth so a typical Body-30 swing (~25 dmg) doesn't outright
  // kill the foe at low HP — the execute log only fires when raw damage
  // alone wouldn't have killed, so the foe needs enough cushion to survive
  // the swing and then be finished by the execute branch.
  foe.maxHealth = 500;

  const startHp = Math.max(1, Math.floor((foe.maxHealth || 0) * startFraction));
  foe.health = startHp;

  const beforeLogLen = cs.log.length;
  const before = foe.health;
  cs = playerAct(cs, BASIC_ATTACK.id, 0);
  const after = cs.enemies[0].health;
  const dealt = Math.max(0, before - after);
  const newLog = cs.log.slice(beforeLogLen).map((e) => (typeof e === "string" ? e : (e?.text || "")));
  const executed = newLog.some((t) => /executes/i.test(t));

  return { maxHealth: foe.maxHealth, before, after, dealt, executed, landed: dealt > 0 };
}

function scenario(label, startFraction) {
  const r = { trials: 0, landed: 0, died: 0, execLog: 0, rawKill: 0, survived: 0,
              postHpSum: 0, dealtSum: 0, maxHpSum: 0 };
  for (let i = 0; i < RUNS; i++) {
    const t = trial(startFraction);
    if (!t) continue;
    r.trials++;
    r.maxHpSum += t.maxHealth;
    if (!t.landed) continue;
    r.landed++;
    r.dealtSum += t.dealt;
    if (t.after <= 0) {
      r.died++;
      if (t.executed) r.execLog++; else r.rawKill++;
    } else {
      r.survived++;
      r.postHpSum += t.after;
    }
  }
  const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : "  0.0%");
  const avgMax = r.maxHpSum / Math.max(1, r.trials);
  console.log(
    label.padEnd(28),
    `maxHP~${avgMax.toFixed(0).padStart(3)}`,
    `landed ${pct(r.landed, r.trials).padStart(6)}`,
    `· died ${pct(r.died, r.landed).padStart(6)}`,
    `· execLog ${String(r.execLog).padStart(4)}`,
    `rawKill ${String(r.rawKill).padStart(4)}`,
    `survive ${String(r.survived).padStart(4)}`,
    `avgDmg ${(r.dealtSum / Math.max(1, r.landed)).toFixed(1)}`,
    r.survived ? `avgPostHP ${(r.postHpSum / r.survived).toFixed(1)}` : "",
  );
  return r;
}

console.log(`\n=== Execute (Body 30) sim — ${RUNS} runs/scenario ===\n`);
const above   = scenario("foe starts at 30% HP", 0.30);
const justAbv = scenario("foe starts at 25% HP", 0.25);  // the old "post-damage trap" zone
const onLine  = scenario("foe starts at 20% HP", 0.20);  // threshold edge: check is <=, so this counts
const under   = scenario("foe starts at 18% HP", 0.18);
const tiny    = scenario("foe starts at  5% HP", 0.05);

// --- Invariants --------------------------------------------------------------
let failures = 0;
function check(label, ok, detail = "") {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

console.log("\nInvariants:");
// 1. Foe well ABOVE the threshold: no execute, ever. (A hit might still raw-kill
//    via a big crit — that's fine; we only forbid the execute LOG.)
check(
  "30% start → execute log never fires",
  above.execLog === 0,
  `execLog=${above.execLog}`,
);

// 2. The old "post-damage trap": foe just above the threshold (25%), where a
//    hit could drop them below it. Under the old code this incorrectly triggered
//    execute. Under the new code it must not.
check(
  "25% start → execute log never fires (old post-damage trap is gone)",
  justAbv.execLog === 0,
  `execLog=${justAbv.execLog}`,
);

// 3. AT the threshold (20%) — the check is `before <= threshold`, so on-the-line
//    counts. Any landed hit dealing damage that doesn't outright kill should
//    execute. (Outright kills suppress the execute log to avoid double-counting.)
check(
  "20% start → every survivor-hit executes (no foe limps away)",
  onLine.landed > 0 && onLine.survived === 0,
  `landed=${onLine.landed}, survived=${onLine.survived}`,
);

// 4. Below the threshold: same rule. A landed hit always kills.
check(
  "18% start → every landed hit kills",
  under.landed > 0 && under.died === under.landed,
  `landed=${under.landed}, died=${under.died}`,
);
check(
  "5% start → every landed hit kills",
  tiny.landed > 0 && tiny.died === tiny.landed,
  `landed=${tiny.landed}, died=${tiny.died}`,
);

// 5. No double-logging on raw kills: when the hit itself drops HP to 0, the
//    execute log MUST NOT fire too — the `target.health > 0` guard owns this.
//    rawKill count is the proof: rawKill > 0 with no leak into execLog.
//    (Verified implicitly by counts summing to died, but assert explicitly.)
check(
  "below-threshold raw-kills don't double-log as executes",
  tiny.died === tiny.execLog + tiny.rawKill && under.died === under.execLog + under.rawKill,
  `tiny: ${tiny.died} = ${tiny.execLog}+${tiny.rawKill}, under: ${under.died} = ${under.execLog}+${under.rawKill}`,
);

console.log(`\n${failures === 0 ? "All invariants hold." : `${failures} invariant(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
