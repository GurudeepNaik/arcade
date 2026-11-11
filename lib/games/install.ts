// Installing The Arcade as an app. Chrome, Edge and Samsung Internet fire `beforeinstallprompt`;
// iPhone and iPad Safari never do, so those get "Share, then Add to Home Screen" instead.

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallWay = "installed" | "prompt" | "ios" | "none";

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export function startInstallWatch(): void {
  addEventListener("beforeinstallprompt", e => {
    e.preventDefault(); // keep it for our own button instead of the browser's mini bar
    deferred = e as InstallPromptEvent;
    notify();
  });
  addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export function onInstallChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function installWay(): InstallWay {
  if (matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone) return "installed";
  if (deferred) return "prompt";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "none";
}

/** Shows the browser's install dialog. True when the player accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome === "accepted";
}

export function registerArcadeWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/play-sw.js", { scope: "/play" }).catch(() => undefined);
}
