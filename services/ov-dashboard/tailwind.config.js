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
      borderRadius: {
        none: "0",
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "14px",
        "2xl": "18px",
        full: "9999px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(0, 0, 0, 0.4)",
        elev: "0 4px 16px -2px rgba(0, 0, 0, 0.55)",
        focus: "0 0 0 3px rgba(245, 173, 74, 0.28)",
      },
    },
  },
  plugins: [],
};
