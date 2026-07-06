"use client";

// Public newsletter signup for the Monthly Energy Report — lives in the footer.
import { useState } from "react";

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || state === "busy") return;
    setState("busy");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const j = await res.json();
      if (!res.ok) { setState("error"); setMsg(j.error ?? "Something went wrong"); return; }
      setState("done"); setEmail("");
    } catch {
      setState("error"); setMsg("Network error — try again");
    }
  }

  if (state === "done") {
    return (
      <p style={{ fontSize: "0.75rem", color: "var(--green-mid, #4ade80)", margin: 0 }}>
        Subscribed — the Monthly Energy Report will arrive in your inbox.
      </p>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
        placeholder="you@organisation.gov.ng"
        style={{ flex: 1, minWidth: 170, padding: "8px 10px", fontSize: "0.78rem", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, background: "rgba(255,255,255,0.06)", color: "#fff" }}
      />
      <button type="submit" disabled={state === "busy"}
        style={{ padding: "8px 14px", fontSize: "0.75rem", fontWeight: 700, background: "var(--green)", color: "#fff", border: "none", borderRadius: 6, cursor: state === "busy" ? "wait" : "pointer" }}>
        {state === "busy" ? "…" : "Subscribe"}
      </button>
      {state === "error" && <div style={{ width: "100%", fontSize: "0.68rem", color: "#fca5a5" }}>{msg}</div>}
    </form>
  );
}
