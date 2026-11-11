import { createRng, int, shuffle, type Rng } from "./rng";

/** 0 up, 1 right, 2 down, 3 left. -1 is an empty cell. */
export type Cell = -1 | 0 | 1 | 2 | 3;
export interface ArrowBoard { size: number; cells: Cell[] }

export const BUMP_PENALTY_S = 5;
const BOARD_SIZES = [5, 6, 7, 7, 8];
const FILL = 0.86;
const FASTEST_TAP_MS = 90;

const STEP: Record<number, [number, number]> = { 0: [0, -1], 1: [1, 0], 2: [0, 1], 3: [-1, 0] };

function pathCells(size: number, index: number, dir: number): number[] {
  const [dx, dy] = STEP[dir]!;
  const out: number[] = [];
  let x = (index % size) + dx, y = Math.floor(index / size) + dy;
  while (x >= 0 && y >= 0 && x < size && y < size) {
    out.push(y * size + x);
    x += dx;
    y += dy;
  }
  return out;
}

export function canExit(board: ArrowBoard, index: number): boolean {
  const dir = board.cells[index];
  if (dir === undefined || dir === -1) return false;
  return pathCells(board.size, index, dir).every(i => board.cells[i] === -1);
}

/** Where a blocked arrow stops: the cell in front of the first arrow in its way. */
export function blockerOf(board: ArrowBoard, index: number): number | null {
  const dir = board.cells[index];
  if (dir === undefined || dir === -1) return null;
  return pathCells(board.size, index, dir).find(i => board.cells[i] !== -1) ?? null;
}

/**
 * Arrows go on in reverse of the order they will leave, each with a clear way out past everything
 * placed before it, so every board can be cleared. Long exit paths are preferred, which makes tangles.
 */
function buildBoard(r: Rng, size: number): ArrowBoard {
  const cells = Array<Cell>(size * size).fill(-1);
  const board = { size, cells };
  const target = Math.round(size * size * FILL);
  let placed = 0;
  for (const index of shuffle(r, cells.map((_, i) => i))) {
    if (placed >= target) break;
    const open = ([0, 1, 2, 3] as const).filter(d => pathCells(size, index, d).every(i => cells[i] === -1));
    if (!open.length) continue;
    const ranked = [...open].sort((a, b) => pathCells(size, index, b).length - pathCells(size, index, a).length);
    cells[index] = ranked[int(r, 0, Math.min(1, ranked.length - 1))]!;
    placed++;
  }
  return board;
}

export function buildArrowBoard(seed: number, size: number): ArrowBoard {
  return buildBoard(createRng(seed), size);
}

export function buildArrowBoards(seed: number): ArrowBoard[] {
  const r = createRng(seed);
  return BOARD_SIZES.map(size => buildBoard(r, size));
}

/** Replays every tap. Null when a tap hits nothing or a board is left unfinished. */
export function replayArrows(seed: number, taps: unknown): { bumps: number; taps: number } | null {
  if (!Array.isArray(taps)) return null;
  const boards = buildArrowBoards(seed);
  if (taps.length !== boards.length) return null;
  let bumps = 0, total = 0;
  for (const [b, board] of boards.entries()) {
    const list = taps[b] as unknown;
    if (!Array.isArray(list)) return null;
    const cells = [...board.cells];
    const live = { size: board.size, cells };
    for (const tap of list) {
      if (!Number.isInteger(tap) || cells[tap as number] === undefined || cells[tap as number] === -1) return null;
      total++;
      if (canExit(live, tap as number)) cells[tap as number] = -1;
      else bumps++;
    }
    if (cells.some(c => c !== -1)) return null;
  }
  return { bumps, taps: total };
}

export function arrowsPlausible(taps: number, elapsedMs: number): boolean {
  return elapsedMs >= taps * FASTEST_TAP_MS;
}
