import type { Metadata } from "next";
import Link from "next/link";
import { gameBySlug, type GameSlug } from "@/lib/games/registry";
import { Challenge } from "./Challenge";
import { gameStyle } from "./game-style";
import { SoundToggle } from "./SoundToggle";

export function gameMetadata(slug: GameSlug, params: Record<string, string | string[] | undefined> = {}): Metadata {
  const game = gameBySlug(slug)!;
  const vs = Number(params.vs);
  const from = typeof params.from === "string" ? params.from : "";
  const challenged = Number.isInteger(vs) && vs > 0;
  const title = challenged ? `${from || "A friend"} challenges you to ${game.title}` : game.title;
  const card = new URLSearchParams({ game: slug, size: "wide", ...(challenged ? { score: String(vs) } : {}), ...(from ? { name: from } : {}) });
  const images = [{ url: `/api/play/card?${card}`, width: 1200, height: 630 }];
  return {
    title,
    description: game.blurb,
    alternates: { canonical: `/play/${slug}` },
    openGraph: { title, description: game.blurb, url: `/play/${slug}`, images },
    twitter: { card: "summary_large_image", title, description: game.blurb, images: images.map(i => i.url) },
  };
}

export function GamePage({ slug, wide = false, children }: { slug: GameSlug; wide?: boolean; children: React.ReactNode }) {
  const game = gameBySlug(slug)!;
  return (
    <div style={gameStyle(game)} className={`mx-auto px-2.5 py-5 min-[360px]:px-4 sm:px-6 sm:py-8 ${wide ? "max-w-3xl" : "max-w-xl"}`}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href="/play" className="arcade-btn arcade-btn--quiet arcade-btn--small">
          <span aria-hidden>←</span> Games
        </Link>
        <h1 className="arcade-title truncate text-xl min-[360px]:text-2xl">{game.title}</h1>
        <SoundToggle />
      </div>
      <Challenge game={game} />
      {children}
    </div>
  );
}
