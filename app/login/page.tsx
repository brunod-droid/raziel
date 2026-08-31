"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        setError("Incorrect passcode, try again.");
        setLoading(false);
        return;
      }
      const next = params.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch {
      setError("Something went wrong, try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label className="field-label">Team passcode</label>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Enter your passcode"
          autoFocus
        />
      </div>
      {error && <p style={{ color: "var(--red)", fontSize: 13, margin: 0 }}>{error}</p>}
      <button className="btn-primary" disabled={loading || !passcode}>
        {loading ? "Checking..." : "Enter"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="container" style={{ maxWidth: 360, paddingTop: 100 }}>
      <p style={{ color: "var(--amber)", fontSize: 12, letterSpacing: 0.5, marginBottom: 4 }}>theo grace</p>
      <h1 style={{ fontSize: 22, marginTop: 0, marginBottom: 20 }}>Holiday Concierge Console</h1>
      <Suspense fallback={<p style={{ color: "var(--text-muted)" }}>Loading...</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
