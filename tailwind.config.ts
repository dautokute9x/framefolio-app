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
        background: "hsl(38 20% 98%)",
        foreground: "hsl(222 18% 14%)",
        card: "hsl(0 0% 100%)",
        "card-foreground": "hsl(222 18% 14%)",
        primary: "hsl(222 32% 18%)",
        "primary-foreground": "hsl(38 20% 98%)",
        secondary: "hsl(38 12% 93%)",
        "secondary-foreground": "hsl(222 18% 14%)",
        muted: "hsl(38 12% 92%)",
        "muted-foreground": "hsl(220 10% 40%)",
        border: "hsl(36 10% 86%)",
        input: "hsl(36 10% 86%)",
        accent: "hsl(25 70% 56%)",
        ring: "hsl(25 70% 56%)",
        destructive: "hsl(0 72% 51%)",
        success: "hsl(150 40% 38%)",
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
