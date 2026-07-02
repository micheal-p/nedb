"use client";
import { useState, useRef, useEffect } from "react";

interface Props {
  text: string;
  position?: "top" | "bottom" | "left" | "right";
  width?: number;
}

export default function InfoTip({ text, position = "top", width = 220 }: Props) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible) return;
    function hide(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setVisible(false);
    }
    document.addEventListener("mousedown", hide);
    return () => document.removeEventListener("mousedown", hide);
  }, [visible]);

  const offsetMap: Record<string, React.CSSProperties> = {
    top:    { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top:    "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    left:   { right:  "calc(100% + 8px)", top: "50%",  transform: "translateY(-50%)" },
    right:  { left:   "calc(100% + 8px)", top: "50%",  transform: "translateY(-50%)" },
  };

  return (
    <span
      ref={ref}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
      role="tooltip"
      aria-label={text}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "default", outline: "none" }}
    >
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 14, height: 14, borderRadius: "50%",
        background: visible ? "var(--green)" : "var(--border)",
        color: visible ? "#fff" : "var(--ink-5)",
        fontSize: "0.6rem", fontWeight: 800, lineHeight: 1,
        transition: "background 0.15s, color 0.15s",
        userSelect: "none",
      }}>
        i
      </span>

      {visible && (
        <span style={{
          position: "absolute",
          ...offsetMap[position],
          width,
          background: "#1A1A1A",
          color: "#F5F5F5",
          fontSize: "0.72rem",
          lineHeight: 1.55,
          padding: "0.5rem 0.75rem",
          borderRadius: 6,
          zIndex: 9999,
          pointerEvents: "none",
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          fontWeight: 400,
          letterSpacing: 0,
          textTransform: "none",
          whiteSpace: "normal",
        }}>
          {text}
        </span>
      )}
    </span>
  );
}
