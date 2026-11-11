import localFont from "next/font/local";

// Bundled (Latin subset, variable weight) instead of next/font/google: the build no longer downloads
// fonts from Google, which failed several Vercel builds with "Cannot read properties of null".
// All three are SIL Open Font License fonts.

export const inter = localFont({ src: "./inter-latin.woff2", weight: "100 900", variable: "--font-inter", display: "swap" });
export const mono = localFont({ src: "./jetbrains-mono-latin.woff2", weight: "100 800", variable: "--font-mono-jb", display: "swap" });
export const display = localFont({ src: "./fredoka-latin.woff2", weight: "300 700", variable: "--font-display", display: "swap" });
