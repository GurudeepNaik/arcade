import { SortGame } from "@/components/play/SortGame";
import { GamePage, gameMetadata } from "@/components/play/GamePage";
import { gameBySlug } from "@/lib/games/registry";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return gameMetadata("sort", await searchParams);
}

export default function Page() {
  return (
    <GamePage slug="sort">
      <SortGame game={gameBySlug("sort")!} />
    </GamePage>
  );
}
