function validate(value, active) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (!value || typeof value !== "object") return false;
  if (active.has(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) return false;
  } else if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  active.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key === "symbol")) return false;

  if (Array.isArray(value)) {
    const dataKeys = keys.filter((key) => key !== "length");
    if (dataKeys.length !== value.length) return false;
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return false;
      if (!validate(descriptor.value, active)) return false;
    }
  } else {
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!("value" in descriptor) || !descriptor.enumerable) return false;
      if (!validate(descriptor.value, active)) return false;
    }
  }

  active.delete(value);
  return true;
}

export function isJsonData(value) {
  return validate(value, new WeakSet());
}

export function assertJsonData(value, reason = "invalid-json-data") {
  if (!isJsonData(value)) throw new TypeError(reason);
  return value;
}

export function cloneJsonData(value, reason = "invalid-json-data") {
  assertJsonData(value, reason);
  return JSON.parse(JSON.stringify(value));
}
