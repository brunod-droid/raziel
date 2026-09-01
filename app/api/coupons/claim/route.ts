import { NextRequest, NextResponse } from "next/server";
import { claimCoupon } from "@/lib/coupons";
import { verifySession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const role = await verifySession(req.cookies.get("tg_session")?.value);
  if (!role) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { siteId } = await req.json();
  if (!siteId) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 });
  }

  try {
    const code = await claimCoupon(siteId, role);
    if (!code) {
      return NextResponse.json({ code: null, message: "No codes left in this site's pool, ask a team lead to add more." });
    }
    return NextResponse.json({ code });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
