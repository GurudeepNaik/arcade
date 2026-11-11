import { ArrowGame } from "@/components/play/ArrowGame";
import { GamePage, gameMetadata } from "@/components/play/GamePage";
import { gameBySlug } from "@/lib/games/registry";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return gameMetadata("arrows", await searchParams);
}

export default function Page() {
  return (
    <GamePage slug="arrows">
      <ArrowGame game={gameBySlug("arrows")!} />
    </GamePage>
  );
}
