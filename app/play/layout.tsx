import type { Metadata, Viewport } from "next";
import { display } from "@/app/fonts";
import { BadgeToaster } from "@/components/play/Badges";
import { ArcadeAppSetup } from "@/components/play/InstallApp";

// Loaded here so the rest of the portfolio pays nothing for the game font.

// Only the Arcade is installable; the rest of the portfolio stays a normal site.
export const metadata: Metadata = {
  manifest: "/play/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Arcade", statusBarStyle: "black-translucent" },
  icons: { apple: "/play/icons/apple-touch-icon.png" },
};

// Lets the bottom tab bar sit above the iPhone home indicator (env(safe-area-inset-bottom)).
export const viewport: Viewport = { viewportFit: "cover" };

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`arcade min-h-[calc(100dvh-4rem)] [overflow-x:clip] ${display.variable}`}>
      {children}
      <BadgeToaster />
      <ArcadeAppSetup />
    </div>
  );
}
