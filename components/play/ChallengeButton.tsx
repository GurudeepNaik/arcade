"use client";

import { useState } from "react";
import { challengeLink } from "@/lib/games/challenge";
import { track } from "@/lib/games/client";
import { readProgress } from "@/lib/games/progress";
import type { Game } from "@/lib/games/registry";

/** "Challenge a friend": shares a link to the exact board just played. Hidden for games without a fixed board. */
export function ChallengeButton({ game, level, stars }: { game: Game; level: number; stars: number }) {
  const [note, setNote] = useState("");
  const name = readProgress().name;
  const link = typeof window === "undefined" ? null : challengeLink(game.slug, level, stars, name);
  if (!link) return null;

  const send = async () => {
    const text = `${name ? `${name} got` : "I got"} ${stars} ${stars === 1 ? "star" : "stars"} on ${game.title} level ${level}. Same board for you: can you beat it?`;
    track(game.slug, "share");
    try {
      if (navigator.share) {
        await navigator.share({ title: "The Arcade", text, url: link });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${link}`);
      setNote("Link copied. Send it to a friend.");
    } catch (err) {
      if ((err as Error).name !== "AbortError") setNote("Couldn't share. Try again.");
    }
  };

  return (
    <>
      <button type="button" onClick={() => void send()} className="arcade-btn arcade-btn--quiet">Challenge a friend</button>
      {note && <p role="status" className="basis-full text-sm font-semibold">{note}</p>}
    </>
  );
}
