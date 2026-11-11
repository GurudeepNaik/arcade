import { browserIdFromCookieHeader, mayUseBrowserCookie } from "@/lib/browser-id";
import { cleanEvent, recordEvent } from "@/lib/games/events";
import { parseUa, visitorId } from "@/lib/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sent by the games as beacons. The owner's own play and bots are not recorded. */
export async function POST(req: Request): Promise<Response> {
  const h = req.headers;
  if (/(^|;\s*)owner=1(;|$)/.test(h.get("cookie") ?? "")) return new Response(null, { status: 204 });
  const ua = h.get("user-agent");
  if (parseUa(ua).is_bot) return new Response(null, { status: 204 });
  const event = cleanEvent((await req.json().catch(() => null)) as Record<string, unknown> | null);
  if (!event) return new Response(null, { status: 400 });
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const browserId = mayUseBrowserCookie(h.get("x-vercel-ip-country")) ? browserIdFromCookieHeader(h.get("cookie")) : null;
  try {
    await recordEvent({ ...event, visitor: visitorId(browserId, ip, ua) });
  } catch (err) {
    console.error("game event not recorded", err);
  }
  return new Response(null, { status: 204 });
}
