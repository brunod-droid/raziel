import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeBase, buildSystemPrompt } from "@/lib/kb";
import { fetchProductPageText } from "@/lib/productPage";

function sanitizeReply(text: string): string {
  if (!text) return text;
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\./g, ".");
}

export async function POST(req: NextRequest) {
  const { message, notes, category, siteId, productUrl } = await req.json();
  if (!message || !String(message).trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const kb = await getKnowledgeBase();
  const site = kb.sites.find((s: any) => s.id === siteId) || kb.sites[0];
  let system = buildSystemPrompt(kb, siteId, category);
  system += `\n\nSearching the site directly:
You have a web_search tool, restricted to this site's own domains (${site.domains.join(", ")}). Use it when you need something current that isn't already covered in the facts above, especially FAQ pages, shipping timelines, the returns and exchanges policy, or warranty terms, rather than guessing or giving a vague non-answer. Don't search for things already well covered in the facts above, that just adds latency for no benefit. Never search outside this site's own domains for a policy answer, a competitor's or unrelated site's policy is not this brand's policy.`;
  let productPageWarning: string | null = null;

  if (productUrl && String(productUrl).trim()) {
    try {
      const pageText = await fetchProductPageText(String(productUrl).trim());
      system += `\n\nLIVE PRODUCT PAGE, fetched just now from ${productUrl}, trust this over any static facts in the knowledge base for this specific product's price, description, and specifications, but note it may not include options that only appear after a customer interacts with the page (like a live subtotal or the Shipping & Returns tab):\n${pageText}`;
    } catch (err: any) {
      productPageWarning = `Could not fetch the product page (${err?.message || "unknown error"}), answered from the knowledge base only.`;
    }
  }

  const userContent = `CUSTOMER MESSAGE:\n${message}${notes && String(notes).trim() ? `\n\nAGENT CONTEXT / NOTES:\n${notes}` : ""}`;

  system += `\n\nReminder: whatever searching or reasoning you do, your final message must still be only the JSON object described earlier, no commentary before or after it, no markdown fences.`;

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
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: userContent }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          allowed_domains: site.domains,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "Claude API error", detail }, { status: 502 });
  }

  const data = await response.json();
  const textBlocks = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text);
  // With web_search enabled, Claude may emit commentary text blocks around its
  // searches before the final answer, so take the last text block (the final
  // answer) rather than joining every block together.
  let text = (textBlocks[textBlocks.length - 1] || "").replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Fallback: pull out the {...} substring in case of any stray text
    // wrapped around the JSON.
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        // fall through to the error response below
      }
    }
  }
  if (!parsed) {
    return NextResponse.json({ error: "Could not parse the model's response", raw: text }, { status: 502 });
  }

  parsed.reply = sanitizeReply(parsed.reply || "");
  if (productPageWarning) parsed.productPageWarning = productPageWarning;
  return NextResponse.json(parsed);
}
