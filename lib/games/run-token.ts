import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Game, GameSlug } from "./registry";
import { DAILY_LEVEL, type SudokuLevel } from "./sudoku";

/** A signed record of a run the server started, so a finished run can be trusted without storing it first. */
export interface Run {
  game: GameSlug;
  seed: number;
  id: string;
  startedAt: number;
  practice: boolean;
  level: SudokuLevel;
}

function signature(payload: string): string | null {
  const secret = process.env.VISITS_SECRET;
  return secret ? createHmac("sha256", `play:${secret}`).update(payload).digest("base64url") : null;
}

export function istDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}

export function newRun(game: Game, practice: boolean, level: SudokuLevel): Run {
  const daily = game.daily && !practice;
  return {
    game: game.slug,
    practice,
    level: daily ? DAILY_LEVEL : level,
    seed: randomInt(2 ** 31), // every run is a new puzzle, ranked or not
    id: randomBytes(12).toString("base64url"),
    startedAt: Date.now(),
  };
}

export function signRun(run: Run): string | null {
  const payload = Buffer.from(JSON.stringify(run)).toString("base64url");
  const sig = signature(payload);
  return sig && `${payload}.${sig}`;
}

export function readRun(token: unknown, maxAgeMs: number): Run | null {
  if (typeof token !== "string") return null;
  const [payload, given] = token.split(".");
  if (!payload || !given) return null;
  const expected = signature(payload);
  if (!expected || expected.length !== given.length) return null;
  if (!timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;
  const run = JSON.parse(Buffer.from(payload, "base64url").toString()) as Run;
  return Date.now() - run.startedAt <= maxAgeMs ? run : null;
}
