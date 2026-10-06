"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ReviewItem = {
  id: string;
  target: string;
  proposed_fact: string;
  raw_input: string;
  reason: string;
  conflicting_with: string | null;
  submitted_by: string | null;
  created_at: string;
};

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [edits, setEdits] = useState<Record<string, { target: string; fact: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const [reviewData, kbData] = await Promise.all([
      fetch("/api/kb/review").then((r) => r.json()),
      fetch("/api/kb").then((r) => r.json()),
    ]);
    setItems(reviewData.items || []);
    setSites((kbData.sites || []).map((s: any) => ({ id: s.id, name: s.name })));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const getEdit = (item: ReviewItem) => edits[item.id] || { target: item.target, fact: item.proposed_fact };

  const approve = async (item: ReviewItem) => {
    setBusyId(item.id);
    const edit = getEdit(item);
    await fetch("/api/kb/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, action: "approve", target: edit.target, fact: edit.fact }),
    });
    setBusyId(null);
    await load();
  };

  const reject = async (item: ReviewItem) => {
    setBusyId(item.id);
    await fetch("/api/kb/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, action: "reject" }),
    });
    setBusyId(null);
    await load();
  };

  return (
    <div className="container">
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ color: "var(--amber)", fontSize: 12, margin: 0 }}>Raziel</p>
          <h1 style={{ fontSize: 24, margin: "4px 0" }}>To Validate</h1>
        </div>
        <Link href="/knowledge" className="btn-ghost" style={{ textDecoration: "none", fontSize: 13 }}>
          Back to Knowledge Base
        </Link>
      </header>

      <p style={{ color: "var(--text-muted)", fontSize: 14, maxWidth: 700, marginBottom: 24 }}>
        Anything submitted that was unclear or contradicted something already recorded lands here instead of silently overwriting it. Approve to
        add it (edit the target or wording first if needed), or reject to discard it.
      </p>

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Nothing pending, everything submitted so far was clear.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {items.map((item) => {
            const edit = getEdit(item);
            return (
              <div key={item.id} className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <label className="field-label">Raw submission</label>
                  <p style={{ fontSize: 14, margin: 0 }}>{item.raw_input}</p>
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: "var(--amber)" }}>Why it's here: </span>
                  <span>{item.reason}</span>
                </div>
                {item.conflicting_with && (
                  <div style={{ fontSize: 13 }}>
                    <span style={{ color: "var(--red)" }}>Conflicts with: </span>
                    <span>{item.conflicting_with}</span>
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: 8 }}>
                  <select
                    value={edit.target}
                    onChange={(e) => setEdits({ ...edits, [item.id]: { ...edit, target: e.target.value } })}
                  >
                    <option value="common">common</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <textarea
                    rows={2}
                    value={edit.fact}
                    onChange={(e) => setEdits({ ...edits, [item.id]: { ...edit, fact: e.target.value } })}
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" onClick={() => approve(item)} disabled={busyId === item.id}>
                    {busyId === item.id ? "Working..." : "Approve"}
                  </button>
                  <button className="btn-ghost" onClick={() => reject(item)} disabled={busyId === item.id} style={{ color: "var(--red)" }}>
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
