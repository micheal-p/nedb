"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="btn btn-secondary btn-sm"
      style={{ gap: 6 }}
    >
      Print / PDF
    </button>
  );
}
