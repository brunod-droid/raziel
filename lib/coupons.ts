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

export type CouponStats = {
  available: number;
  claimed: number;
  total: number;
};

// Calls the claim_coupon Postgres function, which locks and hands out one
// available row atomically, see supabase.sql. Returns null if the pool for
// this site is empty.
export async function claimCoupon(siteId: string, claimedBy?: string): Promise<string | null> {
  const { data, error } = await getClient().rpc("claim_coupon", {
    p_site_id: siteId,
    p_claimed_by: claimedBy || null,
  });
  if (error) throw new Error(`claim_coupon failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  return row?.code ?? null;
}

// Adds new available codes to a site's pool. Duplicate codes (same site,
// same code) are silently skipped rather than erroring, so a team lead can
// paste a list that partially overlaps with what's already there.
export async function addCoupons(siteId: string, codes: string[]): Promise<{ added: number; skipped: number }> {
  const cleaned = Array.from(new Set(codes.map((c) => c.trim()).filter(Boolean)));
  if (cleaned.length === 0) return { added: 0, skipped: 0 };

  const rows = cleaned.map((code) => ({ site_id: siteId, code, status: "available" as const }));
  const { data, error } = await getClient()
    .from("coupon_pool")
    .upsert(rows, { onConflict: "site_id,code", ignoreDuplicates: true })
    .select("code");

  if (error) throw new Error(`addCoupons failed: ${error.message}`);
  const added = data?.length ?? 0;
  return { added, skipped: cleaned.length - added };
}

export async function getCouponStats(siteId: string): Promise<CouponStats> {
  const { count: available, error: e1 } = await getClient()
    .from("coupon_pool")
    .select("*", { count: "exact", head: true })
    .eq("site_id", siteId)
    .eq("status", "available");
  if (e1) throw new Error(`getCouponStats failed: ${e1.message}`);

  const { count: claimed, error: e2 } = await getClient()
    .from("coupon_pool")
    .select("*", { count: "exact", head: true })
    .eq("site_id", siteId)
    .eq("status", "claimed");
  if (e2) throw new Error(`getCouponStats failed: ${e2.message}`);

  const a = available ?? 0;
  const c = claimed ?? 0;
  return { available: a, claimed: c, total: a + c };
}
