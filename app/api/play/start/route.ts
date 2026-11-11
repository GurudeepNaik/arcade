import { gameBySlug } from "@/lib/games/registry";
import { newRun, signRun } from "@/lib/games/run-token";
import { CLUES, DAILY_LEVEL, type SudokuLevel } from "@/lib/games/sudoku";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { game?: unknown; practice?: unknown; level?: unknown } | null;
  const game = gameBySlug(body?.game);
  if (!game?.ranked) return Response.json({ error: "Unknown game" }, { status: 400 });
  const level = typeof body?.level === "string" && body.level in CLUES ? (body.level as SudokuLevel) : DAILY_LEVEL;
  const run = newRun(game, body?.practice === true, level);
  const token = signRun(run);
  if (!token) return Response.json({ error: "Games are not set up" }, { status: 503 });
  return Response.json({ token, seed: run.seed, level: run.level });
}
