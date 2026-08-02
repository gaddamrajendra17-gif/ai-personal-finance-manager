/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#00D4FF",
        accent: "#7C3AED",
        dark: {
          900: "#07070d",
          800: "#0a0a12",
          700: "#0e0e18",
          600: "#111118",
          500: "#1e1e2e",
          400: "#2a2a3e",
        }
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        mono: ["Fira Code", "monospace"],
      }
    },
  },
  plugins: [],
}
