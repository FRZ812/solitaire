// Timeline checkpoints powering the long-press Rewrite / Edit / Rewind menu.
//
// Each narrator turn records a checkpoint: enough to reconstruct the state as it
// was BEFORE that turn. beats/apiHistory are restored by slicing the saved arrays
// back to their pre-turn lengths (cheap); the small character/time snapshots are
// stored inline; the world's heavy parts (codex ~28KB, seen ~24KB, tiles) are kept
// in reference-deduped pools, so the JSON stores each distinct part only once even
// across many checkpoints (applyBeat preserves these refs when a turn doesn't touch
// them).

const emptyPools = () => ({ codex: [], seen: [], tiles: [] });

// Reuse an existing pooled object when one is reference-identical, else append.
function poolPush(pool, obj) {
  const idx = pool.indexOf(obj);
  if (idx >= 0) return { pool, idx };
  return { pool: [...pool, obj], idx: pool.length };
}

// Record a finished narrator turn. base = the state the beat was applied to,
// message = the prompt that produced it, next = the result. extra.travel carries
// the journey context (route, destination, encounter) so a rewritten travel turn
// can re-land the player. Returns next with a checkpoint appended (or next
// unchanged if the turn produced no rewritable text).
export function recordTurn(base, message, next, extra = {}) {
  const startLen = base.beats.length;
  const turnBeats = next.beats.slice(startLen);
  const textBeats = turnBeats.filter((b) => b.type === "narration" || b.type === "dialogue");
  if (textBeats.length === 0) return next;
  const prevText = textBeats
    .map((b) => (b.type === "dialogue" ? `${b.name}: "${b.line}"` : b.content))
    .join("\n\n");
  const p0 = next.pools || emptyPools();
  const c = poolPush(p0.codex, base.world.codex);
  const s = poolPush(p0.seen, base.world.seen);
  const t = poolPush(p0.tiles, base.world.tiles);
  const pools = { codex: c.pool, seen: s.pool, tiles: t.pool };
  const checkpoint = {
    beatsLen: startLen,
    endLen: next.beats.length,
    historyLen: base.apiHistory.length,
    message,
    prevText,
    char: base.character,
    time: base.time,
    world: { codexIdx: c.idx, seenIdx: s.idx, tilesIdx: t.idx, currentTile: base.world.currentTile },
  };
  if (extra.travel) checkpoint.travel = extra.travel;
  return { ...next, pools, turns: [...(next.turns || []), checkpoint] };
}

// The checkpoint index whose beats span the log position `beatIndex`, or -1 if
// the beat belongs to no recorded turn (the opening beat, travel, etc.).
export function turnForBeatIndex(state, beatIndex) {
  const turns = state.turns || [];
  for (let k = 0; k < turns.length; k++) {
    if (beatIndex >= turns[k].beatsLen && beatIndex < turns[k].endLen) return k;
  }
  return -1;
}

// Reconstruct the state as it was right before turn k — dropping turn k and every
// later turn. The pools are left intact (unused entries are harmless and re-shared
// by reference on the next turn).
export function stateBeforeTurn(state, k) {
  const cp = state.turns[k];
  const w = cp.world;
  const world = {
    codex: state.pools.codex[w.codexIdx],
    seen: state.pools.seen[w.seenIdx],
    tiles: state.pools.tiles[w.tilesIdx],
    currentTile: w.currentTile,
  };
  return {
    ...state,
    character: cp.char,
    time: cp.time,
    world,
    beats: state.beats.slice(0, cp.beatsLen),
    apiHistory: state.apiHistory.slice(0, cp.historyLen),
    turns: state.turns.slice(0, k),
  };
}

// Manually edit a beat's text, syncing the change into the matching assistant
// entry in apiHistory (the model's memory) when one can be found.
export function editBeat(state, beatId, newText) {
  const idx = state.beats.findIndex((b) => b.id === beatId);
  if (idx < 0) return state;
  const beat = state.beats[idx];
  const field = beat.type === "dialogue" ? "line" : "content";
  const oldText = beat[field];
  if (oldText === newText) return state;
  const beats = [...state.beats];
  beats[idx] = { ...beat, [field]: newText };

  let apiHistory = state.apiHistory;
  for (let i = state.apiHistory.length - 1; i >= 0; i--) {
    const entry = state.apiHistory[i];
    if (entry.role !== "assistant" || typeof entry.content !== "string") continue;
    if (!entry.content.includes(oldText)) continue;
    const patched = patchRaw(entry.content, beat, oldText, newText);
    if (patched !== entry.content) {
      apiHistory = [...state.apiHistory];
      apiHistory[i] = { ...entry, content: patched };
    }
    break;
  }
  return { ...state, beats, apiHistory };
}

function patchRaw(raw, beat, oldText, newText) {
  try {
    const obj = JSON.parse(raw);
    if (beat.type === "narration" && typeof obj.narration === "string") {
      obj.narration = newText;
      return JSON.stringify(obj);
    }
    if (beat.type === "dialogue") {
      const arr = Array.isArray(obj.dialogues) ? obj.dialogues : (obj.dialogue ? [obj.dialogue] : []);
      let hit = false;
      for (const d of arr) {
        if (d && d.name === beat.name && d.line === oldText) { d.line = newText; hit = true; break; }
      }
      if (hit) {
        if (Array.isArray(obj.dialogues)) obj.dialogues = arr;
        else obj.dialogue = arr[0];
        return JSON.stringify(obj);
      }
    }
  } catch {
    // fall through to a blunt replace
  }
  return raw.includes(oldText) ? raw.replace(oldText, newText) : raw;
}
