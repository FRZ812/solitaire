// Multi-save adapter over localStorage. Maintains an index of campaigns and a
// per-campaign blob keyed by id. The artifact build uses this; the web build
// uses campaigns-supabase.js.
import { storeGet, storeSet, storeDel } from "./storage.js";

const INDEX_KEY = "solitaire-campaigns-index-v12";
const CAMPAIGN_PREFIX = "solitaire-campaign-v12-";
const SCHEMA_VERSION = "v12";

async function readIndex() {
  const raw = await storeGet(INDEX_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

async function writeIndex(index) {
  await storeSet(INDEX_KEY, JSON.stringify(index));
}

export async function listCampaigns() {
  const index = await readIndex();
  return index.slice().sort((a, b) =>
    (b.last_played_at || "").localeCompare(a.last_played_at || "")
  );
}

export async function loadCampaign(id) {
  const raw = await storeGet(CAMPAIGN_PREFIX + id);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function saveCampaign(id, state, { name } = {}) {
  const finalId = id || crypto.randomUUID();
  await storeSet(CAMPAIGN_PREFIX + finalId, JSON.stringify(state));
  const index = await readIndex();
  const existing = index.find(c => c.id === finalId);
  const now = new Date().toISOString();
  if (existing) {
    existing.last_played_at = now;
    if (name !== undefined) existing.name = name;
  } else {
    index.push({
      id: finalId,
      name: name || "Untitled",
      last_played_at: now,
      schema_version: SCHEMA_VERSION,
    });
  }
  await writeIndex(index);
  return { id: finalId };
}

export async function deleteCampaign(id) {
  const index = await readIndex();
  await writeIndex(index.filter(c => c.id !== id));
  await storeDel(CAMPAIGN_PREFIX + id);
}

export async function renameCampaign(id, name) {
  const index = await readIndex();
  const entry = index.find(c => c.id === id);
  if (!entry) return;
  entry.name = name;
  await writeIndex(index);
}
