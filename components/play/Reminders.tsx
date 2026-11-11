"use client";

import { useEffect, useState } from "react";
import { installWay } from "@/lib/games/install";
import { signedIn } from "@/lib/games/store";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type State = "hidden" | "unsupported" | "install-first" | "blocked" | "off" | "on" | "busy";

const keyBytes = (b64url: string) => Uint8Array.from(atob(b64url.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

async function registration(): Promise<ServiceWorkerRegistration | null> {
  return (await navigator.serviceWorker.getRegistration("/play")) ?? null;
}

/** "Remind me before my streak ends": one notification at 7 pm IST, only on days the streak is at risk. */
export function Reminders() {
  const [state, setState] = useState<State>("hidden");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!PUBLIC_KEY || !signedIn()) return;
    const ios = installWay() === "ios";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      // iPhone Safari only offers push to apps added to the Home Screen.
      setState(ios ? "install-first" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("blocked");
    registration()
      .then(reg => reg?.pushManager.getSubscription())
      .then(s => setState(s ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  const turnOn = async () => {
    setError("");
    setState("busy");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState(Notification.permission === "denied" ? "blocked" : "off");
      const reg = (await registration()) ?? (await navigator.serviceWorker.register("/play-sw.js", { scope: "/play" }));
      await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) });
      const res = await fetch("/api/play/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription }) });
      if (!res.ok) {
        await subscription.unsubscribe();
        throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't turn on reminders.");
      }
      setState("on");
    } catch (err) {
      setError((err as Error).message || "Couldn't turn on reminders.");
      setState("off");
    }
  };

  const turnOff = async () => {
    setState("busy");
    const s = await (await registration())?.pushManager.getSubscription();
    if (s) {
      await fetch("/api/play/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: s.endpoint }) }).catch(() => undefined);
      await s.unsubscribe().catch(() => undefined);
    }
    setState("off");
  };

  if (state === "hidden" || state === "unsupported") return null;

  return (
    <section aria-labelledby="reminders-title" className="arcade-panel mt-4 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
      <div className="min-w-0 flex-1">
        <h2 id="reminders-title" className="arcade-title text-xl">Streak reminders</h2>
        <p className="text-sm text-[var(--ink-soft)]">
          {state === "install-first"
            ? "On iPhone, add The Arcade to your Home Screen first, then turn reminders on from the app."
            : state === "blocked"
              ? "Notifications are blocked for this site. Allow them in your browser's site settings to get reminders."
              : "One nudge at 7 pm IST, only on days you haven't played and your streak would end."}
        </p>
        {error && <p role="alert" className="mt-1 text-sm font-semibold text-[var(--bad)]">{error}</p>}
      </div>
      {(state === "off" || state === "on" || state === "busy") && (
        <button
          type="button"
          role="switch"
          aria-checked={state === "on"}
          aria-labelledby="reminders-title"
          disabled={state === "busy"}
          onClick={() => void (state === "on" ? turnOff() : turnOn())}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${state === "on" ? "bg-[var(--good)]" : "bg-[var(--well-2)]"} disabled:opacity-60`}
        >
          <span aria-hidden className={`absolute top-1 size-6 rounded-full bg-white shadow transition-transform ${state === "on" ? "translate-x-7" : "translate-x-1"} start-0`} />
        </button>
      )}
    </section>
  );
}
