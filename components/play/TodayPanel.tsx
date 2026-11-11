"use client";

import Link from "next/link";
import { playedToday, type Progress } from "@/lib/games/progress";
import { formatScore, games } from "@/lib/games/registry";
import { gameStyle } from "./game-style";
import { GameArt } from "./GameArt";

/** Today's ranked dailies as a checklist: what's left first, then what's done. */
export function TodayPanel({ progress, left }: { progress: Progress | null; left: string }) {
  const daily = games.filter(g => g.daily);
  const done = (slug: (typeof daily)[number]["slug"]) => !!progress && playedToday(progress, slug);
  const finished = daily.filter(g => done(g.slug)).length;
  const ordered = [...daily].sort((a, b) => Number(done(a.slug)) - Number(done(b.slug)));

  return (
    <section aria-label="Daily Challenge" className="play-rise">
      <div className="arcade-panel flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <p className="arcade-title text-2xl">{finished === daily.length ? "All done for today" : `${finished} of ${daily.length} done today`}</p>
          <p className="text-sm text-[var(--ink-soft)]">One ranked try per game{left ? `, new puzzles in ${left}` : ""}. Streak: {progress?.streak ?? 0} {progress?.streak === 1 ? "day" : "days"}.</p>
        </div>
        <span aria-hidden className="flex gap-1.5">
          {daily.map(g => <span key={g.slug} style={gameStyle(g)} className={`size-3 rounded-full ${done(g.slug) ? "bg-[var(--g)]" : "bg-[var(--well-2)]"}`} />)}
        </span>
      </div>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {ordered.map(g => {
          const isDone = done(g.slug);
          const best = progress?.best[g.slug];
          return (
            <li key={g.slug} style={gameStyle(g)}>
              <Link href={isDone ? `/play/${g.slug}` : `/play/${g.slug}?daily=1`} className={`arcade-panel flex items-center gap-3 p-3 transition-transform hover:-translate-y-0.5 ${isDone ? "opacity-75" : ""}`}>
                <GameArt slug={g.slug} className="size-14 shrink-0 rounded-2xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="arcade-title block truncate text-lg">{g.title}</span>
                  <span className="block text-xs text-[var(--ink-soft)]">{g.length}{best !== undefined ? ` · best ${formatScore(g, best)}` : ""}</span>
                </span>
                {isDone
                  ? <span className="shrink-0 text-sm font-bold text-[var(--good)]">Done ✓</span>
                  : <span className="arcade-btn shrink-0 !min-h-10 !px-4 !text-base">Play</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
