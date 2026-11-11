"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/games/client";
import { readProgress } from "@/lib/games/progress";
import { readWeek, type WeekTally } from "@/lib/games/week";

function weekQuery(w: WeekTally, name: string, streak: number): string {
  const q = new URLSearchParams({ kind: "week", size: "story", week: w.start, levels: String(w.levels), stars: String(w.stars), plays: String(w.plays), bests: String(w.bests) });
  if (name) q.set("name", name);
  if (streak > 1) q.set("streak", String(streak));
  return q.toString();
}

function ShareWeek({ week, label }: { week: WeekTally; label: string }) {
  const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    const p = readProgress();
    const link = new URL("/play", location.origin).href;
    const text = `My week in The Arcade: ${week.levels} levels, ${week.stars} stars. Can you top it?`;
    track("hoot", "share");
    try {
      const res = await fetch(`/api/play/card?${weekQuery(week, p.name, p.streak)}`);
      const file = new File([await res.blob()], "my-arcade-week.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: `${text} ${link}` });
      else if (navigator.share) await navigator.share({ text, url: link });
      else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
      }
    } catch {
      // Closing the share sheet lands here.
    }
    setBusy(false);
  };
  return <button type="button" disabled={busy} onClick={() => void share()} className="arcade-btn arcade-btn--quiet !min-h-11 w-full !px-5 !text-base sm:w-auto">{busy ? "Making your card…" : label}</button>;
}

function Tiles({ week }: { week: WeekTally }) {
  const items: [number, string][] = [[week.levels, "Levels"], [week.stars, "Stars"], [week.plays, "Games"], [week.bests, "New bests"]];
  return (
    <dl className="mt-3 grid grid-cols-4 gap-2">
      {items.map(([value, label]) => (
        <div key={label} className="rounded-2xl bg-[var(--well)] px-1 py-2.5 text-center">
          <dd className="arcade-title text-2xl tabular-nums">{value}</dd>
          <dt className="text-[11px] text-[var(--ink-soft)]">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

/** Progress tab: this week so far, with a shareable "My week" card. */
export function WeekPanel() {
  const [week, setWeek] = useState<WeekTally | null>(null);
  useEffect(() => setWeek(readWeek().current), []);
  if (!week) return null;
  return (
    <section aria-labelledby="week-title" className="arcade-panel mt-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="week-title" className="arcade-title text-xl">This week</h2>
        {week.plays > 0 && <ShareWeek week={week} label="Share my week" />}
      </div>
      <Tiles week={week} />
      {week.plays === 0 && <p className="mt-2 text-sm text-[var(--ink-soft)]">Nothing yet this week. Weeks start on Monday.</p>}
    </section>
  );
}

const SEEN_KEY = "play.weekRecapSeen";

/** Arcade page, first visit of a new week: last week's numbers and a card to share. Shown once per week. */
export function LastWeekRecap() {
  const [last, setLast] = useState<WeekTally | null>(null);
  useEffect(() => {
    const { last } = readWeek();
    let seen = "";
    try { seen = localStorage.getItem(SEEN_KEY) ?? ""; } catch { /* show it */ }
    if (last && last.plays > 0 && seen !== last.start) setLast(last);
  }, []);
  if (!last) return null;
  const close = () => {
    try { localStorage.setItem(SEEN_KEY, last.start); } catch { /* it shows again next visit */ }
    setLast(null);
  };
  return (
    <section aria-labelledby="recap-title" className="play-rise arcade-panel mt-4 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="recap-title" className="arcade-title text-xl">Your last week</h2>
          <p className="text-sm text-[var(--ink-soft)]">A new week of puzzles starts today.</p>
        </div>
        <button type="button" onClick={close} aria-label="Close the recap" className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--well)] text-lg">×</button>
      </div>
      <Tiles week={last} />
      <div className="mt-3"><ShareWeek week={last} label="Share last week" /></div>
    </section>
  );
}
