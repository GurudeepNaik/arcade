"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blockerOf, buildArrowBoard, buildArrowBoards, BUMP_PENALTY_S, canExit, type ArrowBoard, type Cell } from "@/lib/games/arrows";
import { finishRun, startRun, type FinishResult } from "@/lib/games/client";
import { arrowSize, starsFromMistakes } from "@/lib/games/levels";
import { playedToday, readProgress, recordPlay, type Progress } from "@/lib/games/progress";
import type { Game } from "@/lib/games/registry";
import { buzz, sfx } from "@/lib/games/sfx";
import { AutoDaily } from "./AutoDaily";
import { GameIntro } from "./GameIntro";
import { Leaderboard } from "./Leaderboard";
import { ResultPanel } from "./ResultPanel";
import { clockText, useClock } from "./useClock";
import { useLevels } from "./useLevels";
import { levelSeed } from "@/lib/games/challenge";

const TILE_COLOURS = ["#3fc7a0", "#ffb82e", "#ff7a72", "#55b4f2"];
const DIRECTION = ["up", "right", "down", "left"];
const SLIDE: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const NEXT_BOARD_MS = 420;
const FLY_MS = 290;

const tier = (s: number) => (s < 40 ? "Untouchable" : s < 70 ? "Lightning" : s < 110 ? "Sharp" : s < 170 ? "Solid" : "Cleared!");

function Tile({ dir, flying, reach, index, size, onTap }: { dir: Cell; flying: boolean; reach: number; index: number; size: number; onTap: (i: number, el: HTMLButtonElement) => void }) {
  if (dir === -1) return <span aria-hidden className="aspect-square rounded-[24%] bg-[var(--well)]" />;
  const [dx, dy] = SLIDE[dir]!;
  return (
    <button
      type="button"
      aria-label={`Arrow pointing ${DIRECTION[dir]}`}
      onClick={e => onTap(index, e.currentTarget)}
      style={{ "--c": TILE_COLOURS[dir], "--delay": `${((index % size) + Math.floor(index / size)) * 22}ms`, transform: flying ? `translate(${dx * reach}px, ${dy * reach}px)` : undefined, opacity: flying ? 0 : 1, zIndex: flying ? 10 : undefined } as React.CSSProperties}
      className={`clay relative aspect-square rounded-[24%] ${flying ? "arrow-fly" : "deal"}`}
    >
      <svg viewBox="0 0 24 24" className="size-full" style={{ transform: `rotate(${dir * 90}deg)` }} aria-hidden>
        <path d="M12 5l6.5 7.5H15V19H9v-6.5H5.5z" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function ArrowGame({ game }: { game: Game }) {
  const [phase, setPhase] = useState<"intro" | "playing" | "saving" | "done">("intro");
  const [run, setRun] = useState<{ token: string; seed: number; practice: boolean; size?: number } | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [cells, setCells] = useState<Cell[]>([]);
  const [flying, setFlying] = useState<Set<number>>(new Set());
  const [bumps, setBumps] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [finished, setFinished] = useState<{ result: FinishResult; progress: Progress; newBest: boolean } | null>(null);
  const [error, setError] = useState("");
  const backToIntro = useCallback(() => setPhase("intro"), []);
  const ladder = useLevels(game, at => beginLevel(at), backToIntro);
  const taps = useRef<number[][]>([]);
  const boardEl = useRef<HTMLDivElement>(null);
  const boards = useMemo<ArrowBoard[]>(() => (run ? (run.size ? [buildArrowBoard(run.seed, run.size)] : buildArrowBoards(run.seed)) : []), [run]);
  const seconds = useClock(startedAt, phase === "playing");

  useEffect(() => setProgress(readProgress()), []);

  const begin = async (practice: boolean) => {
    setError("");
    try {
      const started = await startRun("arrows", { practice });
      const first = buildArrowBoards(started.seed)[0]!;
      taps.current = [[]];
      setRun({ ...started, practice });
      setCells(first.cells);
      setFlying(new Set());
      setLevel(0);
      setBumps(0);
      setStartedAt(Date.now());
      setPhase("playing");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const beginLevel = (at: number) => {
    const seed = levelSeed("arrows", at);
    const size = arrowSize(at);
    taps.current = [[]];
    setRun({ token: "", seed, practice: true, size });
    setCells(buildArrowBoard(seed, size).cells);
    setFlying(new Set());
    setLevel(0);
    setBumps(0);
    setStartedAt(Date.now());
    setPhase("playing");
  };

  const finish = useCallback(async () => {
    if (!run || startedAt === null) return;
    if (ladder.active) return ladder.complete(starsFromMistakes(bumps), bumps ? `${bumps} ${bumps === 1 ? "crash" : "crashes"}` : "Not a single crash");
    setPhase("saving");
    const local = Math.round((Date.now() - startedAt) / 1000) + bumps * BUMP_PENALTY_S;
    const result = await finishRun(run.token, { taps: taps.current }).catch((): FinishResult => ({ score: local, ranked: false, standing: null }));
    const saved = recordPlay("arrows", result.score, true, !run.practice);
    setProgress(saved.progress);
    setFinished({ result, ...saved });
    setPhase("done");
    window.scrollTo({ top: 0 });
  }, [bumps, ladder, run, startedAt]);

  const tap = useCallback((index: number, el: HTMLButtonElement) => {
    const size = boards[level]!.size;
    const live = { size, cells };
    if (flying.has(index)) return;
    taps.current[level]!.push(index);
    if (!canExit(live, index)) {
      const dir = cells[index] as number;
      const [dx, dy] = SLIDE[dir]!;
      const blocker = blockerOf(live, index);
      const gap = blocker === null ? 1 : Math.abs((blocker % size) - (index % size)) + Math.abs(Math.floor(blocker / size) - Math.floor(index / size));
      const travel = (gap - 1) * el.offsetWidth + 10;
      el.animate([{ transform: "none" }, { transform: `translate(${dx * travel}px, ${dy * travel}px)` }, { transform: "none" }], { duration: 260, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
      sfx("bad");
      buzz([20, 40, 20]);
      setBumps(b => b + 1);
      setPenalty(p => p + 1);
      return;
    }
    sfx("step");
    buzz(8);
    const next = cells.map((c, i) => (i === index ? (-1 as Cell) : c));
    setCells(next);
    setFlying(f => new Set(f).add(index));
    setTimeout(() => setFlying(f => { const copy = new Set(f); copy.delete(index); return copy; }), FLY_MS);
    if (next.some(c => c !== -1)) return;
    sfx("good");
    setTimeout(() => {
      if (level === boards.length - 1) return void finish();
      taps.current.push([]);
      setLevel(level + 1);
      setCells(boards[level + 1]!.cells);
      setFlying(new Set());
    }, NEXT_BOARD_MS);
  }, [boards, cells, finish, flying, level]);

  if (ladder.element) return ladder.element;
  if (phase === "saving") return <p role="status" className="arcade-title py-24 text-center text-2xl">Checking your run…</p>;
  if (phase === "done" && finished && run) {
    return <ResultPanel game={game} token={run.token} result={finished.result} tier={tier(finished.result.score)} detail={bumps ? `${bumps} ${bumps === 1 ? "crash" : "crashes"}, +${bumps * BUMP_PENALTY_S}s` : "Not a single crash"} progress={finished.progress} newBest={finished.newBest} onAgain={ladder.open} againLabel="Play levels" />;
  }

  if (phase === "playing" && boards[level]) {
    const size = boards[level].size;
    const shown = cells.map((c, i) => (flying.has(i) ? boards[level]!.cells[i]! : c));
    return (
      <div className="play-rise">
        <div className="mb-3 flex items-center justify-between">
          {ladder.active ? <span className="soft-chip px-3.5 py-1 text-sm font-bold">Level {ladder.active}</span> : <ol className="flex gap-1.5" aria-label={`Board ${level + 1} of ${boards.length}`}>
            {boards.map((_, i) => <li key={i} className={`size-3.5 rounded-full transition-colors ${i < level ? "bg-[var(--g-deep)]" : i === level ? "bg-[var(--g)]" : "bg-[var(--well-2)]"}`} />)}
          </ol>}
          <span className="relative">
            <span className="arcade-title text-3xl tabular-nums" role="timer">{clockText(seconds + bumps * BUMP_PENALTY_S)}</span>
            {penalty > 0 && <span key={penalty} aria-hidden className="penalty arcade-title absolute -top-1 right-0 text-lg text-[var(--bad)]">+{BUMP_PENALTY_S}s</span>}
          </span>
        </div>
        <div key={level} ref={boardEl} className="arcade-panel play-enter p-3">
          <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
            {shown.map((dir, i) => <Tile key={i} dir={dir} flying={flying.has(i)} reach={(boardEl.current?.offsetWidth ?? 400) * 1.1} index={i} size={size} onTap={tap} />)}
          </div>
        </div>
        <p className="mt-4 text-center text-[var(--ink-soft)]">Tap arrows with a clear path. Crashes cost {BUMP_PENALTY_S} seconds.</p>
      </div>
    );
  }

  const played = progress ? playedToday(progress, "arrows") : false;
  return (
    <>
      <GameIntro game={game} heading="100 levels" note={played ? "Today's daily challenge is done." : "Plus one ranked daily challenge for the leaderboard."}>
        <button type="button" onClick={ladder.open} className="arcade-btn">Play level {ladder.next}</button>
        {!played && <button type="button" onClick={() => void begin(false)} className="arcade-btn arcade-btn--quiet">Daily challenge</button>}
        <AutoDaily slug="arrows" start={() => void begin(false)} />
        {error && <p role="alert" className="w-full text-sm font-semibold text-[var(--bad)]">{error}</p>}
      </GameIntro>
      <Leaderboard game={game} refresh={0} />
    </>
  );
}
