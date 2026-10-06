"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Site = { id: string; name: string };

export default function AskPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ answer: string; sources_used?: string[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/kb")
      .then((r) => r.json())
      .then((kb) => {
        const s = (kb.sites || []).map((x: any) => ({ id: x.id, name: x.name }));
        setSites(s);
        if (s.length > 0) setSiteId(s[0].id);
      });
  }, []);

  const ask = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, siteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not get an answer.");
        return;
      }
      setResult(data);
    } catch {
      setError("Could not get an answer, try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: "var(--amber)", fontSize: 12, margin: 0 }}>Raziel</p>
          <h1 style={{ fontSize: 24, margin: "4px 0" }}>Ask a Question</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 520, margin: 0 }}>
            Same knowledge base as the Reply Assistant, for your own questions, not a customer reply.
          </p>
        </div>
        <Link href="/" className="btn-ghost" style={{ textDecoration: "none", fontSize: 13 }}>
          Back to Reply Assistant
        </Link>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
        <div>
          <label className="field-label">Site</label>
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Your question</label>
          <textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. what's our policy on..." />
        </div>
        <button className="btn-primary" style={{ width: "fit-content" }} onClick={ask} disabled={loading || !question.trim()}>
          {loading ? "Thinking..." : "Ask"}
        </button>
        {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
        {result && (
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>{result.answer}</p>
            {result.sources_used && result.sources_used.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Sources</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {result.sources_used.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
