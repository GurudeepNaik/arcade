import { cleanName } from "./names";
import { randomSeed } from "./levels";
import type { GameSlug } from "./registry";

// Challenge links replay one exact level board: /play/<game>?challenge=<level>-<seed>&from=<name>&stars=<n>.
// The seed is what makes the board, so the friend gets the very same puzzle.

export const CHALLENGE_GAMES: GameSlug[] = ["hoot", "sudoku", "sort", "arrows", "brain", "lantern"];

export interface Challenge { game: GameSlug; level: number; seed: number; from: string; stars: number }

let pending: Challenge | null = null; // read from the link, waiting for its level to start
let active: Challenge | null = null; // the level being played right now is this challenge
const lastSeed: Partial<Record<GameSlug, { level: number; seed: number }>> = {};

/** Reads a challenge from the page URL once, and removes it so a reload doesn't replay it. */
export function readChallenge(game: GameSlug): Challenge | null {
  if (!CHALLENGE_GAMES.includes(game)) return null;
  const url = new URL(location.href);
  const raw = url.searchParams.get("challenge");
  if (!raw) return null;
  const match = /^(\d{1,3})-(\d{1,10})$/.exec(raw);
  const from = cleanName(url.searchParams.get("from")) ?? "";
  const stars = Number(url.searchParams.get("stars"));
  for (const key of ["challenge", "from", "stars"]) url.searchParams.delete(key);
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  if (!match) return null;
  const level = Number(match[1]);
  const seed = Number(match[2]);
  if (level < 1 || level > 100 || seed >= 2 ** 31) return null;
  pending = { game, level, seed, from, stars: Number.isInteger(stars) && stars >= 0 && stars <= 3 ? stars : 0 };
  return pending;
}

/** The seed for a level about to start: the challenge's when it is one, a fresh one otherwise. */
export function levelSeed(game: GameSlug, level: number): number {
  let seed: number;
  if (pending && pending.game === game && pending.level === level) {
    seed = pending.seed;
    active = pending;
    pending = null;
  } else {
    seed = randomSeed();
    active = null;
  }
  lastSeed[game] = { level, seed };
  return seed;
}

export const activeChallenge = (game: GameSlug): Challenge | null => (active?.game === game ? active : null);

/** A link that gives a friend the board just played. Null for games with no fixed board. */
export function challengeLink(game: GameSlug, level: number, stars: number, from: string): string | null {
  const last = lastSeed[game];
  if (!CHALLENGE_GAMES.includes(game) || !last || last.level !== level) return null;
  const url = new URL(`/play/${game}`, location.origin);
  url.searchParams.set("challenge", `${level}-${last.seed}`);
  url.searchParams.set("stars", String(stars));
  if (from) url.searchParams.set("from", from);
  return url.href;
}
