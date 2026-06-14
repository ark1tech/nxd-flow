/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        canvas: "hsl(var(--canvas))",
        panel: "hsl(var(--panel))",
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        ink: "hsl(var(--ink))",
        muted: "hsl(var(--muted-foreground))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--destructive))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))"
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "SF Pro Display",
          "Segoe UI",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif"
        ]
      },
      boxShadow: {
        card: "0 1px 3px hsl(0 0% 0% / 0.08), 0 1px 2px hsl(0 0% 0% / 0.04)",
        panel: "0 4px 24px hsl(0 0% 0% / 0.08)",
        float: "0 8px 32px hsl(0 0% 0% / 0.12)"
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px"
      },
      animation: {
        pulseSoft: "pulseSoft 2s ease-in-out infinite"
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--accent) / 0.2)" },
          "50%": { boxShadow: "0 0 0 6px hsl(var(--accent) / 0)" }
        }
      }
    }
  },
  plugins: []
};
