"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { lastPlayed, type LastPlayed } from "@/lib/games/last-played";
import { nextLevel, readLevelStars } from "@/lib/games/levels";
import { gameBySlug } from "@/lib/games/registry";
import { gameStyle } from "./game-style";
import { GameArt } from "./GameArt";

const DISMISS_KEY = "play.continueDismissed";

/**
 * "Continue: Colour Sort · Level 12", floating above the tab bar like a music app's mini player.
 * Fixed position, so it never pushes the page down when it appears. Close it and it stays away for the tab.
 */
export function ContinueCard() {
  const [last, setLast] = useState<{ game: LastPlayed["game"]; level: number } | null>(null);

  useEffect(() => {
    const l = lastPlayed();
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { /* show it */ }
    if (!l || dismissed) return;
    // The next level to play in that game: the one just started, if it wasn't cleared.
    setLast({ game: l.game, level: nextLevel(readLevelStars(l.game)) });
  }, []);

  if (!last) return null;
  const game = gameBySlug(last.game)!;
  const close = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* closes for now */ }
    setLast(null);
  };
  return (
    <div role="region" aria-label="Continue playing" className="continue-pill" style={gameStyle(game)}>
      <Link href={`/play/${game.slug}?level=${last.level}`} className="flex min-w-0 flex-1 items-center gap-3">
        <GameArt slug={game.slug} className="size-11 shrink-0 rounded-xl object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-wide g-text">Continue</span>
          <span className="block truncate text-sm font-bold">{game.title} · Level {last.level}</span>
        </span>
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--g)] text-[var(--on-g)]">
          <svg viewBox="0 0 24 24" className="size-4 translate-x-px" fill="currentColor"><path d="M7 4.5v15l12-7.5z" /></svg>
        </span>
      </Link>
      <button type="button" onClick={close} aria-label="Hide continue" className="grid size-9 shrink-0 place-items-center rounded-full text-lg text-[var(--ink-soft)]">×</button>
    </div>
  );
}
