"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { brainTier, buildLevelPuzzles, buildPuzzles, ROUNDS, scoreBrain, type BrainAnswer, type Puzzle } from "@/lib/games/brain";
import { finishRun, startRun, type FinishResult } from "@/lib/games/client";
import { BRAIN_LEVEL_ROUNDS, BRAIN_PASS, brainDifficulty, brainStars, brainTimeScale } from "@/lib/games/levels";
import { playedToday as hasPlayed, readProgress, recordPlay, type Progress } from "@/lib/games/progress";
import { buzz, sfx } from "@/lib/games/sfx";
import type { Game } from "@/lib/games/registry";
import { BlockFigure, cellLabel, CellFigure } from "./Figures";
import { AutoDaily } from "./AutoDaily";
import { GameIntro } from "./GameIntro";
import { Leaderboard } from "./Leaderboard";
import { ResultPanel } from "./ResultPanel";
import { useLevels } from "./useLevels";
import { levelSeed } from "@/lib/games/challenge";

const FEEDBACK_MS = 520;

type Finished = { result: FinishResult; correct: number; progress: Progress; newBest: boolean };

function Question({ puzzle }: { puzzle: Puzzle }) {
  if (puzzle.kind === "sequence") {
    return (
      <>
        <h2 className="arcade-title text-xl">What number comes next?</h2>
        <div className="mt-5 grid grid-cols-6 gap-1 font-mono text-[15px] sm:gap-2 sm:text-2xl">
          {puzzle.shown.map((n, i) => <span key={i} className="rounded-lg bg-[var(--well)] py-2 text-center tabular-nums">{n}</span>)}
          <span className="rounded-lg border-2 border-dashed border-[var(--g-deep)] py-2 text-center g-text">?</span>
        </div>
      </>
    );
  }
  if (puzzle.kind === "matrix") {
    return (
      <>
        <h2 className="arcade-title text-xl">Which piece completes the grid?</h2>
        <div className="mx-auto mt-5 grid max-w-64 grid-cols-3 gap-1.5">
          {puzzle.grid.map((cell, i) => <div key={i} className="aspect-square rounded-xl bg-[var(--well)] p-1.5"><CellFigure cell={cell} /></div>)}
          <div className="grid aspect-square place-items-center rounded-lg border-2 border-dashed border-[var(--g-deep)] font-mono text-xl g-text" aria-label="Missing piece">?</div>
        </div>
      </>
    );
  }
  if (puzzle.kind === "rotate") {
    return (
      <>
        <h2 className="arcade-title text-xl">Which one is this shape, only rotated?</h2>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Flipped copies don&apos;t count.</p>
        <div className="mx-auto mt-4 size-36 rounded-lg bg-[var(--well)] p-3"><BlockFigure blocks={puzzle.target} label="Target shape" /></div>
      </>
    );
  }
  return (
    <>
      <h2 className="arcade-title text-xl">{puzzle.question}</h2>
      <ul className="mt-4 space-y-1.5 text-left">
        {puzzle.facts.map(fact => <li key={fact} className="rounded-lg bg-[var(--well)] px-4 py-2">{fact}</li>)}
      </ul>
    </>
  );
}

function OptionFace({ puzzle, index }: { puzzle: Puzzle; index: number }) {
  if (puzzle.kind === "sequence") return <span className="font-mono text-xl tabular-nums">{puzzle.options[index]}</span>;
  if (puzzle.kind === "order") return <span className="font-medium">{puzzle.options[index]}</span>;
  if (puzzle.kind === "matrix") return <span className="mx-auto block size-16"><CellFigure cell={puzzle.options[index]!} /></span>;
  return <span className="mx-auto block size-20"><BlockFigure blocks={puzzle.options[index]!} label={`Option ${index + 1}`} /></span>;
}

const optionName = (puzzle: Puzzle, index: number) =>
  puzzle.kind === "matrix" ? cellLabel(puzzle.options[index]!) : puzzle.kind === "rotate" ? `Option ${index + 1}` : String(puzzle.options[index]);

function Round({ puzzle, round, total, ladderLevel, onAnswer }: { puzzle: Puzzle; round: number; total: number; ladderLevel: number | null; onAnswer: (answer: BrainAnswer) => void }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const shownAt = useRef(0);
  const answered = useRef(false);

  const answer = useCallback((choice: number) => {
    if (answered.current) return;
    answered.current = true;
    const ms = Math.round(performance.now() - shownAt.current);
    setChosen(choice);
    sfx(choice === puzzle.answer ? "good" : "bad");
    buzz(choice === puzzle.answer ? 12 : [20, 40, 20]);
    setTimeout(() => onAnswer({ choice, ms }), FEEDBACK_MS);
  }, [onAnswer, puzzle.answer]);

  useEffect(() => {
    shownAt.current = performance.now();
    const limit = setTimeout(() => answer(-1), puzzle.seconds * 1000);
    return () => clearTimeout(limit);
  }, [answer, puzzle.seconds]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const index = Number(e.key) - 1;
      if (index >= 0 && index < puzzle.options.length) answer(index);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, puzzle.options.length]);

  const threeAcross = puzzle.options.length % 3 === 0;
  return (
    <div className="play-enter">
      <div className="flex items-center justify-between text-sm text-[var(--ink-soft)]">
        <span aria-live="polite">{ladderLevel ? `Level ${ladderLevel}, puzzle` : "Puzzle"} {round} of {total}</span>
        <span>{puzzle.seconds}s</span>
      </div>
      <div aria-hidden className="mt-2 h-3 overflow-hidden rounded-full  bg-[var(--well)]">
        <div className="play-timer h-full rounded-full bg-[var(--g)]" style={{ "--seconds": `${puzzle.seconds}s`, animationPlayState: chosen === null ? "running" : "paused" } as React.CSSProperties} />
      </div>
      <div className="mt-6 arcade-panel p-5 text-center sm:p-6"><Question puzzle={puzzle} /></div>
      <p role="status" className="sr-only">{chosen === null ? "" : chosen === puzzle.answer ? "Correct" : chosen === -1 ? "Out of time" : "Not this time"}</p>
      <div className={`mt-4 grid gap-2 ${threeAcross ? "grid-cols-3" : "grid-cols-2"}`}>
        {puzzle.options.map((_, i) => {
          const state = chosen === null ? "" : i === puzzle.answer ? "play-right" : i === chosen ? "play-wrong" : "opacity-50";
          return (
            <button
              key={i}
              type="button"
              style={{ "--delay": `${i * 45}ms` } as React.CSSProperties}
              disabled={chosen !== null}
              aria-label={optionName(puzzle, i)}
              onClick={() => answer(i)}
              className={`option deal arcade-title min-h-16 p-3 ${state}`}
            >
              <OptionFace puzzle={puzzle} index={i} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BrainGame({ game }: { game: Game }) {
  const [phase, setPhase] = useState<"intro" | "loading" | "playing" | "saving" | "done">("intro");
  const [run, setRun] = useState<{ token: string; seed: number; practice: boolean; ladderLevel?: number } | null>(null);
  const [round, setRound] = useState(0);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [error, setError] = useState("");
  const [playedToday, setPlayedToday] = useState(false);
  const answers = useRef<BrainAnswer[]>([]);
  const puzzles = useMemo(() => {
    if (!run) return [];
    const at = run.ladderLevel;
    return at ? buildLevelPuzzles(run.seed, BRAIN_LEVEL_ROUNDS, brainDifficulty(at), brainTimeScale(at)) : buildPuzzles(run.seed);
  }, [run]);
  const backToIntro = useCallback(() => setPhase("intro"), []);
  const ladder = useLevels(game, at => beginLevel(at), backToIntro);

  useEffect(() => setPlayedToday(hasPlayed(readProgress(), "brain")), []);

  const begin = async (practice: boolean) => {
    setPhase("loading");
    setError("");
    try {
      const started = await startRun("brain", { practice });
      answers.current = [];
      setRun({ ...started, practice });
      setRound(0);
      setPhase("playing");
    } catch (err) {
      setError((err as Error).message);
      setPhase("intro");
    }
  };

  const beginLevel = (at: number) => {
    answers.current = [];
    setRun({ token: "", seed: levelSeed("brain", at), practice: true, ladderLevel: at });
    setRound(0);
    setPhase("playing");
  };

  const finish = useCallback(async () => {
    if (!run) return;
    if (ladder.active) {
      const correct = answers.current.filter((a, i) => a.choice === puzzles[i]!.answer).length;
      const note = `${correct} of ${BRAIN_LEVEL_ROUNDS} correct`;
      return correct >= BRAIN_PASS ? ladder.complete(brainStars(correct), note) : ladder.fail(`${note}. You need ${BRAIN_PASS}.`);
    }
    setPhase("saving");
    const local = scoreBrain(run.seed, answers.current);
    const result = await finishRun(run.token, { answers: answers.current }).catch((): FinishResult => ({ score: local.score, ranked: false, standing: null }));
    const saved = recordPlay("brain", result.score, false, !run.practice);
    setPlayedToday(hasPlayed(saved.progress, "brain"));
    setFinished({ result, correct: local.correct, ...saved });
    setPhase("done");
    window.scrollTo({ top: 0 });
  }, [ladder, puzzles, run]);

  const onAnswer = useCallback((answer: BrainAnswer) => {
    answers.current.push(answer);
    if (answers.current.length === puzzles.length) void finish();
    else setRound(r => r + 1);
  }, [finish, puzzles.length]);

  if (ladder.element) return ladder.element;
  if (phase === "playing" && puzzles[round]) return <Round key={round} puzzle={puzzles[round]} round={round + 1} total={puzzles.length} ladderLevel={ladder.active} onAnswer={onAnswer} />;
  if (phase === "saving") return <p className="arcade-title py-24 text-center text-2xl" role="status">Adding up your score…</p>;
  if (phase === "done" && finished && run) {
    return (
      <ResultPanel
        game={game}
        token={run.token}
        result={finished.result}
        tier={brainTier(finished.result.score)}
        detail={`${finished.correct} of ${ROUNDS} correct`}
        progress={finished.progress}
        newBest={finished.newBest}
        onAgain={ladder.open}
        againLabel="Play levels"
      />
    );
  }

  return (
    <>
      <GameIntro game={game} heading="100 levels" note={playedToday ? "Today's daily challenge is done. A fun score, not a real IQ test." : "Plus one ranked daily challenge for the leaderboard. A fun score, not a real IQ test."}>
        <button type="button" onClick={ladder.open} className="arcade-btn">Play level {ladder.next}</button>
        {!playedToday && <button type="button" disabled={phase === "loading"} onClick={() => void begin(false)} className="arcade-btn arcade-btn--quiet">{phase === "loading" ? "Starting…" : "Daily challenge"}</button>}
        <AutoDaily slug="brain" start={() => void begin(false)} />
        {error && <p role="alert" className="w-full text-sm font-semibold text-[var(--bad)]">{error}</p>}
      </GameIntro>
      <Leaderboard game={game} refresh={0} />
    </>
  );
}

