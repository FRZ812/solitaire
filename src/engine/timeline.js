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

function turnResponseText(beats) {
  return beats
    .filter((beat) => beat.type === "narration" || beat.type === "dialogue")
    .map((beat) => (beat.type === "dialogue" ? `${beat.name}: "${beat.line}"` : beat.content))
    .join("\n\n");
}

function restoreCheckpointContinuation(restored, checkpoint) {
  const present = checkpoint?.narratorTurnContinuationPresent;
  if (present === true || (present === undefined
    && Object.prototype.hasOwnProperty.call(checkpoint || {}, "narratorTurnContinuation"))) {
    return { ...restored, narratorTurnContinuation: checkpoint.narratorTurnContinuation };
  }
  if (present === false) {
    const withoutContinuation = { ...restored };
    delete withoutContinuation.narratorTurnContinuation;
    return withoutContinuation;
  }
  // Legacy checkpoints did not capture continuation authority. Never inherit
  // a later state's capability into an earlier reconstructed state.
  return { ...restored, narratorTurnContinuation: null };
}

// Persist a turn checkpoint even when narrator presentation has not arrived yet.
// Travel uses this in the same state object that exposes canonical arrival, making
// autosave, rejection, and post-arrival cancellation rewind-safe.
export function startTurnCheckpoint(base, message, next, extra = {}) {
  const startLen = base.beats.length;
  const p0 = next.pools || emptyPools();
  const { codex, seen, tiles, ...restWorld } = base.world;
  const c = poolPush(p0.codex, codex);
  const s = poolPush(p0.seen, seen);
  const t = poolPush(p0.tiles, tiles);
  const pools = { codex: c.pool, seen: s.pool, tiles: t.pool };
  const checkpoint = {
    beatsLen: startLen,
    endLen: next.beats.length,
    historyLen: base.apiHistory.length,
    message,
    prevText: turnResponseText(next.beats.slice(startLen)),
    char: base.character,
    party: base.party,
    memories: base.memories,
    created: base.created,
    time: base.time,
    world: { codexIdx: c.idx, seenIdx: s.idx, tilesIdx: t.idx, ...restWorld },
    narratorTurnContinuationPresent: Object.prototype.hasOwnProperty.call(base, "narratorTurnContinuation"),
  };
  if (checkpoint.narratorTurnContinuationPresent) {
    checkpoint.narratorTurnContinuation = base.narratorTurnContinuation;
  }
  if (extra.travel) checkpoint.travel = extra.travel;
  if (extra.policyOptions) checkpoint.policyOptions = extra.policyOptions;
  return { ...next, pools, turns: [...(next.turns || []), checkpoint] };
}

// Extend an already-persisted checkpoint after late narrator prose/history lands.
// No new turn is appended; the atomic arrival checkpoint remains the authority.
export function finalizeTurnCheckpoint(state, turnIndex) {
  const turns = state.turns || [];
  const checkpoint = turns[turnIndex];
  if (!checkpoint) return state;
  const updated = {
    ...checkpoint,
    endLen: state.beats.length,
    prevText: turnResponseText(state.beats.slice(checkpoint.beatsLen)),
  };
  const nextTurns = [...turns];
  nextTurns[turnIndex] = updated;
  return { ...state, turns: nextTurns };
}

// Record a finished narrator turn. base = the state the beat was applied to,
// message = the prompt that produced it, next = the result. extra.travel carries
// the journey context (route, destination, encounter) so a rewritten travel turn
// can re-land the player. Returns next with a checkpoint appended (or next
// unchanged if the turn produced no rewritable text).
export function recordTurn(base, message, next, extra = {}) {
  const turnBeats = next.beats.slice(base.beats.length);
  if (!turnResponseText(turnBeats)) return next;
  return startTurnCheckpoint(base, message, next, extra);
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

// The checkpoint a PLAYER message contributed to. A manual run may consume one
// bubble or a consecutive queue; return the shared turn for any of them. -1 means
// the message is still pending (or produced no rewritable text).
export function turnStartedAt(state, beatIndex) {
  if (state.beats?.[beatIndex]?.type !== "player") return -1;
  const turns = state.turns || [];
  for (let k = 0; k < turns.length; k++) {
    const previousEnd = k > 0 ? turns[k - 1].endLen : 0;
    // A manual narrator run may consume several consecutive queued player
    // bubbles. Every one of those messages belongs to the turn, not only the
    // final bubble immediately before beatsLen.
    if (beatIndex >= previousEnd && beatIndex < turns[k].beatsLen) return k;
  }
  return -1;
}

// Player messages are pending when they form the uninterrupted tail of the feed.
// This survives autosave/reload and also describes the state produced by rewinding
// a player bubble: its old response is gone, while the player's words remain ready.
export function pendingPlayerBeats(state) {
  const beats = state.beats || [];
  let start = beats.length;
  while (start > 0 && beats[start - 1]?.type === "player") start--;
  return beats.slice(start);
}

export function narratorMessageForPendingPlayers(state) {
  const pending = pendingPlayerBeats(state);
  if (pending.length === 1) {
    const tag = state.created === false ? "[CHARACTER CREATION]" : "[PLAYER ACTION]";
    return `${tag} ${pending[0].content}`;
  }
  if (pending.length > 1) {
    const tag = state.created === false ? "[CHARACTER CREATION]" : "[PLAYER ACTION]";
    const messages = pending.map((beat, index) => `${index + 1}. ${beat.content}`).join("\n");
    return `${tag} The player queued these messages in chronological order. Treat them as one continuous contribution:\n${messages}`;
  }
  if (state.created === false) {
    return "[CHARACTER CREATION] The player remains silent. Continue the interview naturally without inventing any of their answers.";
  }
  return "[CONTINUE STORY] The player takes no new action and says nothing. Continue the current moment through the world, NPCs, and consequences already in motion without choosing or speaking for the player.";
}

// Rewind from one of the player's bubbles, keeping that bubble as queued input.
// If it already produced a response, restore the pre-response checkpoint first;
// if it is still pending, this simply drops any later queued bubbles.
export function rewindToPlayerBeat(state, beatIndex) {
  if (state.beats?.[beatIndex]?.type !== "player") return state;
  const turnK = turnStartedAt(state, beatIndex);
  const base = turnK >= 0 ? stateBeforeTurn(state, turnK) : state;
  if (beatIndex + 1 >= base.beats.length) return base;
  return { ...base, beats: base.beats.slice(0, beatIndex + 1) };
}

// Reconstruct the state as it was right before turn k — dropping turn k and every
// later turn. The pools are left intact (unused entries are harmless and re-shared
// by reference on the next turn).
export function stateBeforeTurn(state, k) {
  const cp = state.turns[k];
  // Overlay the pooled heavy parts onto the inline light snapshot (currentTile,
  // quests, lootedCaches, …). Pre-existing checkpoints carry only currentTile in
  // restWorld, so they reconstruct exactly as before — no migration needed.
  const { codexIdx, seenIdx, tilesIdx, ...restWorld } = cp.world;
  const world = {
    ...restWorld,
    codex: state.pools.codex[codexIdx],
    seen: state.pools.seen[seenIdx],
    tiles: state.pools.tiles[tilesIdx],
  };
  return restoreCheckpointContinuation({
    ...state,
    character: cp.char,
    party: cp.party ?? state.party,
    memories: cp.memories ?? state.memories,
    created: typeof cp.created === "boolean" ? cp.created : state.created,
    time: cp.time,
    world,
    beats: state.beats.slice(0, cp.beatsLen),
    apiHistory: state.apiHistory.slice(0, cp.historyLen),
    turns: state.turns.slice(0, k),
  }, cp);
}

// Reconstruct the state right AFTER turn k completed — keeping turn k's beats and
// dropping everything after it (including the next turn's player bubble). Used by
// "Rewind to here": the selected moment stays, the future is dropped. Returns the
// state unchanged when k is the last turn (nothing comes after).
export function stateAfterTurn(state, k) {
  const turns = state.turns || [];
  const cur = turns[k];
  const nextCp = turns[k + 1];
  if (!cur || !nextCp) return state; // unknown turn, or nothing after it to drop
  // The snapshot captured before turn k+1 IS the state right after turn k (adding
  // the k+1 player bubble doesn't touch character/time/world).
  const { codexIdx, seenIdx, tilesIdx, ...restWorld } = nextCp.world;
  const world = {
    ...restWorld,
    codex: state.pools.codex[codexIdx],
    seen: state.pools.seen[seenIdx],
    tiles: state.pools.tiles[tilesIdx],
  };
  return restoreCheckpointContinuation({
    ...state,
    character: nextCp.char,
    party: nextCp.party ?? state.party,
    memories: nextCp.memories ?? state.memories,
    created: typeof nextCp.created === "boolean" ? nextCp.created : state.created,
    time: nextCp.time,
    world,
    beats: state.beats.slice(0, cur.endLen),       // keep through turn k's last beat
    apiHistory: state.apiHistory.slice(0, nextCp.historyLen),
    turns: state.turns.slice(0, k + 1),
  }, nextCp);
}

// Manually edit a beat's text in place, syncing the change into the model's
// memory: narration/dialogue live in an ASSISTANT entry, the player's own words
// in a USER entry. The story is otherwise untouched (no re-roll).
export function editBeat(state, beatId, newText) {
  const idx = state.beats.findIndex((b) => b.id === beatId);
  if (idx < 0) return state;
  const beat = state.beats[idx];
  const field = beat.type === "dialogue" ? "line" : "content"; // player + narration use `content`
  const oldText = beat[field];
  if (oldText === newText || !oldText) return state;
  const beats = [...state.beats];
  beats[idx] = { ...beat, [field]: newText };

  const role = beat.type === "player" ? "user" : "assistant";
  const storyPosition = narrativePositionInTurn(state, idx);
  let apiHistory = state.apiHistory;
  for (let i = state.apiHistory.length - 1; i >= 0; i--) {
    const entry = state.apiHistory[i];
    if (entry.role !== role || typeof entry.content !== "string") continue;
    const patched = role === "user"
      ? entry.content.replace(oldText, newText) // player's words appear verbatim
      : patchRaw(entry.content, beat, oldText, newText, storyPosition);
    if (patched !== entry.content) {
      apiHistory = [...state.apiHistory];
      apiHistory[i] = { ...entry, content: patched };
      break;
    }
  }
  return { ...state, beats, apiHistory };
}

// Delete a single bubble from the log — leaving its sibling bubbles in the same
// turn intact — and best-effort drop it from the model's memory (a dialogue line
// is pulled from its assistant entry; a narration is blanked). Turn checkpoints
// are re-indexed for the removed beat so rewind/rewrite still line up.
export function deleteBeat(state, beatId) {
  const idx = state.beats.findIndex((b) => b.id === beatId);
  if (idx < 0) return state;
  const beat = state.beats[idx];
  const storyPosition = narrativePositionInTurn(state, idx);
  const beats = state.beats.filter((b) => b.id !== beatId);

  let apiHistory = state.apiHistory;
  if (beat.type === "narration" || beat.type === "dialogue") {
    const text = beat.type === "dialogue" ? beat.line : beat.content;
    for (let i = state.apiHistory.length - 1; i >= 0; i--) {
      const entry = state.apiHistory[i];
      if (entry.role !== "assistant" || typeof entry.content !== "string") continue;
      const patched = removeFromRaw(entry.content, beat, text, storyPosition);
      if (patched !== entry.content) {
        apiHistory = [...state.apiHistory];
        apiHistory[i] = { ...entry, content: patched };
        break;
      }
    }
  }

  // Beats after `idx` shifted up by one — slide every checkpoint boundary that
  // sat at or past the removed beat so [beatsLen, endLen) keeps pointing right.
  const turns = (state.turns || []).map((t) => {
    const nt = { ...t };
    if (t.beatsLen > idx) nt.beatsLen -= 1;
    if (t.endLen > idx) nt.endLen -= 1;
    return nt;
  });
  return { ...state, beats, apiHistory, turns };
}

function removeFromRaw(raw, beat, text, storyPosition) {
  try {
    const obj = JSON.parse(raw);
    if (Array.isArray(obj.story)) {
      const index = matchingStoryIndex(obj.story, beat, text, storyPosition);
      if (index >= 0) {
        obj.story.splice(index, 1);
        return JSON.stringify(obj);
      }
    }
    if (beat.type === "narration" && typeof obj.narration === "string") {
      obj.narration = "";
      return JSON.stringify(obj);
    }
    if (beat.type === "dialogue") {
      let arr = Array.isArray(obj.dialogues) ? obj.dialogues : (obj.dialogue ? [obj.dialogue] : []);
      const before = arr.length;
      arr = arr.filter((d) => !(dialogueSpeakerMatches(d, beat) && d.line === text));
      if (arr.length !== before) {
        if (Array.isArray(obj.dialogues)) obj.dialogues = arr;
        else obj.dialogue = arr[0] || null;
        return JSON.stringify(obj);
      }
    }
  } catch {
    if (text && raw.includes(text)) return raw.replace(text, "");
  }
  return raw;
}

function patchRaw(raw, beat, oldText, newText, storyPosition) {
  try {
    const obj = JSON.parse(raw);
    if (Array.isArray(obj.story)) {
      const index = matchingStoryIndex(obj.story, beat, oldText, storyPosition);
      if (index >= 0) {
        const item = obj.story[index];
        if (beat.type === "dialogue") item.line = newText;
        else if (typeof item.text === "string") item.text = newText;
        else item.content = newText;
        return JSON.stringify(obj);
      }
    }
    if (beat.type === "narration" && typeof obj.narration === "string") {
      obj.narration = newText;
      return JSON.stringify(obj);
    }
    if (beat.type === "dialogue") {
      const arr = Array.isArray(obj.dialogues) ? obj.dialogues : (obj.dialogue ? [obj.dialogue] : []);
      let hit = false;
      for (const d of arr) {
        if (dialogueSpeakerMatches(d, beat) && d.line === oldText) { d.line = newText; hit = true; break; }
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

function narrativePositionInTurn(state, beatIndex) {
  const turnK = turnForBeatIndex(state, beatIndex);
  if (turnK < 0) return -1;
  let position = -1;
  for (let i = state.turns[turnK].beatsLen; i <= beatIndex; i++) {
    if (state.beats[i]?.type === "narration" || state.beats[i]?.type === "dialogue") position++;
  }
  return position;
}

function matchingStoryIndex(story, beat, text, preferred) {
  const matches = (item) => {
    if (!item || typeof item !== "object") return false;
    if (beat.type === "dialogue") {
      return (item.type === "dialogue" || item.type === "dialog")
        && dialogueSpeakerMatches(item, beat) && item.line === text;
    }
    return (item.type === "beat" || item.type === "narration")
      && (item.text === text || item.content === text);
  };
  if (preferred >= 0 && preferred < story.length && matches(story[preferred])) return preferred;
  return story.findIndex(matches);
}

function dialogueSpeakerMatches(item, beat) {
  if (!item || typeof item !== "object") return false;
  const itemSpeakerId = item.speaker?.kind === "character"
    ? item.speaker.id
    : item.speakerId;
  if (beat.speakerId && itemSpeakerId) return itemSpeakerId === beat.speakerId;
  return item.name === beat.name;
}
