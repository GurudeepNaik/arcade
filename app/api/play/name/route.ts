import { subFromCookies } from "@/lib/games/account";
import { readRun } from "@/lib/games/run-token";
import { nicknameOf } from "@/lib/games/nickname";
import { saveName } from "@/lib/games/scores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAMING_WINDOW_MS = 8 * 60 * 60 * 1000;

export async function POST(req: Request): Promise<Response> {
  // Only signed-in players go on the boards.
  const sub = subFromCookies(req.headers.get("cookie"));
  if (!sub) return Response.json({ error: "Sign in with Google to put your name on the board." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { token?: unknown; name?: unknown } | null;
  const run = readRun(body?.token, NAMING_WINDOW_MS);
  if (!run) return Response.json({ error: "This run has expired" }, { status: 400 });
  const name = (await nicknameOf(sub).catch(() => null))?.nickname;
  if (!name) return Response.json({ error: "Couldn't find your account. Sign in again." }, { status: 401 });
  try {
    const saved = await saveName(run.id, name, sub);
    return saved ? Response.json({ name }) : Response.json({ error: "This score already has a name" }, { status: 409 });
  } catch (err) {
    console.error("name not saved", err);
    return Response.json({ error: "Could not save your name. Try again." }, { status: 500 });
  }
}
