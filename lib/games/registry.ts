export type GameSlug = "hoot" | "brain" | "reflex" | "sudoku" | "arrows" | "sort" | "ludo" | "lantern";

export interface Game {
  slug: GameSlug;
  title: string;
  tagline: string;
  blurb: string;
  length: string;
  badge: string;
  steps: [string, string, string];
  unit: "points" | "ms" | "time" | "pours" | "taps" | "none";
  lowerIsBetter: boolean;
  daily: boolean; // one ranked try per day, on a freshly generated puzzle
  ranked: boolean; // has a leaderboard
  colour: string; // main colour of the game
  deep: string; // the darker edge of that colour
  onColour: string; // text on the main colour
}

export const games: Game[] = [
  { slug: "hoot", title: "Hoot & Seek", tagline: "Find every owl. Use only logic.", blurb: "One owl in every row, column and colour, and no two owls touching. No guessing needed, ever.", length: "3 to 8 min", badge: "New every day", steps: ["One owl per row, column and colour", "Owls can't touch, even at corners", "Double-tap for an owl. Wrong ones cost a life"], unit: "time", lowerIsBetter: true, daily: true, ranked: true, colour: "#27b98f", deep: "#14866a", onColour: "#ffffff" },
  { slug: "sudoku", title: "Sudoku", tagline: "A fresh grid every time.", blurb: "A new grid every time you play. Fastest clean solve takes the top spot.", length: "5 to 15 min", badge: "Daily race", steps: ["Fill every row, column and box with 1 to 9", "Use notes to keep track of options", "Your time goes on today's board"], unit: "time", lowerIsBetter: true, daily: true, ranked: true, colour: "#ffb82e", deep: "#d98a00", onColour: "#4a3000" },
  { slug: "ludo", title: "Ludo", tagline: "Roll. Race. Send them home.", blurb: "The classic race. Invite 1 to 3 friends to a live table, or climb 100 levels against the computer.", length: "10 to 20 min", badge: "Play with friends", steps: ["Roll a 6 to bring a token out", "Land on a rival to send it home", "Get all four tokens to the centre first"], unit: "none", lowerIsBetter: false, daily: false, ranked: false, colour: "#ff6b63", deep: "#d43f3a", onColour: "#ffffff" },
  { slug: "sort", title: "Colour Sort", tagline: "Pour it till it's perfect.", blurb: "Pour coloured layers between flasks until every flask holds one colour. Three levels, fewest pours wins.", length: "5 to 10 min", badge: "Daily puzzle", steps: ["Tap a flask, then tap where to pour", "You can only pour onto the same colour", "Fewest total pours tops the board"], unit: "pours", lowerIsBetter: true, daily: true, ranked: true, colour: "#3fb8f0", deep: "#1b86c4", onColour: "#ffffff" },
  { slug: "arrows", title: "Arrow Escape", tagline: "Clear the jam. Don't crash.", blurb: "Every arrow flies off in the way it points, unless something's in its path. Clear five boards fast.", length: "2 to 4 min", badge: "Daily puzzle", steps: ["Tap an arrow with a clear path", "A crash adds 5 seconds", "Clear all 5 boards for your time"], unit: "time", lowerIsBetter: true, daily: true, ranked: true, colour: "#ff9142", deep: "#dd6410", onColour: "#ffffff" },
  { slug: "brain", title: "Brain Score", tagline: "12 puzzles. One number.", blurb: "Number patterns, shape grids, rotations and logic that get harder as you go.", length: "About 4 min", badge: "Daily test", steps: ["12 puzzles, each against the clock", "Right and quick scores the most", "One ranked try each day"], unit: "points", lowerIsBetter: false, daily: true, ranked: true, colour: "#ff7aa2", deep: "#d64a78", onColour: "#ffffff" },
  { slug: "lantern", title: "Lantern Night", tagline: "Light every lantern.", blurb: "Tap a lantern to flip it and its four neighbours. Light the whole square in as few taps as you can.", length: "1 to 5 min", badge: "Daily puzzle", steps: ["Tap a lantern to flip it and its neighbours", "Light every lantern on the board", "Fewest taps tops the daily board"], unit: "taps", lowerIsBetter: true, daily: true, ranked: true, colour: "#8f7bf0", deep: "#6a54d6", onColour: "#ffffff" },
  { slug: "reflex", title: "Reflex Test", tagline: "Wait for it… tap!", blurb: "Tap the moment the screen turns. Five rounds, and your average is your score.", length: "30 seconds", badge: "Unlimited", steps: ["Wait for the panel to change", "Tap as fast as you can", "Your 5-round average is your score"], unit: "ms", lowerIsBetter: true, daily: false, ranked: true, colour: "#a4dd3a", deep: "#6fa414", onColour: "#233300" },
];

export function gameBySlug(slug: unknown): Game | undefined {
  return games.find(g => g.slug === slug);
}

export function formatScore(game: Game, score: number): string {
  if (game.unit === "ms") return `${score} ms`;
  if (game.unit === "pours") return `${score} pours`;
  if (game.unit === "taps") return `${score} ${score === 1 ? "tap" : "taps"}`;
  if (game.unit === "time") return `${Math.floor(score / 60)}:${String(score % 60).padStart(2, "0")}`;
  return String(score);
}
