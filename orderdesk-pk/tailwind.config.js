/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./context/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep teal is the brand color — evokes trust/ledger-books, not the
        // generic SaaS blue/violet. Clay accent nods to Pakistani textile/pottery
        // craft without being literal.
        brand: {
          50: "#eefbf7",
          100: "#d5f5ec",
          200: "#aeead9",
          300: "#79d8bf",
          400: "#43bea0",
          500: "#209f84",
          600: "#147f6b",
          700: "#136557",
          800: "#125046",
          900: "#11423b",
          950: "#062622",
        },
        clay: {
          50: "#fdf4ee",
          100: "#fae4d4",
          200: "#f4c6a3",
          300: "#eda170",
          400: "#e57e46",
          500: "#d9612b",
          600: "#b74b20",
          700: "#95391c",
          800: "#792e1c",
          900: "#63271b",
        },
        ink: {
          50: "#f5f6f6",
          100: "#e6e8e8",
          200: "#c9cdcd",
          300: "#a3a9a9",
          400: "#767f7f",
          500: "#5c6565",
          600: "#4a5252",
          700: "#3d4444",
          800: "#2b3131",
          900: "#1b1f1f",
          950: "#0e1111",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(14, 17, 17, 0.06), 0 1px 12px rgba(14, 17, 17, 0.04)",
      },
    },
  },
  plugins: [],
};
