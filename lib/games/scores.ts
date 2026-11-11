import { connect } from "@/lib/visits";
import { games, type Game, type GameSlug } from "./registry";
export { cleanName } from "./names";

export interface Standing { betterThan: number; players: number }
export interface BoardRow { name: string; score: number }
export type BoardScope = "today" | "all";

const MAX_RUNS_PER_HOUR = 40;
export const BOARD_SIZE = 10;
export async function tooManyRuns(network: string): Promise<boolean> {
  const sql = await connect();
  if (!sql) return false;
  const [row] = (await sql`select count(*)::int as runs from portfolio.scores where network = ${network} and at > now() - interval '1 hour'`) as { runs: number }[];
  return (row?.runs ?? 0) >= MAX_RUNS_PER_HOUR;
}

export async function playedToday(game: GameSlug, visitor: string, day: string): Promise<boolean> {
  const sql = await connect();
  if (!sql) return false;
  const rows = (await sql`select 1 from portfolio.scores where game = ${game} and visitor = ${visitor} and day = ${day} limit 1`) as unknown[];
  return rows.length > 0;
}

/** False when this run was already saved, so one run cannot be submitted twice. */
export async function saveScore(s: { game: GameSlug; run: string; score: number; visitor: string; network: string; day: string; name?: string | null; player?: string | null }): Promise<boolean> {
  const sql = await connect();
  if (!sql) return false;
  const rows = (await sql`insert into portfolio.scores (game, run, score, visitor, network, day, name, player)
    values (${s.game}, ${s.run}, ${s.score}, ${s.visitor}, ${s.network}, ${s.day}, ${s.name ?? null}, ${s.player ?? null})
    on conflict (run) do nothing returning id`) as unknown[];
  return rows.length > 0;
}

export async function standingOf(game: Game, score: number): Promise<Standing | null> {
  const sql = await connect();
  if (!sql) return null;
  const [row] = (await sql`select count(*)::int as players,
      count(*) filter (where case when ${game.lowerIsBetter} then score > ${score} else score < ${score} end)::int as worse
    from portfolio.scores where game = ${game.slug}`) as { players: number; worse: number }[];
  if (!row || row.players === 0) return null;
  return { players: row.players, betterThan: Math.round((row.worse / row.players) * 100) };
}

export async function saveName(run: string, name: string, player: string): Promise<boolean> {
  const sql = await connect();
  if (!sql) return false;
  const rows = (await sql`update portfolio.scores set name = ${name}, player = ${player} where run = ${run} and name is null returning id`) as unknown[];
  return rows.length > 0;
}

/** Each name appears once, with its best score. */
export async function leaderboard(game: Game, scope: BoardScope, day: string): Promise<BoardRow[]> {
  const sql = await connect();
  if (!sql) return [];
  const direction = sql.unsafe(game.lowerIsBetter ? "asc" : "desc");
  return (await sql`select name, score from (
      select distinct on (coalesce(player, 'name:' || lower(name))) name, score, at from portfolio.scores
      where game = ${game.slug} and name is not null and (${scope === "all"} or day = ${day})
      order by coalesce(player, 'name:' || lower(name)), score ${direction}, at
    ) best order by score ${direction}, at limit ${BOARD_SIZE}`) as BoardRow[];
}


export interface OwnerBoardRow { name: string; score: number; day: string; email: string | null; visitor: string }

/** For the owner's /visits page: each ranked game's all-time board, with the account behind each name. */
export async function ownerBoards(): Promise<{ game: Game; rows: OwnerBoardRow[] }[]> {
  const sql = await connect();
  if (!sql) return [];
  const ranked = games.filter(g => g.ranked);
  return Promise.all(ranked.map(async game => {
    const direction = sql.unsafe(game.lowerIsBetter ? "asc" : "desc");
    const rows = (await sql`select name, score, day::text as day, email, visitor from (
        select distinct on (coalesce(s.player, 'name:' || lower(s.name))) s.name, s.score, s.day, s.at, s.visitor, p.email
        from portfolio.scores s left join portfolio.players p on p.sub = s.player
        where s.game = ${game.slug} and s.name is not null
        order by coalesce(s.player, 'name:' || lower(s.name)), s.score ${direction}, s.at
      ) best order by score ${direction}, at limit 25`) as OwnerBoardRow[];
    return { game, rows };
  }));
}
