import { buildHootBoard } from "./hoot";
import { RoomError } from "./ludo-room";
import { buildSudoku } from "./sudoku";

// A race: every player gets the same board from the same seed, and the server checks each finish.

export type RaceGame = "hoot" | "sudoku";
export type RaceLevel = "easy" | "medium" | "hard";

export const RACE_LEVELS: RaceLevel[] = ["easy", "medium", "hard"];
const SPEC: Record<RaceGame, Record<RaceLevel, number>> = {
  hoot: { easy: 6, medium: 7, hard: 8 }, // board size
  sudoku: { easy: 40, medium: 33, hard: 28 }, // clues left
};
export const raceSpec = (game: RaceGame, level: RaceLevel) => SPEC[game][level];

export const MAX_RACERS = 4;
export const COUNTDOWN_MS = 3500;
const FASTEST_FINISH_MS = 5000;
const STRAGGLER_MS = 3 * 60 * 1000; // after the first finish, everyone else has three minutes

export interface Racer { name: string; secret: string; progress: number; finishedMs: number | null }

export interface Race {
  kind: "race";
  code: string;
  game: RaceGame;
  level: RaceLevel;
  seed: number;
  round: number;
  status: "lobby" | "racing" | "over";
  startAt: number;
  firstFinishAt: number | null;
  players: Racer[];
}

export interface RaceView {
  code: string;
  game: RaceGame;
  level: RaceLevel;
  seed: number | null; // hidden until the race starts
  round: number;
  status: Race["status"];
  startsInMs: number;
  players: { name: string; progress: number; finishedMs: number | null; place: number | null }[];
  you: number | null;
  host: boolean;
  version: number;
}

const racerOf = (race: Race, secret: unknown) => race.players.findIndex(p => p.secret === secret);

function requireHost(race: Race, secret: unknown): void {
  if (race.players[0]?.secret !== secret) throw new RoomError(403, "Only the host can do that.");
}

export function newRace(code: string, game: RaceGame, level: RaceLevel, name: string, secret: string, seed: number): Race {
  return { kind: "race", code, game, level, seed, round: 0, status: "lobby", startAt: 0, firstFinishAt: null, players: [{ name, secret, progress: 0, finishedMs: null }] };
}

export function joinRace(race: Race, name: string, secret: string): Race {
  if (race.status !== "lobby") throw new RoomError(409, "This race has already started.");
  if (race.players.length >= MAX_RACERS) throw new RoomError(409, "This race is full.");
  if (race.players.some(p => p.name.toLowerCase() === name.toLowerCase())) throw new RoomError(409, "Someone in this race already has that name.");
  return { ...race, players: [...race.players, { name, secret, progress: 0, finishedMs: null }] };
}

/** Starts a race, or a rematch on a fresh board. The countdown gives every screen time to catch up. */
export function startRace(race: Race, secret: unknown, seed: number, now: number): Race {
  requireHost(race, secret);
  if (race.status === "racing") throw new RoomError(409, "The race is already on.");
  if (race.players.length < 2) throw new RoomError(409, "You need at least one friend to race.");
  return { ...race, seed, round: race.round + 1, status: "racing", startAt: now + COUNTDOWN_MS, firstFinishAt: null, players: race.players.map(p => ({ ...p, progress: 0, finishedMs: null })) };
}

export function reportProgress(race: Race, secret: unknown, value: unknown, now: number): Race {
  const i = racerOf(race, secret);
  if (i < 0 || race.status !== "racing" || now < race.startAt || race.players[i]!.finishedMs !== null) return race;
  const progress = typeof value === "number" && Number.isFinite(value) ? Math.min(0.99, Math.max(0, value)) : 0;
  return { ...race, players: race.players.map((p, k) => (k === i ? { ...p, progress } : p)) };
}

function correct(race: Race, answer: unknown): boolean {
  if (!Array.isArray(answer)) return false;
  const solution = race.game === "hoot" ? buildHootBoard(race.seed, raceSpec("hoot", race.level)).solution : buildSudoku(race.seed, raceSpec("sudoku", race.level)).solution;
  return solution.length === answer.length && solution.every((v, i) => v === answer[i]);
}

export function finishRace(race: Race, secret: unknown, answer: unknown, now: number): Race {
  const i = racerOf(race, secret);
  if (i < 0) throw new RoomError(403, "You aren't in this race.");
  if (race.status !== "racing") throw new RoomError(409, "The race isn't running.");
  if (race.players[i]!.finishedMs !== null) return race;
  const elapsed = now - race.startAt;
  if (elapsed < FASTEST_FINISH_MS || !correct(race, answer)) throw new RoomError(422, "That board isn't solved yet.");
  const players = race.players.map((p, k) => (k === i ? { ...p, progress: 1, finishedMs: elapsed } : p));
  return { ...race, players, firstFinishAt: race.firstFinishAt ?? now, status: players.every(p => p.finishedMs !== null) ? "over" : "racing" };
}

/** Ends a race whose stragglers ran out of time. Null when nothing is due. */
export function closeIfExpired(race: Race, now: number): Race | null {
  if (race.status !== "racing" || race.firstFinishAt === null || now - race.firstFinishAt < STRAGGLER_MS) return null;
  return { ...race, status: "over" };
}

export function raceView(race: Race, secret: unknown, version: number, now: number): RaceView {
  const finished = race.players.filter(p => p.finishedMs !== null).sort((a, b) => a.finishedMs! - b.finishedMs!);
  const me = racerOf(race, secret);
  return {
    code: race.code,
    game: race.game,
    level: race.level,
    seed: race.status === "lobby" ? null : race.seed,
    round: race.round,
    status: race.status,
    startsInMs: race.status === "racing" ? race.startAt - now : 0,
    players: race.players.map(p => ({ name: p.name, progress: p.progress, finishedMs: p.finishedMs, place: p.finishedMs === null ? null : finished.indexOf(p) + 1 })),
    you: me < 0 ? null : me,
    host: me === 0,
    version,
  };
}
