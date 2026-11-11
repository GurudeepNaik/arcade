import { createRng, shuffle, type Rng } from "./rng";

export type SudokuLevel = "easy" | "medium" | "hard";
export const CLUES: Record<SudokuLevel, number> = { easy: 40, medium: 33, hard: 27 };
export const DAILY_LEVEL: SudokuLevel = "medium";

// Nobody fills a whole grid this fast by hand.
const FASTEST_SOLVE_MS = 25_000;

export interface Sudoku { puzzle: number[]; solution: number[] }

const rowOf = (i: number) => Math.floor(i / 9);
const colOf = (i: number) => i % 9;
const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
const ALL = 0b1111111110;

function masks(grid: number[]) {
  const rows = Array<number>(9).fill(0), cols = Array<number>(9).fill(0), boxes = Array<number>(9).fill(0);
  grid.forEach((v, i) => {
    if (!v) return;
    const bit = 1 << v;
    rows[rowOf(i)]! |= bit;
    cols[colOf(i)]! |= bit;
    boxes[boxOf(i)]! |= bit;
  });
  return { rows, cols, boxes };
}

/** Backtracking that always tries the most constrained cell, and stops once `limit` solutions are found. */
function search(grid: number[], limit: number, order: number[], onSolved?: (g: number[]) => void): number {
  const { rows, cols, boxes } = masks(grid);
  let found = 0;
  const step = (): void => {
    let best = -1, bestOptions = 0, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const options = ALL & ~(rows[rowOf(i)]! | cols[colOf(i)]! | boxes[boxOf(i)]!);
      let count = 0;
      for (let m = options; m; m &= m - 1) count++;
      if (count < bestCount) { best = i; bestOptions = options; bestCount = count; if (count <= 1) break; }
    }
    if (best === -1) { found++; onSolved?.(grid); return; }
    for (const v of order) {
      const bit = 1 << v;
      if (!(bestOptions & bit)) continue;
      grid[best] = v;
      rows[rowOf(best)]! |= bit; cols[colOf(best)]! |= bit; boxes[boxOf(best)]! |= bit;
      step();
      rows[rowOf(best)]! &= ~bit; cols[colOf(best)]! &= ~bit; boxes[boxOf(best)]! &= ~bit;
      grid[best] = 0;
      if (found >= limit) return;
    }
  };
  step();
  return found;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function countSolutions(puzzle: number[], limit = 2): number {
  return search([...puzzle], limit, DIGITS);
}

function fullGrid(r: Rng): number[] {
  let solved: number[] = [];
  search(Array<number>(81).fill(0), 1, shuffle(r, DIGITS), g => { solved = [...g]; });
  return solved;
}

/** `level` is a named difficulty, or the exact number of clues to leave. */
export function buildSudoku(seed: number, level: SudokuLevel | number): Sudoku {
  const target = typeof level === "number" ? level : CLUES[level];
  const r = createRng(seed);
  const solution = fullGrid(r);
  const puzzle = [...solution];
  let clues = 81;
  for (const i of shuffle(r, Array.from({ length: 81 }, (_, k) => k))) {
    if (clues <= target) break;
    const kept = puzzle[i]!;
    puzzle[i] = 0;
    if (countSolutions(puzzle) === 1) clues--;
    else puzzle[i] = kept;
  }
  return { puzzle, solution };
}

/** Peers of a cell: same row, column or box. Used to highlight conflicts. */
export function peers(i: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < 81; k++) if (k !== i && (rowOf(k) === rowOf(i) || colOf(k) === colOf(i) || boxOf(k) === boxOf(i))) out.push(k);
  return out;
}

export function sudokuSolved(seed: number, level: SudokuLevel, grid: unknown, elapsedMs: number): boolean {
  if (!Array.isArray(grid) || grid.length !== 81 || elapsedMs < FASTEST_SOLVE_MS) return false;
  const { solution } = buildSudoku(seed, level);
  return solution.every((v, i) => v === grid[i]);
}
