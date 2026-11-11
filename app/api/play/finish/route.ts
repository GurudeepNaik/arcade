import { browserIdFromCookieHeader, mayUseBrowserCookie } from "@/lib/browser-id";
import { subFromCookies } from "@/lib/games/account";
import { nicknameOf } from "@/lib/games/nickname";
import { gameBySlug } from "@/lib/games/registry";
import { istDay, readRun } from "@/lib/games/run-token";
import { playedToday, saveScore, standingOf, tooManyRuns } from "@/lib/games/scores";
import { scoreRun } from "@/lib/games/verify";
import { networkId, visitorId } from "@/lib/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RUN_LIFETIME_MS = 6 * 60 * 60 * 1000;

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const run = readRun(body?.token, RUN_LIFETIME_MS);
  const game = gameBySlug(run?.game);
  if (!body || !run || !game) return Response.json({ error: "This run has expired" }, { status: 400 });
  const score = scoreRun(run, body, Date.now() - run.startedAt);
  if (score === null) return Response.json({ error: "This run could not be counted" }, { status: 422 });
  if (run.practice) return Response.json({ score, ranked: false, standing: null });

  const h = req.headers;
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = h.get("user-agent");
  const browserId = mayUseBrowserCookie(h.get("x-vercel-ip-country")) ? browserIdFromCookieHeader(h.get("cookie")) : null;
  const visitor = visitorId(browserId, ip, ua);
  const network = networkId(ip, ua);
  const day = istDay();
  try {
    if (await tooManyRuns(network)) return Response.json({ error: "Too many runs. Try again in an hour." }, { status: 429 });
    if (game.daily && (await playedToday(game.slug, visitor, day))) return Response.json({ score, ranked: false, standing: null });
    const sub = subFromCookies(h.get("cookie"));
    const nick = sub ? await nicknameOf(sub).catch(() => null) : null;
    const saved = await saveScore({ game: game.slug, run: run.id, score, visitor, network, day, name: nick?.nickname, player: nick ? sub : null });
    return Response.json({ score, ranked: saved, name: saved && nick ? nick.nickname : null, standing: await standingOf(game, score).catch(() => null) });
  } catch (err) {
    console.error("score not saved", err);
    return Response.json({ score, ranked: false, standing: null });
  }
}
