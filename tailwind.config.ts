import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        carbon: "#080A0B",
        optic: "#EAF9FF",
        cyan2: "#00C2FF",
        vermilion: "#FF3D2E",
        amber2: "#FFB000",
        lime2: "#B9FF2C",
        uv: "#8B5CF6",
        mist: "#D6E4F0",
        slate2: "#2D3748",
        silver: "#A7B0B8",
        bone: "#F4EBDD",
        olive2: "#627A3A",
        magma: "#D93600",
        lens: "#101820",
      },
      fontFamily: {
        head: ["var(--font-head)", "sans-serif"],
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
