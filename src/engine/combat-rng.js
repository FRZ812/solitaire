// Small serializable PRNG helpers for browser-native combat. The active state is
// stored with the deck, so a reshuffle is reproducible after cloning or saving.

export function hashSeed(value) {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "solitaire");
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 0x9e3779b9;
}

export function normalizeSeed(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) return (seed >>> 0) || 0x9e3779b9;
  return hashSeed(seed);
}

export function nextRandom(state0) {
  let state = normalizeSeed(state0);
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: state >>> 0 };
}

export function shuffleSeeded(values, state0) {
  const items = [...values];
  let state = normalizeSeed(state0);
  for (let i = items.length - 1; i > 0; i -= 1) {
    const next = nextRandom(state);
    state = next.state;
    const j = Math.floor(next.value * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return { items, state };
}
