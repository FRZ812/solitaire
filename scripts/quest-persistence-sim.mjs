// Regression harness for the "active quests vanish from the journal" bug.
//
// An accepted task lives on state.world.quests. Accepting it does NOT record a
// narrator turn, but travelling DOES — and the timeline checkpoint used by
// Rewind/Rewrite once rebuilt `world` from only {codex, seen, tiles, currentTile},
// silently dropping world.quests (and lootedCaches). So any rewind/rewrite after
// accepting a quest erased it with no completion or abandon.
//
// This sim mirrors the repro: accept a "goblin scout" task, travel several tiles
// (each a recorded turn), then exercise the rewind/rewrite path — asserting the
// quest stays present and active throughout.
//
// Run: node scripts/quest-persistence-sim.mjs

import { makeInitialState } from "../src/data/initial-state.js";
import { acceptTask, activeQuests } from "../src/engine/quests.js";
import { applyBeat } from "../src/engine/beat.js";
import { recordTurn, stateBeforeTurn } from "../src/engine/timeline.js";
import { HEX_DIRECTIONS } from "../src/engine/world.js";

let failures = 0;
function check(label, cond) {
  if (cond) { console.log(`  ok   ${label}`); return; }
  console.log(`  FAIL ${label}`);
  failures++;
}
const hasQuest = (state, id) => activeQuests(state).some((q) => q.id === id);

// A board posting like the tavern hands out (engine/quests.js shape).
const GOBLIN_SCOUT = {
  id: "task-0-goblin-scout",
  title: "The Goblin Scout",
  giver: "the innkeeper",
  type: "errand",
  desc: "A lone goblin scout has been seen watching the east road. Drive it off.",
  rewardCp: 120,
  target: { x: 6, y: 0 },
  targetName: "the east road",
};

// One simulated travel turn: move the player one hex east, pass time, narrate —
// recorded exactly as App's travel handler records it (base → applyBeat → recordTurn).
function travelOneHex(state, step) {
  const cur = state.world.currentTile;
  const dest = { x: cur.x + HEX_DIRECTIONS[0].x, y: cur.y + HEX_DIRECTIONS[0].y };
  const beat = { minutes_passed: 30, narration: `You press on east, step ${step}.` };
  const base = { ...state, beats: [...state.beats, { id: `p${step}`, type: "player", content: "Travel east." }] };
  const next = applyBeat(base, beat, { travelToCoords: dest });
  return recordTurn(base, `[PLAYER ACTION] travel east ${step}`, next);
}

console.log("Quest persistence across travel + rewind/rewrite\n");

// Start a created character standing at the origin, then take the task.
let state = { ...makeInitialState(), created: true };
const accepted = acceptTask(state, GOBLIN_SCOUT);
check("accepting the task succeeds", accepted.ok);
state = accepted.state;
check("quest is active right after accepting", hasQuest(state, GOBLIN_SCOUT.id));

// Travel ~6 tiles, asserting after every leg that the quest is still in the journal.
const LEGS = 6;
const turnAfterLeg = []; // turns.length snapshot after each leg, for rewinding later
for (let i = 1; i <= LEGS; i++) {
  state = travelOneHex(state, i);
  turnAfterLeg.push(state.turns.length);
  check(`quest still active after travel leg ${i}`, hasQuest(state, GOBLIN_SCOUT.id));
}
check("each travel leg recorded a checkpoint", state.turns.length === LEGS);
check(`player actually moved ${LEGS} hexes east`, state.world.currentTile.x === LEGS);

// The real regression: rewind. stateBeforeTurn reconstructs `world` from the
// checkpoint — it must restore world.quests, not drop it.
const rewoundToStart = stateBeforeTurn(state, 0); // back to just before the first travel
check("quest survives rewind to before the first travel", hasQuest(rewoundToStart, GOBLIN_SCOUT.id));
check("rewind to turn 0 puts the player back at the origin", rewoundToStart.world.currentTile.x === 0);

const rewoundToMiddle = stateBeforeTurn(state, 3); // back to before the 4th travel leg
check("quest survives rewind to a middle turn", hasQuest(rewoundToMiddle, GOBLIN_SCOUT.id));
check("rewind to a middle turn restores that turn's position", rewoundToMiddle.world.currentTile.x === 3);

// Rewrite path: rewind to a turn, then re-record a fresh turn from that base —
// the quest must carry through both halves (this is what handleRewriteBeat does).
const base = stateBeforeTurn(state, 2);
check("quest present in the rewrite base state", hasQuest(base, GOBLIN_SCOUT.id));
const reBeat = { minutes_passed: 30, narration: "You take the journey a different way." };
const reNext = applyBeat(base, reBeat, { travelToCoords: { x: base.world.currentTile.x + 1, y: base.world.currentTile.y } });
const rewritten = recordTurn(base, "[REWRITE]", reNext);
check("quest survives a rewrite (rewind + re-record)", hasQuest(rewritten, GOBLIN_SCOUT.id));

// Sanity: the heavy pooled parts still reconstruct correctly after the change.
check("rewound state keeps a real codex", !!rewoundToMiddle.world.codex?.characters?.wanderer);
check("rewound state keeps the tiles map", typeof rewoundToMiddle.world.tiles === "object");

console.log(`\n${failures === 0 ? "PASS" : `FAIL (${failures} failed)`}`);
process.exit(failures === 0 ? 0 : 1);
