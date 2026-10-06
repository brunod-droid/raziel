import { NextRequest, NextResponse } from "next/server";
import { listPendingReviewItems, resolveReviewItem, getReviewItem } from "@/lib/reviewQueue";
import { appendFactToTarget } from "@/lib/kb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listPendingReviewItems();
    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

// action: "approve" adds the (possibly edited) fact to the target and marks resolved.
// action: "reject" just marks resolved without adding anything.
export async function POST(req: NextRequest) {
  const { id, action, target, fact } = await req.json();
  if (!id || !action) {
    return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  }

  try {
    if (action === "approve") {
      const item = await getReviewItem(id);
      if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
      const finalTarget = target || item.target;
      const finalFact = fact || item.proposed_fact;
      await appendFactToTarget(finalTarget, finalFact);
      await resolveReviewItem(id, "approved");
      return NextResponse.json({ ok: true });
    }
    if (action === "reject") {
      await resolveReviewItem(id, "rejected");
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
