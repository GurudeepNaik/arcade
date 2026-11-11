import { browserIdFromCookieHeader, mayUseBrowserCookie } from "@/lib/browser-id";
import { recordClick } from "@/lib/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 ? v.slice(0, max) : null);

export async function POST(req: Request): Promise<Response> {
  if (/(^|;\s*)owner=1(;|$)/.test(req.headers.get("cookie") ?? "")) return new Response(null, { status: 204 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }
  const name = str(body.name, 80);
  const path = str(body.path, 200);
  if (!name || !path) return new Response(null, { status: 400 });
  const h = req.headers;
  try {
    await recordClick({
      name,
      href: str(body.href, 300),
      path,
      text: str(body.text, 80),
      ip: h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      ua: h.get("user-agent"),
      browserId: mayUseBrowserCookie(h.get("x-vercel-ip-country")) ? browserIdFromCookieHeader(h.get("cookie")) : null,
    });
  } catch (err) {
    console.error("click not recorded", err);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
