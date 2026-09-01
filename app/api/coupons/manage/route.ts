import { NextRequest, NextResponse } from "next/server";
import { addCoupons, getCouponStats } from "@/lib/coupons";

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 });
  }
  try {
    const stats = await getCouponStats(siteId);
    return NextResponse.json(stats);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { siteId, codes } = await req.json();
  if (!siteId || !Array.isArray(codes)) {
    return NextResponse.json({ error: "siteId and codes[] are required" }, { status: 400 });
  }
  try {
    const result = await addCoupons(siteId, codes);
    const stats = await getCouponStats(siteId);
    return NextResponse.json({ ...result, stats });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
