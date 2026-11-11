import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { inter, mono } from "./fonts";
import "./globals.css";
import { Beacon } from "@/components/Beacon";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { site } from "@/content/site";


const description = "Eight puzzle and party games with 100 levels each, six daily challenges with leaderboards, and live Ludo with friends. Free, no ads, made by Gurudeep Naik.";

export const metadata: Metadata = {
  metadataBase: new URL(site.arcadeUrl),
  title: { default: "The Arcade", template: "%s · The Arcade" },
  description,
  authors: [{ name: site.name, url: site.url }],
  openGraph: { type: "website", siteName: "The Arcade", title: "The Arcade", description },
  twitter: { card: "summary_large_image", title: "The Arcade", description },
};

export const viewport: Viewport = {
  // Content can reach the screen edges on notched phones; the tab bar pads itself with the safe area.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e12" },
  ],
};

// Runs before paint so the saved or system theme applies without a flash.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})()`;


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2">
          Skip to content
        </a>
        <Nav />
        <main id="main">{children}</main>
        <Footer />
        <Analytics />
        <Beacon />
      </body>
    </html>
  );
}
