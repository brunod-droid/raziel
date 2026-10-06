import { NextRequest, NextResponse } from "next/server";
import { appendSiteNote } from "@/lib/kb";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const role = await verifySession(req.cookies.get("tg_session")?.value);
  if (!role) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (role !== "lead") {
    return NextResponse.json({ error: "Team lead access required" }, { status: 403 });
  }

  const { siteId, note } = await req.json();
  if (!siteId || !note || !String(note).trim()) {
    return NextResponse.json({ error: "siteId and note are required" }, { status: 400 });
  }

  try {
    await appendSiteNote(siteId, String(note), role);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
