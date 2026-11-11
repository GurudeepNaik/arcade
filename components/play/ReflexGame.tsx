"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { finishRun, startRun, type FinishResult } from "@/lib/games/client";
import { reflexLevel, reflexStars, type ReflexLevel } from "@/lib/games/levels";
import { recordPlay, type Progress } from "@/lib/games/progress";
import { FASTEST_HUMAN_MS, MAX_WAIT_MS, MIN_WAIT_MS, REFLEX_ROUNDS, reflexTier, scoreReflex, SLOWEST_COUNTED_MS } from "@/lib/games/reflex";
import type { Game } from "@/lib/games/registry";
import { buzz, sfx } from "@/lib/games/sfx";
import { GameIntro } from "./GameIntro";
import { Leaderboard } from "./Leaderboard";
import { ResultPanel } from "./ResultPanel";
import { useLevels } from "./useLevels";

type Stage = "ready" | "waiting" | "decoy" | "go" | "early" | "slow" | "hit";
type Finished = { result: FinishResult; progress: Progress; newBest: boolean };

const SHOW_HIT_MS = 900;
const DECOY_MS = 700;
const DECOY_COLOUR = "#ff7aa2";

export function ReflexGame({ game }: { game: Game }) {
  const [phase, setPhase] = useState<"intro" | "playing" | "saving" | "done">("intro");
  const [stage, setStage] = useState<Stage>("ready");
  const [times, setTimes] = useState<number[]>([]);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [error, setError] = useState("");
  const token = useRef("");
  const wait = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wentGreenAt = useRef(0);
  const spec = useRef<ReflexLevel | null>(null);
  const backToIntro = useCallback(() => setPhase("intro"), []);
  const ladder = useLevels(game, at => beginLevel(at), backToIntro);
  const rounds = spec.current?.rounds ?? REFLEX_ROUNDS;

  useEffect(() => () => clearTimeout(wait.current), []);

  const arm = useCallback(() => {
    setStage("waiting");
    wentGreenAt.current = 0;
    wait.current = setTimeout(() => {
      if (spec.current && Math.random() < spec.current.decoyChance) {
        setStage("decoy");
        wait.current = setTimeout(() => arm(), DECOY_MS);
        return;
      }
      setStage("go");
      // Timed from the frame that paints the change, not from when it was scheduled.
      requestAnimationFrame(() => { wentGreenAt.current = performance.now(); });
    }, MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS));
  }, []);

  const beginLevel = (at: number) => {
    spec.current = reflexLevel(at);
    token.current = "";
    setTimes([]);
    setPhase("playing");
    arm();
  };

  const begin = async () => {
    setError("");
    spec.current = null;
    try {
      token.current = (await startRun("reflex")).token;
      setTimes([]);
      setPhase("playing");
      arm();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const finish = useCallback(async (all: number[]) => {
    if (ladder.active && spec.current) {
      const average = scoreReflex(all);
      const { target } = spec.current;
      const note = `Average ${average} ms, target ${target} ms`;
      return average <= target ? ladder.complete(reflexStars(average, target), note) : ladder.fail(note);
    }
    setPhase("saving");
    const result = await finishRun(token.current, { times: all }).catch((): FinishResult => ({ score: scoreReflex(all), ranked: false, standing: null }));
    setFinished({ result, ...recordPlay("reflex", result.score, true, true) });
    setPhase("done");
    window.scrollTo({ top: 0 });
  }, [ladder]);

  const tap = useCallback(() => {
    if (stage === "waiting" || stage === "decoy") {
      clearTimeout(wait.current);
      sfx("bad");
      buzz([20, 40, 20]);
      setStage("early");
      return;
    }
    if (stage === "early" || stage === "slow") return arm();
    if (stage !== "go" || !wentGreenAt.current) return;
    const ms = Math.round(performance.now() - wentGreenAt.current);
    if (ms < FASTEST_HUMAN_MS) return setStage("early"); // a guess that happened to land
    if (ms > SLOWEST_COUNTED_MS) return setStage("slow");
    sfx("good");
    buzz(12);
    const all = [...times, ms];
    setTimes(all);
    setStage("hit");
    wait.current = setTimeout(() => (all.length === rounds ? void finish(all) : arm()), SHOW_HIT_MS);
  }, [arm, finish, rounds, stage, times]);

  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      tap();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, tap]);

  if (ladder.element) return ladder.element;
  if (phase === "saving") return <p className="arcade-title py-24 text-center text-2xl" role="status">Adding up your score…</p>;
  if (phase === "done" && finished) {
    return (
      <ResultPanel
        game={game}
        token={token.current}
        result={finished.result}
        tier={reflexTier(finished.result.score)}
        detail={`Rounds: ${times.join(", ")} ms`}
        progress={finished.progress}
        newBest={finished.newBest}
        onAgain={() => void begin()}
        againLabel="Go again"
      />
    );
  }

  if (phase === "playing") {
    const go = stage === "go";
    const last = times[times.length - 1];
    const decoy = stage === "decoy";
    const text = stage === "waiting" ? "Wait for it…" : decoy ? "Don't tap!" : go ? "Tap!" : stage === "early" ? "Too soon" : stage === "slow" ? "Too slow" : `${last} ms`;
    const hint = stage === "early" || stage === "slow" ? "Tap to try this round again" : stage === "waiting" ? (spec.current ? `Beat ${spec.current.target} ms. Only tap on green.` : "Tap when this turns green") : "";
    return (
      <button
        type="button"
        onPointerDown={tap}
        aria-live="assertive"
        style={{ "--c": decoy ? DECOY_COLOUR : "var(--g)" } as React.CSSProperties}
        className={`arcade-panel relative grid min-h-[60dvh] w-full touch-manipulation select-none place-items-center overflow-hidden ${decoy ? "clay text-[var(--tile)]" : go ? "clay reflex-go text-[var(--on-g)]" : stage === "early" || stage === "slow" ? "game-shake !bg-[var(--alert)] text-[var(--on-alert)]" : ""}`}
      >
        {go && <span aria-hidden className="reflex-ring" />}
        <span className="absolute left-5 top-4 text-sm font-semibold opacity-70">{ladder.active ? `Level ${ladder.active}, round` : "Round"} {Math.min(times.length + 1, rounds)} of {rounds}</span>
        <span>
          <span className="arcade-title block text-5xl sm:text-6xl">{text}</span>
          {hint && <span className="mt-2 block text-sm opacity-75">{hint}</span>}
        </span>
      </button>
    );
  }

  return (
    <>
      <GameIntro game={game} heading="100 levels" note="Most people land between 250 and 300 ms. Press Space on a keyboard.">
        <button type="button" onClick={ladder.open} className="arcade-btn">Play level {ladder.next}</button>
        <button type="button" onClick={() => void begin()} className="arcade-btn arcade-btn--quiet">Quick test</button>
        {error && <p role="alert" className="w-full text-sm font-semibold text-[var(--bad)]">{error}</p>}
      </GameIntro>
      <Leaderboard game={game} refresh={0} />
    </>
  );
}
