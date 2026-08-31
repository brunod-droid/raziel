"use client";

import { useState } from "react";
import Link from "next/link";

const CATEGORY_OPTIONS = ["Auto-detect", "Presales", "WISMO / Order status", "Damaged / Defective", "General support"];

function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s)]+/g) || [];
  const cleaned = matches.map((u) => u.replace(/[.,;:!?]+$/, ""));
  return Array.from(new Set(cleaned));
}

function sentimentClass(s: string) {
  if (!s) return "";
  const v = s.toLowerCase();
  if (v.includes("neg")) return "red";
  if (v.includes("pos")) return "green";
  return "amber";
}

type Result = {
  category: string;
  sentiment: string;
  reply: string;
  incentive_used: string;
  clarifying_questions: string[];
};

export default function AgentPage() {
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("Auto-detect");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, notes, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not generate a draft.");
        return;
      }
      setResult(data);
      setReplyDraft(data.reply || "");
    } catch {
      setError("Could not generate a draft. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const copyReply = async () => {
    try {
      await navigator.clipboard.writeText(replyDraft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  return (
    <div className="container">
      <header style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: "var(--amber)", fontSize: 12, letterSpacing: 0.5, margin: 0 }}>theo grace</p>
          <h1 style={{ fontSize: 24, margin: "4px 0" }}>Holiday Concierge Console</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 560, margin: 0 }}>
            Warm, on brand replies for every message that comes in during the season that matters most, with the right gesture attached.
          </p>
        </div>
        <Link href="/knowledge" className="btn-ghost" style={{ textDecoration: "none", fontSize: 13 }}>
          Knowledge Base
        </Link>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="field-label">Customer message</label>
            <textarea rows={7} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Paste the customer's question here..." />
          </div>
          <div>
            <label className="field-label">Context for the assistant (optional)</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Order #, delay length, customer tone, VIP status..." />
          </div>
          <div>
            <label className="field-label">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={generate} disabled={loading || !message.trim()}>
            {loading ? "Drafting..." : "Generate draft"}
          </button>
          {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
        </div>

        <div className="card" style={{ minHeight: 420, display: "flex", flexDirection: "column", gap: 16 }}>
          {!result && !loading && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 260 }}>
                Paste a customer message and generate a draft, it will appear here ready to send.
              </p>
            </div>
          )}
          {loading && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>Drafting...</div>
          )}
          {result && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="badge">{result.category}</span>
                <span className={`badge ${sentimentClass(result.sentiment)}`}>{result.sentiment}</span>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Draft reply</span>
                  <button className="btn-ghost" onClick={copyReply} style={{ fontSize: 12, padding: "4px 10px" }}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <textarea rows={9} value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} />
                {extractUrls(replyDraft).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {extractUrls(replyDraft).map((url, i) => {
                      let label = url.replace(/^https?:\/\//, "").replace(/^www\./, "");
                      const slug = url.split("/products/")[1] || url.split("/categories/")[1];
                      if (slug) label = slug.replace(/[-_]/g, " ").replace(/\?.*$/, "");
                      return (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="link-chip" title={url}>
                          {label}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
              {result.incentive_used && result.incentive_used.toLowerCase() !== "none" && (
                <p style={{ fontSize: 13, margin: 0 }}>
                  <span style={{ color: "var(--text-muted)" }}>Gesture offered: </span>
                  <span style={{ color: "var(--amber)" }}>{result.incentive_used}</span>
                </p>
              )}
              {result.clarifying_questions && result.clarifying_questions.length > 0 && (
                <div className="badge amber" style={{ display: "block", padding: 12 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Ask before sending</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontWeight: 400, color: "var(--text)" }}>
                    {result.clarifying_questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
