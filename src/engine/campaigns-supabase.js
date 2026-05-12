// Multi-save adapter over Supabase PostgREST. RLS scopes everything to the
// authenticated user. The web build uses this; the artifact build uses
// campaigns-local.js.
import { supabase } from "./supabase-client.js";

const SCHEMA_VERSION = "v12";

export async function listCampaigns() {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, last_played_at, schema_version")
    .eq("schema_version", SCHEMA_VERSION)
    .order("last_played_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function loadCampaign(id) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("state")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data?.state ?? null;
}

export async function saveCampaign(id, state, { name } = {}) {
  const now = new Date().toISOString();
  if (id) {
    const update = { state, updated_at: now, last_played_at: now };
    if (name !== undefined) update.name = name;
    const { error } = await supabase
      .from("campaigns")
      .update(update)
      .eq("id", id);
    if (error) throw error;
    return { id };
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("not authenticated");
  const insert = { user_id: session.user.id, state, schema_version: SCHEMA_VERSION };
  if (name !== undefined) insert.name = name;
  const { data, error } = await supabase
    .from("campaigns")
    .insert(insert)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function deleteCampaign(id) {
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function renameCampaign(id, name) {
  const { error } = await supabase
    .from("campaigns")
    .update({ name })
    .eq("id", id);
  if (error) throw error;
}
