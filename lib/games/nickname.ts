import { connect } from "@/lib/visits";
import { cleanName } from "./names";

// One nickname per signed-in player, used on every leaderboard. Until they pick one, their Google first name stands in.

export interface Nickname { nickname: string; chosen: boolean }

export async function nicknameOf(sub: string): Promise<Nickname | null> {
  const sql = await connect();
  if (!sql) return null;
  const [row] = (await sql`select nickname, name from portfolio.players where sub = ${sub}`) as { nickname: string | null; name: string }[];
  if (!row) return null;
  if (row.nickname) return { nickname: row.nickname, chosen: true };
  // The first name only if it passes the same rules as a typed nickname.
  return { nickname: cleanName(row.name.trim().split(/\s+/)[0]) ?? "Player", chosen: false };
}

/**
 * Scores from this player's browsers that no account owns become theirs: named ones from any day (saved
 * before scores were tied to accounts), and today's unnamed ones (finished just before signing in).
 * Safe to run any number of times.
 */
export async function claimBrowserScores(sub: string): Promise<number> {
  const sql = await connect();
  if (!sql) return 0;
  const rows = (await sql`update portfolio.scores s set player = p.sub, name = coalesce(p.nickname, s.name)
    from portfolio.players p
    where p.sub = ${sub} and s.player is null and s.name is not null and s.visitor = any(p.visitors)
    returning s.id`) as unknown[];
  // Today's daily runs finished in this browser before signing in: put them on today's board too.
  const nick = await nicknameOf(sub);
  const today = (await sql`select (now() at time zone 'Asia/Kolkata')::date::text as d`) as { d: string }[];
  const fresh = nick ? (await sql`update portfolio.scores s set player = p.sub, name = ${nick.nickname}
    from portfolio.players p
    where p.sub = ${sub} and s.player is null and s.name is null and s.day = ${today[0]!.d}::date and s.visitor = any(p.visitors)
    returning s.id`) as unknown[] : [];
  return rows.length + fresh.length;
}

export type SetResult = { nickname: string } | { error: string; status: number };

/** Sets the nickname and renames every score this player already has on the boards. */
export async function setNickname(sub: string, input: unknown): Promise<SetResult> {
  const nickname = cleanName(input);
  if (!nickname) return { error: "Use 2 to 20 letters or numbers, and keep it clean.", status: 422 };
  const sql = await connect();
  if (!sql) return { error: "Couldn't save your nickname.", status: 503 };
  const taken = (await sql`select 1 from portfolio.players where lower(nickname) = lower(${nickname}) and sub <> ${sub} limit 1`) as unknown[];
  if (taken.length) return { error: "Someone already uses that nickname. Try another.", status: 409 };
  await claimBrowserScores(sub);
  try {
    await sql.transaction([
      sql`update portfolio.players set nickname = ${nickname} where sub = ${sub}`,
      sql`update portfolio.scores set name = ${nickname} where player = ${sub}`,
    ]);
  } catch (err) {
    // Two players picking the same name at the same moment: the unique index stops the second.
    if (String((err as Error).message).includes("players_nickname")) return { error: "Someone already uses that nickname. Try another.", status: 409 };
    throw err;
  }
  return { nickname };
}
