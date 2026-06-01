"use client";

/*
  Pixel-art AI Wallet Agent — 12×16 grid (1 SVG unit per pixel).

  Design intent:
    - Visor LED bar (light blue-white, always readable on any dark body)
    - Glare pixel on visor top-left (gives CRT/screen feel)
    - Active antenna with signal tip in success green (scanning)
    - Gold coin badge on chest  (wallet identity)
    - Stubby arms reaching out  (cute + agentlike)
    - Rounded body with bevel shading (depth)
    - Short legs + wide feet     (approachable proportions)

  Colors that change per theme (CSS vars):
    --accent        → body
    --accent-strong → body shadow/bevel
    --warning       → coin badge + antenna base
    --success       → antenna tip (active/scanning signal)

  Colors that stay fixed:
    #d8f0ff  → visor screen (always light, readable on all dark bodies)
    #ffffff  → visor glare top-left
*/
export function WalletCharacter({ size = 120 }: { size?: number }) {
  const H = Math.round(size * (16 / 12));

  const body   = "var(--accent)";
  const shade  = "var(--accent-strong)";
  const coin   = "var(--warning)";
  const signal = "var(--success)";
  const visor  = "#d8f0ff";
  const glare  = "#ffffff";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 16"
      width={size}
      height={H}
      style={{ imageRendering: "pixelated", display: "block", overflow: "visible" }}
    >
      {/* ── Antenna ── */}
      {/* signal tip (green = active scanning) */}
      <rect x="5" y="0" width="2" height="1" fill={signal} />
      {/* antenna shaft */}
      <rect x="5" y="1" width="1" height="1" fill={coin} />
      <rect x="5" y="2" width="1" height="1" fill={body} />

      {/* ── Head / body top ── */}
      <rect x="3" y="3" width="6" height="1" fill={body} />
      <rect x="2" y="4" width="8" height="1" fill={body} />
      <rect x="1" y="5" width="10" height="1" fill={body} />

      {/* ── Visor row (LED scanner bar) ── */}
      {/* left/right body walls */}
      <rect x="1" y="6" width="1" height="2" fill={body} />
      <rect x="10" y="6" width="1" height="2" fill={body} />
      {/* visor screen */}
      <rect x="2" y="6" width="8" height="2" fill={visor} />
      {/* glare — top-left reflection */}
      <rect x="2" y="6" width="2" height="1" fill={glare} />
      {/* subtle scanline tint on bottom visor row */}
      <rect x="2" y="7" width="8" height="1" fill={visor} opacity="0.75" />

      {/* ── Body mid ── */}
      <rect x="1" y="8" width="10" height="1" fill={body} />

      {/* stubby arms extending out from body */}
      <rect x="0" y="8" width="1" height="1" fill={body} />
      <rect x="11" y="8" width="1" height="1" fill={body} />

      {/* ── Chest badge (gold coin = wallet identity) ── */}
      <rect x="1" y="9" width="1" height="1" fill={body} />
      <rect x="10" y="9" width="1" height="1" fill={body} />
      <rect x="4" y="9" width="4" height="1" fill={coin} />
      <rect x="2" y="9" width="2" height="1" fill={body} />
      <rect x="8" y="9" width="2" height="1" fill={body} />

      {/* ── Body bottom ── */}
      <rect x="1" y="10" width="10" height="1" fill={body} />
      <rect x="2" y="11" width="8" height="1" fill={body} />
      <rect x="3" y="12" width="6" height="1" fill={body} />

      {/* bevel shading — bottom-right edge */}
      <rect x="9" y="5"  width="1" height="1" fill={shade} />
      <rect x="10" y="6" width="1" height="1" fill={shade} />
      <rect x="10" y="10" width="1" height="1" fill={shade} />

      {/* ── Legs ── */}
      <rect x="4" y="13" width="1" height="2" fill={body} />
      <rect x="7" y="13" width="1" height="2" fill={body} />

      {/* ── Feet ── */}
      <rect x="3" y="15" width="2" height="1" fill={body} />
      <rect x="7" y="15" width="2" height="1" fill={body} />
    </svg>
  );
}
