import { connect, HUMAN_VISIT } from "@/lib/visits";
import { istDay } from "./run-token";

// Owner-only view of everything the Arcade keeps that the other /visits tabs don't show.

const ABANDONED_MS = 10 * 60 * 1000;

export interface LiveTable { code: string; kind: "ludo" | "race"; game: string; status: string; players: string[]; createdAt: string; updatedAt: string }
export interface ArcadeTotals {
  accounts: number;
  nicknames: number;
  friendPairs: number;
  reminderDevices: number;
  remindersToday: number;
  appOpens: number;
  appOpeners: number;
}

export async function arcadeMonitor(): Promise<{ totals: ArcadeTotals; tables: LiveTable[] } | null> {
  const sql = await connect();
  if (!sql) return null;
  const today = istDay();
  const [totals] = (await sql`select
      (select count(*) from portfolio.players)::int as accounts,
      (select count(*) from portfolio.players where nickname is not null)::int as nicknames,
      (select count(*) from portfolio.friends where a < b)::int as friend_pairs,
      (select count(*) from portfolio.push_subs)::int as reminder_devices,
      (select count(*) from portfolio.push_subs where last_sent = ${today}::date)::int as reminders_today,
      (select count(*) from portfolio.visits where ${sql.unsafe(HUMAN_VISIT)} and query like '%source=app%')::int as app_opens,
      (select count(distinct visitor) from portfolio.visits where ${sql.unsafe(HUMAN_VISIT)} and query like '%source=app%')::int as app_openers`) as Record<string, number>[];

  // Tables and races are deleted a day after they're made, so this is the last 24 hours.
  const rooms = (await sql`select code, room, created_at, updated_at from portfolio.ludo_rooms order by updated_at desc limit 50`) as {
    code: string; room: { kind?: string; game?: string; status: string; seats?: { name: string }[]; players?: { name: string }[] }; created_at: string; updated_at: string;
  }[];
  const tables: LiveTable[] = rooms.map(r => ({
    code: r.code,
    kind: r.room.kind === "race" ? "race" : "ludo",
    game: r.room.kind === "race" ? (r.room.game ?? "") : "ludo",
    // No move for 10 minutes and not finished: everyone left (closed the tab, or a test).
    status: r.room.status !== "over" && Date.now() - new Date(r.updated_at).getTime() > ABANDONED_MS ? "abandoned" : r.room.status,
    players: (r.room.seats ?? r.room.players ?? []).map(p => p.name),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return {
    totals: {
      accounts: totals!.accounts!, nicknames: totals!.nicknames!, friendPairs: totals!.friend_pairs!,
      reminderDevices: totals!.reminder_devices!, remindersToday: totals!.reminders_today!,
      appOpens: totals!.app_opens!, appOpeners: totals!.app_openers!,
    },
    tables,
  };
}
