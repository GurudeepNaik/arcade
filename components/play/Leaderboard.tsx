"use client";

import { useEffect, useState } from "react";
import { loadBoard, type BoardRow } from "@/lib/games/client";
import { formatScore, type Game, type GameSlug } from "@/lib/games/registry";
import { signedIn } from "@/lib/games/store";

type Scope = "today" | "all" | "friends";

const MEDALS = ["var(--gold)", "var(--silver)", "var(--bronze)"];

// Pip's score to beat on each board: a fixed target, labelled as Pip's and never ranked, so a quiet board still has a goal.
const PIP_TARGET: Partial<Record<GameSlug, number>> = { hoot: 240, sudoku: 480, sort: 70, arrows: 150, brain: 600, reflex: 300, lantern: 30 };

type Row = BoardRow & { pip?: boolean };

function withPip(game: Game, rows: BoardRow[]): Row[] {
  const target = PIP_TARGET[game.slug];
  if (target === undefined) return rows;
  const beats = (score: number) => (game.lowerIsBetter ? score < target : score > target);
  const at = rows.findIndex(r => !beats(r.score));
  const pip: Row = { name: "Pip's target", score: target, pip: true };
  return at < 0 ? [...rows, pip] : [...rows.slice(0, at), pip, ...rows.slice(at)];
}

export function Leaderboard({ game, refresh, highlight }: { game: Game; refresh: number; highlight?: string }) {
  const [scope, setScope] = useState<Scope>("today");
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [account, setAccount] = useState(false);

  useEffect(() => setAccount(signedIn()), []);

  useEffect(() => {
    let live = true;
    setFailed(false);
    setRows(null);
    loadBoard(game.slug, scope)
      .then(next => live && setRows(next))
      .catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [game.slug, scope, refresh]);

  const scopes: Scope[] = account ? ["today", "all", "friends"] : ["today", "all"];
  const shown: Row[] = rows ? (scope === "friends" ? rows : withPip(game, rows)) : [];
  let rank = 0;

  return (
    <section aria-labelledby="board-title" className="arcade-panel mt-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="board-title" className="arcade-title text-2xl">Top players</h2>
        <div className="flex rounded-2xl bg-[var(--well)] p-1 text-sm font-semibold">
          {scopes.map(s => (
            <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={`min-h-9 rounded-xl px-3 transition-colors ${scope === s ? "bg-[var(--tile)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]"}`}>
              {s === "today" ? "Today" : s === "all" ? "All time" : "Friends"}
            </button>
          ))}
        </div>
      </div>
      {failed && <p className="mt-4 text-[var(--ink-soft)]">The scores didn&apos;t load. Refresh to try again.</p>}
      {!failed && rows === null && <p className="mt-4 text-[var(--ink-soft)]">Loading scores…</p>}
      {!failed && rows?.length === 0 && (
        <p className="mt-4 text-[var(--ink-soft)]">
          {scope === "friends" ? "No friends on today's board yet. Invite some from the Progress tab on the Arcade page." : scope === "today" ? "Nobody's on the board today. Beat Pip's target and take first place." : "The board is empty. Take first place."}
        </p>
      )}
      {!failed && shown.length > 0 && (
        <ol className="mt-3 grid gap-1.5">
          {shown.map((row, i) => {
            const mine = row.me || (!row.pip && row.name === highlight);
            if (!row.pip) rank += 1;
            const medal = row.pip ? undefined : MEDALS[rank - 1];
            return (
              <li
                key={row.pip ? "pip" : `${row.name}-${i}`}
                className={`play-rise flex items-center gap-3 rounded-2xl px-3 py-2.5 ${row.pip ? "border border-dashed border-[var(--well-2)] text-[var(--ink-soft)]" : mine ? "bg-[var(--g)] text-[var(--on-g)]" : "bg-[var(--well)]"}`}
                style={{ "--delay": `${i * 35}ms` } as React.CSSProperties}
              >
                {row.pip
                  ? <span aria-hidden className="grid size-7 shrink-0 place-items-center text-base">🦉</span>
                  : <span className="arcade-title grid size-7 shrink-0 place-items-center rounded-full text-sm" style={{ background: medal ?? "var(--tile)", color: medal ? "var(--medal-ink)" : "var(--ink)" }}>{rank}</span>}
                <span className="min-w-0 flex-1 truncate font-semibold">{row.name}{row.pip && <span className="sr-only"> (a target to beat, not a player)</span>}</span>
                <span className="arcade-title tabular-nums">{formatScore(game, row.score)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
