module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,vue}", "./enterprise/frontend/src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          900: "#064e3b"
        },
        risk: {
          50: "#fff1f2",
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c"
        },
        warning: {
          50: "#fffbeb",
          500: "#f59e0b",
          600: "#d97706"
        },
        ink: {
          50: "#fafafa",
          100: "#f4f4f5",
          300: "#d4d4d8",
          700: "#3f3f46",
          900: "#18181b"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      boxShadow: {
        focus: "0 0 0 3px rgba(16, 185, 129, 0.25)"
      }
    }
  },
  plugins: []
};
