"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHAPTER_SIZE, chapterName, LEVEL_COUNT, nextLevel, readLevelStars, saveLevelStars, type Stars } from "@/lib/games/levels";
import { track } from "@/lib/games/client";
import type { Game } from "@/lib/games/registry";
import { sfx } from "@/lib/games/sfx";
import { Confetti } from "./Confetti";
import { Pip } from "./Pip";
import { ShareCard } from "./ShareCard";
import { SavePrompt, worthSaving } from "./SavePrompt";
import { MadeBy } from "./MadeBy";
import { ChallengeButton } from "./ChallengeButton";
import { activeChallenge, readChallenge, type Challenge } from "@/lib/games/challenge";
import { readProgress } from "@/lib/games/progress";
import { readLevelParam, rememberLastPlayed } from "@/lib/games/last-played";

type Outcome = { level: number; stars: Stars | 0; note: string };

function Star({ on, delay = 0, className }: { on: boolean; delay?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`${on ? "star-on" : "star-off"} ${className ?? ""}`} style={{ "--delay": `${delay}ms` } as React.CSSProperties}>
      <path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" strokeLinejoin="round" />
    </svg>
  );
}

function LevelMap({ stars, onPick, onBack }: { stars: Record<number, Stars>; onPick: (level: number) => void; onBack: () => void }) {
  const current = nextLevel(stars);
  const currentNode = useRef<HTMLButtonElement>(null);
  const earned = Object.values(stars).reduce<number>((sum, s) => sum + s, 0);
  const cleared = Object.keys(stars).length;

  // Braces matter: recent browsers return a promise here, and React would call it as a cleanup.
  useEffect(() => {
    currentNode.current?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <div className="play-rise">
      <div className="mb-4 flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="arcade-btn arcade-btn--quiet arcade-btn--small">Back</button>
        <p className="soft-chip px-3.5 py-1 text-sm font-bold">{cleared} of {LEVEL_COUNT} cleared, {earned} stars</p>
      </div>
      {Array.from({ length: LEVEL_COUNT / CHAPTER_SIZE }, (_, chapter) => (
        <section key={chapter} aria-label={`${chapterName(chapter)} levels`} className="arcade-panel mb-5 p-4 sm:p-5">
          <h2 className="arcade-title text-xl">{chapterName(chapter)}</h2>
          <ol className="mt-3 grid grid-cols-5 gap-x-2 gap-y-3">
            {Array.from({ length: CHAPTER_SIZE }, (_, i) => {
              const level = chapter * CHAPTER_SIZE + i + 1;
              const got = stars[level] ?? 0;
              const open = level <= current;
              const here = level === current && !got;
              return (
                <li key={level} className="grid justify-items-center gap-1">
                  <button
                    ref={here ? currentNode : undefined}
                    type="button"
                    disabled={!open}
                    onClick={() => onPick(level)}
                    aria-label={open ? `Level ${level}, ${got} stars` : `Level ${level}, locked`}
                    style={{ "--c": "var(--g)" } as React.CSSProperties}
                    className={`level-node arcade-title ${open ? "clay text-[var(--on-g)]" : "bg-[var(--well)] text-[var(--ink-soft)]"} ${here ? "game-glow" : ""}`}
                  >
                    {level}
                  </button>
                  <span aria-hidden className="flex h-3">{open && [1, 2, 3].map(n => <Star key={n} on={got >= n} className="size-3" />)}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function LevelDone({ game, outcome, versus, onNext, onRetry, onMap }: { game: Game; outcome: Outcome; versus: Challenge | null; onNext: () => void; onRetry: () => void; onMap: () => void }) {
  const won = outcome.stars > 0;
  const finishedAll = won && outcome.level === LEVEL_COUNT;

  useEffect(() => sfx(won ? "win" : "bad"), [won]);

  return (
    <div className="play-rise relative">
      {won && <Confetti />}
      <div className="arcade-panel p-6 text-center sm:p-8">
        <Pip mood={won ? "cheer" : "oops"} className="mx-auto w-32" />
        <h2 className="arcade-title mt-2 text-4xl">{finishedAll ? `All ${LEVEL_COUNT} cleared!` : won ? `Level ${outcome.level} cleared!` : `Level ${outcome.level}`}</h2>
        {won ? (
          <p role="img" aria-label={`${outcome.stars} of 3 stars`} className="mt-4 flex justify-center gap-2">
            {[1, 2, 3].map(n => <Star key={n} on={outcome.stars >= n} delay={n * 170} className={`size-14 ${outcome.stars >= n ? "star-pop" : ""}`} />)}
          </p>
        ) : null}
        {versus && versus.stars > 0 && (
          <p className="soft-chip mx-auto mt-4 w-fit !rounded-2xl px-4 py-2 font-semibold">
            {outcome.stars > versus.stars ? `You beat ${versus.from || "your friend"}: ${outcome.stars} stars to ${versus.stars}!`
              : outcome.stars === versus.stars ? `A tie with ${versus.from || "your friend"}: ${versus.stars} stars each.`
              : `${versus.from || "Your friend"} got ${versus.stars} ${versus.stars === 1 ? "star" : "stars"}. Try again?`}
          </p>
        )}
        <p className="mt-3 text-[var(--ink-soft)]">{outcome.note || (won ? `${game.title}: a new puzzle waits on every level.` : "Try again. You'll get a new puzzle.")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {won && !finishedAll && <button type="button" onClick={onNext} className="arcade-btn">Next level</button>}
          <button type="button" onClick={onRetry} className={`arcade-btn ${won ? "arcade-btn--quiet" : ""}`}>{won ? "Replay" : "Try again"}</button>
          {won && <ShareCard game={game} what={{ level: outcome.level, stars: outcome.stars }} name={readProgress().name} />}
          {won && <ChallengeButton game={game} level={outcome.level} stars={outcome.stars} />}
          <button type="button" onClick={onMap} className="arcade-btn arcade-btn--quiet">Level map</button>
        </div>
        {won && worthSaving(outcome.level) && <SavePrompt reason={`You've reached level ${outcome.level}.`} />}
      </div>
      {won && outcome.level % 5 === 0 && <MadeBy className="mt-4" />}
    </div>
  );
}

/** The ladder every game shares: the map, the current level, and the screen after a level ends. */
export function useLevels(game: Game, start: (level: number) => void, exit: () => void) {
  const [stars, setStars] = useState<Record<number, Stars>>({});
  const [screen, setScreen] = useState<"map" | Outcome | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [versus, setVersus] = useState<Challenge | null>(null);
  const activeRef = useRef<number | null>(null);
  const startRef = useRef(start);
  startRef.current = start;

  useEffect(() => setStars(readLevelStars(game.slug)), [game.slug]);

  const select = useCallback((level: number | null) => {
    activeRef.current = level;
    setActive(level);
  }, []);

  const play = useCallback((level: number) => {
    select(level);
    setScreen(null);
    window.scrollTo({ top: 0 });
    track(game.slug, "level_start", level);
    rememberLastPlayed(game.slug, level);
    startRef.current(level);
  }, [game.slug, select]);

  const open = useCallback(() => {
    select(null);
    setScreen("map");
  }, [select]);

  const complete = useCallback((earned: Stars, note = "") => {
    const level = activeRef.current;
    if (level === null) return;
    const challenge = activeChallenge(game.slug);
    setVersus(challenge);
    // A friend's challenge can be a level this player hasn't reached: play it, but don't let it skip the ladder.
    const reached = level <= nextLevel(readLevelStars(game.slug));
    if (reached) setStars(saveLevelStars(game.slug, level, earned));
    else note = `${note ? `${note} ` : ""}Level ${level} isn't unlocked for you yet, so these stars aren't saved to your ladder.`;
    track(game.slug, "level_clear", level);
    setScreen({ level, stars: earned, note });
    window.scrollTo({ top: 0 });
  }, [game.slug]);

  const fail = useCallback((note = "") => {
    const level = activeRef.current;
    if (level === null) return;
    setVersus(activeChallenge(game.slug));
    track(game.slug, "level_fail", level);
    setScreen({ level, stars: 0, note });
    window.scrollTo({ top: 0 });
  }, [game.slug]);

  // /play/<game>?challenge=…: jump straight into the friend's board once the game has mounted.
  useEffect(() => {
    const challenge = readChallenge(game.slug);
    // /play/<game>?level=N (the Continue card): the player's own level, if they have reached it.
    const own = challenge ? null : readLevelParam();
    const level = challenge?.level ?? (own !== null && own <= nextLevel(readLevelStars(game.slug)) ? own : null);
    if (level === null) return;
    const timer = setTimeout(() => play(level), 0);
    return () => clearTimeout(timer);
  }, [game.slug, play]);

  const element = useMemo(() => {
    if (screen === "map") return <LevelMap stars={stars} onPick={play} onBack={() => { setScreen(null); exit(); }} />;
    if (screen) return <LevelDone game={game} outcome={screen} versus={versus} onNext={() => play(screen.level + 1)} onRetry={() => play(screen.level)} onMap={open} />;
    return null;
  }, [exit, game, open, play, screen, stars, versus]);

  return { active, next: nextLevel(stars), open, complete, fail, resume: select, element };
}
