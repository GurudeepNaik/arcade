import { BrainGame } from "@/components/play/BrainGame";
import { GamePage, gameMetadata } from "@/components/play/GamePage";
import { gameBySlug } from "@/lib/games/registry";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return gameMetadata("brain", await searchParams);
}

export default function Page() {
  return (
    <GamePage slug="brain">
      <BrainGame game={gameBySlug("brain")!} />
    </GamePage>
  );
}
