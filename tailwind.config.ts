import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:        "#0D0D0D",
        surface:   "#161616",
        border:    "#2A2A2A",
        accent:    "#7C6FF7",
        primary:   "#F0F0F0",
        secondary: "#6B6B6B",
        success:   "#4ADE80",
        error:     "#F87171",
      },
      fontFamily: {
        sans:  ["Inter", "sans-serif"],
        mono:  ["JetBrains Mono", "Courier New", "monospace"],
      },
      fontSize: {
        "2xs": "11px",
        xs:    "12px",
        sm:    "13px",
        base:  "15px",
        md:    "18px",
      },
      spacing: {
        xs:  "4px",
        sm:  "8px",
        md:  "16px",
        lg:  "24px",
        xl:  "32px",
        "2xl": "48px",
        "3xl": "64px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4)",
      },
      maxWidth: {
        "content-sm": "560px",
        "content-md": "600px",
        "content-lg": "680px",
        "content-xl": "900px",
      },
      transitionDuration: {
        micro: "150ms",
        base:  "250ms",
      },
      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%":   { opacity: "0", transform: "translateX(-50%) translateY(20px)" },
          "100%": { opacity: "1", transform: "translateX(-50%) translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out forwards",
        "slide-up": "slide-up 150ms ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
