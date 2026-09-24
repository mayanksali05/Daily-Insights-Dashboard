/** @type {import('tailwindcss').Config} */

// Light / dark themes (ChatGPT-style neutrals).
// Every colour the components use points at a CSS variable defined in
// src/index.css: `:root` holds the light theme, `.dark` the dark theme.
// So a class like `bg-slate-900` means "card background" in both themes.
//
// Roles of the neutral scale:
//   950 page background & inner wells   900 cards          800 borders / hover
//   700 input borders, off switch        600 hover borders
//   500 muted text   400 secondary text   300–100 body text   50 strongest
//   white = headings & big numbers (near-black in light mode)
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;
const scale = (family, shades) => Object.fromEntries(shades.map((s) => [s, v(`${family}-${s}`)]));

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        slate: scale("slate", [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        white: v("white"),
        // accent: links / hover (blue), strong = switch "on" and focus
        indigo: scale("indigo", [300, 400, 500, 600]),
        emerald: scale("emerald", [400]),
        rose: scale("rose", [200, 300, 400, 500]),
        amber: scale("amber", [300, 500]),
        sky: scale("sky", [300, 500]),
        orange: scale("orange", [300, 500]),
      },
    },
  },
  plugins: [],
};
