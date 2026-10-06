import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeBase, getSite } from "@/lib/kb";

export const dynamic = "force-dynamic";

function buildAskPrompt(kb: any, siteId?: string): string {
  const site = getSite(kb, siteId);
  const factLines = [...kb.common.facts, ...site.facts].join(" ");
  const ruleLines = [...kb.common.rules, ...site.rules].map((r: any) => `For ${r.category}: ${r.rule}`).join(" ");
  const scraped = site.scrapedFacts;
  const scrapedLine = scraped?.checkedAt
    ? `Live homepage banner as of the last automated check (${scraped.checkedAt}): "${scraped.homepageBanner}".`
    : "";

  return `You are an internal knowledge assistant for the team working on ${site.name} (${site.domains.join(", ") || "no domain set yet"}) and its sibling brands. A team member is asking you a question directly, for their own understanding, not to draft a customer reply. Answer plainly and directly, like a knowledgeable colleague, not a letter.

FACTS
${factLines}

PROCESS GUIDANCE
${ruleLines}

${scrapedLine}

You have a web_search tool restricted to this site's own domains, use it if the answer isn't already covered above and something current would help (an FAQ, policy, or product page).

If you genuinely don't know and can't find it by searching, say so plainly rather than guessing, and suggest who or what to check instead.

Respond only with valid JSON, no markdown fences, no preamble:
{
  "answer": "the direct answer, plain text, a few sentences to a short paragraph",
  "sources_used": ["short plain-language reference to each fact, rule, or search result relied on, empty array if none"]
}`;
}

export async function POST(req: NextRequest) {
  const { question, siteId } = await req.json();
  if (!question || !String(question).trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const kb = await getKnowledgeBase();
  const system = buildAskPrompt(kb, siteId);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured on the server" }, { status: 500 });
  }

  const site = getSite(kb, siteId);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: String(question) }],
      tools: [{ type: "web_search_20250305", name: "web_search", allowed_domains: site.domains.length > 0 ? site.domains : undefined }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "Claude API error", detail }, { status: 502 });
  }

  const data = await response.json();
  const textBlocks = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text);
  let text = (textBlocks[textBlocks.length - 1] || "").replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }
  }
  if (!parsed) {
    return NextResponse.json({ error: "Could not parse the model's response", raw: text }, { status: 502 });
  }

  return NextResponse.json(parsed);
}
