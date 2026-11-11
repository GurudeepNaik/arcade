import { playerStore } from "./store";
import { today } from "./progress";

// A running tally for the current week (Monday start, India time), and last week's kept for the Monday recap.
// Stored with the rest of the player's data: lasting when signed in, this tab only otherwise.

const KEY = "play.week";

export interface WeekTally { start: string; levels: number; stars: number; plays: number; bests: number }
interface Stored { current: WeekTally; last: WeekTally | null }

/** The Monday (IST) of the week a day falls in, as YYYY-MM-DD. */
export function weekStart(day = today()): string {
  const d = new Date(`${day}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

const empty = (start: string): WeekTally => ({ start, levels: 0, stars: 0, plays: 0, bests: 0 });

function read(): Stored {
  const start = weekStart();
  let stored: Stored | null = null;
  try {
    stored = JSON.parse(playerStore().getItem(KEY) ?? "null") as Stored | null;
  } catch {
    stored = null;
  }
  if (!stored?.current) return { current: empty(start), last: null };
  if (stored.current.start === start) return stored;
  // A new week: what was "current" becomes last week only if it was the week right before.
  const previous = new Date(`${start}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 7);
  const lastWeek = stored.current.start === previous.toISOString().slice(0, 10) ? stored.current : null;
  return { current: empty(start), last: lastWeek };
}

function save(stored: Stored): void {
  try {
    playerStore().setItem(KEY, JSON.stringify(stored));
  } catch {
    // No storage: the recap just isn't kept.
  }
}

export function recordWeek(add: Partial<Omit<WeekTally, "start">>): void {
  const stored = read();
  const c = stored.current;
  save({ ...stored, current: { ...c, levels: c.levels + (add.levels ?? 0), stars: c.stars + (add.stars ?? 0), plays: c.plays + (add.plays ?? 0), bests: c.bests + (add.bests ?? 0) } });
}

export function readWeek(): Stored {
  const stored = read();
  save(stored);
  return stored;
}
