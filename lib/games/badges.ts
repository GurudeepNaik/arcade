import { playerStore } from "./store";
import { LEVEL_COUNT, readLevelStars } from "./levels";
import { readProgress, type Progress } from "./progress";
import { games, type GameSlug } from "./registry";

// Badges are worked out from progress the browser already keeps, so nothing new is stored for them
// except which ones the player has already been shown.

export type BadgeIcon = "star" | "flame" | "crown" | "bolt" | "dice" | "brain" | "trophy" | "map";

export interface Badge { id: string; title: string; hint: string; icon: BadgeIcon; colour: string }

interface Snapshot { progress: Progress; stars: Partial<Record<GameSlug, Record<number, number>>> }

const SEEN_KEY = "play.badges.seen";
export const BADGE_EVENT = "play:badge";

const highest = (s: Snapshot) => Math.max(0, ...Object.values(s.stars).flatMap(levels => Object.keys(levels ?? {}).map(Number)));
const perfect = (s: Snapshot) => Object.values(s.stars).reduce((sum, levels) => sum + Object.values(levels ?? {}).filter(n => n === 3).length, 0);
const tried = (s: Snapshot) => games.filter(g => s.progress.best[g.slug] !== undefined || Object.keys(s.stars[g.slug] ?? {}).length > 0 || (g.slug === "ludo" && s.progress.wins > 0)).length;

const RULES: (Badge & { earned: (s: Snapshot) => boolean })[] = [
  { id: "first", title: "First game", hint: "Finish any game", icon: "star", colour: "#27b98f", earned: s => s.progress.plays >= 1 || highest(s) >= 1 },
  { id: "explorer", title: "Explorer", hint: `Play all ${games.length} games`, icon: "map", colour: "#3fb8f0", earned: s => tried(s) >= games.length },
  { id: "streak3", title: "On a roll", hint: "Play 3 days in a row", icon: "flame", colour: "#ff9142", earned: s => s.progress.streak >= 3 },
  { id: "streak7", title: "Week of play", hint: "Play 7 days in a row", icon: "flame", colour: "#ff6b63", earned: s => s.progress.streak >= 7 },
  { id: "streak30", title: "Unstoppable", hint: "Play 30 days in a row", icon: "flame", colour: "#d64a78", earned: s => s.progress.streak >= 30 },
  { id: "level10", title: "Climber", hint: "Clear level 10 in any game", icon: "trophy", colour: "#a4dd3a", earned: s => highest(s) >= 10 },
  { id: "level50", title: "Halfway up", hint: "Clear level 50 in any game", icon: "trophy", colour: "#27b98f", earned: s => highest(s) >= 50 },
  { id: "level100", title: "Summit", hint: `Clear level ${LEVEL_COUNT} in any game`, icon: "crown", colour: "#ffb82e", earned: s => highest(s) >= LEVEL_COUNT },
  { id: "perfect10", title: "Perfectionist", hint: "Earn 3 stars on 10 levels", icon: "star", colour: "#ffb82e", earned: s => perfect(s) >= 10 },
  { id: "sharp", title: "Big brain", hint: "Score 850 in Brain Score", icon: "brain", colour: "#ff7aa2", earned: s => (s.progress.best.brain ?? 0) >= 850 },
  { id: "lightning", title: "Lightning", hint: "Average under 220 ms in Reflex Test", icon: "bolt", colour: "#a4dd3a", earned: s => (s.progress.best.reflex ?? Infinity) < 220 },
  { id: "ludo", title: "Home run", hint: "Win a game of Ludo", icon: "dice", colour: "#ff6b63", earned: s => s.progress.wins >= 1 },
];

export const BADGES: Badge[] = RULES.map(r => ({ id: r.id, title: r.title, hint: r.hint, icon: r.icon, colour: r.colour }));

function snapshot(): Snapshot {
  return { progress: readProgress(), stars: Object.fromEntries(games.map(g => [g.slug, readLevelStars(g.slug)])) };
}

export function earnedBadgeIds(): Set<string> {
  const s = snapshot();
  return new Set(RULES.filter(r => r.earned(s)).map(r => r.id));
}

/** Announces any badge earned since the last check. Called after every saved result. */
export function announceNewBadges(): void {
  try {
    const seen = new Set(JSON.parse(playerStore().getItem(SEEN_KEY) ?? "[]") as string[]);
    const fresh = [...earnedBadgeIds()].filter(id => !seen.has(id));
    if (!fresh.length) return;
    playerStore().setItem(SEEN_KEY, JSON.stringify([...seen, ...fresh]));
    for (const id of fresh) window.dispatchEvent(new CustomEvent(BADGE_EVENT, { detail: BADGES.find(b => b.id === id) }));
  } catch {
    // Without storage there is nothing to compare against, so no announcement.
  }
}
