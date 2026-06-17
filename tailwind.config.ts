import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        "boutique-creame": "#FFFDF5",
        "espresso-brown": "#2C1E16",
        "cobalt-pulse": "#0047AB",
        "resale-gold": "#D4AF37",
        "frosted-tan": "#F2EFE9",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        "pulse-gold": "pulse-gold 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        "pulse-gold": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: ".8", transform: "scale(1.05)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
