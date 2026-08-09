const UINT32_MAX_PLUS_ONE = 0x100000000;

function hashSeed(seed) {
  let hash = 2166136261;
  for (const char of String(seed ?? "tower-of-winter")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed) {
  return Object.freeze({ algorithm: "mulberry32", state: hashSeed(seed) });
}

export function nextFloat(rng) {
  if (rng?.algorithm !== "mulberry32" || !Number.isInteger(rng.state)) {
    throw new TypeError("invalid-rng-state");
  }
  const state = (rng.state + 0x6D2B79F5) >>> 0;
  let value = state;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  value = ((value ^ (value >>> 14)) >>> 0) / UINT32_MAX_PLUS_ONE;
  return { rng: { algorithm: rng.algorithm, state }, value };
}

export function nextInt(rng, min, max) {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError("invalid-rng-range");
  }
  const next = nextFloat(rng);
  return {
    rng: next.rng,
    value: min + Math.floor(next.value * (max - min + 1)),
  };
}
