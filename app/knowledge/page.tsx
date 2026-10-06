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
  const [activeSiteId, setActiveSiteId] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [couponStats, setCouponStats] = useState<Record<string, { available: number; claimed: number; total: number }>>({});
  const [couponMsg, setCouponMsg] = useState("");
  const [addingCoupons, setAddingCoupons] = useState(false);
  const [ingestText, setIngestText] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<any>(null);

  const load = async () => {
    const data = await (await fetch("/api/kb")).json();
    setKb(data);
    if (!activeSiteId && data.sites?.length > 0) setActiveSiteId(data.sites[0].id);
    setLoading(false);
    return data;
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!activeSiteId) return;
    fetch(`/api/coupons/manage?siteId=${encodeURIComponent(activeSiteId)}`)
      .then((r) => r.json())
      .then((stats) => setCouponStats((prev) => ({ ...prev, [activeSiteId]: stats })))
      .catch(() => {});
  }, [activeSiteId]);

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

  const submitIngest = async () => {
    if (!ingestText.trim()) return;
    setIngesting(true);
    setIngestResult(null);
    try {
      const res = await fetch("/api/kb/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ingestText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIngestResult({ error: data.error || "Something went wrong." });
        return;
      }
      setIngestResult(data);
      if (data.autoAdded) {
        setIngestText("");
        await load();
      }
    } catch (e: any) {
      setIngestResult({ error: e.message });
    } finally {
      setIngesting(false);
    }
  };

  const runScrape = async () => {
    setScraping(true);
    setScrapeMsg("");
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: activeSiteId }),
      });
      const data = await res.json();
      if (data.ok) {
        setScrapeMsg(`Updated: ${data.banner}`);
        await load();
      } else {
        setScrapeMsg(`Scrape failed: ${data.error}`);
      }
    } catch (e: any) {
      setScrapeMsg(`Scrape failed: ${e.message}`);
    } finally {
      setScraping(false);
    }
  };

  const addCoupons = async () => {
    const codes = couponInput
      .split("\n")
      .map((c) => c.trim())
      .filter(Boolean);
    if (codes.length === 0) return;
    setAddingCoupons(true);
    setCouponMsg("");
    try {
      const res = await fetch("/api/coupons/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: activeSiteId, codes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCouponMsg(data.error || "Could not add codes.");
        return;
      }
      setCouponStats((prev) => ({ ...prev, [activeSiteId]: data.stats }));
      setCouponMsg(`Added ${data.added} code${data.added === 1 ? "" : "s"}${data.skipped > 0 ? `, skipped ${data.skipped} already in the pool` : ""}.`);
      setCouponInput("");
    } catch (e: any) {
      setCouponMsg(e.message);
    } finally {
      setAddingCoupons(false);
    }
  };

  if (loading || !kb) {
    return (
      <div className="container">
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  // --- common editing helpers ---
  const updateCommonFact = (i: number, value: string) => {
    const facts = kb.common.facts.map((f: string, idx: number) => (idx === i ? value : f));
    setKb({ ...kb, common: { ...kb.common, facts } });
  };
  const addCommonFact = () => setKb({ ...kb, common: { ...kb.common, facts: [...kb.common.facts, ""] } });
  const removeCommonFact = (i: number) =>
    setKb({ ...kb, common: { ...kb.common, facts: kb.common.facts.filter((_: any, idx: number) => idx !== i) } });

  const updateCommonRule = (i: number, field: string, value: string) => {
    const rules = kb.common.rules.map((r: any, idx: number) => (idx === i ? { ...r, [field]: value } : r));
    setKb({ ...kb, common: { ...kb.common, rules } });
  };
  const addCommonRule = () => setKb({ ...kb, common: { ...kb.common, rules: [...kb.common.rules, { category: "", rule: "" }] } });
  const removeCommonRule = (i: number) =>
    setKb({ ...kb, common: { ...kb.common, rules: kb.common.rules.filter((_: any, idx: number) => idx !== i) } });

  // --- site editing helpers ---
  const siteIdx = kb.sites.findIndex((s: any) => s.id === activeSiteId);
  const site = kb.sites[siteIdx];

  const updateSite = (patch: any) => {
    const sites = kb.sites.map((s: any, idx: number) => (idx === siteIdx ? { ...s, ...patch } : s));
    setKb({ ...kb, sites });
  };

  const updateSiteFact = (i: number, value: string) => {
    const facts = site.facts.map((f: string, idx: number) => (idx === i ? value : f));
    updateSite({ facts });
  };
  const addSiteFact = () => updateSite({ facts: [...site.facts, ""] });
  const removeSiteFact = (i: number) => updateSite({ facts: site.facts.filter((_: any, idx: number) => idx !== i) });

  const updateSitePromo = (i: number, field: string, value: string) => {
    const promoCodes = site.promoCodes.map((p: any, idx: number) => (idx === i ? { ...p, [field]: value } : p));
    updateSite({ promoCodes });
  };
  const addSitePromo = () => updateSite({ promoCodes: [...site.promoCodes, { code: "", discount: "", condition: "", expiry: "" }] });
  const removeSitePromo = (i: number) => updateSite({ promoCodes: site.promoCodes.filter((_: any, idx: number) => idx !== i) });

  const updateSiteRule = (i: number, field: string, value: string) => {
    const rules = site.rules.map((r: any, idx: number) => (idx === i ? { ...r, [field]: value } : r));
    updateSite({ rules });
  };
  const addSiteRule = () => updateSite({ rules: [...site.rules, { category: "", rule: "" }] });
  const removeSiteRule = (i: number) => updateSite({ rules: site.rules.filter((_: any, idx: number) => idx !== i) });

  const addNewSite = () => {
    const id = prompt("Short id for the new site, lowercase, no spaces (e.g. \"mynewbrand\")");
    if (!id) return;
    if (kb.sites.some((s: any) => s.id === id)) {
      alert("A site with that id already exists.");
      return;
    }
    const newSite = {
      id,
      name: id,
      domains: [],
      voice: "",
      facts: [],
      promoCodes: [],
      rules: [],
      scrapedFacts: { homepageBanner: "Not scraped yet.", checkedAt: null, source: null },
    };
    const sites = [...kb.sites, newSite];
    setKb({ ...kb, sites });
    setActiveSiteId(id);
  };

  const stats = couponStats[activeSiteId];

  return (
    <div className="container">
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: "var(--amber)", fontSize: 12, margin: 0 }}>Raziel</p>
          <h1 style={{ fontSize: 24, margin: "4px 0" }}>Knowledge Base</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/review" className="btn-ghost" style={{ textDecoration: "none", fontSize: 13 }}>
            To Validate
          </Link>
          <Link href="/" className="btn-ghost" style={{ textDecoration: "none", fontSize: 13 }}>
            Back to Reply Assistant
          </Link>
        </div>
      </header>

      <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 700, marginBottom: 20 }}>
        Common is shared by every site below. Each site also has its own voice, promo codes, facts and coupon pool on top of that shared trunk.
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Export everything</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
          Downloads the live knowledge base exactly as it is right now, including anything added in the app: common facts and rules, every site, promo codes, the assistant's writing and tone rules, and anything waiting in To Validate.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="btn-primary" href="/api/kb/export?format=xlsx" style={{ textDecoration: "none", display: "inline-block" }}>
            Download Excel
          </a>
          <a className="btn-ghost" href="/api/kb/export?format=json" style={{ textDecoration: "none", display: "inline-block" }}>
            Download JSON
          </a>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Add knowledge</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
          Paste any new info, a policy, a product detail, anything. It's checked against everything already recorded. If it's clear and doesn't
          conflict with anything, it's added automatically. If it's unclear or contradicts something existing, it goes to{" "}
          <Link href="/review" style={{ color: "var(--amber)" }}>
            To Validate
          </Link>{" "}
          for you to resolve instead of silently overwriting anything.
        </p>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <textarea
            rows={3}
            value={ingestText}
            onChange={(e) => setIngestText(e.target.value)}
            placeholder="Paste new info here..."
          />
          <button className="btn-primary" style={{ width: "fit-content" }} onClick={submitIngest} disabled={ingesting || !ingestText.trim()}>
            {ingesting ? "Checking..." : "Add"}
          </button>
          {ingestResult && (
            <div style={{ fontSize: 13 }}>
              {ingestResult.error && <p style={{ color: "var(--red)" }}>{ingestResult.error}</p>}
              {ingestResult.autoAdded && (
                <p style={{ color: "var(--green)" }}>
                  Added to <strong>{ingestResult.target}</strong>: {ingestResult.proposed_fact}
                </p>
              )}
              {ingestResult.autoAdded === false && (
                <p style={{ color: "var(--amber)" }}>
                  Sent to To Validate ({ingestResult.target}): {ingestResult.reason}
                  {ingestResult.conflicting_with && (
                    <>
                      <br />
                      Conflicts with: {ingestResult.conflicting_with}
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ---------- COMMON ---------- */}
      <section style={{ marginBottom: 36, paddingBottom: 28, borderBottom: `1px solid var(--line)` }}>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>Common, shared by every site</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0, marginBottom: 16 }}>Product facts and process rules that apply no matter which site the message came from.</p>

        <label className="field-label">Shared facts</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          {kb.common.facts.map((f: string, i: number) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <textarea rows={2} value={f} onChange={(e) => updateCommonFact(i, e.target.value)} />
              <button className="btn-ghost" onClick={() => removeCommonFact(i)} style={{ color: "var(--red)" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <button className="btn-ghost" style={{ fontSize: 13, marginBottom: 20 }} onClick={addCommonFact}>
          + Add shared fact
        </button>

        <label className="field-label">Shared process rules</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {kb.common.rules.map((r: any, i: number) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 3fr auto", gap: 8 }}>
              <input value={r.category} onChange={(e) => updateCommonRule(i, "category", e.target.value)} placeholder="Category" />
              <textarea rows={2} value={r.rule} onChange={(e) => updateCommonRule(i, "rule", e.target.value)} placeholder="What should the agent do or offer?" />
              <button className="btn-ghost" onClick={() => removeCommonRule(i)} style={{ color: "var(--red)" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <button className="btn-ghost" style={{ fontSize: 13, marginTop: 8 }} onClick={addCommonRule}>
          + Add shared rule
        </button>
      </section>

      {/* ---------- SITE TABS ---------- */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <div className="tabs">
          {kb.sites.map((s: any) => (
            <button key={s.id} className={`tab ${s.id === activeSiteId ? "active" : ""}`} onClick={() => setActiveSiteId(s.id)}>
              {s.name || s.id}
            </button>
          ))}
        </div>
        <button className="btn-ghost" style={{ fontSize: 13 }} onClick={addNewSite}>
          + Add site
        </button>
      </div>

      {site && (
        <>
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Site details</h2>
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label className="field-label">Display name</label>
                  <input value={site.name} onChange={(e) => updateSite({ name: e.target.value })} placeholder="e.g. theo grace" />
                </div>
                <div>
                  <label className="field-label">Domain(s), comma separated</label>
                  <input
                    value={site.domains.join(", ")}
                    onChange={(e) => updateSite({ domains: e.target.value.split(",").map((d: string) => d.trim()).filter(Boolean) })}
                    placeholder="e.g. example.com"
                  />
                </div>
              </div>
              <div>
                <label className="field-label">Voice for this site</label>
                <textarea rows={3} value={site.voice} onChange={(e) => updateSite({ voice: e.target.value })} />
              </div>
            </div>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Live site check</h2>
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 13, margin: 0, color: "var(--text-muted)" }}>
                Last automated check: {site.scrapedFacts?.checkedAt ? new Date(site.scrapedFacts.checkedAt).toLocaleString() : "never"}
              </p>
              <p style={{ fontSize: 14, margin: 0 }}>{site.scrapedFacts?.homepageBanner}</p>
              <button className="btn-ghost" style={{ width: "fit-content", fontSize: 13 }} onClick={runScrape} disabled={scraping || site.domains.length === 0}>
                {scraping ? "Checking the live site..." : "Refresh now"}
              </button>
              {site.domains.length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Add a domain above first.</p>}
              {scrapeMsg && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{scrapeMsg}</p>}
            </div>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Facts specific to this site</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {site.facts.map((f: string, i: number) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                  <textarea rows={2} value={f} onChange={(e) => updateSiteFact(i, e.target.value)} />
                  <button className="btn-ghost" onClick={() => removeSiteFact(i)} style={{ color: "var(--red)" }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-ghost" style={{ marginTop: 8, fontSize: 13 }} onClick={addSiteFact}>
              + Add fact
            </button>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Promo codes for this site</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {site.promoCodes.map((p: any, i: number) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr auto", gap: 8 }}>
                  <input value={p.code} onChange={(e) => updateSitePromo(i, "code", e.target.value)} placeholder="CODE" />
                  <input value={p.discount} onChange={(e) => updateSitePromo(i, "discount", e.target.value)} placeholder="Discount" />
                  <input value={p.condition} onChange={(e) => updateSitePromo(i, "condition", e.target.value)} placeholder="Condition" />
                  <input value={p.expiry} onChange={(e) => updateSitePromo(i, "expiry", e.target.value)} placeholder="Valid until" />
                  <button className="btn-ghost" onClick={() => removeSitePromo(i)} style={{ color: "var(--red)" }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-ghost" style={{ marginTop: 8, fontSize: 13 }} onClick={addSitePromo}>
              + Add promo code
            </button>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Process rules specific to this site</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {site.rules.map((r: any, i: number) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 3fr auto", gap: 8 }}>
                  <input value={r.category} onChange={(e) => updateSiteRule(i, "category", e.target.value)} placeholder="Category" />
                  <textarea rows={2} value={r.rule} onChange={(e) => updateSiteRule(i, "rule", e.target.value)} placeholder="What should the agent do or offer?" />
                  <button className="btn-ghost" onClick={() => removeSiteRule(i)} style={{ color: "var(--red)" }}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-ghost" style={{ marginTop: 8, fontSize: 13 }} onClick={addSiteRule}>
              + Add rule
            </button>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>Single-use coupon pool</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0 }}>
              Paste unique codes below, one per line. Each one can be claimed by exactly one agent, once claimed it's gone from the pool for good.
            </p>
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {stats && (
                <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                  <span>
                    <strong style={{ color: "var(--green)" }}>{stats.available}</strong> available
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    <strong>{stats.claimed}</strong> claimed
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>
                    <strong>{stats.total}</strong> total
                  </span>
                </div>
              )}
              <textarea
                rows={4}
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder={"HOLIDAY-AB12\nHOLIDAY-CD34\nHOLIDAY-EF56"}
              />
              <button className="btn-primary" style={{ width: "fit-content" }} onClick={addCoupons} disabled={addingCoupons || !couponInput.trim()}>
                {addingCoupons ? "Adding..." : "Add codes"}
              </button>
              {couponMsg && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{couponMsg}</p>}
            </div>
          </section>
        </>
      )}

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
