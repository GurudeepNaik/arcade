import { timingSafeEqual } from "node:crypto";
import { sendStreakReminders } from "@/lib/games/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called by the Vercel cron in vercel.json at 19:00 IST. Vercel sends CRON_SECRET as a bearer token.

function authorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function GET(req: Request): Promise<Response> {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  try {
    const result = await sendStreakReminders();
    console.log("streak reminders", result);
    return Response.json(result);
  } catch (err) {
    console.error("streak reminders failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
