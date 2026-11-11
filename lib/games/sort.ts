import { createRng, shuffle, type Rng } from "./rng";

export const CAPACITY = 4;
export const SPARE_FLASKS = 2;
const LEVEL_COLOURS = [5, 7, 9];
const SEARCH_LIMIT = 40_000;

/** Each flask lists its layers from the bottom up. */
export type Flasks = number[][];
export type Pour = [number, number];

export const solvedFlask = (f: number[]) => f.length === 0 || (f.length === CAPACITY && f.every(c => c === f[0]));
export const allSorted = (flasks: Flasks) => flasks.every(solvedFlask);

export function canPour(flasks: Flasks, from: number, to: number): boolean {
  const source = flasks[from], target = flasks[to];
  if (!source || !target || from === to || source.length === 0 || target.length === CAPACITY) return false;
  return target.length === 0 || target[target.length - 1] === source[source.length - 1];
}

/** How many layers move: the matching run on top of the source, limited by the room in the target. */
export function pourSize(flasks: Flasks, from: number, to: number): number {
  const source = flasks[from]!;
  const colour = source[source.length - 1];
  let run = 0;
  for (let i = source.length - 1; i >= 0 && source[i] === colour; i--) run++;
  return Math.min(run, CAPACITY - flasks[to]!.length);
}

export function pour(flasks: Flasks, from: number, to: number): Flasks {
  const size = pourSize(flasks, from, to);
  const next = flasks.map(f => [...f]);
  next[to]!.push(...next[from]!.splice(next[from]!.length - size, size));
  return next;
}

const stateKey = (flasks: Flasks) => flasks.map(f => f.join("")).sort().join("|");

/** Depth-first search for any solution, so only solvable levels are ever dealt. */
export function solvable(start: Flasks): boolean {
  const seen = new Set<string>();
  const stack: Flasks[] = [start];
  while (stack.length && seen.size < SEARCH_LIMIT) {
    const state = stack.pop()!;
    if (allSorted(state)) return true;
    const key = stateKey(state);
    if (seen.has(key)) continue;
    seen.add(key);
    for (let from = 0; from < state.length; from++) {
      if (solvedFlask(state[from]!)) continue;
      for (let to = 0; to < state.length; to++) {
        if (!canPour(state, from, to)) continue;
        if (state[to]!.length === 0 && new Set(state[from]).size === 1) continue; // moving a clean flask to an empty one gains nothing
        stack.push(pour(state, from, to));
      }
    }
  }
  return false;
}

function deal(r: Rng, colours: number): Flasks {
  for (;;) {
    const layers = shuffle(r, Array.from({ length: colours * CAPACITY }, (_, i) => i % colours));
    const flasks: Flasks = Array.from({ length: colours }, (_, i) => layers.slice(i * CAPACITY, (i + 1) * CAPACITY));
    for (let i = 0; i < SPARE_FLASKS; i++) flasks.push([]);
    if (flasks.some(f => f.length && solvedFlask(f))) continue;
    if (solvable(flasks)) return flasks;
  }
}

export function buildSortLevel(seed: number, colours: number): Flasks {
  return deal(createRng(seed), colours);
}

export function buildSortLevels(seed: number): Flasks[] {
  const r = createRng(seed);
  return LEVEL_COLOURS.map(c => deal(r, c));
}

/** Replays the pours for each level. Returns the total, or null when a pour is illegal or a level is left unsorted. */
export function replaySort(seed: number, levels: unknown): number | null {
  if (!Array.isArray(levels)) return null;
  const start = buildSortLevels(seed);
  if (levels.length !== start.length) return null;
  let pours = 0;
  for (const [i, level] of start.entries()) {
    const moves = levels[i] as unknown;
    if (!Array.isArray(moves)) return null;
    let state = level;
    for (const move of moves) {
      if (!Array.isArray(move) || !canPour(state, move[0] as number, move[1] as number)) return null;
      state = pour(state, move[0] as number, move[1] as number);
      pours++;
    }
    if (!allSorted(state)) return null;
  }
  return pours;
}
