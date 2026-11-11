"use client";

import { useEffect, useState } from "react";
import { formatScore, type Game } from "@/lib/games/registry";

/** Shows who sent the link, when someone arrives from a shared score. */
export function Challenge({ game }: { game: Game }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const score = Number(params.get("vs"));
    if (!Number.isInteger(score) || score <= 0) return;
    const from = (params.get("from") ?? "").slice(0, 20) || "A friend";
    setText(`${from} got ${formatScore(game, score)}. Can you beat it?`);
  }, [game]);

  if (!text) return null;
  return <p style={{ "--c": "var(--g)" } as React.CSSProperties} className="arcade-title play-rise mb-4 clay rounded-3xl px-4 py-3 text-center text-[var(--on-g)]">{text}</p>;
}
