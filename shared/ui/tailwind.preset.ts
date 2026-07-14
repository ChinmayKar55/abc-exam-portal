import type { Config } from "tailwindcss"
import { tokens } from "./tokens"

const preset: Partial<Config> = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        // shadcn CSS-var-based semantic palette
        background:   "hsl(var(--background))",
        foreground:   "hsl(var(--foreground))",
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border:  "hsl(var(--border))",
        input:   "hsl(var(--input))",
        ring:    "hsl(var(--ring))",

        // Token-derived named palettes (for explicit token usage in components)
        brand:   tokens.color.brand,
        ocean:   tokens.color.ocean,
        gray:    tokens.color.gray,
        success: tokens.color.success,
        warning: tokens.color.warning,
        danger:  tokens.color.danger,
      },

      borderRadius: {
        ...tokens.radius,
        // shadcn uses CSS vars for radius too
        lg:  "var(--radius)",
        md:  "calc(var(--radius) - 2px)",
        sm:  "calc(var(--radius) - 4px)",
      },

      boxShadow: tokens.shadow,

      fontFamily: {
        sans: tokens.font.sans,
        mono: tokens.font.mono,
      },

      fontSize: tokens.fontSize as Config["theme"]["fontSize"],

      transitionDuration: {
        fast:   tokens.duration.fast,
        normal: tokens.duration.normal,
        slow:   tokens.duration.slow,
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to:   { transform: "translateX(0)" },
        },
      },

      animation: {
        "accordion-down":  "accordion-down 200ms ease-out",
        "accordion-up":    "accordion-up 200ms ease-out",
        "fade-in":         "fade-in 200ms ease-out",
        "slide-in-right":  "slide-in-right 250ms ease-out",
      },
    },
  },
}

export default preset
