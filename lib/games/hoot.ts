import { createRng, pick, shuffle, type Rng } from "./rng";

// Hoot & Seek: one owl in every row, column and coloured patch, and no two owls may touch,
// not even corner to corner. Every board has exactly one solution.

export const DAILY_SIZES = [5, 6, 7, 8];
const FASTEST_SOLVE_MS = 12_000;

export interface HootBoard {
  size: number;
  regions: number[]; // patch number for each cell
  solution: number[]; // owl column for each row
}

const touching = (a: number, b: number) => Math.abs(a - b) <= 1;

/** One column per row, each used once, with neighbouring rows at least two columns apart. */
function placeOwls(r: Rng, size: number): number[] | null {
  const out: number[] = [];
  const used = new Set<number>();
  const step = (row: number): boolean => {
    if (row === size) return true;
    for (const col of shuffle(r, Array.from({ length: size }, (_, i) => i))) {
      if (used.has(col) || (row > 0 && touching(col, out[row - 1]!))) continue;
      used.add(col);
      out[row] = col;
      if (step(row + 1)) return true;
      used.delete(col);
    }
    return false;
  };
  return step(0) ? out : null;
}

/** Grows a patch outward from each owl. Favouring a few patches gives the long, winding shapes that force logic. */
function growRegions(r: Rng, size: number, owls: number[]): number[] {
  const regions = Array<number>(size * size).fill(-1);
  owls.forEach((col, row) => { regions[row * size + col] = row; });
  const appetite = owls.map(() => 1 + r() * r() * 6);
  let open = size * size - size;
  while (open > 0) {
    const weighted = owls.flatMap((_, id) => Array<number>(Math.ceil(appetite[id]!)).fill(id));
    const id = pick(r, weighted);
    const edge: number[] = [];
    regions.forEach((owner, cell) => {
      if (owner !== -1) return;
      const x = cell % size, y = Math.floor(cell / size);
      const beside = [x > 0 && cell - 1, x < size - 1 && cell + 1, y > 0 && cell - size, y < size - 1 && cell + size];
      if (beside.some(n => n !== false && regions[n as number] === id)) edge.push(cell);
    });
    if (!edge.length) continue;
    regions[pick(r, edge)] = id;
    open--;
  }
  return regions;
}

/** Counts solutions, stopping at `limit`. Rows go in order; columns and patches are tracked as bit masks. */
export function countHootSolutions(size: number, regions: number[], limit = 2): number {
  let found = 0;
  const step = (row: number, cols: number, patches: number, last: number) => {
    if (row === size) { found++; return; }
    for (let col = 0; col < size && found < limit; col++) {
      if (cols & (1 << col) || (row > 0 && touching(col, last))) continue;
      const patch = 1 << regions[row * size + col]!;
      if (patches & patch) continue;
      step(row + 1, cols | (1 << col), patches | patch, col);
    }
  };
  step(0, 0, 0, -9);
  return found;
}

/** Any valid placement other than `target`, or null when the board is unique. */
function rivalSolution(size: number, regions: number[], target: number[]): number[] | null {
  const cols: number[] = [];
  const step = (row: number, used: number, patches: number): boolean => {
    if (row === size) return cols.some((c, i) => c !== target[i]);
    for (let col = 0; col < size; col++) {
      if (used & (1 << col) || (row > 0 && touching(col, cols[row - 1]!))) continue;
      const patch = 1 << regions[row * size + col]!;
      if (patches & patch) continue;
      cols[row] = col;
      if (step(row + 1, used | (1 << col), patches | patch)) return true;
    }
    return false;
  };
  return step(0, 0, 0) ? [...cols] : null;
}

function neighbours(size: number, cell: number): number[] {
  const x = cell % size, y = Math.floor(cell / size);
  const out: number[] = [];
  if (x > 0) out.push(cell - 1);
  if (x < size - 1) out.push(cell + 1);
  if (y > 0) out.push(cell - size);
  if (y < size - 1) out.push(cell + size);
  return out;
}

/** True when a patch stays in one piece without `removed`. */
function staysConnected(size: number, regions: number[], removed: number): boolean {
  const id = regions[removed]!;
  const cells = regions.flatMap((owner, cell) => (owner === id && cell !== removed ? [cell] : []));
  const seen = new Set([cells[0]!]);
  const queue = [cells[0]!];
  while (queue.length) {
    for (const next of neighbours(size, queue.pop()!)) {
      if (next !== removed && regions[next] === id && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === cells.length;
}

/** Hands one cell of the rival solution to a patch that already holds another rival owl, which rules that rival out. */
function breakRival(r: Rng, size: number, regions: number[], target: number[], rival: number[]): boolean {
  const owned = new Set(target.map((col, row) => row * size + col));
  const rivalCells = rival.map((col, row) => row * size + col);
  const rivalPatches = new Set(rivalCells.map(c => regions[c]!));
  for (const cell of shuffle(r, rivalCells.filter(c => !owned.has(c)))) {
    if (!staysConnected(size, regions, cell)) continue;
    const moves = neighbours(size, cell).map(n => regions[n]!).filter(p => p !== regions[cell] && rivalPatches.has(p));
    if (!moves.length) continue;
    regions[cell] = pick(r, moves);
    return true;
  }
  return false;
}

/** When no single move breaks a rival, a random edge cell changes hands so the search can continue. */
function nudge(r: Rng, size: number, regions: number[], target: number[]): void {
  const owned = new Set(target.map((col, row) => row * size + col));
  for (const cell of shuffle(r, regions.map((_, i) => i))) {
    if (owned.has(cell) || !staysConnected(size, regions, cell)) continue;
    const moves = neighbours(size, cell).map(n => regions[n]!).filter(p => p !== regions[cell]);
    if (!moves.length) continue;
    regions[cell] = pick(r, moves);
    return;
  }
}

const REPAIR_LIMIT = 600;

export function buildHootBoard(seed: number, size: number): HootBoard {
  const r = createRng(seed);
  for (;;) {
    const solution = placeOwls(r, size);
    if (!solution) continue;
    const regions = growRegions(r, size, solution);
    for (let i = 0; i < REPAIR_LIMIT; i++) {
      const rival = rivalSolution(size, regions, solution);
      if (!rival) return { size, regions, solution };
      if (!breakRival(r, size, regions, solution, rival)) nudge(r, size, regions, solution);
    }
  }
}

export function buildDailyHoot(seed: number): HootBoard[] {
  return DAILY_SIZES.map((size, i) => buildHootBoard((seed + i * 7919) >>> 0, size));
}

/** Which placed owls break a rule, and which rule each break is. */
export function hootConflicts(board: HootBoard, owls: number[]): { cells: Set<number>; rule: "row" | "column" | "patch" | "touch" | null } {
  const cells = new Set<number>();
  let rule: "row" | "column" | "patch" | "touch" | null = null;
  const { size, regions } = board;
  owls.forEach((a, i) => {
    for (const b of owls.slice(i + 1)) {
      const ax = a % size, ay = Math.floor(a / size), bx = b % size, by = Math.floor(b / size);
      const broken = ay === by ? "row" : ax === bx ? "column" : regions[a] === regions[b] ? "patch" : touching(ax, bx) && touching(ay, by) ? "touch" : null;
      if (!broken) continue;
      cells.add(a).add(b);
      rule ??= broken;
    }
  });
  return { cells, rule };
}

export function hootSolved(board: HootBoard, owls: number[]): boolean {
  return owls.length === board.size && hootConflicts(board, owls).cells.size === 0;
}

export function dailyHootSolved(seed: number, solutions: unknown, elapsedMs: number): boolean {
  if (!Array.isArray(solutions) || elapsedMs < FASTEST_SOLVE_MS) return false;
  const boards = buildDailyHoot(seed);
  return solutions.length === boards.length && boards.every((b, i) => {
    const given = solutions[i] as unknown;
    return Array.isArray(given) && b.solution.every((col, row) => col === given[row]);
  });
}

