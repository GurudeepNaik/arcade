import { SudokuGame } from "@/components/play/SudokuGame";
import { GamePage, gameMetadata } from "@/components/play/GamePage";
import { gameBySlug } from "@/lib/games/registry";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return gameMetadata("sudoku", await searchParams);
}

export default function Page() {
  return (
    <GamePage slug="sudoku">
      <SudokuGame game={gameBySlug("sudoku")!} />
    </GamePage>
  );
}
