import type { GameSlug } from "./registry";

// Kept in this browser only. Every read and write tolerates blocked storage.
import { playerStore } from "./store";

const STORE = "play.v2";
const DAY_MS = 86_400_000;

export interface Progress {
  best: Partial<Record<GameSlug, number>>;
  ranked: Partial<Record<GameSlug, string>>; // last day each daily game was played for rank
  plays: number;
  wins: number; // Ludo
  streak: number;
  lastDay: string | null;
  name: string;
}

const empty: Progress = { best: {}, ranked: {}, plays: 0, wins: 0, streak: 0, lastDay: null, name: "" };

export function today(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}

export function readProgress(): Progress {
  try {
    return { ...empty, ...(JSON.parse(playerStore().getItem(STORE) ?? "{}") as Partial<Progress>) };
  } catch {
    return empty;
  }
}

function write(progress: Progress): void {
  try {
    playerStore().setItem(STORE, JSON.stringify(progress));
    void import("./badges").then(b => b.announceNewBadges());
    void import("./sync").then(s => s.syncSoon());
  } catch {
    // Private mode: the game still works, it just forgets.
  }
}

/** One missed day does not break a streak, so it stays a reason to return rather than a chore. */
function nextStreak(progress: Progress, day: string): number {
  if (progress.lastDay === day) return progress.streak;
  if (!progress.lastDay) return 1;
  const gap = Math.round((Date.parse(day) - Date.parse(progress.lastDay)) / DAY_MS);
  return gap <= 2 ? progress.streak + 1 : 1;
}

export const playedToday = (progress: Progress, slug: GameSlug) => progress.ranked[slug] === today();

export function recordPlay(slug: GameSlug, score: number, lowerIsBetter: boolean, ranked: boolean): { progress: Progress; newBest: boolean } {
  const before = readProgress();
  const day = today();
  const previous = before.best[slug];
  const newBest = previous === undefined || (lowerIsBetter ? score < previous : score > previous);
  const progress: Progress = {
    ...before,
    best: newBest ? { ...before.best, [slug]: score } : before.best,
    ranked: ranked ? { ...before.ranked, [slug]: day } : before.ranked,
    plays: before.plays + 1,
    streak: nextStreak(before, day),
    lastDay: day,
  };
  write(progress);
  void import("./week").then(w => w.recordWeek({ plays: 1, bests: newBest ? 1 : 0 }));
  return { progress, newBest };
}

export function recordLudo(won: boolean): Progress {
  const before = readProgress();
  const day = today();
  const progress = { ...before, wins: before.wins + Number(won), plays: before.plays + 1, streak: nextStreak(before, day), lastDay: day };
  write(progress);
  void import("./week").then(w => w.recordWeek({ plays: 1 }));
  return progress;
}

export function rememberName(name: string): void {
  write({ ...readProgress(), name });
}
