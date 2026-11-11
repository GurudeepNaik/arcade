"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { finishRun, startRun, type FinishResult } from "@/lib/games/client";
import { levelSeed } from "@/lib/games/challenge";
import { allLit, buildDailyLantern, buildLanternBoard, flip, lanternStars, solveLanterns, type LanternBoard } from "@/lib/games/lantern";
import { playedToday, readProgress, recordPlay, type Progress } from "@/lib/games/progress";
import { lanternSize, lanternTaps } from "@/lib/games/levels";
import type { Game } from "@/lib/games/registry";
import { sfx } from "@/lib/games/sfx";
import { AutoDaily } from "./AutoDaily";
import { GameIntro } from "./GameIntro";
import { Leaderboard } from "./Leaderboard";
import { ResultPanel } from "./ResultPanel";
import { useLevels } from "./useLevels";

const WIN_HOLD_MS = 700;
const START_HINTS = 3;
const NEXT_BOARD_MS = 800;

const tier = (taps: number) => (taps <= 24 ? "Lamplighter" : taps <= 32 ? "Bright spark" : taps <= 45 ? "Glowing" : "All lit!");

function LanternCell({ lit, row, col, pulse, tick, hinted, onTap }: { lit: boolean; row: number; col: number; pulse: boolean; tick: number; hinted: boolean; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Lantern, row ${row + 1}, column ${col + 1}, ${lit ? "lit" : "dark"}${hinted ? ", hint: tap this one" : ""}`}
      aria-pressed={lit}
      className={`lantern grid aspect-square w-full place-items-center rounded-[22%] ${lit ? "lantern-on" : ""} ${hinted ? "lantern-hint" : ""}`}
    >
      {/* The key replays the flip on every tap without rebuilding the button, so keyboard focus stays put. */}
      <span key={pulse ? tick : "still"} className={`grid h-[72%] place-items-center ${pulse ? "lantern-flip" : ""}`}>
      <svg viewBox="0 0 40 48" aria-hidden className="h-full">
        <rect x="13" y="2" width="14" height="5" rx="2" className="lantern-cap" />
        <path d="M8 8h24c4 7 4 26 0 33H8c-4-7-4-26 0-33z" className="lantern-body" />
        <path d="M15 8c-3 9-3 24 0 33M25 8c3 9 3 24 0 33" fill="none" className="lantern-rib" strokeWidth="1.6" />
        <rect x="13" y="41" width="14" height="5" rx="2" className="lantern-cap" />
      </svg>
      </span>
    </button>
  );
}

/** Lantern Night: 100 levels, plus a ranked daily of three boards scored by total taps. */
export function LanternGame({ game }: { game: Game }) {
  const [phase, setPhase] = useState<"intro" | "playing" | "saving" | "done">("intro");
  const [mode, setMode] = useState<"level" | "daily">("level");
  const [run, setRun] = useState<{ token: string; seed: number } | null>(null);
  const [daily, setDaily] = useState<LanternBoard[]>([]);
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [finished, setFinished] = useState<{ result: FinishResult; progress: Progress; newBest: boolean } | null>(null);
  const [error, setError] = useState("");
  const tapLog = useRef<number[][]>([]);
  const [board, setBoard] = useState<LanternBoard | null>(null);
  const [lit, setLit] = useState<boolean[]>([]);
  const [history, setHistory] = useState<boolean[][]>([]);
  const [last, setLast] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [hints, setHints] = useState(START_HINTS);
  const [hinted, setHinted] = useState<number | null>(null);

  useEffect(() => setProgress(readProgress()), []);
  const backToIntro = useCallback(() => setPhase("intro"), []);
  const ladder = useLevels(game, at => beginLevel(at), backToIntro);

  const openBoard = (next: LanternBoard) => {
    setBoard(next);
    setLit(next.lit);
    setHistory([]);
    setLast(null);
    setSolved(false);
    setHinted(null);
  };

  /** Today's ranked run: three boards from a server seed; every tap counts, so no hints or undo. */
  const beginDaily = async () => {
    setError("");
    try {
      const started = await startRun("lantern", { practice: false });
      const boards = buildDailyLantern(started.seed);
      setRun(started);
      setDaily(boards);
      setIndex(0);
      setTotal(0);
      tapLog.current = boards.map(() => []);
      setMode("daily");
      openBoard(boards[0]!);
      setPhase("playing");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const finishDaily = async () => {
    if (!run) return;
    setPhase("saving");
    const local = tapLog.current.flat().length;
    const result = await finishRun(run.token, { taps: tapLog.current }).catch((): FinishResult => ({ score: local, ranked: false, standing: null }));
    const saved = recordPlay("lantern", result.score, true, true);
    setProgress(saved.progress);
    setFinished({ result, ...saved });
    setPhase("done");
    window.scrollTo({ top: 0 });
  };

  const beginLevel = (at: number) => {
    setMode("level");
    const next = buildLanternBoard(levelSeed("lantern", at), lanternSize(at), lanternTaps(at));
    setBoard(next);
    setLit(next.lit);
    setHistory([]);
    setLast(null);
    setSolved(false);
    setHints(START_HINTS);
    setHinted(null);
    setPhase("playing");
  };

  const tap = (cell: number) => {
    if (!board || solved) return;
    const next = flip(lit, board.size, cell);
    const moves = history.length + 1;
    if (mode === "daily") {
      tapLog.current[index]!.push(cell);
      setTotal(t => t + 1);
      setHistory(h => [...h, lit]);
      setLit(next);
      setLast(cell);
      if (!allLit(next)) return sfx("tap");
      setSolved(true);
      sfx("good");
      if (index === daily.length - 1) return void setTimeout(() => void finishDaily(), WIN_HOLD_MS);
      setTimeout(() => { setIndex(index + 1); openBoard(daily[index + 1]!); }, NEXT_BOARD_MS);
      return;
    }
    setHistory(h => [...h, lit]);
    setLit(next);
    setLast(cell);
    setHinted(null);
    if (allLit(next)) {
      setSolved(true);
      sfx("good");
      const used = START_HINTS - hints;
      // Stars from taps against par, then one less per hint, never below one.
      const stars = Math.max(1, lanternStars(moves, board.par) - used) as 1 | 2 | 3;
      const hintNote = used ? ` ${used} ${used === 1 ? "hint" : "hints"} used: one star less each.` : "";
      setTimeout(() => ladder.complete(stars, `${moves} ${moves === 1 ? "tap" : "taps"}, par ${board.par}.${hintNote}${!used && stars < 3 ? " Match the par for three stars." : ""}`), WIN_HOLD_MS);
    } else sfx("tap");
  };

  /** Lights up the next lantern to tap, worked out from the board as it is now. */
  const hint = () => {
    if (!board || solved || !hints) return;
    const plan = solveLanterns(lit, board.size);
    if (!plan?.length) return;
    setHints(h => h - 1);
    setHinted(plan[0]!);
    sfx("step");
  };

  const undo = () => {
    if (!history.length || solved) return;
    setLit(history[history.length - 1]!);
    setHistory(h => h.slice(0, -1));
    setLast(null);
    setHinted(null);
  };

  const restart = () => {
    if (!board || solved) return;
    setLit(board.lit);
    setHistory([]);
    setLast(null);
    setHinted(null);
  };

  if (ladder.element) return ladder.element;
  if (phase === "saving") return <p role="status" className="arcade-title py-24 text-center text-2xl">Checking your taps…</p>;
  if (phase === "done" && finished && run) {
    return <ResultPanel game={game} token={run.token} result={finished.result} tier={tier(finished.result.score)} detail={`All ${daily.length} boards lit`} progress={finished.progress} newBest={finished.newBest} onAgain={ladder.open} againLabel="Play levels" />;
  }

  if (phase === "playing" && board) {
    const litCount = lit.filter(Boolean).length;
    return (
      <div className="play-rise">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="soft-chip px-3.5 py-1 text-sm font-bold">{mode === "daily" ? `Daily board ${index + 1} of ${daily.length}` : `Level ${ladder.active}`}</span>
          <span className="text-sm font-semibold tabular-nums" aria-live="polite">
            {mode === "daily" ? `${total} ${total === 1 ? "tap" : "taps"} today` : `${history.length} ${history.length === 1 ? "tap" : "taps"} · par ${board.par}`}
          </span>
        </div>
        <p className="sr-only" aria-live="polite">{litCount} of {lit.length} lanterns lit.</p>
        <div
          className="lantern-board arcade-panel mx-auto grid gap-1.5 p-2.5 sm:gap-2 sm:p-3"
          style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))`, maxWidth: `${Math.min(30, board.size * 5.5)}rem` }}
        >
          {lit.map((on, i) => (
            <LanternCell key={i} tick={history.length} hinted={hinted === i} lit={on} row={Math.floor(i / board.size)} col={i % board.size} pulse={last !== null && Math.abs(Math.floor(i / board.size) - Math.floor(last / board.size)) + Math.abs((i % board.size) - (last % board.size)) <= 1 && (Math.floor(i / board.size) === Math.floor(last / board.size) || i % board.size === last % board.size)} onTap={() => tap(i)} />
          ))}
        </div>
        {mode === "daily" ? (
          <p className="mt-5 text-center text-sm text-[var(--ink-soft)]">Every tap counts toward today&apos;s score: no hints or undo on the daily.</p>
        ) : (
        <div className="mt-5 grid grid-cols-3 gap-2">
          <button type="button" onClick={undo} disabled={!history.length || solved} className="arcade-btn arcade-btn--quiet arcade-btn--small !px-2">Undo</button>
          <button type="button" onClick={restart} disabled={!history.length || solved} className="arcade-btn arcade-btn--quiet arcade-btn--small !px-2">Start over</button>
          <button type="button" onClick={hint} disabled={!hints || solved} className="arcade-btn arcade-btn--quiet arcade-btn--small !flex-col !gap-0 !px-2 leading-tight">
            <span>{hints ? `Hint (${hints})` : "No hints"}</span>
            {hints > 0 && <span className="font-sans text-[11px] font-medium text-[var(--ink-soft)]">costs a star</span>}
          </button>
        </div>
        )}
        <p className="mt-3 text-center text-sm text-[var(--ink-soft)]">A tap flips the lantern and the ones above, below and beside it.</p>
      </div>
    );
  }

  return (
    <>
      <GameIntro game={game} heading="100 levels" note={progress && playedToday(progress, "lantern") ? "Today's daily challenge is done." : "Plus a ranked daily: three boards, fewest taps wins."}>
        <button type="button" onClick={ladder.open} className="arcade-btn">Play level {ladder.next}</button>
        {!(progress && playedToday(progress, "lantern")) && <button type="button" onClick={() => void beginDaily()} className="arcade-btn arcade-btn--quiet">Daily challenge</button>}
        <AutoDaily slug="lantern" start={() => void beginDaily()} />
        {error && <p role="alert" className="w-full text-sm font-semibold text-[var(--bad)]">{error}</p>}
      </GameIntro>
      <Leaderboard game={game} refresh={0} />
    </>
  );
}
