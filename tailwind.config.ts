import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

// ScienceQuest design system — Section 4
// All color tokens map to CSS custom properties defined in globals.css.
// Do NOT use default Tailwind color palette (gray, blue, etc.) anywhere in the app.

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // Override — remove default colors entirely so no generic defaults leak in
    colors: {
      transparent: "transparent",
      current:     "currentColor",
      white:       "#ffffff",
      black:       "#000000",

      // ── Backgrounds
      "bg-base":    "var(--color-bg-base)",
      "bg-surface": "var(--color-bg-surface)",
      "bg-raised":  "var(--color-bg-raised)",
      border:       "var(--color-border)",

      // ── Text
      "text-primary":   "var(--color-text-primary)",
      "text-secondary": "var(--color-text-secondary)",
      "text-muted":     "var(--color-text-muted)",

      // ── Accents
      violet:  "var(--color-accent-violet)",
      "violet-hover": "var(--color-accent-violet-hover)",
      cyan:    "var(--color-accent-cyan)",
      amber:   "var(--color-accent-amber)",
      rose:    "var(--color-accent-rose)",
      emerald: "var(--color-accent-emerald)",

      // ── Subjects
      math:      "var(--color-math)",
      physics:   "var(--color-physics)",
      chemistry: "var(--color-chemistry)",
      earth:     "var(--color-earth)",
    },

    extend: {
      // ── Spacing — base unit 4px, multiples only
      spacing: {
        "1":  "4px",
        "2":  "8px",
        "3":  "12px",
        "4":  "16px",
        "5":  "20px",
        "6":  "24px",
        "8":  "32px",
        "10": "40px",
        "12": "48px",
        "16": "64px",
        "20": "80px",
        "24": "96px",
      },

      // ── Border radius
      borderRadius: {
        sm:   "var(--radius-sm)",
        card: "var(--radius-card)",
        lg:   "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },

      // ── Box shadows
      boxShadow: {
        surface:    "var(--shadow-surface)",
        "card-hover": "var(--shadow-card-hover)",
        glow:       "var(--shadow-glow)",
      },

      // ── Font families (set by next/font CSS vars in layout.tsx)
      fontFamily: {
        sora:    ["var(--font-sora)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans:    ["var(--font-dm-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },

      // ── Font sizes — Section 4 typography scale
      fontSize: {
        display: ["48px", { lineHeight: "1.1", fontWeight: "700" }],
        h1:      ["32px", { lineHeight: "1.2", fontWeight: "700" }],
        h2:      ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        h3:      ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        body:    ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        sm:      ["14px", { lineHeight: "1.4", fontWeight: "400" }],
        xs:      ["12px", { lineHeight: "1.4", fontWeight: "500" }],
      },

      // ── Transition durations — Section 4 motion
      transitionDuration: {
        fast:         "100ms",
        DEFAULT:      "200ms",
        explanation:  "300ms",
        celebration:  "400ms",
        xp:           "1000ms",
      },

      // ── Breakpoints — Section 4.4
      screens: {
        tablet:  "640px",
        desktop: "1024px",
      },

      // ── Min touch target size — Section 4.4 (44px)
      minHeight: { touch: "44px" },
      minWidth:  { touch: "44px" },

      // ── Keyframes for CSS-only animations (Framer Motion handles React animations)
      keyframes: {
        "xp-float": {
          "0%":   { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(-32px)" },
        },
        "slide-up": {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(0.8)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "xp-float":    "xp-float 1s ease-out forwards",
        "slide-up":    "slide-up 300ms ease-out forwards",
        "scale-in":    "scale-in 400ms ease-out forwards",
        "fade-in":     "fade-in 200ms ease-out forwards",
      },

      // ── Stagger delay utilities — for quest board topic card entrance
      // Usage: className="animate-fade-in delay-[100ms]"
      // Or use the named set: delay-stagger-1 through delay-stagger-8
      animationDelay: {
        "0":           "0ms",
        "50":          "50ms",
        "100":         "100ms",
        "150":         "150ms",
        "200":         "200ms",
        "300":         "300ms",
        "400":         "400ms",
        "500":         "500ms",
        "stagger-1":   "50ms",
        "stagger-2":   "100ms",
        "stagger-3":   "150ms",
        "stagger-4":   "200ms",
        "stagger-5":   "250ms",
        "stagger-6":   "300ms",
        "stagger-7":   "350ms",
        "stagger-8":   "400ms",
      },
    },
  },
  plugins: [
    // Emit animation-delay utilities from the animationDelay theme values
    plugin(({ matchUtilities, theme }) => {
      matchUtilities(
        { delay: (value: string) => ({ animationDelay: value }) },
        { values: theme("animationDelay") }
      );
    }),
  ],
};

export default config;
