export const REFLEX_ROUNDS = 5;
export const MIN_WAIT_MS = 1200;
export const MAX_WAIT_MS = 3800;

// Below this a tap is a guess, not a reaction. Above it the round was abandoned.
export const FASTEST_HUMAN_MS = 100;
export const SLOWEST_COUNTED_MS = 1500;

export function scoreReflex(times: number[]): number {
  return Math.round(times.reduce((sum, t) => sum + t, 0) / times.length);
}

/** The server saw at least the minimum waits plus the reactions go by, or the times were made up. */
export function plausibleReflexRun(times: number[], elapsedMs: number): boolean {
  if (times.length !== REFLEX_ROUNDS) return false;
  if (!times.every(t => Number.isFinite(t) && t >= FASTEST_HUMAN_MS && t <= SLOWEST_COUNTED_MS)) return false;
  return elapsedMs + 1500 >= REFLEX_ROUNDS * MIN_WAIT_MS + times.reduce((sum, t) => sum + t, 0);
}

/** Online tap tests usually land between 250 and 300 ms once screen and input delay are included. */
export function reflexTier(ms: number): string {
  if (ms < 220) return "Lightning";
  if (ms < 270) return "Very fast";
  if (ms < 320) return "Quick";
  if (ms < 420) return "Steady";
  return "Warming up";
}
