import type { GameSlug } from "./registry";
import type { SudokuLevel } from "./sudoku";

export interface Standing { betterThan: number; players: number }
export interface FinishResult { score: number; ranked: boolean; standing: Standing | null; name?: string | null }
export interface BoardRow { name: string; score: number; me?: boolean }
export interface StartedRun { token: string; seed: number; level: SudokuLevel }

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data;
}

/** Fire and forget: tells the owner's stats what happened. Never slows the game down. */
export function track(game: GameSlug, kind: string, level?: number): void {
  try {
    const body = JSON.stringify({ game, kind, level });
    if (!navigator.sendBeacon?.("/api/play/event", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/play/event", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => undefined);
    }
  } catch {
    // Stats are optional.
  }
}

/** The run token carries its game in plain sight before the signature, so finishing can be counted too. */
function gameOfToken(token: string): { game: GameSlug; practice: boolean } | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[0]!.replace(/-/g, "+").replace(/_/g, "/"))) as { game: GameSlug; practice: boolean };
    return payload;
  } catch {
    return null;
  }
}

export async function startRun(game: GameSlug, options: { practice?: boolean; level?: SudokuLevel } = {}): Promise<StartedRun> {
  const run = await post<StartedRun>("/api/play/start", { game, ...options });
  if (!options.practice) track(game, "daily_start");
  return run;
}

export async function finishRun(token: string, result: Record<string, unknown>): Promise<FinishResult> {
  const finished = await post<FinishResult>("/api/play/finish", { token, ...result });
  const run = gameOfToken(token);
  if (run && !run.practice) track(run.game, "daily_finish");
  return finished;
}
/** Puts a run on the board under the player's nickname: for runs finished before signing in. */
export const claimRun = (token: string) => post<{ name: string }>("/api/play/name", { token });

export async function loadBoard(game: GameSlug, scope: "today" | "all" | "friends"): Promise<BoardRow[]> {
  const res = await fetch(`/api/play/board?game=${game}&scope=${scope}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load the leaderboard.");
  return ((await res.json()) as { rows: BoardRow[] }).rows;
}
