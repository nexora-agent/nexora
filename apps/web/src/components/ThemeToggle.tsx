"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "amber" | "arcade" | "light" | "clean";

const THEMES: { value: Theme; label: string; title: string }[] = [
  { value: "dark",   label: "NX",  title: "Nexus (dark)"     },
  { value: "amber",  label: "CRT", title: "Amber CRT"        },
  { value: "arcade", label: "ARC", title: "Arcade"           },
  { value: "light",  label: "GB",  title: "Game Boy"         },
  { value: "clean",  label: "OG",  title: "Original"         },
];

function preferredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem("nexora-theme") as Theme | null;
  if (stored && THEMES.some((t) => t.value === stored)) return stored;
  return "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = preferredTheme();
    setTheme(t);
    document.documentElement.dataset.theme = t;
    setMounted(true);
  }, []);

  function cycleTheme() {
    const idx = THEMES.findIndex((t) => t.value === theme);
    const next = THEMES[(idx + 1) % THEMES.length];
    setTheme(next.value);
    window.localStorage.setItem("nexora-theme", next.value);
    document.documentElement.dataset.theme = next.value;
  }

  if (!mounted) return null;

  const current = THEMES.find((t) => t.value === theme)!;
  const next = THEMES[(THEMES.findIndex((t) => t.value === theme) + 1) % THEMES.length];

  return (
    <button
      aria-label={`Switch to ${next.title} theme`}
      className="theme-toggle"
      onClick={cycleTheme}
      title={`Current: ${current.title} — click for ${next.title}`}
      type="button"
    >
      <span aria-hidden="true">{current.label}</span>
    </button>
  );
}
