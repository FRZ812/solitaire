const MAX_JSON_DEPTH = 128;
const MAX_JSON_NODES = 100_000;
const MAX_JSON_CODE_UNITS = 2_000_000;

function spend(budget, units = 0) {
  budget.nodes += 1;
  budget.codeUnits += units;
  if (budget.nodes > MAX_JSON_NODES || budget.codeUnits > MAX_JSON_CODE_UNITS) {
    throw new TypeError("json-data-limit-exceeded");
  }
}

function defineData(target, key, value) {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function snapshot(value, active, budget, depth) {
  if (depth > MAX_JSON_DEPTH) throw new TypeError("json-data-limit-exceeded");
  if (value === null || typeof value === "boolean") {
    spend(budget);
    return value;
  }
  if (typeof value === "string") {
    spend(budget, value.length);
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("invalid-json-data");
    spend(budget);
    return value;
  }
  if (!value || typeof value !== "object" || active.has(value)) {
    throw new TypeError("invalid-json-data");
  }

  spend(budget);
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("invalid-json-data");
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key === "symbol")) throw new TypeError("invalid-json-data");

  active.add(value);
  try {
    if (array) {
      const lengthDescriptor = descriptors.length;
      const length = lengthDescriptor && "value" in lengthDescriptor
        ? lengthDescriptor.value
        : -1;
      const dataKeys = keys.filter((key) => key !== "length");
      if (!Number.isInteger(length) || length < 0 || dataKeys.length !== length) {
        throw new TypeError("invalid-json-data");
      }
      const result = [];
      for (let index = 0; index < length; index += 1) {
        const key = String(index);
        const descriptor = descriptors[key];
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
          throw new TypeError("invalid-json-data");
        }
        defineData(result, key, snapshot(descriptor.value, active, budget, depth + 1));
      }
      return result;
    }

    const result = {};
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!("value" in descriptor) || !descriptor.enumerable) {
        throw new TypeError("invalid-json-data");
      }
      budget.codeUnits += key.length;
      if (budget.codeUnits > MAX_JSON_CODE_UNITS) throw new TypeError("json-data-limit-exceeded");
      defineData(result, key, snapshot(descriptor.value, active, budget, depth + 1));
    }
    return result;
  } finally {
    active.delete(value);
  }
}

function snapshotJsonData(value) {
  return snapshot(value, new WeakSet(), { nodes: 0, codeUnits: 0 }, 0);
}

function canonicalSnapshot(value, active, budget, depth) {
  if (depth > MAX_JSON_DEPTH) throw new TypeError("json-data-limit-exceeded");
  if (value === null || typeof value === "boolean") {
    spend(budget);
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    spend(budget, value.length);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("invalid-json-data");
    spend(budget);
    return JSON.stringify(value);
  }
  if (!value || typeof value !== "object" || active.has(value)) {
    throw new TypeError("invalid-json-data");
  }

  spend(budget);
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("invalid-json-data");
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key === "symbol")) throw new TypeError("invalid-json-data");

  active.add(value);
  try {
    if (array) {
      const lengthDescriptor = descriptors.length;
      const length = lengthDescriptor && "value" in lengthDescriptor
        ? lengthDescriptor.value
        : -1;
      const dataKeys = keys.filter((key) => key !== "length");
      if (!Number.isInteger(length) || length < 0 || dataKeys.length !== length) {
        throw new TypeError("invalid-json-data");
      }
      const values = [];
      for (let index = 0; index < length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
          throw new TypeError("invalid-json-data");
        }
        values.push(canonicalSnapshot(descriptor.value, active, budget, depth + 1));
      }
      return `[${values.join(",")}]`;
    }

    const entries = [];
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!("value" in descriptor) || !descriptor.enumerable) {
        throw new TypeError("invalid-json-data");
      }
      budget.codeUnits += key.length;
      if (budget.codeUnits > MAX_JSON_CODE_UNITS) throw new TypeError("json-data-limit-exceeded");
      entries.push([
        key,
        canonicalSnapshot(descriptor.value, active, budget, depth + 1),
      ]);
    }
    entries.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${child}`).join(",")}}`;
  } finally {
    active.delete(value);
  }
}

export function canonicalJsonData(value, reason = "invalid-json-data") {
  try {
    return canonicalSnapshot(value, new WeakSet(), { nodes: 0, codeUnits: 0 }, 0);
  } catch {
    throw new TypeError(reason);
  }
}

export function isJsonData(value) {
  try {
    snapshotJsonData(value);
    return true;
  } catch {
    return false;
  }
}

export function assertJsonData(value, reason = "invalid-json-data") {
  if (!isJsonData(value)) throw new TypeError(reason);
  return value;
}

export function cloneJsonData(value, reason = "invalid-json-data") {
  try {
    return snapshotJsonData(value);
  } catch {
    throw new TypeError(reason);
  }
}

function equalSnapshots(first, second) {
  if (first === second) return true;
  if (!first || !second || typeof first !== "object" || typeof second !== "object") {
    return false;
  }
  if (Array.isArray(first) || Array.isArray(second)) {
    return Array.isArray(first)
      && Array.isArray(second)
      && first.length === second.length
      && first.every((value, index) => equalSnapshots(value, second[index]));
  }
  const firstKeys = Object.keys(first).sort();
  const secondKeys = Object.keys(second).sort();
  return firstKeys.length === secondKeys.length
    && firstKeys.every((key, index) => (
      key === secondKeys[index]
      && equalSnapshots(first[key], second[key])
    ));
}

export function equalJsonData(first, second) {
  try {
    return equalSnapshots(snapshotJsonData(first), snapshotJsonData(second));
  } catch {
    return false;
  }
}
