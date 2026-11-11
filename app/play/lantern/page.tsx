import { LanternGame } from "@/components/play/LanternGame";
import { GamePage, gameMetadata } from "@/components/play/GamePage";
import { gameBySlug } from "@/lib/games/registry";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return gameMetadata("lantern", await searchParams);
}

export default function Page() {
  return (
    <GamePage slug="lantern">
      <LanternGame game={gameBySlug("lantern")!} />
    </GamePage>
  );
}
