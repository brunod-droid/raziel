import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured");
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

const TABLE = "kb_review_queue";

export type ReviewItem = {
  id: string;
  target: string;
  proposed_fact: string;
  raw_input: string;
  reason: string;
  conflicting_with: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_by: string | null;
  created_at: string;
};

export async function addReviewItem(item: {
  target: string;
  proposed_fact: string;
  raw_input: string;
  reason: string;
  conflicting_with?: string | null;
  submitted_by?: string;
}): Promise<void> {
  const { error } = await getClient().from(TABLE).insert({
    target: item.target,
    proposed_fact: item.proposed_fact,
    raw_input: item.raw_input,
    reason: item.reason,
    conflicting_with: item.conflicting_with || null,
    submitted_by: item.submitted_by || null,
  });
  if (error) throw new Error(`addReviewItem failed: ${error.message}`);
}

export async function listPendingReviewItems(): Promise<ReviewItem[]> {
  const { data, error } = await getClient().from(TABLE).select("*").eq("status", "pending").order("created_at", { ascending: true });
  if (error) throw new Error(`listPendingReviewItems failed: ${error.message}`);
  return (data as ReviewItem[]) || [];
}

export async function resolveReviewItem(id: string, status: "approved" | "rejected"): Promise<void> {
  const { error } = await getClient().from(TABLE).update({ status, resolved_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`resolveReviewItem failed: ${error.message}`);
}

export async function getReviewItem(id: string): Promise<ReviewItem | null> {
  const { data, error } = await getClient().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as ReviewItem;
}
