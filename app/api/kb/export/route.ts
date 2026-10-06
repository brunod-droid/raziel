import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeBase } from "@/lib/kb";
import { listPendingReviewItems } from "@/lib/reviewQueue";
import { buildJson, buildWorkbook } from "@/lib/kbExport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/kb/export?format=xlsx   (default) Excel workbook
// GET /api/kb/export?format=json   JSON document
// Lead-only, enforced by the middleware.
export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") === "json" ? "json" : "xlsx";
  const kb = await getKnowledgeBase();

  let pending: any[] = [];
  try {
    pending = await listPendingReviewItems();
  } catch {
    // The review queue table may not exist yet, the export should still work.
  }

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    return new NextResponse(JSON.stringify(buildJson(kb, pending), null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="raziel-knowledge-base-${stamp}.json"`,
      },
    });
  }

  const buffer = await buildWorkbook(kb, pending);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="raziel-knowledge-base-${stamp}.xlsx"`,
    },
  });
}
