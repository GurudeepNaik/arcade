import { gameBySlug } from "@/lib/games/registry";
import { istDay } from "@/lib/games/run-token";
import { subFromCookies } from "@/lib/games/account";
import { friendsBoard } from "@/lib/games/friends";
import { leaderboard } from "@/lib/games/scores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const game = gameBySlug(params.get("game"));
  if (!game) return Response.json({ error: "Unknown game" }, { status: 400 });
  if (params.get("scope") === "friends") {
    const sub = subFromCookies(req.headers.get("cookie"));
    if (!sub) return Response.json({ error: "Sign in to see your friends" }, { status: 401 });
    try {
      return Response.json({ rows: await friendsBoard(game, sub, istDay()) }, { headers: { "cache-control": "private, no-store" } });
    } catch (err) {
      console.error("friends board not loaded", err);
      return Response.json({ rows: [] }, { status: 500 });
    }
  }
  const scope = params.get("scope") === "all" ? "all" : "today";
  try {
    return Response.json({ rows: await leaderboard(game, scope, istDay()) });
  } catch (err) {
    console.error("board not loaded", err);
    return Response.json({ rows: [] }, { status: 500 });
  }
}
