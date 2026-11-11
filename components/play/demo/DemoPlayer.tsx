"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game } from "@/lib/games/registry";
import { gameStyle } from "../game-style";
import { DEMOS, type DemoStep } from "./scenes";

const STEP_MS = 3200;
const SEEN_PREFIX = "play.demoSeen.";

const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Where the finger is and what it does. Coordinates are percent of the scene box. */
function Finger({ step, tick }: { step: DemoStep; tick: number }) {
  if (!step.tap) return null;
  const { x, y, kind = "tap" } = step.tap;
  return (
    <span aria-hidden className="demo-finger" style={{ left: `${x}%`, top: `${y}%` }}>
      <span key={tick} className={`demo-ring ${kind === "double" ? "demo-ring--double" : ""}`} />
    </span>
  );
}

/** The walkthrough itself: a scene, a caption, and controls. Steps advance on their own unless motion is reduced. */
export function DemoPlayer({ game, onClose }: { game: Game; onClose: () => void }) {
  const steps = DEMOS[game.slug];
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [tick, setTick] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const last = at === steps.length - 1;

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    if (reducedMotion()) setPlaying(false);
  }, []);

  const go = useCallback((next: number) => {
    setAt(Math.max(0, Math.min(steps.length - 1, next)));
    setTick(t => t + 1);
  }, [steps.length]);

  useEffect(() => {
    if (!playing || last) return;
    const timer = setTimeout(() => go(at + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [at, go, last, playing]);

  const close = () => {
    try { localStorage.setItem(SEEN_PREFIX + game.slug, "1"); } catch { /* shows again next time */ }
    dialog.current?.close();
    onClose();
  };

  const step = steps[at]!;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="demo-title"
      onCancel={e => { e.preventDefault(); close(); }}
      onClick={e => { if (e.target === dialog.current) close(); }}
      className="demo-sheet arcade"
      style={gameStyle(game)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="demo-title" className="arcade-title text-xl">How to play {game.title}</h2>
        <button type="button" onClick={close} aria-label="Close how to play" className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--well)] text-xl leading-none">×</button>
      </div>

      <div className="demo-stage relative mx-auto mt-3 aspect-square w-full max-w-[19rem]" onClick={() => setPlaying(false)}>
        {step.view}
        <Finger step={step} tick={tick} />
      </div>

      <p aria-live="polite" className="mt-3 min-h-[3.2rem] text-center font-semibold leading-snug">
        <span className="sr-only">Step {at + 1} of {steps.length}. </span>{step.caption}
      </p>

      <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
        {steps.map((_, i) => <span key={i} className={`h-2 rounded-full transition-all ${i === at ? "w-6 bg-[var(--g)]" : "w-2 bg-[var(--well-2)]"}`} />)}
      </div>

      <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <button type="button" onClick={() => { setPlaying(false); go(at - 1); }} disabled={at === 0} className="arcade-btn arcade-btn--quiet arcade-btn--small !px-4">Back</button>
        <button type="button" onClick={() => setPlaying(p => !p)} className="text-sm font-semibold text-[var(--ink-soft)] underline" aria-pressed={!playing}>
          {playing && !last ? "Pause" : last ? "" : "Play"}
        </button>
        {last
          ? <button type="button" onClick={close} className="arcade-btn arcade-btn--small !px-5">Let&apos;s play</button>
          : <button type="button" onClick={() => { setPlaying(false); go(at + 1); }} className="arcade-btn arcade-btn--small !px-4">Next</button>}
      </div>
    </dialog>
  );
}

/** "How to play" on every game's start screen; opens by itself the first time someone visits that game. */
export function HowToPlay({ game }: { game: Game }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let seen = "1";
    try { seen = localStorage.getItem(SEEN_PREFIX + game.slug) ?? ""; } catch { /* storage blocked: don't pop up */ }
    // Not on challenge or daily links: those players came to play straight away.
    const direct = /[?&](challenge|daily|race|table|join|level)=/.test(location.search);
    if (!seen && !direct) setOpen(true);
  }, [game.slug]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="arcade-btn arcade-btn--quiet">How to play</button>
      {open && <DemoPlayer game={game} onClose={() => setOpen(false)} />}
    </>
  );
}
