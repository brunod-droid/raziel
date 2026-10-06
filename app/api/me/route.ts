import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const role = await verifySession(req.cookies.get("tg_session")?.value);
  return NextResponse.json({ role: role || null });
}
