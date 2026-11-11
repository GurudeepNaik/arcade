import { randomBytes, randomInt } from "node:crypto";
import { connect } from "@/lib/visits";
import { RoomError, type Room } from "./ludo-room";
import type { Race } from "./race-room";

type Stored = Room | Race;
const isRace = (stored: Stored): stored is Race => (stored as Race).kind === "race";

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // nothing that reads like another character
const CODE_LENGTH = 6;
const SAVE_ATTEMPTS = 5;
const MAX_NEW_TABLES_PER_HOUR = 20;

export const newCode = () => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
export const newSecret = () => randomBytes(18).toString("base64url");
export const chance = () => randomInt(2 ** 32) / 2 ** 32;
export const cleanCode = (code: unknown) => (typeof code === "string" ? code.trim().toUpperCase().slice(0, CODE_LENGTH) : "");

async function database() {
  const sql = await connect();
  if (!sql) throw new RoomError(503, "Live games aren't set up.");
  return sql;
}

async function loadStored(code: string): Promise<{ room: Stored; version: number } | null> {
  const sql = await database();
  const rows = (await sql`select room, version from portfolio.ludo_rooms where code = ${code}`) as { room: Stored; version: number }[];
  return rows[0] ?? null;
}

export async function loadRoom(code: string): Promise<{ room: Room; version: number } | null> {
  const found = await loadStored(code);
  return found && !isRace(found.room) ? { room: found.room, version: found.version } : null;
}

export async function loadRace(code: string): Promise<{ room: Race; version: number } | null> {
  const found = await loadStored(code);
  return found && isRace(found.room) ? { room: found.room, version: found.version } : null;
}

/** Stores a new table and clears out tables from previous days. */
export async function insertRoom(room: Stored, network: string): Promise<void> {
  const sql = await database();
  await sql`delete from portfolio.ludo_rooms where created_at < now() - interval '1 day'`;
  const [recent] = (await sql`select count(*)::int as tables from portfolio.ludo_rooms where network = ${network} and created_at > now() - interval '1 hour'`) as { tables: number }[];
  if ((recent?.tables ?? 0) >= MAX_NEW_TABLES_PER_HOUR) throw new RoomError(429, "Too many new tables. Try again in an hour.");
  await sql`insert into portfolio.ludo_rooms (code, room, network) values (${room.code}, ${JSON.stringify(room)}::jsonb, ${network})`;
}

/** Saves only if nobody else changed the table first. Null means they did. */
export async function saveRoom(room: Stored, version: number): Promise<number | null> {
  const sql = await database();
  const rows = (await sql`update portfolio.ludo_rooms set room = ${JSON.stringify(room)}::jsonb, version = version + 1, updated_at = now()
    where code = ${room.code} and version = ${version} returning version`) as { version: number }[];
  return rows[0]?.version ?? null;
}

/** Applies a change to the latest table, trying again if two players acted at the same moment. */
export async function changeRoom(code: string, change: (room: Room) => Room): Promise<{ room: Room; version: number }> {
  return changeStored(code, loadRoom, change, "That table doesn't exist. Check the code.");
}

export async function changeRace(code: string, change: (race: Race) => Race): Promise<{ room: Race; version: number }> {
  return changeStored(code, loadRace, change, "That race doesn't exist. Check the code.");
}

async function changeStored<T extends Stored>(code: string, load: (code: string) => Promise<{ room: T; version: number } | null>, change: (room: T) => T, missing: string): Promise<{ room: T; version: number }> {
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
    const current = await load(code);
    if (!current) throw new RoomError(404, missing);
    const room = change(current.room);
    const version = await saveRoom(room, current.version);
    if (version !== null) return { room, version };
  }
  throw new RoomError(409, "The table is busy. Try again.");
}
