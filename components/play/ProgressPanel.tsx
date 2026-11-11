"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LEVEL_COUNT } from "@/lib/games/levels";
import type { Progress } from "@/lib/games/progress";
import { formatScore, games } from "@/lib/games/registry";
import { signedIn } from "@/lib/games/store";
import type { PlayerSummary } from "@/lib/games/summary";
import { gameStyle } from "./game-style";
import { FriendsCard } from "./Friends";
import { Reminders } from "./Reminders";
import { WeekPanel } from "./WeekPanel";
import { GameArt } from "./GameArt";

function Tile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="arcade-panel p-4 text-center">
      <p className="arcade-title text-3xl tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{label}</p>
    </div>
  );
}

/** Every game's ladder at a glance: levels cleared, stars, best score. */
export function ProgressPanel({ progress, summary }: { progress: Progress | null; summary: PlayerSummary | null }) {
  const [saved, setSaved] = useState(true);
  useEffect(() => setSaved(signedIn()), []);

  return (
    <section aria-label="Your progress" className="play-rise">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile value={`${summary?.cleared ?? 0}/${summary?.levels ?? games.length * LEVEL_COUNT}`} label="Levels cleared" />
        <Tile value={summary?.stars ?? 0} label="Stars" />
        <Tile value={progress?.streak ?? 0} label="Day streak" />
        <Tile value={Object.keys(progress?.best ?? {}).length} label="Bests set" />
      </div>
      {!saved && (
        <p className="mt-3 rounded-2xl bg-[var(--well)] px-4 py-3 text-sm">
          Not signed in: this progress is gone when you close the tab. <a href="#sign-in" className="font-semibold underline">Sign in with Google</a> to keep it.
        </p>
      )}
      <WeekPanel />
      <FriendsCard />
      <Reminders />
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {games.map(g => {
          const row = summary?.ladders[g.slug] ?? { cleared: 0, stars: 0 };
          const best = progress?.best[g.slug];
          return (
            <li key={g.slug} style={gameStyle(g)}>
              <Link href={`/play/${g.slug}`} className="arcade-panel flex items-center gap-3 p-3 transition-transform hover:-translate-y-0.5">
                <GameArt slug={g.slug} className="size-14 shrink-0 rounded-2xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="arcade-title block truncate text-lg">{g.title}</span>
                  <span className="block text-xs tabular-nums text-[var(--ink-soft)]">
                    {row.cleared} of {LEVEL_COUNT} levels · {row.stars} stars{best !== undefined ? ` · best ${formatScore(g, best)}` : ""}
                  </span>
                  <span aria-hidden className="mt-2 block h-2 overflow-hidden rounded-full bg-[var(--well)]">
                    <span className="clay block h-full origin-left rounded-full" style={{ "--c": "var(--g)", transform: `scaleX(${row.cleared / LEVEL_COUNT})` } as React.CSSProperties} />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
