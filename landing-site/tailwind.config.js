/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-elev": "var(--surface-elev)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        "text-dim": "var(--text-dim)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "accent-dim": "var(--accent-dim)",
        success: "var(--success)",
        danger: "var(--danger)",
        whatsapp: "#25D366",
        "whatsapp-bg": "#0b141a",
        "whatsapp-bubble": "#202c33",
        "whatsapp-out": "#005c4b",
        telegram: "#2AABEE",
        "telegram-bg": "#0e1621",
        "telegram-bubble": "#182533",
        "telegram-out": "#2b5278",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        none: "0",
        sm: "6px",
        DEFAULT: "9px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "26px",
        "3xl": "32px",
        full: "9999px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.10), 0 1px 2px -1px rgba(0,0,0,0.10)",
        elev: "0 8px 28px -6px rgba(0,0,0,0.30)",
        glow: "0 0 0 1px rgba(245,173,74,0.20), 0 24px 64px -16px rgba(245,173,74,0.18)",
        phone: "0 32px 80px -20px rgba(0,0,0,0.65)",
        focus: "0 0 0 3px rgba(245,173,74,0.28)",
      },
      keyframes: {
        "pulse-mark": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scan": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(2400%)" },
        },
        "blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.2" },
        },
        "typing": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "30%": { transform: "translateY(-4px)", opacity: "1" },
        },
        "marquee": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "pulse-mark": "pulse-mark 2s ease-in-out infinite",
        "fade-up": "fade-up 0.5s ease-out both",
        scan: "scan 4s linear infinite",
        blink: "blink 1.4s ease-in-out infinite",
        typing: "typing 1.2s ease-in-out infinite",
        marquee: "marquee 28s linear infinite",
      },
    },
  },
  plugins: [],
};
