import { ReflexGame } from "@/components/play/ReflexGame";
import { GamePage, gameMetadata } from "@/components/play/GamePage";
import { gameBySlug } from "@/lib/games/registry";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return gameMetadata("reflex", await searchParams);
}

export default function Page() {
  return (
    <GamePage slug="reflex">
      <ReflexGame game={gameBySlug("reflex")!} />
    </GamePage>
  );
}
