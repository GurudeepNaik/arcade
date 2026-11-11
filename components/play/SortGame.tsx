"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { finishRun, startRun, type FinishResult } from "@/lib/games/client";
import { sortColours, sortStars } from "@/lib/games/levels";
import { playedToday, readProgress, recordPlay, type Progress } from "@/lib/games/progress";
import type { Game } from "@/lib/games/registry";
import { buzz, sfx } from "@/lib/games/sfx";
import { allSorted, buildSortLevel, buildSortLevels, CAPACITY, canPour, pour, solvedFlask, type Flasks, type Pour } from "@/lib/games/sort";
import { AutoDaily } from "./AutoDaily";
import { GameIntro } from "./GameIntro";
import { Leaderboard } from "./Leaderboard";
import { ResultPanel } from "./ResultPanel";
import { useLevels } from "./useLevels";
import { levelSeed } from "@/lib/games/challenge";

// Each colour also has a mark, so the puzzle works without telling colours apart.
const LIQUIDS: [string, string, string][] = [
  ["#ff6b63", "red", "●"], ["#ffc23d", "yellow", "▲"], ["#2fcbb0", "teal", "■"], ["#4aa8f2", "blue", "◆"], ["#ff8fb2", "pink", "★"],
  ["#9edb4c", "green", "✚"], ["#ff9142", "orange", "▼"], ["#b38cf0", "violet", "◖"], ["#c9966b", "tan", "◗"],
  ["#5b6ee1", "indigo", "✦"], ["#e36bd1", "magenta", "▬"], ["#7fd6dc", "ice", "◇"],
];
const NEXT_LEVEL_MS = 900;
const LIFT_MS = 230;
const POUR_HOLD_MS = 300;

const tier = (pours: number) => (pours < 70 ? "Master pourer" : pours < 90 ? "Steady hand" : pours < 120 ? "Sharp" : pours < 160 ? "Solid" : "All sorted!");

function FlaskView({ layers, index, lifted, sealed, onTap, register }: { layers: number[]; index: number; lifted: boolean; sealed: boolean; onTap: (i: number) => void; register: (i: number, el: HTMLButtonElement | null) => void }) {
  const names = layers.length ? layers.map(l => LIQUIDS[l]![1]).join(", ") : "empty";
  const done = layers.length === CAPACITY && solvedFlask(layers);
  return (
    <button
      ref={el => register(index, el)}
      type="button"
      data-lifted={lifted}
      onClick={() => onTap(index)}
      aria-pressed={lifted}
      aria-label={`Flask ${index + 1}: ${names}`}
      className="flask relative h-44 w-full max-w-16 justify-self-center sm:h-52"
    >
      <span aria-hidden className="absolute -inset-x-1 top-0 z-10 h-3 rounded-full bg-[var(--tile)] shadow-[0_2px_4px_var(--glow)]" />
      {done && <span aria-hidden className="flask-cork clay absolute inset-x-2 -top-2 z-20 h-5 rounded-lg" style={{ "--c": "var(--gold)" } as React.CSSProperties} />}
      <span aria-hidden className={`flask-glass absolute inset-x-0 bottom-0 top-1.5 flex flex-col-reverse overflow-hidden rounded-b-[26px] p-[3px] sm:rounded-b-[32px] ${sealed ? "game-pop" : ""}`}>
        {layers.map((colour, i) => (
          <span key={`${i}-${colour}`} className={`liquid liquid-in grid shrink-0 place-items-center text-sm text-black/35 ${i === 0 ? "rounded-b-[22px] sm:rounded-b-[28px]" : ""}`} style={{ height: `${100 / CAPACITY}%`, "--c": LIQUIDS[colour]![0] } as React.CSSProperties}>{LIQUIDS[colour]![2]}</span>
        ))}
        <span className="pointer-events-none absolute inset-y-3 left-2 w-1.5 rounded-full bg-white/45" />
      </span>
    </button>
  );
}

export function SortGame({ game }: { game: Game }) {
  const [phase, setPhase] = useState<"intro" | "playing" | "saving" | "done">("intro");
  const [run, setRun] = useState<{ token: string; seed: number; practice: boolean; colours?: number } | null>(null);
  const [level, setLevel] = useState(0);
  const [flasks, setFlasks] = useState<Flasks>([]);
  const [moves, setMoves] = useState<Pour[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [sealed, setSealed] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [finished, setFinished] = useState<{ result: FinishResult; progress: Progress; newBest: boolean } | null>(null);
  const [error, setError] = useState("");
  const backToIntro = useCallback(() => setPhase("intro"), []);
  const ladder = useLevels(game, at => beginLevel(at), backToIntro);
  const busy = useRef(false);
  const allMoves = useRef<Pour[][]>([]);
  const elements = useRef(new Map<number, HTMLButtonElement>());
  const levels = useMemo(() => (run ? (run.colours ? [buildSortLevel(run.seed, run.colours)] : buildSortLevels(run.seed)) : []), [run]);

  useEffect(() => setProgress(readProgress()), []);

  const register = useCallback((i: number, el: HTMLButtonElement | null) => {
    if (el) elements.current.set(i, el);
    else elements.current.delete(i);
  }, []);

  const begin = async (practice: boolean) => {
    setError("");
    try {
      const started = await startRun("sort", { practice });
      allMoves.current = [];
      setRun({ ...started, practice });
      setFlasks(buildSortLevels(started.seed)[0]!);
      setMoves([]);
      setSelected(null);
      setLevel(0);
      setTotal(0);
      setPhase("playing");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const beginLevel = (at: number) => {
    const seed = levelSeed("sort", at);
    const colours = sortColours(at);
    allMoves.current = [];
    setRun({ token: "", seed, practice: true, colours });
    setFlasks(buildSortLevel(seed, colours));
    setMoves([]);
    setSelected(null);
    setSealed(null);
    setLevel(0);
    setTotal(0);
    setPhase("playing");
  };

  const finish = useCallback(async () => {
    if (!run) return;
    if (ladder.active && run.colours) {
      const pours = allMoves.current.flat().length;
      return ladder.complete(sortStars(pours, run.colours), `Sorted in ${pours} pours`);
    }
    setPhase("saving");
    const local = allMoves.current.flat().length;
    const result = await finishRun(run.token, { levels: allMoves.current }).catch((): FinishResult => ({ score: local, ranked: false, standing: null }));
    const saved = recordPlay("sort", result.score, true, !run.practice);
    setProgress(saved.progress);
    setFinished({ result, ...saved });
    setPhase("done");
    window.scrollTo({ top: 0 });
  }, [ladder, run]);

  /** The source flask travels to the target, tips over it and returns, with the liquid changing at the tip. */
  const animatePour = useCallback(async (from: number, to: number, colour: string, apply: () => void) => {
    const source = elements.current.get(from), target = elements.current.get(to);
    if (!source || !target || matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
    const a = source.getBoundingClientRect(), b = target.getBoundingClientRect();
    const side = a.left < b.left ? -1 : 1;
    const dx = b.left - a.left + side * a.width * 0.72, dy = b.top - a.top - 34;
    const tilt = `translate(${dx}px, ${dy}px) rotate(${-side * 72}deg)`;
    source.style.zIndex = "30";
    const easing = "cubic-bezier(0.77, 0, 0.175, 1)";
    await source.animate([{ transform: "translateY(-16px)" }, { transform: tilt }], { duration: LIFT_MS, easing, fill: "forwards" }).finished;
    // Attached to the page itself: a transformed ancestor would pull a fixed element out of place.
    const line = document.createElement("div");
    line.className = "pour-stream";
    Object.assign(line.style, { left: `${b.left + b.width / 2 - 4}px`, top: `${b.top - 8}px`, height: `${b.height * 0.55}px`, background: colour });
    document.body.append(line);
    sfx("pour");
    apply();
    await new Promise(r => setTimeout(r, POUR_HOLD_MS));
    line.remove();
    const back = source.animate([{ transform: tilt }, { transform: "none" }], { duration: LIFT_MS, easing, fill: "forwards" });
    await back.finished;
    back.cancel();
    source.getAnimations().forEach(a => a.cancel());
    source.style.zIndex = "";
  }, []);

  const tapFlask = useCallback(async (index: number) => {
    if (busy.current) return;
    if (selected === null) {
      if (flasks[index]!.length === 0) return;
      sfx("tap");
      return setSelected(index);
    }
    if (selected === index) return setSelected(null);
    if (!canPour(flasks, selected, index)) {
      sfx("bad");
      buzz([20, 40, 20]);
      elements.current.get(index)?.animate([{ transform: "none" }, { transform: "translateX(-5px)" }, { transform: "translateX(4px)" }, { transform: "none" }], { duration: 240 });
      setSelected(flasks[index]!.length ? index : null);
      return;
    }
    busy.current = true;
    const from = selected;
    const source = flasks[from]!;
    const next = pour(flasks, from, index);
    const nextMoves: Pour[] = [...moves, [from, index]];
    setSelected(null);
    await animatePour(from, index, LIQUIDS[source[source.length - 1]!]![0], () => {
      setFlasks(next);
      setMoves(nextMoves);
      setTotal(t => t + 1);
    });
    busy.current = false;
    if (next[index]!.length === CAPACITY && solvedFlask(next[index]!)) {
      setSealed(index);
      sfx("good");
      buzz(14);
    }
    if (!allSorted(next)) return;
    allMoves.current[level] = nextMoves;
    busy.current = true;
    setTimeout(() => {
      busy.current = false;
      if (level === levels.length - 1) return void finish();
      setLevel(level + 1);
      setFlasks(levels[level + 1]!);
      setMoves([]);
      setSealed(null);
    }, NEXT_LEVEL_MS);
  }, [animatePour, finish, flasks, level, levels, moves, selected]);

  const undo = () => {
    if (busy.current || !moves.length) return;
    const kept = moves.slice(0, -1);
    setFlasks(kept.reduce((state, [a, b]) => pour(state, a, b), levels[level]!));
    setMoves(kept);
    setSelected(null);
    setTotal(t => t - 1);
  };

  const restart = () => {
    if (busy.current) return;
    setTotal(t => t - moves.length);
    setFlasks(levels[level]!);
    setMoves([]);
    setSelected(null);
  };

  if (ladder.element) return ladder.element;
  if (phase === "saving") return <p role="status" className="arcade-title py-24 text-center text-2xl">Checking your pours…</p>;
  if (phase === "done" && finished && run) {
    return <ResultPanel game={game} token={run.token} result={finished.result} tier={tier(finished.result.score)} detail={`All ${levels.length} levels sorted`} progress={finished.progress} newBest={finished.newBest} onAgain={ladder.open} againLabel="Play levels" />;
  }

  if (phase === "playing") {
    return (
      <div className="play-rise">
        <div className="mb-3 flex items-center justify-between">
          <span className="soft-chip px-3.5 py-1 text-sm font-bold">{ladder.active ? `Level ${ladder.active}` : `Daily level ${level + 1} of ${levels.length}`}</span>
          <span className="arcade-title text-2xl tabular-nums">{total} {total === 1 ? "pour" : "pours"}</span>
        </div>
        <div className="arcade-panel lab-bench px-2 pb-6 pt-9">
          <div key={level} className="play-enter mx-auto grid max-w-md gap-x-2.5 gap-y-9 px-2 sm:gap-x-4" style={{ gridTemplateColumns: `repeat(${Math.ceil(flasks.length / 2)}, minmax(0, 1fr))` }}>
            {flasks.map((layers, i) => <FlaskView key={i} layers={layers} index={i} lifted={selected === i} sealed={sealed === i} onTap={i2 => void tapFlask(i2)} register={register} />)}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={undo} disabled={!moves.length} className="arcade-btn arcade-btn--quiet arcade-btn--small">Undo</button>
          <button type="button" onClick={restart} disabled={!moves.length} className="arcade-btn arcade-btn--quiet arcade-btn--small">Restart level</button>
        </div>
      </div>
    );
  }

  const played = progress ? playedToday(progress, "sort") : false;
  return (
    <>
      <GameIntro game={game} heading="100 levels" note={played ? "Today's daily challenge is done." : "Plus one ranked daily challenge for the leaderboard."}>
        <button type="button" onClick={ladder.open} className="arcade-btn">Play level {ladder.next}</button>
        {!played && <button type="button" onClick={() => void begin(false)} className="arcade-btn arcade-btn--quiet">Daily challenge</button>}
        <AutoDaily slug="sort" start={() => void begin(false)} />
        {error && <p role="alert" className="w-full text-sm font-semibold text-[var(--bad)]">{error}</p>}
      </GameIntro>
      <Leaderboard game={game} refresh={0} />
    </>
  );
}
