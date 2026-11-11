// Brain Score puzzles. Everything comes from one seed, so the server can rebuild a run and score it.
import { createRng, int, pick, shuffle, type Rng } from "./rng";

export const ROUNDS = 12;
const MAX_SCORE = 1000;
const SPEED_SHARE = 0.2;

export type Shape = "circle" | "square" | "triangle";
export type Fill = "solid" | "soft" | "outline";
export interface Cell { shape: Shape; count: number; fill: Fill }
export type Block = [number, number];

interface Base { level: number; seconds: number; answer: number }
export type Puzzle =
  | (Base & { kind: "sequence"; shown: number[]; options: number[] })
  | (Base & { kind: "matrix"; grid: Cell[]; options: Cell[] })
  | (Base & { kind: "rotate"; target: Block[]; options: Block[][] })
  | (Base & { kind: "order"; facts: string[]; question: string; options: string[] });

export interface BrainAnswer { choice: number; ms: number }

function withAnswer<T>(r: Rng, correct: T, wrong: T[]): { options: T[]; answer: number } {
  const options = shuffle(r, [correct, ...wrong]);
  return { options, answer: options.indexOf(correct) };
}

/** Each family returns the first five terms and the term that follows. */
function numberPattern(r: Rng, level: number): number[] {
  if (level <= 3) {
    const start = int(r, 1, 20), step = int(r, 2, 9) * pick(r, [1, 1, -1]);
    return Array.from({ length: 6 }, (_, i) => start + 40 * Number(step < 0) + i * step);
  }
  if (level <= 6) {
    if (r() < 0.5) {
      const start = int(r, 1, 5), ratio = int(r, 2, 3);
      return Array.from({ length: 6 }, (_, i) => start * ratio ** i);
    }
    const up = int(r, 3, 9), down = int(r, 1, up - 1), out = [int(r, 5, 20)];
    for (let i = 1; i < 6; i++) out.push(out[i - 1]! + (i % 2 ? up : -down));
    return out;
  }
  if (level <= 9) {
    if (r() < 0.5) {
      const out = [int(r, 1, 6), int(r, 2, 8)];
      for (let i = 2; i < 6; i++) out.push(out[i - 1]! + out[i - 2]!);
      return out;
    }
    const gap = int(r, 1, 5), growth = int(r, 1, 3), out = [int(r, 1, 12)];
    for (let i = 1; i < 6; i++) out.push(out[i - 1]! + gap + growth * (i - 1));
    return out;
  }
  if (r() < 0.5) {
    const times = int(r, 2, 3), plus = int(r, 1, 4), out = [int(r, 1, 5)];
    for (let i = 1; i < 6; i++) out.push(out[i - 1]! * times + plus);
    return out;
  }
  const a = int(r, 1, 9), stepA = int(r, 2, 6), b = int(r, 20, 40), stepB = int(r, 2, 7);
  return Array.from({ length: 6 }, (_, i) => (i % 2 ? b - stepB * ((i - 1) / 2) : a + stepA * (i / 2)));
}

function sequencePuzzle(r: Rng, level: number): Puzzle {
  const terms = numberPattern(r, level);
  const correct = terms[5]!;
  const wrong = new Set<number>();
  const spread = Math.max(2, Math.abs(correct - terms[4]!));
  while (wrong.size < 3) {
    const guess = correct + int(r, -spread, spread) + pick(r, [-1, 1]);
    if (guess !== correct) wrong.add(guess);
  }
  return { kind: "sequence", level, seconds: 20, shown: terms.slice(0, 5), ...withAnswer(r, correct, [...wrong]) };
}

const SHAPES: Shape[] = ["circle", "square", "triangle"];
const FILLS: Fill[] = ["solid", "soft", "outline"];
const sameCell = (a: Cell, b: Cell) => a.shape === b.shape && a.count === b.count && a.fill === b.fill;

/** One attribute of the 3x3 grid: fixed, changing along each row, or rotating through a Latin square. */
function attributeRule(r: Rng, varies: boolean): (row: number, col: number) => number {
  const offset = int(r, 0, 2);
  if (!varies) return () => offset;
  return r() < 0.5 ? (_row, col) => (col + offset) % 3 : (row, col) => (row + col + offset) % 3;
}

function matrixPuzzle(r: Rng, level: number): Puzzle {
  const varying = level <= 4 ? 1 : level <= 8 ? 2 : 3;
  const flags = shuffle(r, [0, 1, 2].map(i => i < varying));
  const [shapeAt, countAt, fillAt] = flags.map(f => attributeRule(r, f)) as [ReturnType<typeof attributeRule>, ReturnType<typeof attributeRule>, ReturnType<typeof attributeRule>];
  const cellAt = (row: number, col: number): Cell => ({ shape: SHAPES[shapeAt(row, col)]!, count: countAt(row, col) + 1, fill: FILLS[fillAt(row, col)]! });
  const grid: Cell[] = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) if (row < 2 || col < 2) grid.push(cellAt(row, col));
  const correct = cellAt(2, 2);
  const wrong: Cell[] = [];
  while (wrong.length < 5) {
    const guess: Cell = { ...correct };
    const changes = int(r, 1, 2);
    for (let i = 0; i < changes; i++) {
      const attr = int(r, 0, 2);
      if (attr === 0) guess.shape = pick(r, SHAPES);
      else if (attr === 1) guess.count = int(r, 1, 3);
      else guess.fill = pick(r, FILLS);
    }
    if (!sameCell(guess, correct) && !wrong.some(w => sameCell(w, guess))) wrong.push(guess);
  }
  return { kind: "matrix", level, seconds: 30, grid, ...withAnswer(r, correct, wrong) };
}

const normalise = (blocks: Block[]): Block[] => {
  const minX = Math.min(...blocks.map(b => b[0])), minY = Math.min(...blocks.map(b => b[1]));
  return blocks.map(([x, y]) => [x - minX, y - minY] as Block).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};
const key = (blocks: Block[]) => JSON.stringify(normalise(blocks));
const turn = (blocks: Block[]) => normalise(blocks.map(([x, y]) => [-y, x] as Block));
const flip = (blocks: Block[]) => normalise(blocks.map(([x, y]) => [-x, y] as Block));

function turned(blocks: Block[], times: number): Block[] {
  let out = blocks;
  for (let i = 0; i < times; i++) out = turn(out);
  return out;
}

const rotations = (blocks: Block[]) => [0, 1, 2, 3].map(t => key(turned(blocks, t)));

function growShape(r: Rng, size: number): Block[] {
  const blocks: Block[] = [[0, 0]];
  while (blocks.length < size) {
    const [x, y] = pick(r, blocks);
    const [dx, dy] = pick(r, [[1, 0], [-1, 0], [0, 1], [0, -1]] as const);
    const next: Block = [x + dx, y + dy];
    if (!blocks.some(b => b[0] === next[0] && b[1] === next[1])) blocks.push(next);
  }
  return normalise(blocks);
}

function rotatePuzzle(r: Rng, level: number): Puzzle {
  const size = level <= 4 ? 5 : level <= 8 ? 6 : 7;
  for (;;) {
    const target = growShape(r, size);
    const mirror = flip(target);
    if (rotations(target).includes(key(mirror))) continue; // symmetric: a mirror would also be correct
    const correct = turned(target, int(r, 1, 3));
    const altered = growShape(r, size);
    if (rotations(target).includes(key(altered)) || rotations(mirror).includes(key(altered))) continue;
    const first = int(r, 0, 3);
    const wrong = [turned(mirror, first), turned(mirror, (first + 1) % 4), turned(altered, int(r, 0, 3))];
    if (new Set([correct, ...wrong].map(key)).size < 4) continue;
    return { kind: "rotate", level, seconds: 25, target, ...withAnswer(r, correct, wrong) };
  }
}

const PEOPLE = ["Asha", "Ben", "Chitra", "Dev", "Esha", "Farid", "Gita", "Hari"];
const TRAITS = [
  ["older than", "oldest", "youngest"],
  ["taller than", "tallest", "shortest"],
  ["faster than", "fastest", "slowest"],
] as const;

function orderPuzzle(r: Rng, level: number): Puzzle {
  const count = level <= 4 ? 3 : level <= 8 ? 4 : 5;
  const ranked = shuffle(r, PEOPLE).slice(0, count);
  const [phrase, top, bottom] = pick(r, TRAITS);
  const facts = shuffle(r, ranked.slice(0, -1).map((name, i) => `${name} is ${phrase} ${ranked[i + 1]}.`));
  const place = level <= 4 ? pick(r, [0, count - 1]) : int(r, 0, count - 1);
  const question = place === 0 ? `Who is the ${top}?`
    : place === count - 1 ? `Who is the ${bottom}?`
    : place === 1 ? `Who is second ${top}?`
    : place === count - 2 ? `Who is second ${bottom}?`
    : `Who is in the middle?`;
  const correct = ranked[place]!;
  const wrong = shuffle(r, ranked.filter(n => n !== correct)).slice(0, 3);
  return { kind: "order", level, seconds: 30, facts, question, ...withAnswer(r, correct, wrong) };
}

const MAKERS = [sequencePuzzle, matrixPuzzle, rotatePuzzle, orderPuzzle];

export function buildPuzzles(seed: number): Puzzle[] {
  const r = createRng(seed);
  return Array.from({ length: ROUNDS }, (_, i) => MAKERS[i % MAKERS.length]!(r, i + 1));
}

/** A short mixed run for the level ladder: kinds shuffle each play, and clocks tighten as levels rise. */
export function buildLevelPuzzles(seed: number, rounds: number, difficulty: number, timeScale: number): Puzzle[] {
  const r = createRng(seed);
  const makers = shuffle(r, MAKERS);
  return Array.from({ length: rounds }, (_, i) => {
    const puzzle = makers[i % makers.length]!(r, Math.min(ROUNDS, difficulty + (i % 2)));
    return { ...puzzle, seconds: Math.max(8, Math.round(puzzle.seconds * timeScale)) };
  });
}

const weight = (level: number) => level + 2;
const TOTAL_WEIGHT = Array.from({ length: ROUNDS }, (_, i) => weight(i + 1)).reduce((a, b) => a + b, 0);

/** Harder rounds are worth more. 80% of a round is for being right, 20% for being quick. */
export function scoreBrain(seed: number, answers: BrainAnswer[]): { score: number; correct: number } {
  let points = 0, correct = 0;
  buildPuzzles(seed).forEach((puzzle, i) => {
    const given = answers[i];
    if (!given || given.choice !== puzzle.answer) return;
    correct++;
    const speed = Math.max(0, 1 - given.ms / (puzzle.seconds * 1000));
    points += (weight(puzzle.level) / TOTAL_WEIGHT) * MAX_SCORE * (1 - SPEED_SHARE + SPEED_SHARE * speed);
  });
  return { score: Math.round(points), correct };
}

/** Answers a person could really have given, checked against the time the server saw pass. */
export function plausibleBrainRun(seed: number, answers: BrainAnswer[], elapsedMs: number): boolean {
  const puzzles = buildPuzzles(seed);
  if (answers.length !== puzzles.length) return false;
  const inBounds = answers.every((a, i) =>
    Number.isInteger(a.choice) && a.choice >= -1 && Number.isFinite(a.ms) && a.ms >= 0 && a.ms <= puzzles[i]!.seconds * 1000 + 1500
    && (a.choice === -1 || a.ms >= 250));
  return inBounds && answers.reduce((sum, a) => sum + a.ms, 0) <= elapsedMs + 3000;
}

export function brainTier(score: number): string {
  if (score >= 850) return "Exceptional";
  if (score >= 700) return "Razor sharp";
  if (score >= 500) return "Sharp";
  if (score >= 300) return "Solid";
  return "Warming up";
}
