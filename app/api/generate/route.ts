import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeBase, buildSystemPrompt } from "@/lib/kb";

function sanitizeReply(text: string): string {
  if (!text) return text;
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\./g, ".");
}

export async function POST(req: NextRequest) {
  const { message, notes, category, siteId } = await req.json();
  if (!message || !String(message).trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const kb = await getKnowledgeBase();
  const system = buildSystemPrompt(kb, siteId, category);
  const userContent = `CUSTOMER MESSAGE:\n${message}${notes && String(notes).trim() ? `\n\nAGENT CONTEXT / NOTES:\n${notes}` : ""}`;

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
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "Claude API error", detail }, { status: 502 });
  }

  const data = await response.json();
  const text = (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .replace(/```json|```/g, "")
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Could not parse the model's response", raw: text }, { status: 502 });
  }

  parsed.reply = sanitizeReply(parsed.reply || "");
  return NextResponse.json(parsed);
}
