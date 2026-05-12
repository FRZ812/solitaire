// Storage shim: prefers the artifact's window.storage when available,
// falls back to localStorage when running outside the Claude artifact pane.

export async function storeGet(key) {
  try {
    if (typeof window !== "undefined" && window.storage) {
      const r = await window.storage.get(key);
      if (r && r.value !== undefined) return r.value;
    }
  } catch {}
  try { return localStorage.getItem(key); } catch {}
  return null;
}

export async function storeSet(key, value) {
  try {
    if (typeof window !== "undefined" && window.storage) {
      await window.storage.set(key, value);
      return;
    }
  } catch {}
  try { localStorage.setItem(key, value); } catch {}
}

export async function storeDel(key) {
  try {
    if (typeof window !== "undefined" && window.storage?.delete) {
      await window.storage.delete(key);
      return;
    }
  } catch {}
  try { localStorage.removeItem(key); return; } catch {}
  await storeSet(key, "");
}
