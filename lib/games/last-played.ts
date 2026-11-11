import { gameBySlug, type GameSlug } from "./registry";
import { playerStore } from "./store";

// The last level a player started, for the "Continue" card on the Arcade page. Player data like the rest:
// kept for good when signed in, for this tab only otherwise.

const KEY = "play.last";

export interface LastPlayed { game: GameSlug; level: number; at: number }

export function rememberLastPlayed(game: GameSlug, level: number): void {
  try {
    playerStore().setItem(KEY, JSON.stringify({ game, level, at: Date.now() } satisfies LastPlayed));
  } catch {
    // No storage: no Continue card.
  }
}

export function lastPlayed(): LastPlayed | null {
  try {
    const v = JSON.parse(playerStore().getItem(KEY) ?? "null") as Partial<LastPlayed> | null;
    if (!v || !gameBySlug(v.game) || !Number.isInteger(v.level) || v.level! < 1 || v.level! > 100) return null;
    return v as LastPlayed;
  } catch {
    return null;
  }
}

/** /play/<game>?level=N opens that level directly, if the player has reached it. Read once, then removed. */
export function readLevelParam(): number | null {
  const url = new URL(location.href);
  const raw = url.searchParams.get("level");
  if (raw === null) return null;
  url.searchParams.delete("level");
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  const level = Number(raw);
  return Number.isInteger(level) && level >= 1 && level <= 100 ? level : null;
}
