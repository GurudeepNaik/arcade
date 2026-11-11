import { GamePage, gameMetadata } from "@/components/play/GamePage";
import { HootGame } from "@/components/play/HootGame";
import { gameBySlug } from "@/lib/games/registry";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return gameMetadata("hoot", await searchParams);
}

export default function Page() {
  return (
    <GamePage slug="hoot">
      <HootGame game={gameBySlug("hoot")!} />
    </GamePage>
  );
}
