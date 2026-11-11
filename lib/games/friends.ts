import { randomBytes } from "node:crypto";
import { connect } from "@/lib/visits";
import { BOARD_SIZE, type BoardRow } from "./scores";
import type { Game } from "./registry";

// Friends are signed-in players who opened each other's invite link. Friendship goes both ways.

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i: codes get read aloud
export const cleanCode = (v: unknown): string | null => (typeof v === "string" && /^[a-z2-9]{8}$/.test(v) ? v : null);

function newCode(): string {
  return [...randomBytes(8)].map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/** The player's invite code, made on first use. */
export async function friendCode(sub: string): Promise<string | null> {
  const sql = await connect();
  if (!sql) return null;
  const [row] = (await sql`select friend_code from portfolio.players where sub = ${sub}`) as { friend_code: string | null }[];
  if (!row) return null;
  if (row.friend_code) return row.friend_code;
  for (let i = 0; i < 3; i++) {
    const code = newCode();
    const set = (await sql`update portfolio.players set friend_code = ${code} where sub = ${sub} and friend_code is null
      and not exists (select 1 from portfolio.players where friend_code = ${code}) returning friend_code`) as { friend_code: string }[];
    if (set[0]) return set[0].friend_code;
    const again = (await sql`select friend_code from portfolio.players where sub = ${sub}`) as { friend_code: string | null }[];
    if (again[0]?.friend_code) return again[0].friend_code;
  }
  return null;
}

/** Only the first name: shown to someone who opened the link before signing in. */
export async function inviterName(code: string): Promise<string | null> {
  const sql = await connect();
  if (!sql) return null;
  const [row] = (await sql`select name from portfolio.players where friend_code = ${code}`) as { name: string }[];
  return row ? firstName(row.name) : null;
}

export type AddResult = { friend: string } | { error: "unknown" | "self" };

export async function addFriend(sub: string, code: string): Promise<AddResult> {
  const sql = await connect();
  if (!sql) return { error: "unknown" };
  const [other] = (await sql`select sub, name from portfolio.players where friend_code = ${code}`) as { sub: string; name: string }[];
  if (!other) return { error: "unknown" };
  if (other.sub === sub) return { error: "self" };
  await sql`insert into portfolio.friends (a, b) values (${sub}, ${other.sub}), (${other.sub}, ${sub}) on conflict do nothing`;
  return { friend: firstName(other.name) };
}

export async function listFriends(sub: string): Promise<{ name: string; picture: string }[]> {
  const sql = await connect();
  if (!sql) return [];
  const rows = (await sql`select p.name, p.picture from portfolio.friends f join portfolio.players p on p.sub = f.b
    where f.a = ${sub} order by f.at desc limit 100`) as { name: string; picture: string }[];
  return rows.map(r => ({ name: firstName(r.name), picture: r.picture }));
}

/** You and your friends, best score each, under the nickname each chose for the boards. */
export async function friendsBoard(game: Game, sub: string, day: string): Promise<(BoardRow & { me: boolean })[]> {
  const sql = await connect();
  if (!sql) return [];
  const direction = sql.unsafe(game.lowerIsBetter ? "asc" : "desc");
  return (await sql`select name, score, player = ${sub} as me from (
      select distinct on (player) player, name, score, at from portfolio.scores
      where game = ${game.slug} and day = ${day} and name is not null
        and player in (select ${sub} union select b from portfolio.friends where a = ${sub})
      order by player, score ${direction}, at
    ) best order by score ${direction}, at limit ${BOARD_SIZE}`) as (BoardRow & { me: boolean })[];
}
