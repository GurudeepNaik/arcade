import type { Game } from "@/lib/games/registry";

export function gameStyle(game: Game): React.CSSProperties {
  return { "--g": game.colour, "--g-deep": game.deep, "--on-g": game.onColour } as React.CSSProperties;
}
