"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { finishRun, startRun, type FinishResult } from "@/lib/games/client";
import { buildDailyHoot, buildHootBoard, hootConflicts, hootSolved, type HootBoard } from "@/lib/games/hoot";
import { hootSize, type Stars } from "@/lib/games/levels";
import { playedToday, readProgress, recordPlay, type Progress } from "@/lib/games/progress";
import type { Game } from "@/lib/games/registry";
import { buzz, sfx } from "@/lib/games/sfx";
import { Confetti } from "./Confetti";
import { AutoDaily } from "./AutoDaily";
import { GameIntro } from "./GameIntro";
import { Leaderboard } from "./Leaderboard";
import { Pip, type PipMood } from "./Pip";
import { ResultPanel } from "./ResultPanel";
import { clockText, useClock } from "./useClock";
import { useLevels } from "./useLevels";
import { useRace, type RaceStart } from "./useRace";
import { levelSeed } from "@/lib/games/challenge";

const PATCHES = ["#ff8fab", "#ffc14d", "#6fd6a8", "#6cc5f2", "#b79cf0", "#ff9e5e", "#9edb5c", "#f27d72", "#5fd0cf", "#d9a877"];
const COLOUR_NAMES = ["pink", "yellow", "green", "blue", "violet", "orange", "lime", "red", "aqua", "tan"];
const NEXT_BOARD_MS = 1250;
const START_HINTS = 3;
const START_LIVES = 3;
const DOUBLE_TAP_MS = 400;
const GHOST_MS = 620;
const OUT_OF_LIVES_MS = 1500;

const EMPTY = 0, CROSS = 1, OWL = 2;
type Mark = 0 | 1 | 2;

const SAY = { row: "Two owls in one row!", column: "Two owls in one column!", patch: "Two owls in one colour!", touch: "Those owls are touching!" };

const tier = (s: number) => (s < 90 ? "Night vision" : s < 180 ? "Sharp-eyed" : s < 300 ? "Wise owl" : s < 480 ? "Solid" : "All found!");

function OwlFace({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" aria-hidden className={className}>
      <path d="M14 14 9 3c6 1 12 4 15 8zM46 14l5-11c-6 1-12 4-15 8z" fill="#14866a" />
      <path d="M30 7c15 0 25 11 25 25S44 57 30 57 5 46 5 32 15 7 30 7z" fill="#2fbf95" />
      <path d="M30 32c10 0 16 6 16 13 0 7-7 11-16 11s-16-4-16-11c0-7 6-13 16-13z" fill="#fff1d6" />
      <circle cx="20" cy="26" r="10.5" fill="#fff" /><circle cx="40" cy="26" r="10.5" fill="#fff" />
      <circle cx="21.5" cy="27" r="6" fill="#1f3d3a" /><circle cx="38.5" cy="27" r="6" fill="#1f3d3a" />
      <circle cx="23.5" cy="24.5" r="2" fill="#fff" /><circle cx="40.5" cy="24.5" r="2" fill="#fff" />
      <path d="M30 31l-4.5 1.5c1 4 3.5 6 4.5 6.5 1-.5 3.5-2.5 4.5-6.5z" fill="#ffb82e" />
    </svg>
  );
}

function Lives({ left }: { left: number }) {
  return (
    <ol aria-label={`${left} of ${START_LIVES} lives left`} className="soft-chip flex gap-0.5 px-2.5 py-1">
      {Array.from({ length: START_LIVES }, (_, i) => (
        <li key={i}>
          <svg viewBox="0 0 24 24" aria-hidden className={`heart block size-5 ${i >= left ? "heart-lost" : ""}`}>
            <path d="M12 21C6 16.5 2.5 13 2.5 8.6 2.5 5.6 4.9 3.5 7.6 3.5c1.8 0 3.4 1 4.4 2.6 1-1.6 2.6-2.6 4.4-2.6 2.7 0 5.1 2.1 5.1 5.1C21.5 13 18 16.5 12 21z" />
          </svg>
        </li>
      ))}
    </ol>
  );
}

function Tile({ board, index, mark, dim, wrong, hop, onPress }: { board: HootBoard; index: number; mark: Mark; dim: boolean; wrong: boolean; hop: boolean; onPress: (i: number) => void }) {
  const { size, regions } = board;
  const x = index % size, y = Math.floor(index / size), patch = regions[index]!;
  const same = (dx: number, dy: number) => {
    const nx = x + dx, ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < size && ny < size && regions[ny * size + nx] === patch;
  };
  const up = same(0, -1), down = same(0, 1), left = same(-1, 0), right = same(1, 0);
  const round = "clamp(8px, 2.6vmin, 15px)";
  // Tiles in one patch overlap slightly, so the patch reads as a single smooth shape.
  const gap = (joined: boolean) => (joined ? "-0.6px" : "1.5px");
  const corner = (a: boolean, b: boolean) => (a || b ? "0" : round);
  const edges = [!up && "inset 0 3px 0 rgb(255 255 255 / 0.45)", !down && "inset 0 -4px 0 rgb(0 0 0 / 0.13)"].filter(Boolean).join(", ");
  const state = mark === OWL ? "owl" : mark === CROSS ? "crossed" : "empty";
  return (
    <span className="deal relative block aspect-square" style={{ "--delay": `${(x + y) * 24}ms` } as React.CSSProperties}>
      <button
        type="button"
        data-cell={index}
        onClick={() => onPress(index)}
        aria-label={`Row ${y + 1}, column ${x + 1}, ${COLOUR_NAMES[patch]}, ${state}`}
        className={`absolute grid place-items-center ${wrong ? "game-shake" : ""}`}
        style={{ inset: `${gap(up)} ${gap(right)} ${gap(down)} ${gap(left)}`, background: PATCHES[patch], borderRadius: `${corner(up, left)} ${corner(up, right)} ${corner(down, right)} ${corner(down, left)}`, boxShadow: edges || undefined }}
      >
        <span aria-hidden className="hoot-square" />
        <span aria-hidden className={`hoot-dim pointer-events-none absolute inset-0 bg-[var(--shade)] ${dim ? "opacity-[0.12]" : "opacity-0"}`} style={{ borderRadius: "inherit" }} />
        {mark === CROSS && (
          <svg viewBox="0 0 24 24" aria-hidden className="mark-in relative w-[46%]"><path d="M6 6l12 12M18 6 6 18" stroke="#fff" strokeWidth="4.6" strokeLinecap="round" /></svg>
        )}
        {wrong && <span className="owl-poof absolute inset-[6%]"><OwlFace className="block" /></span>}
        {mark === OWL && <span className={`relative block w-[88%] ${hop ? "owl-hop" : "owl-drop"}`} style={{ "--delay": `${(x + y) * 40}ms` } as React.CSSProperties}><OwlFace className="block" /></span>}
      </button>
    </span>
  );
}

export function HootGame({ game }: { game: Game }) {
  const [phase, setPhase] = useState<"intro" | "playing" | "saving" | "done">("intro");
  const [run, setRun] = useState<{ token: string; seed: number } | null>(null);
  const [mode, setMode] = useState<"daily" | "level" | "race">("daily");
  const [boards, setBoards] = useState<HootBoard[]>([]);
  const [index, setIndex] = useState(0);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [cleared, setCleared] = useState(false);
  const [mood, setMood] = useState<PipMood>("idle");
  const [say, setSay] = useState("");
  const [hints, setHints] = useState(START_HINTS);
  const [lives, setLives] = useState(START_LIVES);
  const [ghost, setGhost] = useState<number | null>(null);
  const [broken, setBroken] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [burst, setBurst] = useState(0);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [finished, setFinished] = useState<{ result: FinishResult; progress: Progress; newBest: boolean } | null>(null);
  const [error, setError] = useState("");
  const backToIntro = useCallback(() => setPhase("intro"), []);
  const ladder = useLevels(game, at => beginLevel(at), backToIntro);
  const race = useRace(game, start => beginRace(start), backToIntro);
  const level = ladder.active ?? 1;
  const history = useRef<Mark[][]>([]);
  const latest = useRef<Mark[]>([]);
  const livesRef = useRef(START_LIVES);
  const hintsUsed = useRef(0);
  const lastTap = useRef({ cell: -1, at: 0 });
  const ghostTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const drag = useRef<{ from: number; painted: boolean } | null>(null);
  const skipClick = useRef(false);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const board = boards[index];
  const seconds = useClock(startedAt, phase === "playing" && !cleared);

  useEffect(() => {
    setProgress(readProgress());
  }, []);

  const react = useCallback((next: PipMood, line: string) => {
    setMood(next);
    setSay(line);
    clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => { setMood("idle"); setSay(""); }, 1800);
  }, []);

  const openBoard = useCallback((next: HootBoard) => {
    latest.current = Array<Mark>(next.size * next.size).fill(EMPTY);
    setMarks(latest.current);
    history.current = [];
    livesRef.current = START_LIVES;
    hintsUsed.current = 0;
    setLives(START_LIVES);
    setCleared(false);
  }, []);

  const beginDaily = async () => {
    setError("");
    try {
      const started = await startRun("hoot");
      const set = buildDailyHoot(started.seed);
      setRun(started);
      setMode("daily");
      setBoards(set);
      setIndex(0);
      openBoard(set[0]!);
      setStartedAt(Date.now());
      setPhase("playing");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const beginRace = useCallback((start: RaceStart) => {
    const next = buildHootBoard(start.seed, start.spec);
    setMode("race");
    setBoards([next]);
    setIndex(0);
    openBoard(next);
    setStartedAt(start.startsAt);
    setPhase("playing");
  }, [openBoard]);

  const beginLevel = useCallback((at: number) => {
    const next = buildHootBoard(levelSeed("hoot", at), hootSize(at));
    setMode("level");
    setBoards([next]);
    setIndex(0);
    setHints(START_HINTS);
    openBoard(next);
    setStartedAt(Date.now());
    setPhase("playing");
  }, [openBoard]);

  const finishDaily = useCallback(async () => {
    if (!run || startedAt === null) return;
    setPhase("saving");
    const local = Math.round((Date.now() - startedAt) / 1000);
    const result = await finishRun(run.token, { solutions: boards.map(b => b.solution) }).catch((): FinishResult => ({ score: local, ranked: false, standing: null }));
    const saved = recordPlay("hoot", result.score, true, true);
    setProgress(saved.progress);
    setFinished({ result, ...saved });
    setPhase("done");
    window.scrollTo({ top: 0 });
  }, [boards, run, startedAt]);

  const owlsOf = (list: Mark[]) => list.flatMap((m, i) => (m === OWL ? [i] : []));

  const checkSolved = useCallback((next: Mark[]) => {
    if (!board || !hootSolved(board, owlsOf(next))) return;
    setCleared(true);
    sfx("win");
    buzz([14, 30, 14]);
    setMood("cheer");
    setSay("All found!");
    setBurst(b => b + 1);
    setTimeout(() => {
      setMood("idle");
      setSay("");
      // Stars = lives left, minus one per hint used, never below one.
      if (mode === "level") return ladder.complete(Math.max(1, livesRef.current - hintsUsed.current) as Stars, hintsUsed.current ? `${hintsUsed.current} ${hintsUsed.current === 1 ? "hint" : "hints"} used: one star less each.` : "");
      if (mode === "race") return void race.finish(board.solution);
      if (index === boards.length - 1) return void finishDaily();
      setIndex(index + 1);
      openBoard(boards[index + 1]!);
    }, NEXT_BOARD_MS);
  }, [board, boards, finishDaily, index, ladder, mode, openBoard, race]);

  /** A wrong owl costs a life for good: nothing the player does afterwards gives it back. */
  const loseLife = useCallback((cell: number) => {
    if (!board) return;
    const rule = hootConflicts(board, [...owlsOf(latest.current), cell]).rule;
    latest.current = latest.current.map((m, i) => (i === cell ? CROSS : m));
    setMarks(latest.current);
    setGhost(cell);
    setBroken(rule);
    clearTimeout(ghostTimer.current);
    ghostTimer.current = setTimeout(() => { setGhost(null); setBroken(null); }, GHOST_MS);
    sfx("bad");
    buzz([20, 40, 20]);
    const left = livesRef.current - 1;
    livesRef.current = left;
    setLives(left);
    if (left > 0) return react("oops", rule ? SAY[rule] : "No owl there!");
    setLocked(true);
    react("oops", "Out of lives!");
    setTimeout(() => {
      setLocked(false);
      if (mode === "level") return ladder.fail("You ran out of lives.");
      openBoard(board);
      react("think", "Fresh start. Clock's still running!");
    }, OUT_OF_LIVES_MS);
  }, [board, ladder, mode, openBoard, react]);

  const placeOwl = useCallback((cell: number) => {
    if (!board) return;
    if (board.solution[Math.floor(cell / board.size)] !== cell % board.size) return loseLife(cell);
    history.current.push(latest.current);
    const next = latest.current.map((m, i) => (i === cell ? OWL : m));
    latest.current = next;
    setMarks(next);
    sfx("good");
    buzz(10);
    checkSolved(next);
  }, [board, checkSolved, loseLife]);

  const press = useCallback((cell: number) => {
    if (skipClick.current) { skipClick.current = false; return; }
    if (cleared || locked) return;
    const now = performance.now();
    const double = lastTap.current.cell === cell && now - lastTap.current.at < DOUBLE_TAP_MS;
    lastTap.current = double ? { cell: -1, at: 0 } : { cell, at: now };
    const current = latest.current;
    if (current[cell] === OWL) return;
    if (double) return placeOwl(cell);
    history.current.push(current);
    latest.current = current.map((m, i) => (i === cell ? (m === CROSS ? EMPTY : CROSS) : m));
    setMarks(latest.current);
    sfx("tap");
  }, [cleared, locked, placeOwl]);

  /** Dragging across tiles crosses them all out in one stroke. */
  const paint = (e: React.PointerEvent) => {
    if (!drag.current || cleared) return;
    const cell = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-cell]")?.dataset.cell;
    if (cell === undefined || Number(cell) === drag.current.from && !drag.current.painted) return;
    const targets = drag.current.painted ? [Number(cell)] : [drag.current.from, Number(cell)];
    if (!drag.current.painted) history.current.push(marks);
    drag.current.painted = true;
    skipClick.current = true;
    latest.current = latest.current.map((v, i) => (targets.includes(i) && v === EMPTY ? CROSS : v));
    setMarks(latest.current);
  };

  const undo = () => {
    const last = history.current.pop();
    if (!last || cleared || locked) return;
    latest.current = last;
    setMarks(last);
  };

  const hint = () => {
    if (!board || !hints || cleared || locked) return;
    const target = board.solution.map((col, row) => row * board.size + col).find(c => latest.current[c] !== OWL);
    if (target === undefined) return;
    setHints(h => h - 1);
    hintsUsed.current += 1;
    react("think", "Try here! (one star less)");
    placeOwl(target);
  };

  const owls = useMemo(() => owlsOf(marks), [marks]);
  const { report } = race;
  useEffect(() => {
    if (mode === "race" && board) report(owls.length / board.size);
  }, [board, mode, owls.length, report]);
  const blocked = useMemo(() => {
    const out = new Set<number>();
    if (!board) return out;
    const { size, regions } = board;
    for (const o of owls) {
      const ox = o % size, oy = Math.floor(o / size);
      regions.forEach((patch, c) => {
        const x = c % size, y = Math.floor(c / size);
        if (c !== o && (x === ox || y === oy || patch === regions[o] || (Math.abs(x - ox) <= 1 && Math.abs(y - oy) <= 1))) out.add(c);
      });
    }
    return out;
  }, [board, owls]);

  if (race.element) return race.element;
  if (ladder.element) return ladder.element;
  if (phase === "saving") return <p role="status" className="arcade-title py-24 text-center text-2xl">Counting owls…</p>;
  if (phase === "done" && finished && run) {
    return <ResultPanel game={game} token={run.token} result={finished.result} tier={tier(finished.result.score)} detail={`All ${boards.length} boards solved`} progress={finished.progress} newBest={finished.newBest} onAgain={ladder.open} againLabel="Play levels" />;
  }

  if (phase === "playing" && board) {
    const rules: [string, boolean][] = [["Row and column", broken === "row" || broken === "column"], ["Colour", broken === "patch"], ["No touching", broken === "touch"]];
    return (
      <div>
        {burst > 0 && cleared && <Confetti key={burst} />}
        {mode === "race" && race.bar}
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="soft-chip px-3.5 py-1 text-sm font-bold">{mode === "race" ? "Race" : mode === "level" ? `Level ${level}` : `Daily board ${index + 1} of ${boards.length}`}</span>
          <Lives left={lives} />
          <span className="arcade-title text-3xl tabular-nums" role="timer">{clockText(seconds)}</span>
        </div>
        <ol aria-label={`${owls.length} of ${board.size} owls placed`} className="soft-chip flex justify-center gap-1 px-3 py-1.5">
          {Array.from({ length: board.size }, (_, i) => (
            <li key={i} className="w-7">
              {i < owls.length ? <OwlFace className="owl-drop block" /> : <span className="block aspect-square rounded-full bg-[var(--well-2)]" />}
            </li>
          ))}
        </ol>
        <ul className="mt-3 grid grid-cols-3 gap-1.5 text-center text-xs font-semibold">
          {rules.map(([label, broken]) => (
            <li key={label} className={`rounded-xl px-1 py-1.5 transition-colors ${broken ? "bg-[var(--alert)] text-[var(--on-alert)]" : "bg-[var(--well)] text-[var(--ink-soft)]"}`}>{label}</li>
          ))}
        </ul>
        <div className="relative mt-16">
          <div className="absolute -top-[4.5rem] right-3 z-10 flex items-end gap-2">
            {say && <p key={say} role="status" className="soft-chip play-rise mb-5 !rounded-2xl px-3 py-1.5 text-sm font-semibold">{say}</p>}
            <Pip mood={mood} className="w-20" />
          </div>
          <div
            key={`${mode}-${index}-${level}`}
            onPointerDown={e => {
              skipClick.current = false;
              const cell = (e.target as HTMLElement).closest<HTMLElement>("[data-cell]")?.dataset.cell;
              drag.current = cell === undefined ? null : { from: Number(cell), painted: false };
            }}
            onPointerMove={paint}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
            className="arcade-panel grid touch-none select-none p-2.5 sm:p-3"
            style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))` }}
          >
            {marks.map((mark, i) => <Tile key={i} board={board} index={i} mark={mark} dim={blocked.has(i) && mark !== OWL} wrong={ghost === i} hop={cleared} onPress={press} />)}
          </div>
        </div>
        <div className={`mt-5 grid gap-2 ${mode === "level" ? "grid-cols-2" : "grid-cols-1"}`}>
          <button type="button" onClick={undo} className="arcade-btn arcade-btn--quiet arcade-btn--small">Undo</button>
          {mode === "level" && (
            <button type="button" disabled={!hints} onClick={hint} className="arcade-btn arcade-btn--quiet arcade-btn--small !flex-col !gap-0 leading-tight">
              <span>{hints ? `Hint (${hints} left)` : "No hints left"}</span>
              {hints > 0 && <span className="font-sans text-[11px] font-medium text-[var(--ink-soft)]">costs a star</span>}
            </button>
          )}
        </div>
        <p className="mt-3 text-center text-sm text-[var(--ink-soft)]">Tap to cross, double-tap for an owl. A wrong owl costs a life.</p>
      </div>
    );
  }

  const played = progress ? playedToday(progress, "hoot") : false;
  return (
    <>
      <GameIntro game={game} heading="100 levels" note={played ? "Today's daily challenge is done." : "Plus one ranked daily challenge for the leaderboard."}>
        <button type="button" onClick={ladder.open} className="arcade-btn">Play level {ladder.next}</button>
        <button type="button" onClick={race.open} className="arcade-btn arcade-btn--quiet">Race a friend</button>
        {!played && <button type="button" onClick={() => void beginDaily()} className="arcade-btn arcade-btn--quiet">Daily challenge</button>}
        <AutoDaily slug="hoot" start={() => void beginDaily()} />
        {error && <p role="alert" className="w-full text-sm font-semibold text-[var(--bad)]">{error}</p>}
      </GameIntro>
      <Leaderboard game={game} refresh={0} />
    </>
  );
}
