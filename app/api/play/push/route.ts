import { subFromCookies } from "@/lib/games/account";
import { cleanSubscription, removeSubscription, saveSubscription } from "@/lib/games/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Turns streak reminders on for this device. Signed-in players only. */
export async function POST(req: Request): Promise<Response> {
  const sub = subFromCookies(req.headers.get("cookie"));
  if (!sub) return Response.json({ error: "Sign in to get reminders" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { subscription?: unknown } | null;
  const subscription = cleanSubscription(body?.subscription);
  if (!subscription) return Response.json({ error: "This browser sent a subscription we can't use." }, { status: 400 });
  try {
    await saveSubscription(sub, subscription);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("push subscription not saved", err);
    return Response.json({ error: "Couldn't turn on reminders. Try again." }, { status: 500 });
  }
}

export async function DELETE(req: Request): Promise<Response> {
  const sub = subFromCookies(req.headers.get("cookie"));
  if (!sub) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint !== "string") return Response.json({ error: "No subscription given" }, { status: 400 });
  await removeSubscription(sub, body.endpoint).catch(() => undefined);
  return new Response(null, { status: 204 });
}
