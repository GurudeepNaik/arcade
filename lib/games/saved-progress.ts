import { games, type GameSlug } from "./registry";

// Progress as it travels between a browser and the server, and how two copies combine:
// the better result always wins, so signing in on a second device never loses anything.

export interface SavedProgress {
  best: Partial<Record<GameSlug, number>>;
  ranked: Partial<Record<GameSlug, string>>;
  plays: number;
  wins: number;
  streak: number;
  lastDay: string | null;
  name: string;
  levels: Partial<Record<GameSlug, Record<number, number>>>;
}

export const emptyProgress = (): SavedProgress => ({ best: {}, ranked: {}, plays: 0, wins: 0, streak: 0, lastDay: null, name: "", levels: {} });

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
const later = (a: string | null | undefined, b: string | null | undefined) => (!a ? b ?? null : !b ? a : a > b ? a : b);

/** Accepts only the expected shape, so a stored copy can never carry anything else. */
export function cleanProgress(input: unknown): SavedProgress {
  const p = (input && typeof input === "object" ? input : {}) as Partial<SavedProgress>;
  const out = emptyProgress();
  for (const g of games) {
    const best = p.best?.[g.slug];
    if (typeof best === "number" && Number.isFinite(best) && best > 0) out.best[g.slug] = best;
    const ranked = p.ranked?.[g.slug];
    if (typeof ranked === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ranked)) out.ranked[g.slug] = ranked;
    const levels = p.levels?.[g.slug];
    if (levels && typeof levels === "object") {
      const clean: Record<number, number> = {};
      for (const [level, stars] of Object.entries(levels)) {
        const n = Number(level);
        if (Number.isInteger(n) && n >= 1 && n <= 100 && [1, 2, 3].includes(stars as number)) clean[n] = stars as number;
      }
      out.levels[g.slug] = clean;
    }
  }
  out.plays = num(p.plays);
  out.wins = num(p.wins);
  out.streak = num(p.streak);
  out.lastDay = typeof p.lastDay === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.lastDay) ? p.lastDay : null;
  out.name = typeof p.name === "string" ? p.name.slice(0, 20) : "";
  return out;
}

export function mergeProgress(a: SavedProgress, b: SavedProgress): SavedProgress {
  const out = emptyProgress();
  for (const g of games) {
    const x = a.best[g.slug], y = b.best[g.slug];
    if (x !== undefined || y !== undefined) out.best[g.slug] = x === undefined ? y! : y === undefined ? x : g.lowerIsBetter ? Math.min(x, y) : Math.max(x, y);
    const day = later(a.ranked[g.slug], b.ranked[g.slug]);
    if (day) out.ranked[g.slug] = day;
    const levels = { ...a.levels[g.slug] };
    for (const [level, stars] of Object.entries(b.levels[g.slug] ?? {})) levels[Number(level)] = Math.max(levels[Number(level)] ?? 0, stars);
    if (Object.keys(levels).length) out.levels[g.slug] = levels;
  }
  out.plays = Math.max(a.plays, b.plays);
  out.wins = Math.max(a.wins, b.wins);
  out.streak = Math.max(a.streak, b.streak);
  out.lastDay = later(a.lastDay, b.lastDay);
  out.name = a.name || b.name;
  return out;
}
