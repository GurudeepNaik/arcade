"use client";

import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID, renderGoogleButton, signInWithGoogle } from "@/lib/games/google-client";
import { playerStore, signedIn } from "@/lib/games/store";

// Asks once a player has something worth keeping. Never blocks play: "Not now" closes it for a few days.

const DISMISSED_KEY = "play.savePrompt";
const QUIET_DAYS = 3;

function dismissedRecently(): boolean {
  try {
    const at = Number(playerStore().getItem(DISMISSED_KEY) ?? 0);
    return Date.now() - at < QUIET_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function rememberDismissal(): void {
  try {
    playerStore().setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // Without storage it asks again next time, which is harmless.
  }
}

/** True when a cleared level is far enough in to be worth saving. */
export const worthSaving = (level: number) => level >= 4;

export function SavePrompt({ reason, title = "Keep your progress?", always = false, onSaved }: {
  reason: string;
  title?: string;
  /** Ask even if the player said "Not now" recently: used where signing in is the only way to do the thing. */
  always?: boolean;
  onSaved?: () => void;
}) {
  const [state, setState] = useState<"hidden" | "ask" | "saved" | "skipped">("hidden");
  const [error, setError] = useState("");
  const button = useRef<HTMLDivElement>(null);
  const saved = useRef(onSaved);
  saved.current = onSaved;

  useEffect(() => {
    if (GOOGLE_CLIENT_ID && !signedIn() && (always || !dismissedRecently())) setState("ask");
  }, [always]);

  useEffect(() => {
    if (state !== "ask" || !button.current) return;
    let live = true;
    renderGoogleButton(button.current, async credential => {
      setError("");
      const out = await signInWithGoogle(credential);
      if (!live) return;
      if ("player" in out) {
        setState("saved");
        saved.current?.();
      }
      else setError(out.error);
    }).catch(() => live && setError("Google sign-in couldn't load."));
    return () => { live = false; };
  }, [state]);

  if (state === "hidden") return null;

  if (state === "saved") {
    return <p role="status" className="play-rise soft-chip mx-auto mt-5 w-fit !rounded-2xl px-4 py-2 text-sm font-semibold text-[var(--good)]">Saved to your account. Sign in on any device to carry on.</p>;
  }
  if (state === "skipped") {
    return <p role="status" className="play-rise mt-5 text-center text-sm text-[var(--ink-soft)]">No problem. Your progress lasts until you close this tab.</p>;
  }

  return (
    <section aria-labelledby="save-prompt-title" className="play-rise arcade-panel mx-auto mt-5 max-w-md p-5 text-center" style={{ "--delay": "500ms" } as React.CSSProperties}>
      <h3 id="save-prompt-title" className="arcade-title text-xl">{title}</h3>
      <p className="mt-1.5 text-sm text-[var(--ink-soft)]">{reason} Sign in with Google to save your levels, stars and streak, and carry on from any device.</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <div ref={button} className="min-h-10" />
        <button type="button" onClick={() => { rememberDismissal(); setState("skipped"); }} className="text-sm font-semibold text-[var(--ink-soft)] underline">Not now</button>
      </div>
      <p className="mt-3 text-xs text-[var(--ink-soft)]">Without an account nothing is saved: your progress is gone when you close this tab. Gurudeep sees your name and email. <a href="/privacy" className="underline">Privacy</a></p>
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-[var(--bad)]">{error}</p>}
    </section>
  );
}
