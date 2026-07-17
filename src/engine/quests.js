// Tavern quest board: deterministic board generation + accepting/abandoning
// tasks + working day-labour. Recruiting a companion is a narrative hand-off
// (App calls the narrator), so there's no party machinery here.
//
// Accepted tasks live on state.world.quests as light records; completion is
// left to play in the world (the narrator can reward them) — the board only
// hands out leads and tracks what you've taken.

import { advanceTime } from "./time.js";
import { coinsToCopper, copperToCoins, formatCopper } from "./economy.js";
import { spoilState } from "./spoilage.js";
import { ageState } from "./aging.js";
import { makeRng } from "./town-gen.js";
import { TASK_POOL, JOB_POOL, BOARD_REFRESH_DAYS } from "../data/postings.js";
import { COMPANION_LIST } from "../data/companions.js";
import { advanceProgression, earnedLevelGrowthText, projectCharacterProgression } from "./progression.js";

const clamp100 = (v) => Math.max(0, Math.min(100, v));

export function boardBucket(day) {
  return Math.floor((day || 0) / BOARD_REFRESH_DAYS);
}

// Weighted sample without replacement.
function pickN(pool, n, rng) {
  const avail = pool.slice();
  const out = [];
  for (let k = 0; k < n && avail.length; k++) {
    const total = avail.reduce((s, e) => s + (e.weight ?? 1), 0);
    let r = rng() * total;
    let idx = 0;
    for (let i = 0; i < avail.length; i++) { r -= (avail[i].weight ?? 1); if (r <= 0) { idx = i; break; } }
    out.push(avail[idx]);
    avail.splice(idx, 1);
  }
  return out;
}

// Roll the board for a tile/day. Stable within a refresh window; ids are
// derived from the window so accepting dedupes and re-renders are stable.
export function generateBoard(tileKey, day) {
  const bucket = boardBucket(day);
  const rng = makeRng(`board:${tileKey}:${bucket}`);
  const tasks = pickN(TASK_POOL, 4, rng).map((t) => ({ ...t, id: `task-${bucket}-${t.key}` }));
  const recruits = pickN(COMPANION_LIST, 3, rng); // full companion templates (keep their real ids)
  const jobs = pickN(JOB_POOL, 4, rng).map((t) => ({ ...t, id: `job-${bucket}-${t.key}` }));
  return { bucket, tasks, recruits, jobs };
}

export function activeQuests(state) {
  return (state.world.quests || []).filter((q) => q.status === "active");
}

// Take a task: record it as an active quest (deduped by id).
export function acceptTask(state, posting) {
  const quests = state.world.quests || [];
  if (quests.some((q) => q.id === posting.id)) return { state, ok: false, reason: "Already taken." };
  const q = {
    id: posting.id, title: posting.title, giver: posting.giver, type: posting.type,
    desc: posting.desc, rewardCp: posting.rewardCp, day: state.time.day, status: "active",
    loc: posting.target || null, locName: posting.targetName || null, // map marker + bearings
  };
  return { ok: true, state: { ...state, world: { ...state.world, quests: [...quests, q] } } };
}

export function abandonTask(state, id) {
  const quests = state.world.quests || [];
  return { ok: true, state: { ...state, world: { ...state.world, quests: quests.filter((q) => q.id !== id) } } };
}

// Hire yourself out: a stretch of honest labour. Advances time, pays the wage,
// and wears you down (needs). Deterministic; returns a summary for a log beat.
export function applyDayLabour(state, job) {
  const time = advanceTime(state.time, (job.hours || 4) * 60);
  const coins = copperToCoins(coinsToCopper(state.character.inventory.coins) + (job.payCp || 0));
  const cur = state.character.needs || { hunger: 0, thirst: 0, sleep: 0 };
  const cost = job.needs || { hunger: -10, thirst: -10, sleep: -8 };
  const needs = {
    hunger: clamp100((cur.hunger || 0) + (cost.hunger || 0)),
    thirst: clamp100((cur.thirst || 0) + (cost.thirst || 0)),
    sleep: clamp100((cur.sleep || 0) + (cost.sleep || 0)),
  };
  let summary = `You ${job.title.toLowerCase()} for ${job.hours} hours and earn ${formatCopper(job.payCp || 0)}.`;
  const worked = {
    ...state,
    time,
    character: { ...state.character, needs, inventory: { ...state.character.inventory, coins } },
  };
  // A stretch of work can carry past a day's turn — spoil any food that's gone off.
  const sp = spoilState(worked);
  if (sp.spoiled.length) summary += ` While you worked, ${sp.spoiled.map((s) => `${s.quantity}× ${s.name}`).join(", ")} spoiled in your pack.`;
  // Age the codex too — a no-op on hours-scale jobs, but defensive for any future
  // multi-day labour and keeps every time-advance site uniform.
  const ag = ageState(sp.state);
  let next = ag.state;
  const progress = advanceProgression(next.character, Math.max(1, job.hours || 4) * 30);
  if (progress.earnedLevels > 0) {
    next = {
      ...next,
      beats: [...(next.beats || []), {
        id: `labour-level-${Date.now()}`,
        type: "growth",
        text: earnedLevelGrowthText(progress),
      }],
    };
  }
  return { ok: true, summary, state: projectCharacterProgression(next) };
}
