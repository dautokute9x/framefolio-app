import animate from "tailwindcss-animate";
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "background": "hsl(var(--background) / <alpha-value>)",
        "foreground": "hsl(var(--foreground) / <alpha-value>)",
        "card": "hsl(var(--card) / <alpha-value>)",
        "card-foreground": "hsl(var(--card-foreground) / <alpha-value>)",
        "primary": "hsl(var(--primary) / <alpha-value>)",
        "primary-foreground": "hsl(var(--primary-foreground) / <alpha-value>)",
        "secondary": "hsl(var(--secondary) / <alpha-value>)",
        "secondary-foreground": "hsl(var(--secondary-foreground) / <alpha-value>)",
        "muted": "hsl(var(--muted) / <alpha-value>)",
        "muted-foreground": "hsl(var(--muted-foreground) / <alpha-value>)",
        "border": "hsl(var(--border) / <alpha-value>)",
        "input": "hsl(var(--input) / <alpha-value>)",
        "accent": "hsl(var(--accent) / <alpha-value>)",
        "ring": "hsl(var(--ring) / <alpha-value>)",
        "destructive": "hsl(var(--destructive) / <alpha-value>)",
        "success": "hsl(var(--success) / <alpha-value>)",
      },
      borderRadius: {
        lg: "1rem",
        md: "0.875rem",
        sm: "0.75rem"
      },
      boxShadow: {
        premium: "0 18px 48px -18px rgba(15, 23, 42, 0.20)"
      },
      fontFamily: {
        sans: ["var(--font-inter)"],
        display: ["var(--font-playfair)"]
      }
    },
  },
  plugins: [animate],
};

export default config;
