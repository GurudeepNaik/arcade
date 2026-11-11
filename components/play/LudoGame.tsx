"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyMove, chooseBotMove, COLOUR_NAMES, currentColour, FINISHED, gameOver, legalMoves, newGame, passTurn, rollDie, rollForfeits, type Colour, type LudoState,
} from "@/lib/games/ludo";
import { ludoLevel, starsFromMistakes } from "@/lib/games/levels";
import { readProgress, recordLudo } from "@/lib/games/progress";
import { games, type Game } from "@/lib/games/registry";
import { buzz, sfx } from "@/lib/games/sfx";
import { Dice } from "./Dice";
import { playerStore } from "@/lib/games/store";
import { FILLS, LudoTable, type MovingToken } from "./LudoTable";
import { LudoOnline } from "./LudoOnline";
import { GameArt } from "./GameArt";
import { GameIntro } from "./GameIntro";
import { Pip } from "./Pip";
import { Confetti } from "./Confetti";
import { useLevels } from "./useLevels";

const SAVE_KEY = "play.ludo";
const HUMAN: Colour = 0;
const ROLL_MS = 640;
const BOT_THINK_MS = 520;
const STEP_MS = 150;
type Phase = "setup" | "roll" | "rolling" | "choose" | "moving" | "over";
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

function readSaved(): LudoState | null {
  try {
    return JSON.parse(playerStore().getItem(SAVE_KEY) ?? "null") as LudoState | null;
  } catch {
    return null;
  }
}

function save(state: LudoState | null): void {
  try {
    if (state) playerStore().setItem(SAVE_KEY, JSON.stringify(state));
    else playerStore().removeItem(SAVE_KEY);
  } catch {
    // The game carries on, it just can't be resumed after a refresh.
  }
}

export function LudoGame({ game }: { game: Game }) {
  const [state, setState] = useState<LudoState | null>(null);
  const [resume, setResume] = useState<LudoState | null>(null);
  const [phase, setPhase] = useState<Phase>("setup");
  const [roll, setRoll] = useState(6);
  const [spins, setSpins] = useState(0);
  const [note, setNote] = useState("");
  const [choices, setChoices] = useState<number[]>([]);
  const [moving, setMoving] = useState<MovingToken | null>(null);
  const [wins, setWins] = useState(0);
  const [online, setOnline] = useState<string | null>(null);
  const stateRef = useRef<LudoState | null>(null);
  const skill = useRef(1);
  const backToIntro = useCallback(() => setPhase("setup"), []);
  const ladder = useLevels(game, at => beginLevel(at), backToIntro);

  useEffect(() => {
    setResume(readSaved());
    setWins(readProgress().wins);
    const invited = new URLSearchParams(location.search).get("room");
    if (invited) setOnline(invited.toUpperCase());
  }, []);

  const settle = useCallback((next: LudoState) => {
    stateRef.current = next;
    setState(next);
    save(gameOver(next) ? null : next);
  }, []);

  const start = (players: Colour[], level?: number) => {
    skill.current = level ? ludoLevel(level).skill : 1;
    settle({ ...newGame(players), ladderLevel: level });
    setNote("");
    setChoices([]);
    setPhase("roll");
  };

  const beginLevel = (at: number) => start(ludoLevel(at).rivals === 1 ? [0, 2] : [0, 1, 2, 3], at);

  const freeTable = (players: Colour[]) => {
    ladder.resume(null);
    start(players);
  };

  const continueGame = (saved: LudoState) => {
    ladder.resume(saved.ladderLevel ?? null);
    skill.current = saved.ladderLevel ? ludoLevel(saved.ladderLevel).skill : 1;
    settle(saved);
    setPhase("roll");
  };

  const move = useCallback(async (token: number, value: number) => {
    const before = stateRef.current!;
    const colour = currentColour(before);
    setChoices([]);
    setPhase("moving");
    const result = applyMove(before, token, value);
    for (const progress of result.path) {
      setMoving({ colour, token, progress });
      sfx("step");
      await wait(STEP_MS);
    }
    setMoving(null);
    if (result.captured.length) {
      sfx("capture");
      buzz([30, 30, 60]);
      setNote(colour === HUMAN ? "Sent one home! Roll again." : `${COLOUR_NAMES[colour]} captured ${result.captured.some(c => c.colour === HUMAN) ? "your token" : "a token"}.`);
    } else if (result.finishedToken) {
      sfx("good");
      setNote(`${colour === HUMAN ? "Your" : `${COLOUR_NAMES[colour]}'s`} token made it home.`);
    } else setNote(value === 6 && result.extraTurn ? "Six! Roll again." : "");
    settle(result.state);
    if (gameOver(result.state)) {
      const won = result.state.winners[0] === HUMAN;
      setWins(recordLudo(won).wins);
      sfx(won ? "win" : "bad");
      setPhase("over");
      window.scrollTo({ top: 0 });
      if (result.state.ladderLevel) {
        const rivalsHome = Math.max(...result.state.players.filter(c => c !== HUMAN).map(c => result.state.tokens[c]!.filter(p => p === FINISHED).length));
        if (won) ladder.complete(starsFromMistakes(rivalsHome), rivalsHome ? `Your closest rival got ${rivalsHome} home` : "No rival got a single token home");
        else ladder.fail("A rival got all four home first.");
      }
      return;
    }
    setPhase("roll");
  }, [ladder, settle]);

  const doRoll = useCallback(async () => {
    const current = stateRef.current!;
    const colour = currentColour(current);
    const value = rollDie(current, colour);
    setPhase("rolling");
    setNote("");
    setRoll(value);
    setSpins(s => s + 1);
    sfx("dice");
    await wait(ROLL_MS);
    if (rollForfeits(current, value)) {
      setNote("Three sixes: turn lost.");
      settle(passTurn(current));
      await wait(BOT_THINK_MS);
      return setPhase("roll");
    }
    const options = legalMoves(current, colour, value);
    if (!options.length) {
      if (colour === HUMAN) setNote(value === 6 ? "No move for that six." : "No move. Next player.");
      await wait(colour === HUMAN ? 800 : 300);
      settle(passTurn(current));
      return setPhase("roll");
    }
    if (colour !== HUMAN) {
      await wait(BOT_THINK_MS / 2);
      return void move(chooseBotMove(current, value, skill.current), value);
    }
    const distinct = options.filter((t, i) => options.findIndex(o => current.tokens[colour]![o] === current.tokens[colour]![t]) === i);
    if (distinct.length === 1) return void move(distinct[0]!, value);
    setChoices(options);
    setPhase("choose");
  }, [move, settle]);

  useEffect(() => {
    if (phase !== "roll" || !state || currentColour(state) === HUMAN) return;
    const timer = setTimeout(() => void doRoll(), BOT_THINK_MS);
    return () => clearTimeout(timer);
  }, [doRoll, phase, state]);

  if (online !== null) {
    return <LudoOnline key={online} code={online} onBack={() => { setOnline(null); history.replaceState(null, "", "/play/ludo"); }} />;
  }
  if (ladder.element) return ladder.element;
  if (phase === "setup" || !state) {
    return (
      <GameIntro game={game} heading="Pick your game" note={wins ? `You've won ${wins} ${wins === 1 ? "game" : "games"}.` : "Invite friends, climb the levels, or take on the computer."}>
        {resume && <button type="button" onClick={() => continueGame(resume)} className="arcade-btn">Continue game</button>}
        <button type="button" onClick={() => setOnline("")} className={`arcade-btn ${resume ? "arcade-btn--quiet" : ""}`}>Play with friends</button>
        <button type="button" onClick={ladder.open} className="arcade-btn arcade-btn--quiet">Play level {ladder.next}</button>
        <button type="button" onClick={() => freeTable([0, 2])} className="arcade-btn arcade-btn--quiet">1 rival</button>
        <button type="button" onClick={() => freeTable([0, 1, 2, 3])} className="arcade-btn arcade-btn--quiet">3 rivals</button>
      </GameIntro>
    );
  }

  if (phase === "over") {
    const won = state.winners[0] === HUMAN;
    const next = games.filter(g => g.slug !== "ludo").slice(0, 3);
    return (
      <div className="relative [overflow-x:clip]">
        {won && <Confetti />}
        <div className="arcade-panel play-rise overflow-hidden text-center">
          <GameArt slug="ludo" className="block h-32 w-full  object-cover" />
          <div className="p-6">
            <h2 className="arcade-title text-5xl">{won ? "You won!" : `${COLOUR_NAMES[state.winners[0]!]} wins`}</h2>
            <p className="mt-2 text-[var(--ink-soft)]">{won ? `That's ${wins} ${wins === 1 ? "win" : "wins"} so far.` : "So close. Rematch?"}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => start(state.players)} className="arcade-btn">Play again</button>
              <button type="button" onClick={() => setPhase("setup")} className="arcade-btn arcade-btn--quiet">Change table</button>
            </div>
          </div>
        </div>
        <ul className="mt-6 grid grid-cols-3 gap-3">
          {next.map(g => <li key={g.slug}><Link href={`/play/${g.slug}`} className="poster"><GameArt slug={g.slug} className="block aspect-[4/3] w-full object-cover" /><span className="arcade-title block truncate px-2 py-1.5 text-center text-sm">{g.title}</span></Link></li>)}
        </ul>
      </div>
    );
  }

  const turn = currentColour(state);
  const mine = turn === HUMAN;
  const message = note || (mine ? (phase === "choose" ? "Pick a token to move" : phase === "roll" ? "Your turn. Roll the dice!" : "") : `${COLOUR_NAMES[turn]} is playing…`);

  return (
    <div className="play-rise">
      <LudoTable state={state} moving={moving} human={HUMAN} choices={phase === "choose" ? choices : []} roll={roll} onPick={(token, value) => void move(token, value)} />
      <div className="arcade-panel mt-5 flex items-center gap-4 p-4">
        <button
          type="button"
          disabled={!mine || phase !== "roll"}
          onClick={() => void doRoll()}
          aria-label={`Roll the dice. Last roll ${roll}`}
          className={`shrink-0 rounded-2xl p-2 ${mine && phase === "roll" ? "game-glow" : ""}`}
        >
          <Dice value={roll} spins={spins} />
        </button>
        <Pip mood={/Sent one home|made it home|Six!/.test(note) ? "cheer" : /captured your/.test(note) ? "oops" : mine ? "idle" : "think"} className="hidden w-14 shrink-0 min-[400px]:block" />
        <div className="min-w-0 flex-1">
          <p aria-live="polite" className="arcade-title min-h-7 text-xl">{message}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
            {state.players.map(colour => (
              <li key={colour} className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors ${colour === turn ? "bg-[var(--well-2)]" : "opacity-70"}`}>
                <span className="size-3 rounded-full" style={{ background: FILLS[colour] }} />
                {colour === HUMAN ? "You" : COLOUR_NAMES[colour]} {state.tokens[colour]!.filter(p => p === FINISHED).length}/4
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-[var(--ink-soft)]">Stars are safe squares. Your game saves itself.</p>
    </div>
  );
}

