import { RoomError } from "@/lib/games/ludo-room";
import { changeRace, cleanCode, insertRoom, loadRace, newCode, newSecret, saveRoom } from "@/lib/games/ludo-rooms";
import { cleanName } from "@/lib/games/names";
import { closeIfExpired, finishRace, joinRace, newRace, RACE_LEVELS, raceView, reportProgress, startRace, type Race, type RaceGame } from "@/lib/games/race-room";
import { networkId } from "@/lib/visits";
import { randomInt } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEAT_HEADER = "x-seat";
const GAMES: RaceGame[] = ["hoot", "sudoku"];
const newSeed = () => randomInt(2 ** 31);

function failure(err: unknown): Response {
  if (err instanceof RoomError) return Response.json({ error: err.message }, { status: err.status });
  console.error("race failed", err);
  return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
}

const reply = (race: Race, version: number, secret: unknown, extra: object = {}) => Response.json({ view: raceView(race, secret, version, Date.now()), ...extra });

export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const secret = req.headers.get(SEAT_HEADER);
  try {
    const current = await loadRace(cleanCode(params.get("code")));
    if (!current) throw new RoomError(404, "That race doesn't exist. Check the code.");
    let { room, version } = current;
    const closed = closeIfExpired(room, Date.now());
    if (closed) {
      const saved = await saveRoom(closed, version);
      if (saved !== null) { room = closed; version = saved; }
    }
    if (Number(params.get("since")) === version) return new Response(null, { status: 204 });
    return reply(room, version, secret);
  } catch (err) {
    return failure(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Bad request" }, { status: 400 });
  const code = cleanCode(body.code);
  const secret = req.headers.get(SEAT_HEADER);
  const now = Date.now();
  try {
    switch (body.action) {
      case "create": {
        const name = cleanName(body.name);
        const game = GAMES.find(g => g === body.game);
        const level = RACE_LEVELS.find(l => l === body.level) ?? "medium";
        if (!name) throw new RoomError(422, "Use 2 to 20 letters or numbers, and keep it clean.");
        if (!game) throw new RoomError(422, "Unknown game.");
        const seat = newSecret();
        const race = newRace(newCode(), game, level, name, seat, newSeed());
        const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        await insertRoom(race, networkId(ip, req.headers.get("user-agent")));
        return reply(race, 1, seat, { secret: seat });
      }
      case "join": {
        const name = cleanName(body.name);
        if (!name) throw new RoomError(422, "Use 2 to 20 letters or numbers, and keep it clean.");
        const seat = newSecret();
        const { room, version } = await changeRace(code, r => joinRace(r, name, seat));
        return reply(room, version, seat, { secret: seat });
      }
      case "start": {
        const { room, version } = await changeRace(code, r => startRace(r, secret, newSeed(), now));
        return reply(room, version, secret);
      }
      case "progress": {
        const { room, version } = await changeRace(code, r => reportProgress(r, secret, body.progress, now));
        return reply(room, version, secret);
      }
      case "finish": {
        const { room, version } = await changeRace(code, r => finishRace(r, secret, body.answer, now));
        return reply(room, version, secret);
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return failure(err);
  }
}
