"use client";

import { isHostedPreviewMode } from "@/lib/demo/demoMode";

export function HostedPreviewBanner() {
  if (!isHostedPreviewMode()) {
    return null;
  }

  return (
    <section
      aria-label="Hosted preview notice"
      className="hosted-preview-banner"
      style={{
        alignItems: "center",
        background: "rgba(99, 102, 241, 0.12)",
        border: "1px solid rgba(99, 102, 241, 0.45)",
        borderRadius: "12px",
        display: "flex",
        gap: "12px",
        margin: "16px auto 0",
        maxWidth: "1200px",
        padding: "12px 18px",
      }}
    >
      <span className="status-pill status-current">Hosted preview</span>
      <p style={{ margin: 0 }}>
        Hosted preview mode. This public demo runs deterministic benchmark
        previews in the browser. Live autonomous execution runs from the local
        operator runner and records results on Mantle.
      </p>
    </section>
  );
}
