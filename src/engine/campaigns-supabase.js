// Multi-save adapter over Supabase PostgREST. RLS scopes everything to the
// authenticated user. The web build uses this; the artifact build uses
// campaigns-local.js.
import { supabase } from "./supabase-client.js";
import {
  CURRENT_CAMPAIGN_SCHEMA,
  READABLE_CAMPAIGN_SCHEMAS,
  hasCurrentMechanicsState,
  isReadableCampaignSchema,
} from "./campaign-migration.js";
import { ATTRIBUTE_SCALE_VERSION, PROGRESSION_VERSION } from "./progression.js";

// ----- Optimistic-concurrency baselines -----
// campaignId -> the row's `updated_at` as we last observed it (from loadCampaign
// or from our own last successful save). Every guarded UPDATE gates on
// `WHERE updated_at = baseline`; if another tab or device wrote since we loaded,
// the row's updated_at no longer matches, the UPDATE touches 0 rows, and we
// refuse with STALE_CAMPAIGN rather than silently clobber the newer progress.
// This is the classic lost-update guard, keyed per campaign (handcrafted-map.js
// does the same for its single shared map row).
const baselines = new Map();

// ----- Per-campaign save serialization -----
// The debounced autosave fires saves fire-and-forget, so on a slow connection a
// second save can begin before the first resolves. Both would read the same
// baseline and the second would be a false STALE against our OWN earlier write.
// Chain saves per id so each one gates on the previous save's fresh baseline.
const saveChains = new Map();

function assertWritableCampaignState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)
    || !hasCurrentMechanicsState(state)
    || state.progressionVersion !== PROGRESSION_VERSION
    || state.attributeScaleVersion !== ATTRIBUTE_SCALE_VERSION) {
    const error = new Error(
      "Campaign state has not passed the current migration gate and was not saved.",
    );
    error.code = "CAMPAIGN_MIGRATION_REQUIRED";
    throw error;
  }
}

export async function listCampaigns() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, last_played_at, schema_version")
    .in("schema_version", READABLE_CAMPAIGN_SCHEMAS)
    .order("last_played_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function loadCampaign(id) {
  return (await loadCampaignRecord(id))?.state ?? null;
}

// Startup restoration also needs the row timestamp so a locally cached state
// can be used only when it contains progress newer than the last server write.
// Keep loadCampaign's state-only contract for existing callers.
export async function loadCampaignRecord(id) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("state, updated_at, schema_version")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (data && !isReadableCampaignSchema(data.schema_version)) {
    const unsupported = new Error(
      `Campaign schema ${String(data.schema_version || "missing")} is not supported by this build.`,
    );
    unsupported.code = "UNSUPPORTED_CAMPAIGN_SCHEMA";
    unsupported.schemaVersion = data.schema_version ?? null;
    throw unsupported;
  }
  // Capture the concurrency baseline at load time so the first autosave can
  // detect a row that was changed elsewhere between opening and saving.
  if (data) baselines.set(id, data.updated_at ?? null);
  return data ? { state: data.state, updatedAt: data.updated_at ?? null } : null;
}

export async function saveCampaign(id, state, { name } = {}) {
  // Never label arbitrary or partially migrated JSON with the current database
  // schema. Every production caller must hydrate through prepareCampaignState.
  assertWritableCampaignState(state);
  // New campaigns insert a fresh row (no baseline to guard against yet).
  if (!id) return insertCampaign(state, { name });
  // Existing campaigns go through the per-id chain so concurrent saves from this
  // same tab can't race each other's baseline.
  const prior = saveChains.get(id) || Promise.resolve();
  const run = prior.catch(() => {}).then(() => updateCampaign(id, state, { name }));
  saveChains.set(id, run);
  try {
    return await run;
  } finally {
    // Only the latest link clears the chain; an in-flight successor leaves its
    // own entry in place.
    if (saveChains.get(id) === run) saveChains.delete(id);
  }
}

async function updateCampaign(id, state, { name }) {
  const now = new Date().toISOString();
  // A successfully hydrated payload has passed the migration/read-back gate. Persist its
  // current lineage on the next ordinary save so v12 rows remain visible throughout the
  // rollout and converge to v13 without a destructive bulk rewrite.
  const update = {
    state,
    schema_version: CURRENT_CAMPAIGN_SCHEMA,
    updated_at: now,
    last_played_at: now,
  };
  if (name !== undefined) update.name = name;

  const baseline = baselines.get(id);
  let query = supabase.from("campaigns").update(update).eq("id", id);
  // Gate on the baseline only when we hold one. Without it (a campaign never
  // loaded this session, or a legacy row whose updated_at was never set) fall
  // back to an unguarded write so we never block a save that works today, then
  // capture the baseline below for next time.
  if (baseline != null) query = query.eq("updated_at", baseline);

  const { data, error } = await query.select("updated_at");
  if (error) throw error;

  if (baseline != null && (!data || data.length === 0)) {
    // The gate matched 0 rows. Distinguish a genuine conflict (row changed
    // since we loaded it) from an RLS/missing-row case by re-reading
    // updated_at, then refuse rather than overwrite.
    const { data: probe } = await supabase
      .from("campaigns").select("updated_at").eq("id", id).maybeSingle();
    if (probe && probe.updated_at !== baseline) {
      const err = new Error(
        "This campaign was changed in another tab or on another device since you " +
        "opened it. Your latest changes were NOT saved — reload to continue from " +
        "the newest version."
      );
      err.code = "STALE_CAMPAIGN";
      err.loadedUpdatedAt = baseline;
      err.serverUpdatedAt = probe.updated_at;
      throw err;
    }
    throw new Error("Save returned 0 rows — the campaign may have been deleted or access was denied.");
  }

  // Advance the baseline to this write's updated_at so the next save chains off it.
  if (data && data.length > 0) baselines.set(id, data[0].updated_at);
  return { id, updatedAt: data?.[0]?.updated_at ?? now };
}

async function insertCampaign(state, { name }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("not authenticated");
  const insert = { user_id: session.user.id, state, schema_version: CURRENT_CAMPAIGN_SCHEMA };
  if (name !== undefined) insert.name = name;
  const { data, error } = await supabase
    .from("campaigns")
    .insert(insert)
    .select("id, updated_at")
    .single();
  if (error) throw error;
  baselines.set(data.id, data.updated_at ?? null);
  return { id: data.id, updatedAt: data.updated_at ?? null };
}

export async function deleteCampaign(id) {
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", id);
  if (error) throw error;
  baselines.delete(id);
  saveChains.delete(id);
}

export async function renameCampaign(id, name) {
  // Metadata-only write (last-write-wins on the name is fine — not gated). Still
  // refresh the baseline from the result so that, if the table has an auto-touch
  // trigger on updated_at, the next state save doesn't see a stale baseline.
  const { data, error } = await supabase
    .from("campaigns")
    .update({ name })
    .eq("id", id)
    .select("updated_at");
  if (error) throw error;
  if (data && data.length > 0 && data[0].updated_at != null) {
    baselines.set(id, data[0].updated_at);
  }
}
