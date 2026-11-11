import { connect } from "@/lib/visits";
import { gameBySlug, type GameSlug } from "./registry";

// What players do in the Arcade, kept so the owner can see which games get played and where people give up.

export const EVENT_KINDS = ["daily_start", "daily_finish", "level_start", "level_clear", "level_fail", "table_start", "share"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface GameEvent { game: GameSlug; kind: EventKind; level: number | null; visitor: string }

export function cleanEvent(body: Record<string, unknown> | null): Omit<GameEvent, "visitor"> | null {
  const game = gameBySlug(body?.game);
  const kind = EVENT_KINDS.find(k => k === body?.kind);
  if (!game || !kind) return null;
  const level = Number.isInteger(body?.level) && (body!.level as number) >= 1 && (body!.level as number) <= 100 ? (body!.level as number) : null;
  return { game: game.slug, kind, level };
}

export async function recordEvent(event: GameEvent): Promise<void> {
  const sql = await connect();
  if (!sql) return;
  await sql`insert into portfolio.game_events (game, kind, level, visitor) values (${event.game}, ${event.kind}, ${event.level}, ${event.visitor})`;
}

export interface GameStats {
  game: GameSlug;
  players: number;
  dailyStarts: number;
  dailyFinishes: number;
  levelStarts: number;
  levelClears: number;
  levelFails: number;
  tables: number;
  shares: number;
  highestLevel: number | null;
  hardestLevel: number | null; // the level that sent the most players away
  hardestFails: number;
}

/** One row per game. Data-centre and owner traffic is left out, the same way as on the other tabs. */
export async function gameStats(excludedVisitors: string): Promise<GameStats[]> {
  const sql = await connect();
  if (!sql) return [];
  const rows = (await sql`select game,
      count(distinct visitor)::int as players,
      count(*) filter (where kind = 'daily_start')::int as daily_starts,
      count(*) filter (where kind = 'daily_finish')::int as daily_finishes,
      count(*) filter (where kind = 'level_start')::int as level_starts,
      count(*) filter (where kind = 'level_clear')::int as level_clears,
      count(*) filter (where kind = 'level_fail')::int as level_fails,
      count(*) filter (where kind = 'table_start')::int as tables,
      count(*) filter (where kind = 'share')::int as shares,
      max(level) filter (where kind = 'level_clear') as highest_level
    from portfolio.game_events where visitor not in (${sql.unsafe(excludedVisitors)})
    group by game`) as Record<string, number | string | null>[];
  const hardest = (await sql`select distinct on (game) game, level, count(*)::int as fails
    from portfolio.game_events where kind = 'level_fail' and level is not null and visitor not in (${sql.unsafe(excludedVisitors)})
    group by game, level order by game, fails desc, level`) as { game: string; level: number; fails: number }[];
  return rows.map(r => {
    const worst = hardest.find(h => h.game === r.game);
    return {
      game: r.game as GameSlug,
      players: Number(r.players),
      dailyStarts: Number(r.daily_starts),
      dailyFinishes: Number(r.daily_finishes),
      levelStarts: Number(r.level_starts),
      levelClears: Number(r.level_clears),
      levelFails: Number(r.level_fails),
      tables: Number(r.tables),
      shares: Number(r.shares),
      highestLevel: r.highest_level === null ? null : Number(r.highest_level),
      hardestLevel: worst?.level ?? null,
      hardestFails: worst?.fails ?? 0,
    };
  }).sort((a, b) => b.players - a.players);
}

export interface FunnelStep { label: string; count: number }

/**
 * Each step is a subset of the one before, so the percentages read as "of those, how many".
 * `humanVisit` filters portfolio.visits to real people since the log started; the owner is never logged.
 */
export function funnelSql(humanVisit: string): string {
  return `with v as (select visitor, path, at from portfolio.visits where ${humanVisit}),
    visitors as (select distinct visitor from v),
    arcade as (select distinct visitor from v where path = '/play' or path like '/play/%'),
    played as (select distinct e.visitor from portfolio.game_events e join arcade a using (visitor)
      where e.kind in ('daily_start', 'level_start', 'table_start')),
    finished as (select distinct e.visitor from portfolio.game_events e join played p using (visitor)
      where e.kind in ('daily_finish', 'level_clear')),
    signed as (select distinct p.visitor from played p join portfolio.players pl on p.visitor = any(pl.visitors)),
    returned as (select v.visitor from v join played p using (visitor)
      group by v.visitor having count(distinct (v.at at time zone 'Asia/Kolkata')::date) >= 2)
    select (select count(*) from visitors)::int as visitors,
      (select count(*) from arcade)::int as arcade,
      (select count(*) from played)::int as played,
      (select count(*) from finished)::int as finished,
      (select count(*) from signed)::int as signed,
      (select count(*) from returned)::int as returned`;
}

export async function arcadeFunnel(humanVisit: string): Promise<FunnelStep[]> {
  const sql = await connect();
  if (!sql) return [];
  const [r] = (await sql`${sql.unsafe(funnelSql(humanVisit))}`) as Record<string, number>[];
  if (!r) return [];
  return [
    { label: "Visited the site", count: r.visitors! },
    { label: "Opened the Arcade", count: r.arcade! },
    { label: "Started a game", count: r.played! },
    { label: "Finished a level or daily", count: r.finished! },
    { label: "Signed in", count: r.signed! },
    { label: "Came back another day", count: r.returned! },
  ];
}
