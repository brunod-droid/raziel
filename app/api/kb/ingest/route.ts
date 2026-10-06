import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeBase, appendFactToTarget } from "@/lib/kb";
import { addReviewItem } from "@/lib/reviewQueue";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function buildIngestPrompt(kb: any): string {
  const siteList = kb.sites.map((s: any) => `- ${s.id} (${s.name}): ${s.facts.length} existing facts, ${s.rules.length} rules`).join("\n");
  const allFacts = [
    `COMMON (applies to every site):\n${kb.common.facts.map((f: string) => `- ${f}`).join("\n")}`,
    ...kb.sites.map((s: any) => `${s.id.toUpperCase()} (${s.name}):\n${s.facts.map((f: string) => `- ${f}`).join("\n") || "(no site specific facts yet)"}`),
  ].join("\n\n");

  return `You are the knowledge base curator for a group of e-commerce brands (mostly personalized jewelry, one sells personalized canvas art). You will be given a NEW piece of information submitted by a team lead, and the ENTIRE current knowledge base. Decide where it belongs and whether it's safe to add automatically.

SITES AVAILABLE
${siteList}

CURRENT KNOWLEDGE BASE
${allFacts}

Your job:
1. Decide the target: "common" if this applies to every site, or the specific site id if it's specific to one brand. If you genuinely cannot tell, pick your best guess and mark it unclear.
2. Check whether it conflicts with anything already recorded for that target (or common, since common applies everywhere too). A conflict means the new information contradicts, changes, or is inconsistent with an existing fact, not just that it's related to the same topic.
3. Write a clean, well-worded version of the fact as a complete sentence or two, ready to be added verbatim to the knowledge base in the same plain, matter-of-fact style as the existing facts, do not editorialize or add caveats that weren't in the submission.
4. Only mark something "clear" (safe to auto-add) if the target is confident and there is no conflict. If there's any real ambiguity or contradiction, mark it not clear and explain why in plain language, a human will review it.

Respond only with valid JSON, no markdown fences, no preamble:
{
  "target": "common or a site id",
  "clear": true or false,
  "proposed_fact": "the clean fact text",
  "reason": "one or two plain sentences explaining your target choice, and if not clear, exactly what is ambiguous or what it conflicts with",
  "conflicting_with": "the existing fact text it conflicts with, or null if none"
}`;
}

export async function POST(req: NextRequest) {
  const role = await verifySession(req.cookies.get("tg_session")?.value);
  if (!role || role !== "lead") {
    return NextResponse.json({ error: "Team lead access required" }, { status: 403 });
  }

  const { text } = await req.json();
  if (!text || !String(text).trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const kb = await getKnowledgeBase();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server" }, { status: 500 });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: buildIngestPrompt(kb),
      messages: [{ role: "user", content: `NEW SUBMISSION:\n${text}` }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "Claude API error", detail }, { status: 502 });
  }

  const data = await response.json();
  const textBlocks = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text);
  let raw = (textBlocks[textBlocks.length - 1] || "").replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
  }
  if (!parsed) {
    return NextResponse.json({ error: "Could not parse the analysis", raw }, { status: 502 });
  }

  if (parsed.clear && !parsed.conflicting_with) {
    await appendFactToTarget(parsed.target, parsed.proposed_fact);
    return NextResponse.json({ autoAdded: true, target: parsed.target, proposed_fact: parsed.proposed_fact });
  }

  await addReviewItem({
    target: parsed.target || "common",
    proposed_fact: parsed.proposed_fact || text,
    raw_input: text,
    reason: parsed.reason || "Needs human review.",
    conflicting_with: parsed.conflicting_with || null,
    submitted_by: role,
  });

  return NextResponse.json({
    autoAdded: false,
    target: parsed.target,
    reason: parsed.reason,
    conflicting_with: parsed.conflicting_with,
  });
}
