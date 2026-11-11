import { earnedBadgeIds, BADGES } from "./badges";
import { LEVEL_COUNT, readLevelStars } from "./levels";
import { games, type GameSlug } from "./registry";

export interface GameLadder { cleared: number; stars: number }
export interface PlayerSummary {
  ladders: Record<GameSlug, GameLadder>;
  cleared: number;
  stars: number;
  levels: number;
  badges: number;
  badgeTotal: number;
}

/** Everything the hub shows about a player, read once from this browser. */
export function playerSummary(): PlayerSummary {
  const ladders = {} as Record<GameSlug, GameLadder>;
  for (const g of games) {
    const stars = Object.values(readLevelStars(g.slug));
    ladders[g.slug] = { cleared: stars.length, stars: stars.reduce((a, b) => a + b, 0) };
  }
  const all = Object.values(ladders);
  return {
    ladders,
    cleared: all.reduce((n, l) => n + l.cleared, 0),
    stars: all.reduce((n, l) => n + l.stars, 0),
    levels: games.length * LEVEL_COUNT,
    badges: earnedBadgeIds().size,
    badgeTotal: BADGES.length,
  };
}
