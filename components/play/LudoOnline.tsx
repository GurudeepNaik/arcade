"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { currentColour, FINISHED, legalMoves } from "@/lib/games/ludo";
import type { RoomSize, RoomView } from "@/lib/games/ludo-room";
import { track } from "@/lib/games/client";
import { readProgress, rememberName } from "@/lib/games/progress";
import { PlayerName } from "./PlayerName";
import { buzz, sfx } from "@/lib/games/sfx";
import { Confetti } from "./Confetti";
import { Dice } from "./Dice";
import { FILLS, LudoTable, type MovingToken } from "./LudoTable";
import { Pip } from "./Pip";

const POLL_MS = 1000;
const STEP_MS = 150;
const SEAT_KEY = "play.ludo.seat.";
const SIZES: RoomSize[] = [2, 3, 4];

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

function storedSeat(code: string): string {
  try {
    return localStorage.getItem(SEAT_KEY + code) ?? "";
  } catch {
    return "";
  }
}

function storeSeat(code: string, secret: string): void {
  try {
    localStorage.setItem(SEAT_KEY + code, secret);
  } catch {
    // The seat lasts until this page closes.
  }
}

async function send(seat: string, body: object): Promise<{ view: RoomView; secret?: string }> {
  const res = await fetch("/api/play/ludo", { method: "POST", headers: { "content-type": "application/json", "x-seat": seat }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { view: RoomView; secret?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Try again.");
  return data;
}

function Invite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = () => `${location.origin}/play/ludo?room=${code}`;
  const text = `Play Ludo with me! Table ${code}`;

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
      <a href={`https://wa.me/?text=${encodeURIComponent(`${text} `)}`} onClick={e => { e.currentTarget.href = `https://wa.me/?text=${encodeURIComponent(`${text} ${link()}`)}`; }} target="_blank" rel="noreferrer" className="arcade-btn arcade-btn--quiet">WhatsApp</a>
    </div>
  );
}

function Lobby({ view, onStart, busy }: { view: RoomView; onStart: () => void; busy: boolean }) {
  const open = view.size - view.seats.length;
  return (
    <div className="arcade-panel play-rise p-6 text-center sm:p-8">
      <Pip mood="idle" className="mx-auto w-24" />
      <p className="mt-2 text-[var(--ink-soft)]">Table code</p>
      <h2 className="arcade-title text-5xl tracking-widest">{view.code}</h2>
      <Invite code={view.code} />
      <ul className="mt-6 grid gap-2 text-left">
        {view.seats.map((seat, i) => (
          <li key={seat.colour} className="deal flex items-center gap-3 rounded-2xl bg-[var(--well)] px-4 py-3 font-semibold">
            <span aria-hidden className="size-5 rounded-full" style={{ background: FILLS[seat.colour] }} />
            <span className="min-w-0 flex-1 truncate">{seat.name}{seat.colour === view.you ? " (you)" : ""}</span>
            {i === 0 && <span className="text-sm text-[var(--ink-soft)]">Host</span>}
          </li>
        ))}
        {Array.from({ length: open }, (_, i) => <li key={i} className="rounded-2xl bg-[var(--well)] px-4 py-3 text-[var(--ink-soft)] opacity-70">Waiting for a friend…</li>)}
      </ul>
      {view.host ? (
        <button type="button" disabled={busy || view.seats.length < 2} onClick={onStart} className="arcade-btn mt-6">{view.seats.length < 2 ? "Waiting for players" : `Start with ${view.seats.length} players`}</button>
      ) : (
        <p className="mt-6 font-semibold">Waiting for {view.seats[0]?.name} to start…</p>
      )}
    </div>
  );
}

function Setup({ code, onReady, onBack }: { code: string; onReady: (view: RoomView, secret: string) => void; onBack: () => void }) {
  const [name, setName] = useState("");
  const [size, setSize] = useState<RoomSize>(4);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => setName(readProgress().name), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { view, secret } = await send("", code ? { action: "join", code, name } : { action: "create", name, size });
      rememberName(name.trim());
      storeSeat(view.code, secret!);
      onReady(view, secret!);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="arcade-panel play-rise p-6 text-center sm:p-8">
      <Pip mood="idle" className="mx-auto w-24" />
      <h2 className="arcade-title mt-2 text-3xl">{code ? `Join table ${code}` : "Play with friends"}</h2>
      <PlayerName id="ludo-name" name={name} setName={setName} />
      {!code && (
        <fieldset className="mt-5 text-left">
          <legend className="font-semibold">How many players?</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {SIZES.map(n => (
              <button key={n} type="button" aria-pressed={size === n} onClick={() => setSize(n)} className={`arcade-btn ${size === n ? "" : "arcade-btn--quiet"}`}>{n}</button>
            ))}
          </div>
        </fieldset>
      )}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-[var(--bad)]">{error}</p>}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="submit" disabled={busy || name.trim().length < 2} className="arcade-btn">{busy ? "Just a moment…" : code ? "Join table" : "Create table"}</button>
        <button type="button" onClick={onBack} className="arcade-btn arcade-btn--quiet">Back</button>
      </div>
    </form>
  );
}

/** Live Ludo for 2 to 4 people. The server runs the game; this screen shows it and sends taps. */
export function LudoOnline({ code: startCode, onBack }: { code: string; onBack: () => void }) {
  const [view, setView] = useState<RoomView | null>(null);
  const [seat, setSeat] = useState("");
  const [checking, setChecking] = useState(!!startCode);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState<MovingToken | null>(null);
  const [roll, setRoll] = useState(6);
  const [spins, setSpins] = useState(0);
  const lastEvent = useRef<number | null>(null);
  const version = useRef(0);
  const myTurnBefore = useRef(false);

  const code = view?.code ?? startCode;

  const take = useCallback((next: RoomView) => {
    version.current = next.version;
    setView(next);
  }, []);

  // Someone with a saved seat, like after a refresh, goes straight back to the table.
  useEffect(() => {
    if (!startCode) return;
    const saved = storedSeat(startCode);
    setSeat(saved);
    fetch(`/api/play/ludo?code=${startCode}`, { headers: { "x-seat": saved } })
      .then(async res => {
        const data = (await res.json().catch(() => ({}))) as { view?: RoomView; error?: string };
        if (!res.ok) return setError(data.error ?? "That table can't be opened.");
        if (data.view && (saved || data.view.status !== "lobby")) take(data.view);
      })
      .catch(() => setError("That table can't be opened."))
      .finally(() => setChecking(false));
  }, [startCode, take]);

  useEffect(() => {
    if (!code || !view) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      fetch(`/api/play/ludo?code=${code}&since=${version.current}`, { headers: { "x-seat": seat } })
        .then(async res => {
          if (res.status !== 200) return;
          const data = (await res.json()) as { view: RoomView };
          take(data.view);
        })
        .catch(() => undefined); // the next check-in tries again
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [code, seat, take, !!view]); // eslint-disable-line react-hooks/exhaustive-deps

  // New events arrive from the server: spin the dice, then hop the token along its path.
  const event = view?.event;
  useEffect(() => {
    if (!event) return;
    if (lastEvent.current === null) {
      lastEvent.current = event.seq;
      setRoll(event.roll);
      return;
    }
    if (event.seq <= lastEvent.current) return;
    lastEvent.current = event.seq;
    let live = true;
    void (async () => {
      setRoll(event.roll);
      setSpins(s => s + 1);
      sfx("dice");
      if (event.token === null) return;
      await wait(420);
      for (const progress of event.path) {
        if (!live) return;
        setMoving({ colour: event.colour, token: event.token, progress });
        sfx("step");
        await wait(STEP_MS);
      }
      setMoving(null);
      if (/home!/.test(event.note)) { sfx("capture"); buzz([30, 30, 60]); }
    })();
    return () => { live = false; setMoving(null); };
  }, [event]);

  const mine = !!view?.game && view.status === "playing" && currentColour(view.game) === view.you;

  useEffect(() => {
    if (mine && !myTurnBefore.current) { sfx("good"); buzz(16); }
    myTurnBefore.current = mine;
  }, [mine]);

  useEffect(() => {
    if (view?.status === "over") sfx("win");
  }, [view?.status]);

  const act = async (body: object) => {
    setBusy(true);
    setError("");
    try {
      take((await send(seat, { code, ...body })).view);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  if (checking) return <p role="status" className="arcade-title py-24 text-center text-2xl">Finding the table…</p>;
  if (!view) {
    if (error) {
      return (
        <div className="arcade-panel play-rise p-6 text-center">
          <Pip mood="oops" className="mx-auto w-24" />
          <p className="arcade-title mt-2 text-2xl">{error}</p>
          <button type="button" onClick={onBack} className="arcade-btn mt-5">Back</button>
        </div>
      );
    }
    return <Setup code={startCode} onBack={onBack} onReady={(next, secret) => { setSeat(secret); take(next); }} />;
  }

  if (view.status === "lobby") return <><Lobby view={view} busy={busy} onStart={() => { track("ludo", "table_start", view.seats.length); void act({ action: "start" }); }} />{error && <p role="alert" className="mt-3 text-center font-semibold text-[var(--bad)]">{error}</p>}</>;

  const game = view.game!;
  const turn = currentColour(game);
  const nameOf = (colour: number) => view.seats.find(s => s.colour === colour)?.name ?? "";

  if (view.status === "over") {
    const winner = game.winners[0]!;
    const won = winner === view.you;
    return (
      <div className="relative">
        {won && <Confetti />}
        <div className="arcade-panel play-rise p-6 text-center sm:p-8">
          <Pip mood={won ? "cheer" : "think"} className="mx-auto w-32" />
          <h2 className="arcade-title mt-2 text-4xl">{won ? "You won!" : `${nameOf(winner)} wins!`}</h2>
          <ul className="mt-4 grid gap-1.5 text-left">
            {view.seats.map(s => (
              <li key={s.colour} className="flex items-center gap-3 rounded-2xl bg-[var(--well)] px-4 py-2.5 font-semibold">
                <span aria-hidden className="size-4 rounded-full" style={{ background: FILLS[s.colour] }} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span>{game.tokens[s.colour]!.filter(p => p === FINISHED).length} of 4 home</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {view.host ? <button type="button" disabled={busy} onClick={() => void act({ action: "rematch" })} className="arcade-btn">Rematch</button> : <p className="w-full font-semibold">Waiting for {view.seats[0]?.name} to start a rematch…</p>}
            <button type="button" onClick={onBack} className="arcade-btn arcade-btn--quiet">Leave table</button>
          </div>
        </div>
      </div>
    );
  }

  const choosing = mine && view.pending !== null;
  const choices = choosing && view.you !== null ? legalMoves(game, view.you, view.pending!) : [];
  const message = error || (mine ? (choosing ? "Pick a token to move" : "Your turn. Roll the dice!") : event?.note || `${nameOf(turn)}'s turn…`);
  const seconds = Math.max(1, Math.round(view.turnMsLeft / 1000));

  return (
    <div className="play-rise">
      <LudoTable state={game} moving={moving} human={view.you} choices={choices} roll={view.pending ?? roll} onPick={token => void act({ action: "move", token })} />
      <div aria-hidden className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--well)]">
        <div key={`${event?.seq ?? 0}-${turn}`} className="play-timer h-full rounded-full" style={{ "--seconds": `${seconds}s`, background: FILLS[turn] } as React.CSSProperties} />
      </div>
      <div className="arcade-panel mt-3 flex items-center gap-4 p-4">
        <button type="button" disabled={!mine || choosing || busy} onClick={() => void act({ action: "roll" })} aria-label={`Roll the dice. Last roll ${roll}`} className={`shrink-0 rounded-2xl p-2 ${mine && !choosing ? "game-glow" : ""}`}>
          <Dice value={roll} spins={spins} />
        </button>
        <div className="min-w-0 flex-1">
          <p aria-live="polite" className="arcade-title min-h-7 text-xl">{message}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
            {view.seats.map(s => (
              <li key={s.colour} className={`flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors ${s.colour === turn ? "bg-[var(--well-2)]" : "opacity-70"}`}>
                <span className="size-3 rounded-full" style={{ background: FILLS[s.colour] }} />
                {s.colour === view.you ? "You" : s.name} {game.tokens[s.colour]!.filter(p => p === FINISHED).length}/4{s.away ? " away" : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-[var(--ink-soft)]">{view.you === null ? "You're watching this table." : "Run out of time and your turn plays itself."}</p>
    </div>
  );
}
