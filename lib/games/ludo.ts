// Classic Ludo rules on a 15x15 board. Pure functions, so the bots and the rules can be tested alone.

export type Colour = 0 | 1 | 2 | 3; // clockwise from the left arm
export const COLOUR_NAMES = ["Red", "Green", "Yellow", "Blue"];

export const BASE = -1;
export const HOME_ENTRY = 51; // first square of a colour's home column
export const FINISHED = 56;
const TRACK = 52;
const STARTS = [0, 13, 26, 39];
const SAFE_TRACK = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

type Point = [number, number]; // row, column

export const TRACK_CELLS: Point[] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];

export const HOME_CELLS: Point[][] = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];

export const BASE_CELLS: Point[][] = [
  [[2, 2], [2, 3.5], [3.5, 2], [3.5, 3.5]],
  [[2, 10.5], [2, 12], [3.5, 10.5], [3.5, 12]],
  [[10.5, 10.5], [10.5, 12], [12, 10.5], [12, 12]],
  [[10.5, 2], [10.5, 3.5], [12, 2], [12, 3.5]],
];

const CENTRE: Point[] = [[7, 6.3], [6.3, 7], [7, 7.7], [7.7, 7]];

export const trackIndex = (colour: Colour, progress: number) => (STARTS[colour]! + progress) % TRACK;
export const isSafeTrack = (index: number) => SAFE_TRACK.has(index);

export function cellOf(colour: Colour, token: number, progress: number): Point {
  if (progress === BASE) return BASE_CELLS[colour]![token]!;
  if (progress >= FINISHED) return CENTRE[colour]!;
  if (progress >= HOME_ENTRY) return HOME_CELLS[colour]![progress - HOME_ENTRY]!;
  return TRACK_CELLS[trackIndex(colour, progress)]!;
}

export interface LudoState {
  players: Colour[];
  tokens: number[][]; // indexed by colour, then token
  turn: number; // index into players
  sixes: number;
  winners: Colour[];
  ladderLevel?: number; // set when this game is a level rather than a free table
}

export function newGame(players: Colour[]): LudoState {
  return { players, tokens: [0, 1, 2, 3].map(() => [BASE, BASE, BASE, BASE]), turn: 0, sixes: 0, winners: [] };
}

export const currentColour = (s: LudoState) => s.players[s.turn]!;

// Waiting for a six with nothing on the board is the dull part of Ludo, so that one situation gets
// a kinder dice: 30% straight to a six, then a fair roll, which lands on six about 42% of the time.
const STUCK_SIX_BOOST = 0.3;

/** Rolls for one player. `chance` returns 0 to 1, so the server can supply its secure random source. */
export function rollDie(s: LudoState, colour: Colour, chance: () => number = Math.random): number {
  const stuck = s.tokens[colour]!.every(p => p === BASE || p === FINISHED);
  if (stuck && chance() < STUCK_SIX_BOOST) return 6;
  return 1 + Math.floor(chance() * 6);
}

export function canMove(progress: number, roll: number): boolean {
  if (progress === BASE) return roll === 6;
  return progress < FINISHED && progress + roll <= FINISHED;
}

export function legalMoves(s: LudoState, colour: Colour, roll: number): number[] {
  return [0, 1, 2, 3].filter(t => canMove(s.tokens[colour]![t]!, roll));
}

const onTrack = (progress: number) => progress >= 0 && progress < HOME_ENTRY;

/** Opposing tokens a move would land on. A stack of two or more on one square is a block and stays safe. */
function capturable(s: LudoState, colour: Colour, landing: number): { colour: Colour; token: number }[] {
  if (!onTrack(landing)) return [];
  const index = trackIndex(colour, landing);
  if (isSafeTrack(index)) return [];
  const hits: { colour: Colour; token: number }[] = [];
  for (const other of s.players) {
    if (other === colour) continue;
    const here = [0, 1, 2, 3].filter(t => onTrack(s.tokens[other]![t]!) && trackIndex(other, s.tokens[other]![t]!) === index);
    if (here.length === 1) hits.push({ colour: other, token: here[0]! });
  }
  return hits;
}

export interface MoveResult {
  state: LudoState;
  path: number[]; // every progress value the token steps through
  captured: { colour: Colour; token: number }[];
  finishedToken: boolean;
  extraTurn: boolean;
}

function nextTurn(s: LudoState): number {
  let turn = s.turn;
  do turn = (turn + 1) % s.players.length;
  while (s.winners.includes(s.players[turn]!));
  return turn;
}

/** First player to bring all four tokens home wins the table. */
export const gameOver = (s: LudoState) => s.winners.length > 0;

export function passTurn(s: LudoState): LudoState {
  return gameOver(s) ? s : { ...s, turn: nextTurn(s), sixes: 0 };
}

/** Three sixes in a row forfeit the turn. */
export function rollForfeits(s: LudoState, roll: number): boolean {
  return roll === 6 && s.sixes === 2;
}

export function applyMove(s: LudoState, token: number, roll: number): MoveResult {
  const colour = currentColour(s);
  const from = s.tokens[colour]![token]!;
  const to = from === BASE ? 0 : from + roll;
  const path = from === BASE ? [0] : Array.from({ length: roll }, (_, i) => from + i + 1);
  const captured = capturable(s, colour, to);
  const tokens = s.tokens.map(t => [...t]);
  tokens[colour]![token] = to;
  for (const hit of captured) tokens[hit.colour]![hit.token] = BASE;
  const finishedToken = to === FINISHED;
  const winners = tokens[colour]!.every(p => p === FINISHED) ? [...s.winners, colour] : s.winners;
  const won = winners.includes(colour);
  const extraTurn = !won && (roll === 6 || captured.length > 0 || finishedToken);
  const moved: LudoState = { ...s, tokens, winners, sixes: roll === 6 ? s.sixes + 1 : 0 };
  const over = gameOver(moved);
  const state = over ? moved : extraTurn ? moved : { ...moved, turn: nextTurn(moved), sixes: 0 };
  return { state, path, captured, finishedToken, extraTurn: extraTurn && !over };
}

/** Finish first, then capture, then leave base, then reach safety, then run from danger, then advance. */
export function chooseBotMove(s: LudoState, roll: number, skill = 1, chance: () => number = Math.random): number {
  const colour = currentColour(s);
  const options = legalMoves(s, colour, roll);
  if (chance() > skill) return options[Math.floor(chance() * options.length)]!;
  let best = options[0]!, bestScore = -Infinity;
  for (const token of options) {
    const from = s.tokens[colour]![token]!;
    const to = from === BASE ? 0 : from + roll;
    let score = to / 10;
    if (to === FINISHED) score += 100;
    score += capturable(s, colour, to).length * 60;
    if (from === BASE) score += 30;
    if (to >= HOME_ENTRY) score += 20;
    if (onTrack(to) && isSafeTrack(trackIndex(colour, to))) score += 15;
    if (onTrack(from) && isSafeTrack(trackIndex(colour, from))) score -= 8;
    for (const other of s.players) {
      if (other === colour) continue;
      for (const p of s.tokens[other]!) {
        if (!onTrack(p) || !onTrack(to)) continue;
        const gap = (trackIndex(colour, to) - trackIndex(other, p) + TRACK) % TRACK;
        if (gap > 0 && gap <= 6 && !isSafeTrack(trackIndex(colour, to))) score -= 6;
      }
    }
    if (score > bestScore) { best = token; bestScore = score; }
  }
  return best;
}
