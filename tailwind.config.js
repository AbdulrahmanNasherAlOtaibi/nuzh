/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // هوية نزهة: أخضر داكن + ذهبي/بيج
        night: {
          950: "#0d1f14",
          900: "#12291b",
          800: "#183422",
          700: "#1f402a",
          600: "#2a5237",
          500: "#356545",
        },
        gold: {
          300: "#e8d5a3",
          400: "#d9bd7f",
          500: "#c9a95c",
          600: "#b3903f",
          700: "#8f7130",
        },
        sand: {
          50: "#faf6ec",
          100: "#f3ecd9",
          200: "#e9dcbd",
          300: "#dbc898",
        },
      },
      fontFamily: {
        cairo: ["Cairo", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
