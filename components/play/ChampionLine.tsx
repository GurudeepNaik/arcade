"use client";

import { useEffect, useState } from "react";
import type { Champion } from "@/lib/games/champion";

/** "This week's champion" line. Shows nothing until someone has points this week. */
export function ChampionLine({ className }: { className?: string }) {
  const [champion, setChampion] = useState<Champion | null>(null);
  useEffect(() => {
    fetch("/api/play/champion")
      .then(r => r.json() as Promise<{ champion: Champion | null }>)
      .then(d => setChampion(d.champion))
      .catch(() => undefined);
  }, []);
  // Holds one line of space while loading, so the page doesn't jump when the name arrives.
  if (!champion) return <span aria-hidden className={`block min-h-5 ${className ?? ""}`} />;
  return (
    <span className={`play-rise flex min-w-0 items-center gap-2 ${className ?? ""}`}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-5 shrink-0"><path d="M4.5 17.5l-1-9 4.6 3.6L12 5.5l3.9 6.6 4.6-3.6-1 9z" fill="var(--gold)" /></svg>
      {/* One line always (shorter label on phones), so the space held while loading is exactly right. */}
      <span className="min-w-0 truncate"><span className="sm:hidden">Champion</span><span className="hidden sm:inline">This week&apos;s champion</span>: <strong>{champion.name}</strong>, {champion.points} points</span>
    </span>
  );
}
