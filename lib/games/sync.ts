import { cleanProgress, mergeProgress, type SavedProgress } from "./saved-progress";
import { playerStore, setSignedIn, signedIn } from "./store";

// Keeps the browser's progress and the signed-in account in step. Only runs for signed-in players.

const PROGRESS_KEY = "play.v2";
const LEVELS_KEY = "play.levels";
const DEBOUNCE_MS = 2000;

let timer: ReturnType<typeof setTimeout> | undefined;

function read(key: string): Record<string, unknown> {
  try {
    return JSON.parse(playerStore().getItem(key) ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function localProgress(): SavedProgress {
  return cleanProgress({ ...read(PROGRESS_KEY), levels: read(LEVELS_KEY) });
}

/** Writes a merged copy back into this browser. Written directly, so it doesn't trigger another sync. */
export function applyProgress(remote: SavedProgress): SavedProgress {
  const merged = mergeProgress(localProgress(), cleanProgress(remote));
  const { levels, ...rest } = merged;
  try {
    playerStore().setItem(PROGRESS_KEY, JSON.stringify(rest));
    playerStore().setItem(LEVELS_KEY, JSON.stringify(levels));
  } catch {
    // Without storage the account copy is still saved.
  }
  return merged;
}

export const markSignedIn = setSignedIn;
export { signedIn };

/** Called after every saved result. Sends the latest progress a moment later, in one request. */
export function syncSoon(): void {
  if (!signedIn()) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    void fetch("/api/play/account", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ progress: localProgress() }), keepalive: true })
      .then(r => { if (r.status === 401) markSignedIn(false); })
      .catch(() => undefined);
  }, DEBOUNCE_MS);
}
