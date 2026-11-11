"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/lib/games/client";
import { readProgress, rememberName } from "@/lib/games/progress";
import { PlayerName } from "./PlayerName";
import { MAX_RACERS, RACE_LEVELS, raceSpec, type RaceGame, type RaceLevel, type RaceView } from "@/lib/games/race-room";
import type { Game } from "@/lib/games/registry";
import { buzz, sfx } from "@/lib/games/sfx";
import { Confetti } from "./Confetti";
import { Pip } from "./Pip";

const POLL_MS = 1000;
const PROGRESS_EVERY_MS = 1200;
const SEAT_KEY = "play.race.seat.";
const RACER_COLOURS = ["#27b98f", "#ff6b63", "#3fb8f0", "#ffb82e"];

export interface RaceStart { seed: number; spec: number; startsAt: number; round: number }

function storedSeat(code: string): string {
  try { return localStorage.getItem(SEAT_KEY + code) ?? ""; } catch { return ""; }
}
function storeSeat(code: string, secret: string): void {
  try { localStorage.setItem(SEAT_KEY + code, secret); } catch { /* the seat lasts until the page closes */ }
}

async function send(seat: string, body: object): Promise<{ view: RaceView; secret?: string }> {
  const res = await fetch("/api/play/race", { method: "POST", headers: { "content-type": "application/json", "x-seat": seat }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { view: RaceView; secret?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data;
}

const raceTime = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;

/** Everyone's progress during a race, plus the 3-2-1 countdown over the board. */
function RaceBar({ view, startsAt }: { view: RaceView; startsAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  const left = Math.ceil((startsAt - now) / 1000);
  return (
    <>
      {left > 0 && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--mint)]/80 backdrop-blur-sm">
          <p key={left} aria-live="assertive" className="arcade-title game-pop text-[9rem] leading-none text-[var(--g-deep)]">{left}</p>
        </div>
      )}
      <ul aria-label="Race progress" className="soft-chip mb-3 grid gap-1.5 !rounded-2xl p-3">
        {view.players.map((p, i) => (
          <li key={p.name} className="flex items-center gap-2 text-sm font-semibold">
            <span className="w-20 truncate">{i === view.you ? "You" : p.name}</span>
            <span className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--well)]">
              <span className="block h-full origin-left rounded-full transition-transform duration-700" style={{ background: RACER_COLOURS[i], transform: `scaleX(${p.finishedMs !== null ? 1 : p.progress})` }} />
            </span>
            <span className="w-12 text-right tabular-nums">{p.finishedMs !== null ? raceTime(p.finishedMs).slice(0, -2) : `${Math.round(p.progress * 100)}%`}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Invite({ game, code }: { game: Game; code: string }) {
  const [copied, setCopied] = useState(false);
  const link = () => `${location.origin}/play/${game.slug}?race=${code}`;
  const text = `Race me at ${game.title}! Code ${code}`;
  const share = async () => {
    try {
      if (navigator.share) return await navigator.share({ text, url: link() });
      await navigator.clipboard.writeText(`${text} ${link()}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Closing the share sheet lands here, and needs no message.
    }
  };
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-3">
      <button type="button" onClick={() => void share()} className="arcade-btn">{copied ? "Link copied" : "Invite friends"}</button>
      <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} onClick={e => { e.currentTarget.href = `https://wa.me/?text=${encodeURIComponent(`${text} ${link()}`)}`; }} target="_blank" rel="noreferrer" className="arcade-btn arcade-btn--quiet">WhatsApp</a>
    </div>
  );
}

/** Races for Hoot & Seek and Sudoku. The game calls `start` to deal the shared board and `finish` with its answer. */
export function useRace(game: Game, onStart: (start: RaceStart) => void, onExit: () => void) {
  const [open, setOpen] = useState<string | null>(null); // null: not racing; "": new race; code: joining
  const [view, setView] = useState<RaceView | null>(null);
  const [seat, setSeat] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState<RaceLevel>("medium");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [startsAt, setStartsAt] = useState(0);
  const version = useRef(0);
  const dealtRound = useRef(0);
  const lastReport = useRef(0);
  const startRef = useRef(onStart);
  startRef.current = onStart;

  const take = useCallback((next: RaceView) => {
    version.current = next.version;
    if (next.status === "racing") setStartsAt(Date.now() + next.startsInMs);
    setView(next);
  }, []);

  // An invite link opens the race straight away; a saved seat goes back to it after a refresh.
  useEffect(() => {
    setName(readProgress().name);
    const code = new URLSearchParams(location.search).get("race")?.toUpperCase();
    if (!code) return;
    setOpen(code);
    const saved = storedSeat(code);
    setSeat(saved);
    fetch(`/api/play/race?code=${code}`, { headers: { "x-seat": saved } })
      .then(async res => {
        const data = (await res.json().catch(() => ({}))) as { view?: RaceView; error?: string };
        if (!res.ok) return setError(data.error ?? "That race can't be opened.");
        if (data.view && data.view.you !== null) take(data.view);
      })
      .catch(() => setError("That race can't be opened."));
  }, [take]);

  useEffect(() => {
    if (!view) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      fetch(`/api/play/race?code=${view.code}&since=${version.current}`, { headers: { "x-seat": seat } })
        .then(async res => { if (res.status === 200) take(((await res.json()) as { view: RaceView }).view); })
        .catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [seat, take, !!view, view?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new round deals the shared board to this player once.
  useEffect(() => {
    if (!view || view.status !== "racing" || view.seed === null || view.you === null || view.round === dealtRound.current) return;
    dealtRound.current = view.round;
    sfx("good");
    startRef.current({ seed: view.seed, spec: raceSpec(view.game as RaceGame, view.level), startsAt: Date.now() + view.startsInMs, round: view.round });
  }, [view]);

  const act = async (body: object) => {
    setBusy(true);
    setError("");
    try {
      take((await send(seat, { code: view?.code ?? open, ...body })).view);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { view: next, secret } = await send("", open ? { action: "join", code: open, name } : { action: "create", game: game.slug, level, name });
      rememberName(name.trim());
      storeSeat(next.code, secret!);
      setSeat(secret!);
      take(next);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  const leave = () => {
    setOpen(null);
    setView(null);
    dealtRound.current = 0;
    history.replaceState(null, "", location.pathname);
    onExit();
  };

  const report = useCallback((progress: number) => {
    if (!view || view.status !== "racing" || Date.now() - lastReport.current < PROGRESS_EVERY_MS) return;
    lastReport.current = Date.now();
    void send(seat, { action: "progress", code: view.code, progress }).then(r => take(r.view)).catch(() => undefined);
  }, [seat, take, view]);

  const finish = useCallback(async (answer: number[]) => {
    if (!view) return;
    try {
      take((await send(seat, { action: "finish", code: view.code, answer })).view);
      buzz([14, 30, 14]);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [seat, take, view]);

  const me = view && view.you !== null ? view.players[view.you] : null;
  const racing = !!view && view.status === "racing" && !!me && me.finishedMs === null;

  let element: React.ReactNode = null;
  if (open !== null && !view) {
    element = error && open ? (
      <div className="arcade-panel play-rise p-6 text-center">
        <Pip mood="oops" className="mx-auto w-24" />
        <p className="arcade-title mt-2 text-2xl">{error}</p>
        <button type="button" onClick={leave} className="arcade-btn mt-5">Back</button>
      </div>
    ) : (
      <form onSubmit={enter} className="arcade-panel play-rise p-6 text-center sm:p-8">
        <Pip mood="idle" className="mx-auto w-24" />
        <h2 className="arcade-title mt-2 text-3xl">{open ? `Join race ${open}` : `Race a friend at ${game.title}`}</h2>
        <p className="mt-1 text-[var(--ink-soft)]">Same board for everyone. Fastest solve wins.</p>
        <PlayerName id="race-name" name={name} setName={setName} />
        {!open && (
          <fieldset className="mt-5 text-left">
            <legend className="font-semibold">Difficulty</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {RACE_LEVELS.map(l => <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={`arcade-btn arcade-btn--small capitalize ${level === l ? "" : "arcade-btn--quiet"}`}>{l}</button>)}
            </div>
          </fieldset>
        )}
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-[var(--bad)]">{error}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="submit" disabled={busy || name.trim().length < 2} className="arcade-btn">{busy ? "Just a moment…" : open ? "Join race" : "Create race"}</button>
          <button type="button" onClick={leave} className="arcade-btn arcade-btn--quiet">Back</button>
        </div>
      </form>
    );
  } else if (view && view.status === "lobby") {
    element = (
      <div className="arcade-panel play-rise p-6 text-center sm:p-8">
        <Pip mood="idle" className="mx-auto w-24" />
        <p className="mt-2 text-[var(--ink-soft)]">{game.title} race, {view.level}</p>
        <h2 className="arcade-title text-5xl tracking-widest">{view.code}</h2>
        <Invite game={game} code={view.code} />
        <ul className="mt-6 grid gap-2 text-left">
          {view.players.map((p, i) => (
            <li key={p.name} className="deal flex items-center gap-3 rounded-2xl bg-[var(--well)] px-4 py-3 font-semibold">
              <span aria-hidden className="size-5 rounded-full" style={{ background: RACER_COLOURS[i] }} />
              <span className="min-w-0 flex-1 truncate">{p.name}{i === view.you ? " (you)" : ""}</span>
              {i === 0 && <span className="text-sm text-[var(--ink-soft)]">Host</span>}
            </li>
          ))}
          {view.players.length < MAX_RACERS && <li className="rounded-2xl bg-[var(--well)] px-4 py-3 text-[var(--ink-soft)] opacity-70">Up to {MAX_RACERS} can race…</li>}
        </ul>
        {view.host ? (
          <button type="button" disabled={busy || view.players.length < 2} onClick={() => { track(game.slug, "table_start", view.players.length); void act({ action: "start" }); }} className="arcade-btn mt-6">{view.players.length < 2 ? "Waiting for a friend" : `Start the race (${view.players.length})`}</button>
        ) : (
          <p className="mt-6 font-semibold">Waiting for {view.players[0]?.name} to start…</p>
        )}
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-[var(--bad)]">{error}</p>}
      </div>
    );
  } else if (view && !racing && view.status !== "lobby") {
    const order = [...view.players].map((p, i) => ({ ...p, i })).sort((a, b) => (a.place ?? 99) - (b.place ?? 99));
    const won = me?.place === 1;
    element = (
      <div className="relative">
        {won && <Confetti />}
        <div className="arcade-panel play-rise p-6 text-center sm:p-8">
          <Pip mood={won ? "cheer" : "think"} className="mx-auto w-28" />
          <h2 className="arcade-title mt-2 text-4xl">{view.status === "over" ? (won ? "You won the race!" : `${order[0]?.name} wins!`) : "Finished! Waiting for the others…"}</h2>
          <ol className="mt-5 grid gap-2 text-left">
            {order.map(p => (
              <li key={p.name} className="flex items-center gap-3 rounded-2xl bg-[var(--well)] px-4 py-3 font-semibold">
                <span className="arcade-title w-6 text-center">{p.place ?? "–"}</span>
                <span aria-hidden className="size-4 rounded-full" style={{ background: RACER_COLOURS[p.i] }} />
                <span className="min-w-0 flex-1 truncate">{p.i === view.you ? "You" : p.name}</span>
                <span className="tabular-nums">{p.finishedMs !== null ? raceTime(p.finishedMs) : view.status === "over" ? "Didn't finish" : `${Math.round(p.progress * 100)}%`}</span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {view.status === "over" && (view.host ? <button type="button" disabled={busy} onClick={() => void act({ action: "start" })} className="arcade-btn">Rematch on a new board</button> : <p className="w-full font-semibold">Waiting for {view.players[0]?.name} to start a rematch…</p>)}
            <button type="button" onClick={leave} className="arcade-btn arcade-btn--quiet">Leave race</button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-[var(--bad)]">{error}</p>}
        </div>
      </div>
    );
  }

  const bar = racing && view ? <RaceBar view={view} startsAt={startsAt} /> : null;
  return { element, bar, racing, open: () => setOpen(""), report, finish, error };
}
