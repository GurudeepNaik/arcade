import { createHmac, timingSafeEqual } from "node:crypto";
import { connect } from "@/lib/visits";
import { cleanProgress, emptyProgress, mergeProgress, type SavedProgress } from "./saved-progress";

// Optional Google sign-in. Google signs a token in the browser; the server checks it with Google,
// then keeps its own signed cookie so later requests don't go back to Google.

export const SESSION_COOKIE = "player";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365;
export const googleClientId = () => process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export interface Player { sub: string; email: string; name: string; picture: string }
interface GoogleToken { aud: string; iss: string; exp: string; sub: string; email: string; email_verified: string; name?: string; given_name?: string; picture?: string }

/** Checks a Google sign-in token: issued by Google, for this site, unexpired, with a verified email. */
export async function verifyGoogle(credential: unknown): Promise<Player | null> {
  const clientId = googleClientId();
  if (!clientId || typeof credential !== "string" || credential.length > 4096) return null;
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const t = (await res.json()) as GoogleToken;
  const issuer = t.iss === "accounts.google.com" || t.iss === "https://accounts.google.com";
  if (t.aud !== clientId || !issuer || Number(t.exp) * 1000 < Date.now() || t.email_verified !== "true" || !t.sub) return null;
  return { sub: t.sub, email: t.email, name: (t.given_name || t.name || "").slice(0, 20), picture: t.picture ?? "" };
}

function signature(value: string): string | null {
  const secret = process.env.VISITS_SECRET;
  return secret ? createHmac("sha256", `player:${secret}`).update(value).digest("base64url") : null;
}

export function sessionValue(sub: string): string | null {
  const sig = signature(sub);
  return sig && `${sub}.${sig}`;
}

export function subFromCookies(header: string | null): string | null {
  const raw = (header ?? "").match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  const sub = raw.slice(0, dot), given = raw.slice(dot + 1);
  const expected = signature(sub);
  if (!expected || expected.length !== given.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return null;
  return sub;
}

async function database() {
  const sql = await connect();
  if (!sql) throw new Error("No database");
  return sql;
}

/** Creates or updates the player, merges the progress this browser brought, and links this visitor id. */
export async function signIn(player: Player, brought: unknown, visitor: string): Promise<SavedProgress> {
  const sql = await database();
  const rows = (await sql`select progress from portfolio.players where sub = ${player.sub}`) as { progress: unknown }[];
  const merged = mergeProgress(cleanProgress(rows[0]?.progress ?? emptyProgress()), cleanProgress(brought));
  if (!merged.name) merged.name = player.name;
  await sql`insert into portfolio.players (sub, email, name, picture, progress, visitors)
    values (${player.sub}, ${player.email}, ${player.name}, ${player.picture}, ${JSON.stringify(merged)}::jsonb, array[${visitor}])
    on conflict (sub) do update set email = excluded.email, name = excluded.name, picture = excluded.picture, progress = excluded.progress, seen_at = now(),
      visitors = case when ${visitor} = any(portfolio.players.visitors) then portfolio.players.visitors else array_append(portfolio.players.visitors, ${visitor}) end`;
  return merged;
}

export async function loadPlayer(sub: string): Promise<(Player & { progress: SavedProgress }) | null> {
  const sql = await database();
  const rows = (await sql`select sub, email, name, picture, progress from portfolio.players where sub = ${sub}`) as (Player & { progress: unknown })[];
  const row = rows[0];
  return row ? { ...row, progress: cleanProgress(row.progress) } : null;
}

export async function saveProgress(sub: string, brought: unknown): Promise<SavedProgress | null> {
  const current = await loadPlayer(sub);
  if (!current) return null;
  const merged = mergeProgress(current.progress, cleanProgress(brought));
  const sql = await database();
  await sql`update portfolio.players set progress = ${JSON.stringify(merged)}::jsonb, seen_at = now() where sub = ${sub}`;
  return merged;
}

export interface PlayerRow extends Player {
  createdAt: string;
  seenAt: string;
  plays: number;
  levelsCleared: number;
  bestsSet: number;
  visitors: string[];
  nickname: string | null;
  friends: number;
  reminderDevices: number;
}

/** Every signed-in account, newest activity first. For the owner's /visits page only. */
export async function listPlayers(limit = 500): Promise<PlayerRow[]> {
  const sql = await connect();
  if (!sql) return [];
  const rows = (await sql`select p.sub, p.email, p.name, p.picture, p.progress, p.visitors, p.created_at, p.seen_at, p.nickname,
      (select count(*) from portfolio.friends f where f.a = p.sub)::int as friends,
      (select count(*) from portfolio.push_subs s where s.player = p.sub)::int as reminder_devices
    from portfolio.players p order by p.seen_at desc limit ${limit}`) as (Player & { progress: unknown; visitors: string[]; created_at: string; seen_at: string; nickname: string | null; friends: number; reminder_devices: number })[];
  return rows.map(r => {
    const p = cleanProgress(r.progress);
    return {
      sub: r.sub, email: r.email, name: r.name, picture: r.picture, visitors: r.visitors,
      createdAt: r.created_at, seenAt: r.seen_at,
      nickname: r.nickname, friends: r.friends, reminderDevices: r.reminder_devices,
      plays: p.plays,
      levelsCleared: Object.values(p.levels).reduce((n, lv) => n + Object.keys(lv ?? {}).length, 0),
      bestsSet: Object.keys(p.best).length,
    };
  });
}
