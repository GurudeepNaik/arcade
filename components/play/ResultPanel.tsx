"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { claimRun, type FinishResult } from "@/lib/games/client";
import { readProgress, rememberName, type Progress } from "@/lib/games/progress";
import { NicknameForm } from "./Nickname";
import { MadeBy } from "./MadeBy";
import { formatScore, games, type Game } from "@/lib/games/registry";
import { sfx } from "@/lib/games/sfx";
import { GameArt } from "./GameArt";
import { Pip } from "./Pip";
import { Leaderboard } from "./Leaderboard";
import { signedIn } from "@/lib/games/store";
import { SavePrompt } from "./SavePrompt";
import { ShareCard } from "./ShareCard";
import { Confetti } from "./Confetti";

// Below this many runs a percentage would say more than the data can.
const MIN_RUNS_FOR_RANK = 10;
const ROLL_MS = 1000;

function RollingScore({ game, value }: { game: Game; value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setShown(value);
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / ROLL_MS);
      setShown(Math.round(value * (1 - (1 - progress) ** 4)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span aria-hidden className="tabular-nums">{formatScore(game, shown)}</span>;
}

/** Signed in but the run came back without a name (an old tab): claim it once, quietly. */
function AutoClaim({ onStart }: { onStart: () => void }) {
  const start = useRef(onStart);
  useEffect(() => start.current(), []);
  return <p>Saving your score to the board…</p>;
}

export function ResultPanel({ game, token, result, tier, detail, progress, newBest, onAgain, againLabel }: {
  game: Game;
  token: string;
  result: FinishResult;
  tier: string;
  detail: string;
  progress: Progress;
  newBest: boolean;
  onAgain: () => void;
  againLabel: string;
}) {
  const [name, setName] = useState(result.name ?? "");
  const [editing, setEditing] = useState(false);
  const [claimError, setClaimError] = useState("");
  const claim = () => {
    setClaimError("");
    claimRun(token)
      .then(saved => { setName(saved.name); rememberName(saved.name); setRefresh(n => n + 1); })
      .catch(err => setClaimError((err as Error).message));
  };
  const [refresh, setRefresh] = useState(0);
  const [meter, setMeter] = useState(0);
  const [account, setAccount] = useState(false);
  useEffect(() => setAccount(signedIn()), []);
  const others = games.filter(g => g.slug !== game.slug).slice(0, 3);
  const ranked = result.standing && result.standing.players >= MIN_RUNS_FOR_RANK ? result.standing : null;
  const best = progress.best[game.slug];

  useEffect(() => {
    sfx("win");
    const frame = requestAnimationFrame(() => setMeter((result.standing?.betterThan ?? 0) / 100));
    return () => cancelAnimationFrame(frame);
  }, [result.standing]);

  return (
    <div className="relative [overflow-x:clip] pb-2">
      <Confetti />
      <div className="arcade-panel play-rise overflow-hidden text-center">
        <div className="relative h-40 sm:h-44">
          <GameArt slug={game.slug} className="block size-full object-cover" />
          <Pip mood="cheer" className="absolute -bottom-4 left-1/2 w-28 -translate-x-1/2 sm:w-32" />
        </div>
        <div className="px-5 pb-6 pt-8">
          <p className="arcade-title text-2xl g-text">{tier}</p>
          <p className="arcade-title mt-1 text-6xl sm:text-7xl">
            <span className="sr-only">{formatScore(game, result.score)}</span>
            <RollingScore game={game} value={result.score} />
          </p>
          <p className="mt-2 text-[var(--ink-soft)]">{detail}</p>
          {ranked && (
            <div className="mx-auto mt-4 max-w-sm">
              <p className="font-semibold">Better than {ranked.betterThan}% of {ranked.players} runs</p>
              <div aria-hidden className="mt-2 h-4 overflow-hidden rounded-full bg-[var(--well)]">
                <div className="clay play-meter h-full rounded-full" style={{ "--c": "var(--g)", transform: `scaleX(${meter})` } as React.CSSProperties} />
              </div>
            </div>
          )}
          {result.standing && !ranked && <p className="mt-3 font-semibold">One of the first {MIN_RUNS_FOR_RANK} runs ever recorded</p>}
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            {newBest ? "New personal best!" : best !== undefined ? `Your best: ${formatScore(game, best)}` : ""}
            {progress.streak > 1 ? ` · ${progress.streak}-day streak` : ""}
          </p>
          {!result.ranked && <p className="mt-1 text-sm text-[var(--ink-soft)]">This run isn&apos;t on the board.</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onAgain} className="arcade-btn">{againLabel}</button>
            <ShareCard game={game} what={{ score: result.score }} name={name || readProgress().name} extras={{ better: ranked?.betterThan, streak: progress.streak }} label="Share my score" />
          </div>
          {!result.ranked && <SavePrompt reason="Today's challenge is done." />}
        </div>
      </div>
      {result.ranked && name && (
        <div className="arcade-panel mt-5 p-4">
          {editing
            ? <NicknameForm current={name} onSaved={n => { setName(n); setEditing(false); setRefresh(r => r + 1); }} onCancel={() => setEditing(false)} />
            : <p className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>On the board as <strong>{name}</strong>.</span><button type="button" onClick={() => setEditing(true)} className="font-semibold underline">Change nickname</button></p>}
        </div>
      )}
      {result.ranked && !name && !account && (
        <SavePrompt always title="Claim your spot on the board" reason="Today's challenge is done. The leaderboard is for signed-in players." onSaved={() => { setAccount(true); claim(); }} />
      )}
      {result.ranked && !name && account && (
        <div className="arcade-panel mt-5 p-4 text-sm">
          {claimError ? <p role="alert" className="font-semibold text-[var(--bad)]">{claimError} <button type="button" onClick={claim} className="underline">Try again</button></p> : <AutoClaim onStart={claim} />}
        </div>
      )}
      <Leaderboard game={game} refresh={refresh} highlight={name} />
      <MadeBy className="mt-5" />
      <h2 className="arcade-title mt-7 text-xl">Play next</h2>
      <ul className="mt-3 grid grid-cols-3 gap-3">
        {others.map(g => (
          <li key={g.slug}>
            <Link href={`/play/${g.slug}`} className="poster">
              <GameArt slug={g.slug} className="block aspect-[4/3] w-full object-cover" />
              <span className="arcade-title block truncate px-2 py-1.5 text-center text-sm">{g.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
