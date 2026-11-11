"use client";

import { useEffect, useState } from "react";
import { BADGE_EVENT, BADGES, earnedBadgeIds, type Badge, type BadgeIcon } from "@/lib/games/badges";
import { sfx } from "@/lib/games/sfx";

const GLYPHS: Record<BadgeIcon, string> = {
  star: "M12 4.5l2.3 4.7 5.2.8-3.8 3.6.9 5.1L12 16.3l-4.6 2.4.9-5.1-3.8-3.6 5.2-.8z",
  flame: "M12 3.5c1 3 4.5 4.6 4.5 9a4.5 4.5 0 0 1-9 0c0-2 1-3.3 2-4.2.2 1.4.9 2.3 1.8 2.6-.4-2.7-.1-5.3.7-7.4z",
  crown: "M4.5 17.5l-1-9 4.6 3.6L12 5.5l3.9 6.6 4.6-3.6-1 9z",
  bolt: "M13.5 3.5l-7 10h4.8l-1.3 7 7-10.2h-4.8z",
  dice: "M6.5 5.5h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01",
  brain: "M9 5a3 3 0 0 0-3 3 3 3 0 0 0-1 5.5A3 3 0 0 0 9 18a2 2 0 0 0 3 .5 2 2 0 0 0 3-.5 3 3 0 0 0 4-4.5A3 3 0 0 0 18 8a3 3 0 0 0-3-3 2 2 0 0 0-3-.5A2 2 0 0 0 9 5z",
  trophy: "M8 4.5h8v4a4 4 0 0 1-8 0zM8 6.5H5.5a2.5 2.5 0 0 0 2.6 3M16 6.5h2.5a2.5 2.5 0 0 1-2.6 3M12 12.5v3.5M9 19.5h6M10 16h4v3.5h-4z",
  map: "M4.5 6.5l5-2 5 2 5-2v13l-5 2-5-2-5 2zM9.5 4.5v13M14.5 6.5v13",
};

export function BadgeMedal({ badge, earned, className }: { badge: Badge; earned: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <circle cx="12" cy="12" r="11" fill={earned ? badge.colour : "var(--well-2)"} />
      <circle cx="12" cy="12" r="11" fill="url(#medal-shine)" opacity={earned ? 0.5 : 0} />
      <defs><radialGradient id="medal-shine" cx=".35" cy=".25" r=".7"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient></defs>
      <path d={GLYPHS[badge.icon]} fill={badge.icon === "flame" || badge.icon === "star" || badge.icon === "crown" || badge.icon === "bolt" ? "#fff" : "none"} stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity={earned ? 1 : 0.6} />
    </svg>
  );
}

/** The player's badge shelf: earned ones in colour, the rest showing how to get them. */
export function BadgeShelf() {
  const [earned, setEarned] = useState<Set<string> | null>(null);
  useEffect(() => setEarned(earnedBadgeIds()), []);
  const count = earned?.size ?? 0;
  return (
    <section aria-labelledby="badges-title" className="arcade-panel p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="badges-title" className="arcade-title text-2xl">Badges</h2>
        <p className="text-sm text-[var(--ink-soft)]">{count} of {BADGES.length} earned</p>
      </div>
      <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[...BADGES].sort((a, b) => Number(!!earned?.has(b.id)) - Number(!!earned?.has(a.id))).map((badge, i) => {
          const got = !!earned?.has(badge.id);
          return (
            <li key={badge.id} className="deal grid justify-items-center gap-1.5 text-center" style={{ "--delay": `${i * 30}ms` } as React.CSSProperties}>
              <BadgeMedal badge={badge} earned={got} className={`size-14 ${got ? "" : "opacity-70"}`} />
              <span className={`text-xs font-semibold ${got ? "" : "text-[var(--ink-soft)]"}`}>{badge.title}</span>
              <span className="sr-only">{got ? "Earned." : `Locked. ${badge.hint}.`}</span>
              {!got && <span aria-hidden className="text-[11px] leading-tight text-[var(--ink-soft)]">{badge.hint}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const TOAST_MS = 3600;

/** Pops up when a badge is earned anywhere in the Arcade. */
export function BadgeToaster() {
  const [queue, setQueue] = useState<Badge[]>([]);
  useEffect(() => {
    const onBadge = (e: Event) => setQueue(q => [...q, (e as CustomEvent<Badge>).detail]);
    window.addEventListener(BADGE_EVENT, onBadge);
    return () => window.removeEventListener(BADGE_EVENT, onBadge);
  }, []);
  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    sfx("win");
    const timer = setTimeout(() => setQueue(q => q.slice(1)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [current]);
  if (!current) return null;
  return (
    <div role="status" className="badge-toast soft-chip fixed inset-x-4 bottom-5 z-50 mx-auto flex max-w-sm items-center gap-3 !rounded-3xl p-3 pr-5">
      <BadgeMedal badge={current} earned className="size-12 shrink-0" />
      <span>
        <span className="block text-xs font-semibold text-[var(--ink-soft)]">Badge earned</span>
        <span className="arcade-title block text-lg">{current.title}</span>
      </span>
    </div>
  );
}
