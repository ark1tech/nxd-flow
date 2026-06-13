/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f5f5f7",
        panel: "#ffffff",
        border: "#e5e5ea",
        "border-strong": "#d1d1d6",
        ink: "#1d1d1f",
        muted: "#86868b",
        accent: "#007aff",
        "accent-hover": "#0066d6",
        success: "#34c759",
        warning: "#ff9500",
        danger: "#ff3b30"
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "SF Pro Display",
          "Helvetica Neue",
          "Helvetica",
          "Arial",
          "sans-serif"
        ]
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        panel: "0 4px 24px rgba(0,0,0,0.06)",
        float: "0 8px 32px rgba(0,0,0,0.08)"
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
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(0, 122, 255, 0.2)" },
          "50%": { boxShadow: "0 0 0 6px rgba(0, 122, 255, 0)" }
        }
      }
    }
  },
  plugins: []
};
