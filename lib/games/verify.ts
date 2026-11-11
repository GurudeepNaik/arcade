import { arrowsPlausible, BUMP_PENALTY_S, replayArrows } from "./arrows";
import { plausibleBrainRun, scoreBrain, type BrainAnswer } from "./brain";
import { dailyHootSolved } from "./hoot";
import { FASTEST_TAP_MS, replayLantern } from "./lantern";
import { plausibleReflexRun, scoreReflex } from "./reflex";
import type { Run } from "./run-token";
import { replaySort } from "./sort";
import { sudokuSolved } from "./sudoku";

const FASTEST_POUR_MS = 180;

/** Rebuilds the run on the server and scores it. Null when it could not have been played. */
export function scoreRun(run: Run, body: Record<string, unknown>, elapsedMs: number): number | null {
  const seconds = Math.round(elapsedMs / 1000);
  switch (run.game) {
    case "brain": {
      const answers = body.answers as BrainAnswer[];
      if (!Array.isArray(answers) || !plausibleBrainRun(run.seed, answers, elapsedMs)) return null;
      return scoreBrain(run.seed, answers).score;
    }
    case "reflex": {
      const times = body.times as number[];
      if (!Array.isArray(times) || !plausibleReflexRun(times, elapsedMs)) return null;
      return scoreReflex(times);
    }
    case "hoot":
      return dailyHootSolved(run.seed, body.solutions, elapsedMs) ? seconds : null;
    case "sudoku":
      return sudokuSolved(run.seed, run.level, body.grid, elapsedMs) ? seconds : null;
    case "arrows": {
      const replay = replayArrows(run.seed, body.taps);
      if (!replay || !arrowsPlausible(replay.taps, elapsedMs)) return null;
      return seconds + replay.bumps * BUMP_PENALTY_S;
    }
    case "sort": {
      const pours = replaySort(run.seed, body.levels);
      return pours !== null && elapsedMs >= pours * FASTEST_POUR_MS ? pours : null;
    }
    case "lantern": {
      const taps = replayLantern(run.seed, body.taps);
      return taps !== null && elapsedMs >= taps * FASTEST_TAP_MS ? taps : null;
    }
    default:
      return null;
  }
}
