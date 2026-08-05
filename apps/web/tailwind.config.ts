const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0B",
        surface: "#131316",
        "surface-2": "#1C1C21",
        border: "#26262C",
        fg: "#FAFAFA",
        "fg-muted": "#A1A1AA",
        brand: "#6D4AFF",
        "brand-hover": "#5B3AE0",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
      },
      fontFamily: {
        sans: ["Inter Tight", "Inter", "system-ui", ...defaultTheme.fontFamily.sans],
        mono: ["JetBrains Mono", "ui-monospace", ...defaultTheme.fontFamily.mono],
      },
      borderRadius: {
        md: "12px",
        lg: "16px",
      },
    },
  },
  plugins: [],
};
