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
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      // Softer, rounder surfaces — calmer, ChatGPT-like feel.
      borderRadius: {
        none: "0",
        sm: "6px",
        DEFAULT: "9px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "26px",
        full: "9999px",
      },
      boxShadow: {
        // Soft, low-contrast elevation instead of hard borders.
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.10), 0 1px 2px -1px rgba(0, 0, 0, 0.10)",
        elev: "0 8px 28px -6px rgba(0, 0, 0, 0.30)",
        focus: "0 0 0 3px rgba(245, 173, 74, 0.28)",
      },
    },
  },
  plugins: [],
};
