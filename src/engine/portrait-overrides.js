export const PLAYER_PORTRAIT_ID = "wanderer";

function usablePortrait(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function portraitOverrideFor(state, characterId) {
  return usablePortrait(state?.portraitOverrides?.[characterId]);
}

export function withPortraitOverride(state, characterId, portrait) {
  const id = String(characterId || "").trim();
  if (!id) return state;
  const portraitOverrides = { ...(state.portraitOverrides || {}) };
  const value = usablePortrait(portrait);
  if (value) portraitOverrides[id] = value;
  else delete portraitOverrides[id];
  return { ...state, portraitOverrides };
}

// Runs on the already-cloned campaign inside migrateCodex. Legacy WIP stored
// uploads on both the compact player and Codex record, then retained those data
// URLs inside rewind checkpoints. Move current presentation into one save-level
// map and scrub historical duplicates so rewinds cannot resurrect old artwork.
export function migratePortraitOverrides(state) {
  if (!state || typeof state !== "object") return state;
  const portraitOverrides = { ...(state.portraitOverrides || {}) };
  const adopt = (id, record) => {
    const value = usablePortrait(record?.portrait);
    if (value && !portraitOverrides[id]) portraitOverrides[id] = value;
    if (record && Object.prototype.hasOwnProperty.call(record, "portrait")) delete record.portrait;
  };

  adopt(PLAYER_PORTRAIT_ID, state.character);
  for (const [id, record] of Object.entries(state.world?.codex?.characters || {})) adopt(id, record);

  for (const turn of state.turns || []) {
    if (turn?.char && Object.prototype.hasOwnProperty.call(turn.char, "portrait")) delete turn.char.portrait;
  }
  for (const codex of state.pools?.codex || []) {
    for (const record of Object.values(codex?.characters || {})) {
      if (record && Object.prototype.hasOwnProperty.call(record, "portrait")) delete record.portrait;
    }
  }

  state.portraitOverrides = portraitOverrides;
  return state;
}
