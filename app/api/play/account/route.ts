import { browserIdFromCookieHeader, mayUseBrowserCookie } from "@/lib/browser-id";
import { googleClientId, loadPlayer, saveProgress, SESSION_COOKIE, SESSION_MAX_AGE, sessionValue, signIn, subFromCookies, verifyGoogle } from "@/lib/games/account";
import { claimBrowserScores, nicknameOf, setNickname } from "@/lib/games/nickname";
import { visitorId } from "@/lib/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cookie = (value: string, maxAge: number) => `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;

/** Who is signed in, with their saved progress. 204 when nobody is. */
export async function GET(req: Request): Promise<Response> {
  if (!googleClientId()) return Response.json({ enabled: false });
  const sub = subFromCookies(req.headers.get("cookie"));
  const player = sub ? await loadPlayer(sub).catch(() => null) : null;
  if (!player) return Response.json({ enabled: true, player: null });
  await claimBrowserScores(sub!).catch(err => console.error("scores not claimed", err));
  const nick = await nicknameOf(sub!).catch(() => null);
  return Response.json({ enabled: true, player: { name: player.name, email: player.email, picture: player.picture, nickname: nick?.nickname ?? "", nicknameChosen: !!nick?.chosen }, progress: player.progress });
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { credential?: unknown; progress?: unknown } | null;
  const player = await verifyGoogle(body?.credential).catch(() => null);
  if (!player) return Response.json({ error: "Google sign-in didn't go through. Try again." }, { status: 401 });
  const session = sessionValue(player.sub);
  if (!session) return Response.json({ error: "Sign-in isn't set up." }, { status: 503 });
  const h = req.headers;
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const browserId = mayUseBrowserCookie(h.get("x-vercel-ip-country")) ? browserIdFromCookieHeader(h.get("cookie")) : null;
  try {
    const progress = await signIn(player, body?.progress, visitorId(browserId, ip, h.get("user-agent")));
    await claimBrowserScores(player.sub).catch(err => console.error("scores not claimed", err));
    const nick = await nicknameOf(player.sub).catch(() => null);
    return new Response(JSON.stringify({ player: { name: player.name, email: player.email, picture: player.picture, nickname: nick?.nickname ?? "", nicknameChosen: !!nick?.chosen }, progress }), {
      headers: { "content-type": "application/json", "set-cookie": cookie(session, SESSION_MAX_AGE) },
    });
  } catch (err) {
    console.error("sign-in failed", err);
    return Response.json({ error: "Couldn't save your account. Try again." }, { status: 500 });
  }
}

export async function PUT(req: Request): Promise<Response> {
  const sub = subFromCookies(req.headers.get("cookie"));
  if (!sub) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { progress?: unknown } | null;
  const progress = await saveProgress(sub, body?.progress).catch(() => null);
  return progress ? Response.json({ progress }) : Response.json({ error: "Couldn't save" }, { status: 500 });
}

/** Changes the nickname everywhere: this player's scores on every board are renamed too. */
export async function PATCH(req: Request): Promise<Response> {
  const sub = subFromCookies(req.headers.get("cookie"));
  if (!sub) return Response.json({ error: "Not signed in" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { nickname?: unknown } | null;
  try {
    const out = await setNickname(sub, body?.nickname);
    return "nickname" in out ? Response.json(out) : Response.json({ error: out.error }, { status: out.status });
  } catch (err) {
    console.error("nickname not saved", err);
    return Response.json({ error: "Couldn't save your nickname. Try again." }, { status: 500 });
  }
}

export async function DELETE(): Promise<Response> {
  return new Response(null, { status: 204, headers: { "set-cookie": cookie("", 0) } });
}
