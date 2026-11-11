import webpush from "web-push";
import { site } from "@/content/site";
import { connect } from "@/lib/visits";
import { istDay } from "./run-token";

// Streak reminders: one push in the evening (IST) to signed-in players whose streak ends at midnight.
// Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.

export interface PushSubscriptionJson { endpoint: string; keys: { p256dh: string; auth: string } }

export function cleanSubscription(v: unknown): PushSubscriptionJson | null {
  const s = v as Partial<PushSubscriptionJson> | null;
  if (!s || typeof s.endpoint !== "string" || !s.endpoint.startsWith("https://") || s.endpoint.length > 1000) return null;
  if (typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string" || s.keys.p256dh.length > 200 || s.keys.auth.length > 100) return null;
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
}

export async function saveSubscription(sub: string, s: PushSubscriptionJson): Promise<void> {
  const sql = await connect();
  if (!sql) throw new Error("No database");
  await sql`insert into portfolio.push_subs (endpoint, player, keys) values (${s.endpoint}, ${sub}, ${JSON.stringify(s.keys)}::jsonb)
    on conflict (endpoint) do update set player = excluded.player, keys = excluded.keys`;
}

export async function removeSubscription(sub: string, endpoint: string): Promise<void> {
  const sql = await connect();
  if (!sql) return;
  await sql`delete from portfolio.push_subs where endpoint = ${endpoint} and player = ${sub}`;
}

const yesterday = () => istDay(new Date(Date.now() - 86_400_000));

/** Sends today's reminders. Safe to run twice: each device gets at most one per day. */
export async function sendStreakReminders(): Promise<{ due: number; sent: number; gone: number; failed: number }> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const sql = await connect();
  if (!sql || !publicKey || !privateKey) throw new Error("Reminders aren't set up");
  webpush.setVapidDetails(`mailto:${site.email}`, publicKey, privateKey);

  const today = istDay();
  // Played yesterday, not yet today: the streak is alive and ends at midnight.
  const due = (await sql`select s.endpoint, s.keys, (p.progress->>'streak')::int as streak
    from portfolio.push_subs s join portfolio.players p on p.sub = s.player
    where p.progress->>'lastDay' = ${yesterday()} and coalesce((p.progress->>'streak')::int, 0) > 0
      and (s.last_sent is null or s.last_sent < ${today}::date)`) as { endpoint: string; keys: PushSubscriptionJson["keys"]; streak: number }[];

  let sent = 0, gone = 0, failed = 0;
  for (const row of due) {
    const payload = JSON.stringify({
      title: `Keep your ${row.streak}-day streak`,
      body: "Play any daily challenge before midnight IST. Today's puzzles are waiting.",
      url: "/play#today",
      tag: "streak",
    });
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: row.keys }, payload, { TTL: 4 * 3600, urgency: "normal" });
      await sql`update portfolio.push_subs set last_sent = ${today}::date where endpoint = ${row.endpoint}`;
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // The browser dropped this subscription; it will never work again.
        await sql`delete from portfolio.push_subs where endpoint = ${row.endpoint}`;
        gone++;
      } else {
        console.error("reminder not sent", status, (err as Error).message);
        failed++;
      }
    }
  }
  return { due: due.length, sent, gone, failed };
}
