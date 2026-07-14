/**
 * DESIGN TOKENS — single source of truth.
 * Every colour, radius, shadow and font value lives here.
 * No component file may contain a hardcoded colour, spacing, or typography value.
 * Tailwind utilities and shadcn CSS vars are both derived from this file.
 */

export const tokens = {
  color: {
    // ── Brand: Indigo ────────────────────────────────────────────
    brand: {
      50:  "#eef2ff",
      100: "#e0e7ff",
      200: "#c7d2fe",
      300: "#a5b4fc",
      400: "#818cf8",
      500: "#6366f1",
      600: "#4f46e5",  // primary action
      700: "#4338ca",
      800: "#3730a3",
      900: "#312e81",
      950: "#1e1b4b",
    },
    // ── Accent: Ocean Blue ───────────────────────────────────────
    ocean: {
      50:  "#f0f9ff",
      100: "#e0f2fe",
      200: "#bae6fd",
      300: "#7dd3fc",
      400: "#38bdf8",
      500: "#0ea5e9",  // accent / links
      600: "#0284c7",
      700: "#0369a1",
      800: "#075985",
      900: "#0c4a6e",
      950: "#082f49",
    },
    // ── Neutral: Slate-Gray ──────────────────────────────────────
    gray: {
      0:   "#ffffff",
      50:  "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
      950: "#020617",
    },
    // ── Semantic ─────────────────────────────────────────────────
    success: { 50: "#f0fdf4", 500: "#22c55e", 700: "#15803d" },
    warning: { 50: "#fffbeb", 500: "#f59e0b", 700: "#b45309" },
    danger:  { 50: "#fef2f2", 500: "#ef4444", 700: "#b91c1c" },
  },

  radius: {
    none: "0",
    xs:   "0.125rem",
    sm:   "0.25rem",
    md:   "0.375rem",
    lg:   "0.5rem",
    xl:   "0.75rem",
    "2xl":"1rem",
    "3xl":"1.5rem",
    full: "9999px",
  },

  shadow: {
    xs:   "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    sm:   "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    md:   "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
    lg:   "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    xl:   "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    inner:"inset 0 2px 4px 0 rgb(0 0 0 / 0.05)",
    // brand glow for focus rings
    brand:"0 0 0 3px rgb(99 102 241 / 0.35)",
    ocean:"0 0 0 3px rgb(14 165 233 / 0.35)",
  },

  font: {
    sans:  ["Inter", "system-ui", "sans-serif"],
    mono:  ["JetBrains Mono", "Fira Code", "monospace"],
  },

  fontSize: {
    xs:   ["0.75rem",  { lineHeight: "1rem" }],
    sm:   ["0.875rem", { lineHeight: "1.25rem" }],
    base: ["1rem",     { lineHeight: "1.5rem" }],
    lg:   ["1.125rem", { lineHeight: "1.75rem" }],
    xl:   ["1.25rem",  { lineHeight: "1.75rem" }],
    "2xl":["1.5rem",   { lineHeight: "2rem" }],
    "3xl":["1.875rem", { lineHeight: "2.25rem" }],
    "4xl":["2.25rem",  { lineHeight: "2.5rem" }],
  },

  // Animation durations
  duration: {
    fast:   "100ms",
    normal: "200ms",
    slow:   "350ms",
  },
} as const

export type Tokens = typeof tokens
