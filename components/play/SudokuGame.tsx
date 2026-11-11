"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { finishRun, startRun, type FinishResult } from "@/lib/games/client";
import { starsFromMistakes, sudokuClues } from "@/lib/games/levels";
import { playedToday, readProgress, recordPlay, today, type Progress } from "@/lib/games/progress";
import type { Game } from "@/lib/games/registry";
import { buzz, sfx } from "@/lib/games/sfx";
import { buildSudoku, peers, type SudokuLevel } from "@/lib/games/sudoku";
import { AutoDaily } from "./AutoDaily";
import { GameIntro } from "./GameIntro";
import { Leaderboard } from "./Leaderboard";
import { ResultPanel } from "./ResultPanel";
import { playerStore } from "@/lib/games/store";
import { clockText, useClock } from "./useClock";
import { useLevels } from "./useLevels";
import { useRace, type RaceStart } from "./useRace";
import { levelSeed } from "@/lib/games/challenge";

const SAVE_KEY = "play.sudoku";
const WAVE_MS = 1000;
// Nine equal columns, with a thin spacer track between the three boxes.
const BOARD_TRACKS = "repeat(3, minmax(0, 1fr)) 3px repeat(3, minmax(0, 1fr)) 3px repeat(3, minmax(0, 1fr))";

interface Saved { token: string; seed: number; level: SudokuLevel; clues?: number; practice: boolean; grid: number[]; notes: number[]; startedAt: number; day: string }
type Move = { index: number; value: number; notes: number };

function loadSaved(): Saved | null {
  try {
    const saved = JSON.parse(playerStore().getItem(SAVE_KEY) ?? "null") as Saved | null;
    return saved?.day === today() ? saved : null;
  } catch {
    return null;
  }
}

/** Only the daily grid is kept across refreshes. A level is simply dealt fresh. */
function writeSaved(saved: Saved | null): void {
  if (saved && !saved.token) return;
  try {
    if (saved) playerStore().setItem(SAVE_KEY, JSON.stringify(saved));
    else playerStore().removeItem(SAVE_KEY);
  } catch {
    // Without storage a refresh restarts the grid, nothing worse.
  }
}

const tier = (s: number) => (s < 300 ? "Grandmaster" : s < 480 ? "Expert" : s < 780 ? "Sharp" : s < 1200 ? "Solid" : "Finished!");

function Cell({ value, notes, given, selected, peer, same, conflict, wave, index, onPick }: {
  value: number; notes: number; given: boolean; selected: boolean; peer: boolean; same: boolean; conflict: boolean; wave: boolean; index: number; onPick: (i: number) => void;
}) {
  const row = Math.floor(index / 9), col = index % 9;
  const shade = conflict ? `bg-[var(--alert)] text-[var(--on-alert)] ${selected ? "ring-2 ring-[var(--bad)]" : ""}` : selected ? "clay text-[var(--on-g)]" : same ? "bg-[color-mix(in_srgb,var(--g)_48%,var(--tile))]" : peer ? "bg-[color-mix(in_srgb,var(--g)_20%,var(--tile))]" : given ? "bg-[var(--well-2)]" : "bg-[var(--well)]";
  return (
    <button
      type="button"
      onClick={() => onPick(index)}
      aria-label={`Row ${row + 1}, column ${col + 1}, ${value || "empty"}${given ? ", given" : ""}`}
      style={{ gridColumn: col + Math.floor(col / 3) + 1, gridRow: row + Math.floor(row / 3) + 1, "--delay": `${(row + col) * (wave ? 45 : 14)}ms`, "--c": "var(--g)" } as React.CSSProperties}
      className={`relative grid aspect-square place-items-center rounded-lg transition-colors duration-100 ${shade} ${wave ? "sudoku-wave" : "deal"}`}
    >
      {value ? (
        <span key={value} className={`arcade-title text-[clamp(1.1rem,6vw,1.75rem)] leading-none ${given ? "" : selected ? "" : "g-text"} ${given ? "" : "game-pop"}`}>{value}</span>
      ) : notes ? (
        <span aria-hidden className="grid size-full grid-cols-3 p-px text-[clamp(0.45rem,2vw,0.65rem)] leading-none text-[var(--ink-soft)]">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <span key={n} className="grid place-items-center">{notes & (1 << n) ? n : ""}</span>)}
        </span>
      ) : null}
    </button>
  );
}

export function SudokuGame({ game }: { game: Game }) {
  const [phase, setPhase] = useState<"intro" | "playing" | "saving" | "done">("intro");
  const [run, setRun] = useState<Saved | null>(null);
  const [resume, setResume] = useState<Saved | null>(null);
  const [grid, setGrid] = useState<number[]>([]);
  const [notes, setNotes] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [noteMode, setNoteMode] = useState(false);
  const [wave, setWave] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState<{ result: FinishResult; progress: Progress; newBest: boolean } | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const backToIntro = useCallback(() => setPhase("intro"), []);
  const ladder = useLevels(game, at => beginLevel(at), backToIntro);
  const race = useRace(game, start => beginRace(start), backToIntro);
  const racing = useRef(false);
  const mistakes = useRef(0);
  const history = useRef<Move[]>([]);
  const seconds = useClock(run?.startedAt ?? null, phase === "playing" && !done);
  const board = useMemo(() => (run ? buildSudoku(run.seed, run.clues ?? run.level) : null), [run]);

  useEffect(() => {
    setProgress(readProgress());
    setResume(loadSaved());
  }, []);

  const open = useCallback((saved: Saved) => {
    setRun(saved);
    setGrid(saved.grid);
    setNotes(saved.notes);
    setSelected(null);
    setNoteMode(false);
    setWave(false);
    setDone(false);
    history.current = [];
    mistakes.current = 0;
    setPhase("playing");
  }, []);

  const beginRace = useCallback((start: RaceStart) => {
    racing.current = true;
    open({ token: "", seed: start.seed, clues: start.spec, level: "medium", practice: true, grid: buildSudoku(start.seed, start.spec).puzzle, notes: Array<number>(81).fill(0), startedAt: start.startsAt, day: today() });
  }, [open]);

  const beginLevel = useCallback((at: number) => {
    racing.current = false;
    const seed = levelSeed("sudoku", at);
    const clues = sudokuClues(at);
    open({ token: "", seed, clues, level: "medium", practice: true, grid: buildSudoku(seed, clues).puzzle, notes: Array<number>(81).fill(0), startedAt: Date.now(), day: today() });
  }, [open]);

  const begin = async (practice: boolean, level?: SudokuLevel) => {
    racing.current = false;
    setError("");
    try {
      const started = await startRun("sudoku", { practice, level });
      const { puzzle } = buildSudoku(started.seed, started.level);
      const saved: Saved = { ...started, practice, grid: puzzle, notes: Array<number>(81).fill(0), startedAt: Date.now(), day: today() };
      writeSaved(saved);
      open(saved);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const { report } = race;
  useEffect(() => {
    if (!racing.current || !board) return;
    const blanks = board.puzzle.filter(v => !v).length;
    const right = grid.filter((v, i) => !board.puzzle[i] && v === board.solution[i]).length;
    report(blanks ? right / blanks : 0);
  }, [board, grid, report]);

  const conflicts = useMemo(() => {
    const out = new Set<number>();
    grid.forEach((v, i) => { if (v && peers(i).some(p => grid[p] === v)) out.add(i); });
    return out;
  }, [grid]);

  const finish = useCallback(async (solved: number[]) => {
    if (!run) return;
    setDone(true);
    setWave(true);
    sfx("win");
    if (run.token) writeSaved(null);
    await new Promise(r => setTimeout(r, WAVE_MS));
    if (racing.current) return void race.finish(solved);
    if (ladder.active) return ladder.complete(starsFromMistakes(mistakes.current));
    setPhase("saving");
    const local = Math.round((Date.now() - run.startedAt) / 1000);
    const result = await finishRun(run.token, { grid: solved }).catch((): FinishResult => ({ score: local, ranked: false, standing: null }));
    const saved = recordPlay("sudoku", result.score, true, !run.practice);
    setProgress(saved.progress);
    setFinished({ result, ...saved });
    setPhase("done");
    window.scrollTo({ top: 0 });
  }, [ladder, race, run]);

  const place = useCallback((digit: number) => {
    if (selected === null || !board || done || board.puzzle[selected]) return;
    history.current.push({ index: selected, value: grid[selected]!, notes: notes[selected]! });
    if (noteMode && digit) {
      const next = [...notes];
      next[selected]! ^= 1 << digit;
      setNotes(next);
      sfx("tap");
      if (run) writeSaved({ ...run, grid, notes: next });
      return;
    }
    const nextGrid = [...grid];
    nextGrid[selected] = digit;
    const nextNotes = [...notes];
    nextNotes[selected] = 0;
    if (digit) for (const p of peers(selected)) nextNotes[p]! &= ~(1 << digit);
    setGrid(nextGrid);
    setNotes(nextNotes);
    if (run) writeSaved({ ...run, grid: nextGrid, notes: nextNotes });
    const clash = digit && peers(selected).some(p => nextGrid[p] === digit);
    if (clash) { mistakes.current++; sfx("bad"); buzz([20, 40, 20]); } else if (digit) { sfx("tap"); buzz(8); }
    if (board.solution.every((v, i) => v === nextGrid[i])) void finish(nextGrid);
  }, [board, done, finish, grid, noteMode, notes, run, selected]);

  const undo = useCallback(() => {
    const last = history.current.pop();
    if (!last) return;
    setGrid(g => g.map((v, i) => (i === last.index ? last.value : v)));
    setNotes(n => n.map((v, i) => (i === last.index ? last.notes : v)));
    setSelected(last.index);
  }, []);

  const hint = () => {
    if (!board) return;
    const target = selected !== null && !grid[selected] ? selected : grid.findIndex(v => !v);
    if (target < 0) return;
    setSelected(target);
    mistakes.current++;
    const next = [...grid];
    next[target] = board.solution[target]!;
    history.current.push({ index: target, value: 0, notes: notes[target]! });
    setGrid(next);
    sfx("good");
    if (board.solution.every((v, i) => v === next[i])) void finish(next);
  };

  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key)) return place(Number(e.key));
      if (e.key === "Backspace" || e.key === "Delete" || e.key === "0") return place(0);
      if (e.key.toLowerCase() === "n") return setNoteMode(m => !m);
      const step = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (!step) return;
      e.preventDefault();
      setSelected(s => {
        const next = (s ?? 40) + step;
        return next >= 0 && next < 81 ? next : s;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, place]);

  if (race.element) return race.element;
  if (ladder.element) return ladder.element;
  if (phase === "saving") return <p role="status" className="arcade-title py-24 text-center text-2xl">Checking your grid…</p>;
  if (phase === "done" && finished && run) {
    return <ResultPanel game={game} token={run.token} result={finished.result} tier={tier(finished.result.score)} detail="Today's grid solved" progress={finished.progress} newBest={finished.newBest} onAgain={ladder.open} againLabel="Play levels" />;
  }

  if (phase === "playing" && board) {
    const left = (d: number) => 9 - grid.filter(v => v === d).length;
    const focus = selected === null ? 0 : grid[selected]!;
    const peerSet = new Set(selected === null ? [] : peers(selected));
    return (
      <div className="play-rise">
        {racing.current && race.bar}
        <div className="mb-3 flex items-center justify-between">
          <span className="soft-chip px-3.5 py-1 text-sm font-bold capitalize">{racing.current ? "Race" : ladder.active ? `Level ${ladder.active}` : "Daily challenge"}</span>
          <span className="arcade-title text-3xl tabular-nums" role="timer">{clockText(seconds)}</span>
        </div>
        <div className="arcade-panel grid gap-[2px] p-2 sm:p-3" style={{ gridTemplateColumns: BOARD_TRACKS, gridTemplateRows: "auto auto auto 3px auto auto auto 3px auto auto auto" }}>
          {grid.map((value, i) => (
            <Cell key={i} index={i} value={value} notes={notes[i]!} given={board.puzzle[i] !== 0} selected={selected === i} peer={peerSet.has(i)} same={!!focus && value === focus} conflict={conflicts.has(i)} wave={wave} onPick={setSelected} />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-9 gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
            <button key={d} type="button" disabled={left(d) <= 0} onClick={() => place(d)} aria-label={`Enter ${d}, ${left(d)} left`} className="arcade-btn arcade-btn--quiet !block !h-[3.4rem] !min-h-0 !rounded-2xl !p-0 !text-xl leading-none">
              {d}
              <span className="block font-sans text-[10px] font-medium text-[var(--ink-soft)]">{left(d)}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button type="button" onClick={undo} className="arcade-btn arcade-btn--quiet arcade-btn--small">Undo</button>
          <button type="button" onClick={() => place(0)} className="arcade-btn arcade-btn--quiet arcade-btn--small">Erase</button>
          <button type="button" aria-pressed={noteMode} onClick={() => setNoteMode(m => !m)} className={`arcade-btn arcade-btn--small ${noteMode ? "" : "arcade-btn--quiet"}`}>Notes {noteMode ? "on" : "off"}</button>
        </div>
        {run?.practice && <button type="button" onClick={hint} className="arcade-btn arcade-btn--quiet arcade-btn--small mt-2 w-full">Show one answer</button>}
      </div>
    );
  }

  const played = progress ? playedToday(progress, "sudoku") : false;
  return (
    <>
      <GameIntro game={game} heading="100 levels" note={played ? "Today's daily challenge is done." : "Plus one ranked daily challenge for the leaderboard."}>
        <button type="button" onClick={ladder.open} className="arcade-btn">Play level {ladder.next}</button>
        <button type="button" onClick={race.open} className="arcade-btn arcade-btn--quiet">Race a friend</button>
        {resume ? <button type="button" onClick={() => open(resume)} className="arcade-btn arcade-btn--quiet">Continue daily grid</button>
          : !played && <button type="button" onClick={() => void begin(false)} className="arcade-btn arcade-btn--quiet">Daily challenge</button>}
        <AutoDaily slug="sudoku" start={() => void begin(false)} />
        {error && <p role="alert" className="w-full text-sm font-semibold text-[var(--bad)]">{error}</p>}
      </GameIntro>
      <Leaderboard game={game} refresh={0} />
    </>
  );
}
