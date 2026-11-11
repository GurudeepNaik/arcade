"use client";

import { useState } from "react";
import { track } from "@/lib/games/client";
import { refTag } from "@/lib/games/names";
import { readProgress, rememberName, today } from "@/lib/games/progress";
import { formatScore, type Game } from "@/lib/games/registry";

type What = { score: number } | { level: number; stars: number };
/** Extra lines for the card: only sent when they're true and worth showing. */
export interface CardExtras { better?: number | null; streak?: number }

function cardQuery(game: Game, what: What, name: string, extras: CardExtras, size: "story" | "wide"): string {
  const q = new URLSearchParams({ game: game.slug, size, day: today() });
  if ("score" in what) q.set("score", String(what.score));
  else { q.set("level", String(what.level)); q.set("stars", String(what.stars)); }
  if (name) q.set("name", name);
  if (extras.better) q.set("better", String(extras.better));
  if (extras.streak && extras.streak > 1) q.set("streak", String(extras.streak));
  return q.toString();
}

/**
 * Shares a picture of the result where the phone allows it, and a challenge link everywhere.
 * No sign-in needed: a guest without a name is asked for one first (optional, kept for this tab only).
 */
export function ShareCard({ game, what, name, extras = {}, label = "Share", quiet = true }: { game: Game; what: What; name: string; extras?: CardExtras; label?: string; quiet?: boolean }) {
  const [state, setState] = useState<"idle" | "naming" | "busy" | "saved">("idle");
  const [typed, setTyped] = useState("");

  const share = async (cardName: string) => {
    setState("busy");
    const link = new URL(`/play/${game.slug}`, location.origin);
    link.searchParams.set("ref", refTag(cardName || null));
    if ("score" in what) link.searchParams.set("vs", String(what.score));
    if (cardName) link.searchParams.set("from", cardName);
    const text = "score" in what
      ? `I got ${formatScore(game, what.score)} on ${game.title}. Can you beat it?`
      : `I cleared level ${what.level} of ${game.title}. Your turn!`;
    track(game.slug, "share");
    try {
      const res = await fetch(`/api/play/card?${cardQuery(game, what, cardName, extras, "story")}`);
      const file = new File([await res.blob()], `${game.slug}-arcade.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text} ${link.href}` });
      } else if (navigator.share) {
        await navigator.share({ text, url: link.href });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        await navigator.clipboard?.writeText(`${text} ${link.href}`).catch(() => undefined);
        setState("saved");
        setTimeout(() => setState("idle"), 2200);
        return;
      }
    } catch {
      // Closing the share sheet lands here, and needs no message.
    }
    setState("idle");
  };

  const start = () => {
    const known = name || readProgress().name;
    if (known) void share(known);
    else setState("naming");
  };

  if (state === "naming") {
    const submit = (e: React.FormEvent) => {
      e.preventDefault();
      const clean = typed.trim().slice(0, 20);
      if (clean.length >= 2) rememberName(clean);
      void share(clean.length >= 2 ? clean : "");
    };
    return (
      // basis-full: takes a whole row of the button group, so nothing is squeezed beside it on a phone.
      <form onSubmit={submit} className="play-rise grid w-full basis-full gap-2.5 rounded-2xl bg-[var(--well)] p-4 text-left">
        <label htmlFor="card-name" className="text-sm font-semibold">Name on your card <span className="font-normal text-[var(--ink-soft)]">(optional)</span></label>
        <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input id="card-name" value={typed} onChange={e => setTyped(e.target.value)} maxLength={20} autoComplete="nickname" autoFocus placeholder="Your name" className="min-h-12 w-full min-w-0 rounded-xl border-2 border-[var(--well-2)] bg-[var(--tile)] px-3 text-base font-semibold" />
          <button type="submit" className="arcade-btn !min-h-12 w-full !px-6 !text-base sm:w-auto">Share card</button>
        </div>
        <button type="button" onClick={() => void share("")} className="mx-auto min-h-10 text-sm font-semibold text-[var(--ink-soft)] underline">Share without a name</button>
      </form>
    );
  }

  const text = state === "busy" ? "Making your card…" : state === "saved" ? "Card saved, link copied" : label;
  return <button type="button" disabled={state === "busy"} onClick={start} className={`arcade-btn ${quiet ? "arcade-btn--quiet" : ""}`}>{text}</button>;
}
