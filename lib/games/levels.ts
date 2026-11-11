import type { GameSlug } from "./registry";

// Every game has 100 levels. A level sets the difficulty; the puzzle itself is generated fresh on each play.

export const LEVEL_COUNT = 100;
import { playerStore } from "./store";

const STORE = "play.levels";
const STEP = (LEVEL_COUNT - 1);

export type Stars = 1 | 2 | 3;
type LevelStars = Record<number, Stars>;
type AllStars = Partial<Record<GameSlug, LevelStars>>;

const ramp = (level: number, from: number, to: number) => from + ((level - 1) * (to - from)) / STEP;

export const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

export const hootSize = (level: number) => 5 + Math.floor((level - 1) / 20);
export const sudokuClues = (level: number) => Math.round(ramp(level, 46, 25));
export const sortColours = (level: number) => 3 + Math.floor((level - 1) / 11);
export const arrowSize = (level: number) => 4 + Math.floor((level - 1) / 17);
// Lantern Night: 3x3 up to 7x7, and more lanterns scrambled within each size.
export const lanternSize = (level: number) => 3 + Math.floor((level - 1) / 20);
export const lanternTaps = (level: number) => {
  const size = lanternSize(level);
  const within = ((level - 1) % 20) / 19; // 0 at the start of a size, 1 at its end
  return Math.max(2, Math.round(size * (0.8 + within * 1.2)));
};

export const BRAIN_LEVEL_ROUNDS = 5;
export const BRAIN_PASS = 3;
export const brainDifficulty = (level: number) => 1 + Math.floor(((level - 1) * 11) / STEP);
export const brainTimeScale = (level: number) => ramp(level, 1, 0.55);

export interface ReflexLevel { rounds: number; target: number; decoyChance: number }
export function reflexLevel(level: number): ReflexLevel {
  return { rounds: 3 + Math.floor((level - 1) / 34), target: Math.round(ramp(level, 480, 215)), decoyChance: Math.min(0.5, (level - 1) / 150) };
}

export interface LudoLevel { rivals: 1 | 3; skill: number }
export function ludoLevel(level: number): LudoLevel {
  return { rivals: level <= 20 || level % 3 === 0 ? 1 : 3, skill: Math.min(0.98, ramp(level, 0.3, 0.98)) };
}

export const starsFromMistakes = (mistakes: number): Stars => (mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1);
export const sortStars = (pours: number, colours: number): Stars => (pours <= colours * 3 ? 3 : pours <= colours * 4 ? 2 : 1);
export const brainStars = (correct: number): Stars => (correct === BRAIN_LEVEL_ROUNDS ? 3 : correct === BRAIN_LEVEL_ROUNDS - 1 ? 2 : 1);
export const reflexStars = (average: number, target: number): Stars => (average <= target - 40 ? 3 : average <= target - 20 ? 2 : 1);

const CHAPTERS = ["Easy", "Medium", "Hard", "Expert", "Master"];
export const CHAPTER_SIZE = 20;
export const chapterName = (chapter: number) => CHAPTERS[chapter]!;

function readAll(): AllStars {
  try {
    return JSON.parse(playerStore().getItem(STORE) ?? "{}") as AllStars;
  } catch {
    return {};
  }
}

export const readLevelStars = (slug: GameSlug): LevelStars => readAll()[slug] ?? {};

/** The next level to play: one past the highest cleared, and never past the last. */
export function nextLevel(stars: LevelStars): number {
  const cleared = Object.keys(stars).map(Number);
  return Math.min(LEVEL_COUNT, (cleared.length ? Math.max(...cleared) : 0) + 1);
}

/** Keeps the best result for a level, so a poor replay never takes stars away. */
export function saveLevelStars(slug: GameSlug, level: number, stars: Stars): LevelStars {
  const all = readAll();
  const mine = { ...all[slug] };
  const before = mine[level] ?? 0;
  mine[level] = Math.max(before, stars) as Stars;
  // The week counts each clear, and only the stars this clear added (a replay for the same stars adds none).
  void import("./week").then(w => w.recordWeek({ levels: 1, plays: 1, stars: Math.max(0, stars - before) }));
  try {
    playerStore().setItem(STORE, JSON.stringify({ ...all, [slug]: mine }));
    void import("./badges").then(b => b.announceNewBadges());
    void import("./sync").then(s => s.syncSoon());
  } catch {
    // Without storage, progress only lasts for this visit.
  }
  return mine;
}
