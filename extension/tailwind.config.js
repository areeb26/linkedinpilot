/** @type {import('tailwindcss').Config} */
module.exports = {
  mode: "jit",
  darkMode: "class",
  content: [
    "./popup.tsx",
    "./contents/**/*.{tsx,ts}",
    "./components/**/*.{tsx,ts}",
    "./src/**/*.{tsx,ts,jsx,js}"
  ],
  theme: {
    extend: {},
  },
  plugins: []
}
