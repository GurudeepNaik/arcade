import { cleanName } from "@/lib/games/scores";
import { advanceIfExpired, joinRoom, moveToken, newRoom, nextRoll, rematch, rollDice, RoomError, startRoom, viewOf, type Room, type RoomSize } from "@/lib/games/ludo-room";
import { chance, changeRoom, cleanCode, insertRoom, loadRoom, newCode, newSecret, saveRoom } from "@/lib/games/ludo-rooms";
import { networkId } from "@/lib/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEAT_HEADER = "x-seat";
const SIZES: RoomSize[] = [2, 3, 4];

function failure(err: unknown): Response {
  if (err instanceof RoomError) return Response.json({ error: err.message }, { status: err.status });
  console.error("ludo table failed", err);
  return Response.json({ error: "Something went wrong. Try again." }, { status: 500 });
}

const reply = (room: Room, version: number, secret: unknown, extra: object = {}) =>
  Response.json({ view: viewOf(room, secret, version, Date.now()), ...extra });

/** Each player checks in about once a second. A check-in also moves on a turn whose time ran out. */
export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const secret = req.headers.get(SEAT_HEADER);
  try {
    const current = await loadRoom(cleanCode(params.get("code")));
    if (!current) throw new RoomError(404, "That table doesn't exist. Check the code.");
    let { room, version } = current;
    const advanced = advanceIfExpired(room, nextRoll(room, chance), Date.now());
    if (advanced) {
      const saved = await saveRoom(advanced, version);
      if (saved !== null) { room = advanced; version = saved; }
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
        const size = SIZES.find(s => s === body.size);
        if (!name) throw new RoomError(422, "Use 2 to 20 letters or numbers, and keep it clean.");
        if (!size) throw new RoomError(422, "Choose 2, 3 or 4 players.");
        const seat = newSecret();
        const room = newRoom(newCode(), size, name, seat);
        const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        await insertRoom(room, networkId(ip, req.headers.get("user-agent")));
        return reply(room, 1, seat, { secret: seat });
      }
      case "join": {
        const name = cleanName(body.name);
        if (!name) throw new RoomError(422, "Use 2 to 20 letters or numbers, and keep it clean.");
        const seat = newSecret();
        const { room, version } = await changeRoom(code, r => joinRoom(r, name, seat));
        return reply(room, version, seat, { secret: seat });
      }
      case "start": {
        const { room, version } = await changeRoom(code, r => startRoom(r, secret, now));
        return reply(room, version, secret);
      }
      case "rematch": {
        const { room, version } = await changeRoom(code, r => rematch(r, secret, now));
        return reply(room, version, secret);
      }
      case "roll": {
        const { room, version } = await changeRoom(code, r => rollDice(r, secret, nextRoll(r, chance), now));
        return reply(room, version, secret);
      }
      case "move": {
        const { room, version } = await changeRoom(code, r => moveToken(r, secret, body.token, now));
        return reply(room, version, secret);
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return failure(err);
  }
}
