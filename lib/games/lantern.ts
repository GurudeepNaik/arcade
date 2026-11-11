import { createRng } from "./rng";

// Lantern Night: tapping a lantern flips it and its four neighbours. Light every lantern.
// A board is made by starting fully lit and tapping `taps` distinct random cells, so it is always
// solvable. Par is the shortest solution, found by solveLanterns below.

export interface LanternBoard { size: number; lit: boolean[]; par: number; seed: number }

export function flip(lit: boolean[], size: number, cell: number): boolean[] {
  const next = lit.slice();
  const row = Math.floor(cell / size);
  const col = cell % size;
  for (const [r, c] of [[row, col], [row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]] as const) {
    if (r >= 0 && r < size && c >= 0 && c < size) next[r * size + c] = !next[r * size + c];
  }
  return next;
}

export const allLit = (lit: boolean[]) => lit.every(Boolean);

export function buildLanternBoard(seed: number, size: number, taps: number): LanternBoard {
  const rand = createRng(seed);
  const cells = Array.from({ length: size * size }, (_, i) => i);
  // Shuffle and take the first `taps` cells: distinct taps, so none of them cancel out.
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  let lit = Array<boolean>(size * size).fill(true);
  const chosen = cells.slice(0, Math.min(taps, cells.length));
  for (const cell of chosen) lit = flip(lit, size, cell);
  // Rarely, the taps undo each other completely; one more distinct tap fixes that.
  if (allLit(lit) && cells.length > chosen.length) {
    lit = flip(lit, size, cells[chosen.length]!);
    chosen.push(cells[chosen.length]!);
  }
  // Par is the true fewest taps, which is sometimes fewer than the scramble used.
  return { size, lit, par: solveLanterns(lit, size)?.length ?? chosen.length, seed };
}

/** Stars from moves against the scramble's tap count (the par). */
export const lanternStars = (moves: number, par: number): 1 | 2 | 3 => (moves <= par ? 3 : moves <= Math.ceil(par * 1.6) ? 2 : 1);

/**
 * The fewest taps that light every lantern from this state (none if already lit).
 * Linear algebra over GF(2): each tap is a vector, the board is the target. Some sizes (4×4, 5×5) have
 * several solutions, so every choice of the free taps is tried and the shortest kept. Any state reached
 * from a solvable board stays solvable, because every tap undoes itself.
 */
export function solveLanterns(lit: boolean[], size: number): number[] | null {
  const n = size * size;
  const rows: number[][] = Array.from({ length: n }, (_, cell) => {
    const row = Array<number>(n + 1).fill(0);
    const r = Math.floor(cell / size), c = cell % size;
    for (const [rr, cc] of [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]] as const) {
      if (rr >= 0 && rr < size && cc >= 0 && cc < size) row[rr * size + cc] = 1;
    }
    row[n] = lit[cell] ? 0 : 1;
    return row;
  });
  const pivotOf = Array<number>(n).fill(-1);
  let rank = 0;
  for (let col = 0; col < n && rank < n; col++) {
    const sel = rows.findIndex((row, i) => i >= rank && row[col] === 1);
    if (sel < 0) continue;
    [rows[rank], rows[sel]] = [rows[sel]!, rows[rank]!];
    for (let i = 0; i < n; i++) {
      if (i !== rank && rows[i]![col]) for (let k = col; k <= n; k++) rows[i]![k]! ^= rows[rank]![k]!;
    }
    pivotOf[col] = rank++;
  }
  if (rows.slice(rank).some(row => row[n])) return null; // unsolvable (can't happen for boards made here)
  const free = pivotOf.map((p, col) => (p < 0 ? col : -1)).filter(col => col >= 0);
  let best: number[] | null = null;
  for (let mask = 0; mask < 1 << free.length; mask++) {
    const x = Array<number>(n).fill(0);
    free.forEach((col, i) => { x[col] = (mask >> i) & 1; });
    for (let col = n - 1; col >= 0; col--) {
      const p = pivotOf[col]!;
      if (p < 0) continue;
      let v = rows[p]![n]!;
      for (let k = col + 1; k < n; k++) if (rows[p]![k]) v ^= x[k]!;
      x[col] = v;
    }
    const taps = x.flatMap((v, i) => (v ? [i] : []));
    if (!best || taps.length < best.length) best = taps;
  }
  return best;
}

// ---------- Daily challenge ----------
// Three boards, the same for everyone who gets the same seed. Score = total taps (lower is better).
// The server replays the taps from the seed, so a score can't be claimed without solving every board.

export const DAILY_LANTERN = [
  { size: 4, taps: 6 },
  { size: 5, taps: 8 },
  { size: 6, taps: 10 },
] as const;
export const FASTEST_TAP_MS = 120;

export const buildDailyLantern = (seed: number): LanternBoard[] =>
  DAILY_LANTERN.map((b, i) => buildLanternBoard((seed + i * 7919) % 2 ** 31, b.size, b.taps));

/** Total taps if `taps` (one list per board, cell indices in order) lights every board; null otherwise. */
export function replayLantern(seed: number, taps: unknown): number | null {
  const boards = buildDailyLantern(seed);
  if (!Array.isArray(taps) || taps.length !== boards.length) return null;
  let total = 0;
  for (const [i, board] of boards.entries()) {
    const list = taps[i];
    if (!Array.isArray(list) || list.length > 400) return null;
    let lit = board.lit;
    for (const cell of list) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= board.size * board.size) return null;
      lit = flip(lit, board.size, cell);
    }
    if (!allLit(lit)) return null;
    total += list.length;
  }
  return total;
}
