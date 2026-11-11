import { LudoGame } from "@/components/play/LudoGame";
import { GamePage, gameMetadata } from "@/components/play/GamePage";
import { gameBySlug } from "@/lib/games/registry";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return gameMetadata("ludo", await searchParams);
}

export default function Page() {
  return (
    <GamePage slug="ludo" wide>
      <LudoGame game={gameBySlug("ludo")!} />
    </GamePage>
  );
}
