"use client";

import { useState, useRef, useEffect } from "react";

interface Message { role: "user" | "assistant"; text: string; time: string }

const SUGGESTIONS: Record<string, string[]> = {
  overview:   ["Summarise Nigeria's energy performance this year", "What is the YoY change in crude oil production?", "Which sector has improved the most?"],
  downstream: ["Which DisCo has the worst ATC&C loss?", "What is the national average collection efficiency?", "Explain what ATC&C loss means"],
  upstream:   ["Which OML block produces the most crude?", "How has gas flaring trended over 5 years?", "What is royalty compliance rate?"],
  power:      ["Compare electricity generation vs. sent out", "Which DisCo improved most in the last year?", "What is the grid installed capacity?"],
  renewable:  ["How many off-grid connections does REA have?", "What is LPG household penetration?", "Which state has the most mini-grids?"],
  revenue:    ["What is the oil revenue FAAC contribution?", "Which OML block contributes most royalties?", "Explain PPT and how it is calculated"],
  default:    ["Explain this dashboard to me", "What data is available in NEDB?", "How is this data collected?"],
};

function now() { return new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }); }

export default function ApexAI({ currentView, profileLabel }: { currentView: string; profileLabel: string }) {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: `Hello! I'm Apex AI, your NEDB intelligence assistant. I can help you understand the energy data on your dashboard, explain trends, compare metrics, and answer questions about Nigeria's energy sector.\n\nI'm currently viewing your **${profileLabel}** dashboard. What would you like to know?`,
      time: now(),
    },
  ]);
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100); }, [open]);

  function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q, time: now() }]);
    setThinking(true);
    // Placeholder — replace with Claude API call when ready
    setTimeout(() => {
      setThinking(false);
      setMessages((m) => [...m, {
        role: "assistant",
        text: `I'm processing your question about "${q}". The Apex AI intelligence engine is being configured — once connected to the NEDB data API, I'll provide real-time analysis, trend explanations, and data-driven insights specific to your ${profileLabel} dashboard.\n\n*Apex AI · Pending API configuration*`,
        time: now(),
      }]);
    }, 1200);
  }

  const suggestions = SUGGESTIONS[currentView] ?? SUGGESTIONS.default;

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 900,
          width: 52, height: 52, borderRadius: "50%",
          background: "linear-gradient(135deg, #0E7A3C 0%, #065F46 100%)",
          border: "2px solid rgba(255,255,255,0.2)",
          boxShadow: "0 4px 20px rgba(14,122,60,0.4)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.2s, box-shadow 0.2s",
        }}
        title="Apex AI — NEDB Intelligence Assistant"
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.08)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
            <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10 10 10 0 0 1-10-10A10 10 0 0 1 12 2z"/>
            <path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
          </svg>
        )}
        {!open && (
          <span style={{ position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: "50%", background: "#0E7A3C", border: "2px solid #fff", animation: "pulse 2s infinite" }} />
        )}
      </button>

      {/* Label when closed */}
      {!open && (
        <div style={{ position: "fixed", bottom: 30, right: 84, zIndex: 899, background: "var(--ink)", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.04em", pointerEvents: "none", opacity: 0.85 }}>
          Apex AI
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 84, right: 24, zIndex: 900,
          width: 360, height: 520, background: "#fff",
          border: "1px solid var(--border)", borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.16)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #0A0A0A 0%, #1a1a1a 100%)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #0E7A3C, #065F46)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10 10 10 0 0 1-10-10A10 10 0 0 1 12 2z"/>
                <path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>Apex AI</div>
              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#0E7A3C", display: "inline-block" }} />
                NEDB Intelligence Assistant
              </div>
            </div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.25)", textAlign: "right" }}>
              <div>Viewing</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{profileLabel}</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, background: "var(--surface)" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 8, alignItems: "flex-end" }}>
                {msg.role === "assistant" && (
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg, #0E7A3C, #065F46)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10 10 10 0 0 1-10-10A10 10 0 0 1 12 2z"/><path d="M12 8v4M12 16h.01" strokeLinecap="round"/></svg>
                  </div>
                )}
                <div style={{ maxWidth: "78%" }}>
                  <div style={{
                    padding: "8px 12px", borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    background: msg.role === "user" ? "var(--ink)" : "#fff",
                    color: msg.role === "user" ? "#fff" : "var(--ink)",
                    fontSize: "0.78rem", lineHeight: 1.55,
                    border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    whiteSpace: "pre-wrap",
                  }}>
                    {msg.text}
                  </div>
                  <div style={{ fontSize: "0.62rem", color: "var(--ink-5)", marginTop: 3, textAlign: msg.role === "user" ? "right" : "left" }}>{msg.time}</div>
                </div>
              </div>
            ))}
            {thinking && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg, #0E7A3C, #065F46)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 2a10 10 0 0 1 10 10 10 10 0 0 1-10 10 10 10 0 0 1-10-10A10 10 0 0 1 12 2z"/><path d="M12 8v4M12 16h.01" strokeLinecap="round"/></svg>
                </div>
                <div style={{ padding: "10px 14px", background: "#fff", border: "1px solid var(--border)", borderRadius: "12px 12px 12px 2px", display: "flex", gap: 4, alignItems: "center" }}>
                  {[0, 0.2, 0.4].map((d, i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ink-4)", animation: `bounce 1s ${d}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", background: "#fff", display: "flex", gap: 6, overflowX: "auto", flexShrink: 0 }}>
            {suggestions.map((s) => (
              <button key={s} onClick={() => send(s)} style={{ padding: "4px 10px", fontSize: "0.68rem", fontWeight: 500, border: "1px solid var(--border)", borderRadius: 20, background: "var(--surface)", color: "var(--ink-4)", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
                {s}
              </button>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border)", background: "#fff", display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about energy data…"
              style={{ flex: 1, padding: "8px 12px", fontSize: "0.8rem", border: "1px solid var(--border)", borderRadius: 8, outline: "none", background: "var(--surface)", color: "var(--ink)" }}
            />
            <button onClick={() => send()} disabled={!input.trim() || thinking} style={{ width: 36, height: 36, borderRadius: 8, background: input.trim() && !thinking ? "var(--ink)" : "var(--surface-muted)", border: "none", cursor: input.trim() && !thinking ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !thinking ? "#fff" : "var(--ink-5)"} strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1); } }
        @keyframes pulse  { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </>
  );
}
