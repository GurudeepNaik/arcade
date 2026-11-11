import { rememberName } from "./progress";
import type { SavedProgress } from "./saved-progress";
import { rememberNickname } from "./store";
import { applyProgress, localProgress, markSignedIn } from "./sync";

// Browser side of Google sign-in, shared by the hub chip and the "save your progress" prompt.

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GIS_SRC = "https://accounts.google.com/gsi/client";

export interface PlayerInfo { name: string; email: string; picture: string; nickname: string; nicknameChosen: boolean }
export interface GoogleId {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }) => void;
  renderButton: (el: HTMLElement, o: Record<string, string>) => void;
  disableAutoSelect: () => void;
}
declare global { interface Window { google?: { accounts: { id: GoogleId } } } }

export function loadGoogle(): Promise<GoogleId> {
  return new Promise((resolve, reject) => {
    if (window.google) return resolve(window.google.accounts.id);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => (window.google ? resolve(window.google.accounts.id) : reject(new Error("Google didn't load"))));
    script.addEventListener("error", () => reject(new Error("Google didn't load")));
    if (!existing) {
      script.src = GIS_SRC;
      script.async = true;
      document.head.append(script);
    }
  });
}

/** Keeps the better of this browser's progress and the account's, and remembers the sign-in. */
export function adoptAccount(progress: SavedProgress): void {
  // Signed in first, so this tab's play moves into lasting storage before the account copy is merged in.
  markSignedIn(true);
  const merged = applyProgress(progress);
  if (merged.name) rememberName(merged.name);
}

/** Sends Google's credential to the server. Returns the player, or an error message to show. */
export async function signInWithGoogle(credential: string): Promise<{ player: PlayerInfo } | { error: string }> {
  const res = await fetch("/api/play/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential, progress: localProgress() }) }).catch(() => null);
  const data = (await res?.json().catch(() => ({}))) as { player?: PlayerInfo; progress?: SavedProgress; error?: string } | undefined;
  if (res?.ok && data?.player && data.progress) {
    adoptAccount(data.progress);
    rememberNickname(data.player.nickname || null);
    return { player: data.player };
  }
  return { error: data?.error ?? "Sign-in didn't go through. Try again." };
}

/** Draws Google's button into `el`. The iframe needs a light colour-scheme or the browser paints it white in dark mode. */
export async function renderGoogleButton(el: HTMLElement, onCredential: (credential: string) => void): Promise<void> {
  const id = await loadGoogle();
  id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: ({ credential }) => onCredential(credential) });
  el.style.colorScheme = "light";
  el.replaceChildren(); // never two buttons if this runs again
  const dark = document.documentElement.dataset.theme === "dark";
  id.renderButton(el, { theme: dark ? "filled_black" : "outline", size: "large", shape: "pill", text: "continue_with" });
}
