import { connect } from "@/lib/visits";
import { games } from "./registry";

// The weekly champion: on each game and each day, the top 10 named players earn 10 points down to 1.
// The most points from Monday to Sunday (India time) takes the week.

export interface Champion { name: string; points: number; podiums: number }

const LOWER_IS_BETTER = games.filter(g => g.lowerIsBetter).map(g => `'${g.slug}'`).join(", ");

export async function weeklyChampion(): Promise<Champion | null> {
  const sql = await connect();
  if (!sql) return null;
  const rows = (await sql`with week as (
      select date_trunc('week', (now() at time zone 'Asia/Kolkata'))::date as monday
    ), best as (
      select game, day, lower(name) as player, min(name) as name,
        min(case when game in (${sql.unsafe(LOWER_IS_BETTER)}) then score else -score end) as ranked
      from portfolio.scores, week
      where name is not null and day >= week.monday
      group by game, day, lower(name)
    ), placed as (
      select name, player, rank() over (partition by game, day order by ranked) as place from best
    )
    select min(name) as name, sum(11 - place)::int as points, count(*) filter (where place <= 3)::int as podiums
    from placed where place <= 10
    group by player order by points desc, podiums desc limit 1`) as Champion[];
  return rows[0] ?? null;
}
