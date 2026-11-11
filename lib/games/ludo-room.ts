import { applyMove, chooseBotMove, currentColour, gameOver, legalMoves, newGame, passTurn, rollDie, rollForfeits, COLOUR_NAMES, type Colour, type LudoState } from "./ludo";

// A live Ludo table. The server owns this state: it rolls the dice, checks every move, and plays for
// anyone who goes quiet, so no player can cheat and no player can freeze the table.

export const TURN_MS = 25_000;
const AWAY_TURN_MS = 5_000;
const AWAY_AFTER_MISSES = 2;

/** Two players sit opposite each other, then the other two arms fill in. */
const SEAT_ORDER: Colour[] = [0, 2, 1, 3];

export type RoomSize = 2 | 3 | 4;

export interface Seat { colour: Colour; name: string; secret: string; missed: number }

export interface RoomEvent {
  seq: number;
  colour: Colour;
  roll: number;
  token: number | null;
  path: number[];
  note: string;
}

export interface Room {
  code: string;
  size: RoomSize;
  status: "lobby" | "playing" | "over";
  seats: Seat[];
  game: LudoState | null;
  pending: number | null; // a roll waiting for its player to choose a token
  turnStartedAt: number;
  event: RoomEvent | null;
}

/** What a player may see. Seat secrets never leave the server. */
export interface RoomView {
  code: string;
  size: RoomSize;
  status: Room["status"];
  seats: { colour: Colour; name: string; away: boolean }[];
  game: LudoState | null;
  pending: number | null;
  event: RoomEvent | null;
  turnMsLeft: number;
  you: Colour | null;
  host: boolean;
  version: number;
}

export class RoomError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const seatOf = (room: Room, secret: unknown) => room.seats.find(s => s.secret === secret);
const nameOf = (room: Room, colour: Colour) => room.seats.find(s => s.colour === colour)?.name ?? COLOUR_NAMES[colour]!;

export function newRoom(code: string, size: RoomSize, name: string, secret: string): Room {
  return { code, size, status: "lobby", seats: [{ colour: SEAT_ORDER[0]!, name, secret, missed: 0 }], game: null, pending: null, turnStartedAt: 0, event: null };
}

export function joinRoom(room: Room, name: string, secret: string): Room {
  if (room.status !== "lobby") throw new RoomError(409, "This game has already started.");
  if (room.seats.length >= room.size) throw new RoomError(409, "This table is full.");
  if (room.seats.some(s => s.name.toLowerCase() === name.toLowerCase())) throw new RoomError(409, "Someone at this table already has that name.");
  return { ...room, seats: [...room.seats, { colour: SEAT_ORDER[room.seats.length]!, name, secret, missed: 0 }] };
}

function deal(room: Room, now: number): Room {
  const players = room.seats.map(s => s.colour).sort((a, b) => a - b);
  return { ...room, status: "playing", game: newGame(players), pending: null, turnStartedAt: now, event: null, seats: room.seats.map(s => ({ ...s, missed: 0 })) };
}

function requireHost(room: Room, secret: unknown): void {
  if (room.seats[0]?.secret !== secret) throw new RoomError(403, "Only the host can do that.");
}

export function startRoom(room: Room, secret: unknown, now: number): Room {
  requireHost(room, secret);
  if (room.status !== "lobby") throw new RoomError(409, "This game has already started.");
  if (room.seats.length < 2) throw new RoomError(409, "You need at least one friend at the table.");
  return deal(room, now);
}

export function rematch(room: Room, secret: unknown, now: number): Room {
  requireHost(room, secret);
  if (room.status !== "over") throw new RoomError(409, "This game is still going.");
  return deal(room, now);
}

function requireTurn(room: Room, secret: unknown): Seat {
  const seat = seatOf(room, secret);
  if (!seat) throw new RoomError(403, "You aren't at this table.");
  if (room.status !== "playing" || !room.game) throw new RoomError(409, "The game isn't running.");
  if (currentColour(room.game) !== seat.colour) throw new RoomError(409, "It isn't your turn.");
  return seat;
}

function nextSeq(room: Room): number {
  return (room.event?.seq ?? 0) + 1;
}

function playToken(room: Room, token: number, roll: number, now: number): Room {
  const game = room.game!;
  const colour = currentColour(game);
  const result = applyMove(game, token, roll);
  const who = nameOf(room, colour);
  const note = gameOver(result.state) ? `${who} wins!`
    : result.captured.length ? `${who} sent ${nameOf(room, result.captured[0]!.colour)} home!`
    : result.finishedToken ? `${who} got a token home.`
    : result.extraTurn ? `${who} rolls again.`
    : "";
  return {
    ...room,
    game: result.state,
    pending: null,
    turnStartedAt: now,
    status: gameOver(result.state) ? "over" : "playing",
    event: { seq: nextSeq(room), colour, roll, token, path: result.path, note },
  };
}

function pass(room: Room, roll: number, note: string, now: number): Room {
  const colour = currentColour(room.game!);
  return { ...room, game: passTurn(room.game!), pending: null, turnStartedAt: now, event: { seq: nextSeq(room), colour, roll, token: null, path: [], note } };
}

function resolveRoll(room: Room, roll: number, now: number): Room {
  const game = room.game!;
  const colour = currentColour(game);
  const who = nameOf(room, colour);
  if (rollForfeits(game, roll)) return pass(room, roll, `Three sixes. ${who} loses the turn.`, now);
  const options = legalMoves(game, colour, roll);
  if (!options.length) return pass(room, roll, `${who} has no move.`, now);
  const tokens = game.tokens[colour]!;
  const distinct = options.filter((t, i) => options.findIndex(o => tokens[o] === tokens[t]) === i);
  if (distinct.length === 1) return playToken(room, distinct[0]!, roll, now);
  return { ...room, pending: roll, turnStartedAt: now, event: { seq: nextSeq(room), colour, roll, token: null, path: [], note: "" } };
}

/** The next roll for whoever's turn it is, from the server's random source. */
export function nextRoll(room: Room, chance: () => number): number {
  return room.game ? rollDie(room.game, currentColour(room.game), chance) : 1;
}

const present = (room: Room, secret: unknown): Room => ({ ...room, seats: room.seats.map(s => (s.secret === secret ? { ...s, missed: 0 } : s)) });

/** `value` comes from the server's random source, never from a player. */
export function rollDice(room: Room, secret: unknown, value: number, now: number): Room {
  requireTurn(room, secret);
  if (room.pending !== null) throw new RoomError(409, "Pick a token first.");
  return resolveRoll(present(room, secret), value, now);
}

export function moveToken(room: Room, secret: unknown, token: unknown, now: number): Room {
  const seat = requireTurn(room, secret);
  if (room.pending === null) throw new RoomError(409, "Roll the dice first.");
  if (typeof token !== "number" || !legalMoves(room.game!, seat.colour, room.pending).includes(token)) throw new RoomError(409, "That token can't move.");
  return playToken(present(room, secret), token, room.pending, now);
}

function turnLimit(room: Room): number {
  const current = room.game && room.seats.find(s => s.colour === currentColour(room.game!));
  return current && current.missed >= AWAY_AFTER_MISSES ? AWAY_TURN_MS : TURN_MS;
}

/** Plays one step for a player whose time ran out, so a table never gets stuck. Null when nothing is due. */
export function advanceIfExpired(room: Room, value: number, now: number): Room | null {
  if (room.status !== "playing" || !room.game || now - room.turnStartedAt < turnLimit(room)) return null;
  const colour = currentColour(room.game);
  const marked: Room = { ...room, seats: room.seats.map(s => (s.colour === colour ? { ...s, missed: s.missed + 1 } : s)) };
  if (marked.pending !== null) return playToken(marked, chooseBotMove(marked.game!, marked.pending), marked.pending, now);
  const rolled = resolveRoll(marked, value, now);
  return rolled.pending !== null ? playToken(rolled, chooseBotMove(rolled.game!, rolled.pending), rolled.pending, now) : rolled;
}

export function viewOf(room: Room, secret: unknown, version: number, now: number): RoomView {
  const me = seatOf(room, secret);
  return {
    code: room.code,
    size: room.size,
    status: room.status,
    seats: room.seats.map(s => ({ colour: s.colour, name: s.name, away: s.missed >= AWAY_AFTER_MISSES })),
    game: room.game,
    pending: room.pending,
    event: room.event,
    turnMsLeft: Math.max(0, turnLimit(room) - (now - room.turnStartedAt)),
    you: me?.colour ?? null,
    host: !!me && room.seats[0]?.secret === secret,
    version,
  };
}
