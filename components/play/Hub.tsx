"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LEVEL_COUNT, nextLevel, readLevelStars } from "@/lib/games/levels";
import { playedToday, readProgress, type Progress } from "@/lib/games/progress";
import { formatScore, games, type Game } from "@/lib/games/registry";
import { playerSummary, type PlayerSummary } from "@/lib/games/summary";
import { gameStyle } from "./game-style";
import { Account } from "./Account";
import { BadgeShelf } from "./Badges";
import { ChampionLine } from "./ChampionLine";
import { FriendInvite } from "./Friends";
import { LastWeekRecap } from "./WeekPanel";
import { GameArt } from "./GameArt";
import { HubTabList, useHubTab, type HubTab } from "./HubTabs";
import { InstallCard } from "./InstallApp";
import { ContinueCard } from "./ContinueCard";
import { MadeBy } from "./MadeBy";
import { Pip } from "./Pip";
import { ProgressPanel } from "./ProgressPanel";
import { TodayPanel } from "./TodayPanel";

function untilMidnightIst(): string {
  const ist = Date.now() + 5.5 * 3_600_000;
  const left = 86_400_000 - (ist % 86_400_000);
  return `${Math.floor(left / 3_600_000)}h ${Math.floor((left % 3_600_000) / 60_000)}m`;
}

function Stat({ value, label, onClick }: { value: string | number; label: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="arcade-title block text-xl tabular-nums sm:text-2xl">{value}</span>
      <span className="block text-[11px] leading-tight text-[var(--ink-soft)] sm:text-xs">{label}</span>
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className="hub-stat rounded-2xl px-1 py-2 text-center">{body}</button>
    : <div className="rounded-2xl px-1 py-2 text-center">{body}</div>;
}

function Ladder({ cleared }: { cleared: number }) {
  return (
    <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-[var(--well)]">
      <span className="clay block h-full origin-left rounded-full" style={{ "--c": "var(--g)", transform: `scaleX(${cleared / LEVEL_COUNT})` } as React.CSSProperties} />
    </span>
  );
}

function Status({ game, progress }: { game: Game; progress: Progress | null }) {
  const [level, setLevel] = useState(1);
  useEffect(() => setLevel(nextLevel(readLevelStars(game.slug))), [game.slug]);
  const best = progress?.best[game.slug];
  const done = !!progress && game.daily && playedToday(progress, game.slug);
  return (
    <span className="flex items-center justify-between gap-2">
      <span>Level {level} of {LEVEL_COUNT}</span>
      {done ? <span className="font-semibold text-[var(--good)]">Done today</span> : best !== undefined ? <span>Best {formatScore(game, best)}</span> : null}
    </span>
  );
}

function GamesPanel({ progress, summary }: { progress: Progress | null; summary: PlayerSummary | null }) {
  const [lead, ...rest] = games;
  return (
    <>
      {/* Featured game: a compact banner on phones, a big poster from sm up. */}
      <Link href={`/play/${lead!.slug}`} style={gameStyle(lead!)} className="poster play-rise relative sm:!grid sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <GameArt slug={lead!.slug} className="block aspect-[2/1] w-full object-cover sm:aspect-auto sm:h-full sm:min-h-64" />
        <span className="flex flex-col justify-center gap-2 p-4 sm:gap-3 sm:p-8">
          <span className="flex items-center justify-between gap-2">
            <span className="arcade-title text-3xl sm:text-5xl">{lead!.title}</span>
            <span className="soft-chip shrink-0 px-2.5 py-1 text-xs font-bold g-text sm:hidden">{lead!.badge}</span>
          </span>
          <span className="soft-chip hidden w-fit px-3 py-1 text-sm font-bold g-text sm:order-first sm:block">{lead!.badge}</span>
          <span className="text-sm text-[var(--ink-soft)] sm:text-base"><span className="sm:hidden">{lead!.tagline}</span><span className="hidden sm:inline">{lead!.blurb}</span></span>
          <span className="text-sm text-[var(--ink-soft)]"><Status game={lead!} progress={progress} /><Ladder cleared={summary?.ladders[lead!.slug].cleared ?? 0} /></span>
          <span className="arcade-btn mt-1 w-full sm:w-fit">Play 100 levels</span>
        </span>
      </Link>
      {/* Phones: one game per row, art on the left, like an app list. sm and up: poster cards. */}
      <ul className="mt-3 grid gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {rest.map((game, i) => (
          <li key={game.slug} className="play-rise" style={{ "--delay": `${90 + i * 60}ms` } as React.CSSProperties}>
            <Link href={`/play/${game.slug}`} style={gameStyle(game)} className="poster !flex h-full items-center gap-3 p-2.5 sm:!block sm:p-0">
              <span className="relative block size-[5.5rem] shrink-0 overflow-hidden rounded-[18px] sm:size-auto sm:rounded-none">
                <GameArt slug={game.slug} className="block size-full object-cover sm:aspect-[4/3] sm:h-auto" />
                <span className="soft-chip absolute left-2.5 top-2.5 hidden px-2.5 py-1 text-xs font-bold g-text sm:block">{game.badge}</span>
              </span>
              <span className="block min-w-0 flex-1 sm:p-4">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="arcade-title truncate text-lg sm:text-2xl">{game.title}</span>
                  <span className="shrink-0 text-[11px] font-bold g-text sm:hidden">{game.badge}</span>
                </span>
                <span className="block truncate text-sm text-[var(--ink-soft)]">{game.tagline}</span>
                <span className="mt-1 block text-xs text-[var(--ink-soft)] sm:mt-2 sm:text-sm"><Status game={game} progress={progress} /><Ladder cleared={summary?.ladders[game.slug].cleared ?? 0} /></span>
              </span>
              <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 text-[var(--ink-soft)] sm:hidden" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Hub() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [summary, setSummary] = useState<PlayerSummary | null>(null);
  const [left, setLeft] = useState("");
  const [tab, setTab] = useState<HubTab>("games");
  const select = useHubTab(tab, setTab);

  const refresh = useCallback(() => {
    setProgress(readProgress());
    setSummary(playerSummary());
  }, []);

  useEffect(() => {
    refresh();
    setLeft(untilMidnightIst());
    const timer = setInterval(() => setLeft(untilMidnightIst()), 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const daily = games.filter(g => g.daily);
  const remaining = progress ? daily.filter(g => !playedToday(progress, g.slug)).length : daily.length;
  const show = (t: HubTab) => () => select(t);

  return (
    <div className="relative mx-auto max-w-5xl px-4 pb-8 pt-5 sm:px-6 sm:py-10">
      <span aria-hidden className="moon" />
      <div className="relative grid items-center gap-4 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex items-center gap-3 sm:gap-5">
          <Pip mood="idle" className="w-14 shrink-0 min-[380px]:w-20 sm:w-28" />
          <div className="min-w-0">
            <h1 className="arcade-title whitespace-nowrap text-[2.5rem] leading-none min-[380px]:text-5xl sm:text-7xl">The Arcade</h1>
            <p className="mt-2 text-[var(--ink-soft)] sm:text-lg"><button type="button" onClick={show("today")} className="text-start underline decoration-dotted underline-offset-4 hover:text-[var(--ink)]">{remaining > 0 ? `${remaining} daily ${remaining === 1 ? "challenge" : "challenges"} waiting` : "All done for today"}</button><span className="block min-h-5 text-sm sm:inline sm:min-h-0 sm:text-[length:inherit]">{left && <><span className="hidden sm:inline">, </span>New ones in {left}</>}</span></p>
            <ChampionLine className="mt-2 text-sm" />
          </div>
        </div>
        <div className="arcade-panel grid gap-2 p-3">
          <div className="min-h-[4.9rem]"><Account onChange={refresh} /></div>
          <div className="grid grid-cols-4 gap-1">
            <Stat value={progress?.streak ?? 0} label="Day streak" />
            <Stat value={summary?.cleared ?? 0} label="Levels" onClick={show("progress")} />
            <Stat value={summary?.stars ?? 0} label="Stars" onClick={show("progress")} />
            <Stat value={`${summary?.badges ?? 0}/${summary?.badgeTotal ?? 12}`} label="Badges" onClick={show("badges")} />
          </div>
        </div>
      </div>

      <FriendInvite />
      <LastWeekRecap />

      <HubTabList
        tab={tab}
        onSelect={select}
        labels={{
          games: "Games",
          today: <span className="text-center leading-[1.15] sm:whitespace-nowrap">Daily Challenge <span className="hidden font-semibold opacity-70 sm:inline">{daily.length - remaining}/{daily.length}</span></span>,
          progress: <span className="whitespace-nowrap">Progress <span className="hidden font-semibold opacity-70 min-[400px]:inline">{summary?.cleared ?? 0}</span></span>,
          badges: <span className="whitespace-nowrap">Badges <span className="hidden font-semibold opacity-70 min-[400px]:inline">{summary?.badges ?? 0}</span></span>,
        }}
      />

      <div className="mt-5">
        <div role="tabpanel" id="panel-games" aria-labelledby="tab-games" hidden={tab !== "games"}>
          {/* Unmounted when hidden: GameArt SVGs share gradient ids, and an id inside a hidden panel paints nothing. */}
          {tab === "games" && <ContinueCard />}
          {tab === "games" && <GamesPanel progress={progress} summary={summary} />}
          {tab === "games" && <InstallCard className="mt-6" />}
          {tab === "games" && <MadeBy className="mt-6" />}
        </div>
        <div role="tabpanel" id="panel-today" aria-labelledby="tab-today" hidden={tab !== "today"}>
          {tab === "today" && <TodayPanel progress={progress} left={left} />}
        </div>
        <div role="tabpanel" id="panel-progress" aria-labelledby="tab-progress" hidden={tab !== "progress"}>
          {tab === "progress" && <ProgressPanel progress={progress} summary={summary} />}
        </div>
        <div role="tabpanel" id="panel-badges" aria-labelledby="tab-badges" hidden={tab !== "badges"}>
          {tab === "badges" && <BadgeShelf />}
        </div>
      </div>
    </div>
  );
}
