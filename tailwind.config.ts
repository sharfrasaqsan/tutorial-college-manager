import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FAF9F6",
        surface: "#FFFFFF",
        border: "#E4E1DA",
        "text-main": "#1C1F23",
        "text-muted": "#5F6670",
        accent: {
          DEFAULT: "#1F5C4D",
          hover: "#17473B",
          soft: "#E6F0EC",
          "soft-hover": "#D8E8E1",
        },
        warning: {
          text: "#9A5B00",
          bg: "#FBF1DE",
          border: "#F3DCB1",
        },
        danger: {
          text: "#A32A2A",
          bg: "#FBE9E7",
          border: "#F5C7C3",
        },
      },
      borderRadius: {
        DEFAULT: "6px",
        sm: "4px",
        md: "6px",
        lg: "6px",
      },
      fontFamily: {
        sans: ["var(--font-ibm-plex-sans)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["var(--font-newsreader)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
