"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function KnowledgePage() {
  const [kb, setKb] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState("");

  useEffect(() => {
    fetch("/api/kb")
      .then((r) => r.json())
      .then((data) => {
        setKb(data);
        setLoading(false);
      });
  }, []);

  const save = async (next: any) => {
    setSaving(true);
    const res = await fetch("/api/kb", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    const data = await res.json();
    setKb(data);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const runScrape = async () => {
    setScraping(true);
    setScrapeMsg("");
    try {
      const res = await fetch("/api/scrape", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setScrapeMsg(`Updated: ${data.banner}`);
        const fresh = await (await fetch("/api/kb")).json();
        setKb(fresh);
      } else {
        setScrapeMsg(`Scrape failed: ${data.error}`);
      }
    } catch (e: any) {
      setScrapeMsg(`Scrape failed: ${e.message}`);
    } finally {
      setScraping(false);
    }
  };

  if (loading || !kb) {
    return (
      <div className="container">
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  const updatePromo = (i: number, field: string, value: string) => {
    const promoCodes = kb.promoCodes.map((p: any, idx: number) => (idx === i ? { ...p, [field]: value } : p));
    setKb({ ...kb, promoCodes });
  };
  const addPromo = () => setKb({ ...kb, promoCodes: [...kb.promoCodes, { code: "", discount: "", condition: "", expiry: "" }] });
  const removePromo = (i: number) => setKb({ ...kb, promoCodes: kb.promoCodes.filter((_: any, idx: number) => idx !== i) });

  const updateRule = (i: number, field: string, value: string) => {
    const rules = kb.rules.map((r: any, idx: number) => (idx === i ? { ...r, [field]: value } : r));
    setKb({ ...kb, rules });
  };
  const addRule = () => setKb({ ...kb, rules: [...kb.rules, { category: "", rule: "" }] });
  const removeRule = (i: number) => setKb({ ...kb, rules: kb.rules.filter((_: any, idx: number) => idx !== i) });

  const updateFact = (i: number, value: string) => {
    const facts = kb.brand.facts.map((f: string, idx: number) => (idx === i ? value : f));
    setKb({ ...kb, brand: { ...kb.brand, facts } });
  };
  const addFact = () => setKb({ ...kb, brand: { ...kb.brand, facts: [...kb.brand.facts, ""] } });
  const removeFact = (i: number) => setKb({ ...kb, brand: { ...kb.brand, facts: kb.brand.facts.filter((_: any, idx: number) => idx !== i) } });

  return (
    <div className="container">
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: "var(--amber)", fontSize: 12, margin: 0 }}>theo grace</p>
          <h1 style={{ fontSize: 24, margin: "4px 0" }}>Knowledge Base</h1>
        </div>
        <Link href="/" className="btn-ghost" style={{ textDecoration: "none", fontSize: 13 }}>
          Back to Reply Assistant
        </Link>
      </header>

      <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 700, marginBottom: 28 }}>
        Edits here are shared with every agent using this tool. The reply assistant reads directly from this list.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Live site check</h2>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 13, margin: 0, color: "var(--text-muted)" }}>
            Last automated check: {kb.scrapedFacts?.checkedAt ? new Date(kb.scrapedFacts.checkedAt).toLocaleString() : "never"}
          </p>
          <p style={{ fontSize: 14, margin: 0 }}>{kb.scrapedFacts?.homepageBanner}</p>
          <button className="btn-ghost" style={{ width: "fit-content", fontSize: 13 }} onClick={runScrape} disabled={scraping}>
            {scraping ? "Checking the live site..." : "Refresh now"}
          </button>
          {scrapeMsg && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{scrapeMsg}</p>}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Brand voice and facts</h2>
        <label className="field-label">Voice guidance</label>
        <textarea rows={4} value={kb.brand.voice} onChange={(e) => setKb({ ...kb, brand: { ...kb.brand, voice: e.target.value } })} />
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {kb.brand.facts.map((f: string, i: number) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <textarea rows={2} value={f} onChange={(e) => updateFact(i, e.target.value)} />
              <button className="btn-ghost" onClick={() => removeFact(i)} style={{ color: "var(--red)" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <button className="btn-ghost" style={{ marginTop: 8, fontSize: 13 }} onClick={addFact}>
          + Add fact
        </button>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Promo codes</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {kb.promoCodes.map((p: any, i: number) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr auto", gap: 8 }}>
              <input value={p.code} onChange={(e) => updatePromo(i, "code", e.target.value)} placeholder="CODE" />
              <input value={p.discount} onChange={(e) => updatePromo(i, "discount", e.target.value)} placeholder="Discount" />
              <input value={p.condition} onChange={(e) => updatePromo(i, "condition", e.target.value)} placeholder="Condition" />
              <input value={p.expiry} onChange={(e) => updatePromo(i, "expiry", e.target.value)} placeholder="Valid until" />
              <button className="btn-ghost" onClick={() => removePromo(i)} style={{ color: "var(--red)" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <button className="btn-ghost" style={{ marginTop: 8, fontSize: 13 }} onClick={addPromo}>
          + Add promo code
        </button>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Process rules</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {kb.rules.map((r: any, i: number) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 3fr auto", gap: 8 }}>
              <input value={r.category} onChange={(e) => updateRule(i, "category", e.target.value)} placeholder="Category" />
              <textarea rows={2} value={r.rule} onChange={(e) => updateRule(i, "rule", e.target.value)} placeholder="What should the agent do or offer?" />
              <button className="btn-ghost" onClick={() => removeRule(i)} style={{ color: "var(--red)" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <button className="btn-ghost" style={{ marginTop: 8, fontSize: 13 }} onClick={addRule}>
          + Add rule
        </button>
      </section>

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn-primary" onClick={() => save(kb)} disabled={saving}>
          {saved ? "Saved" : saving ? "Saving..." : "Save changes"}
        </button>
        <button className="btn-ghost" onClick={() => save({ resetToDefaults: true })} disabled={saving}>
          Reset to latest defaults
        </button>
      </div>
    </div>
  );
}
