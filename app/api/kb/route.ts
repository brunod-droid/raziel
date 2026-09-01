import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeBase, saveKnowledgeBase, DEFAULT_KB } from "@/lib/kb";

export const dynamic = "force-dynamic";

export async function GET() {
  const kb = await getKnowledgeBase();
  return NextResponse.json(kb);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const next = body?.resetToDefaults ? DEFAULT_KB : body;
  const saved = await saveKnowledgeBase(next);
  return NextResponse.json(saved);
}
