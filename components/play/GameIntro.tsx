import type { Game } from "@/lib/games/registry";
import { GameArt } from "./GameArt";
import { HowToPlay } from "./demo/DemoPlayer";

/** The opening screen of every game: its cover, how to play, and the way in. */
export function GameIntro({ game, heading, note, children }: { game: Game; heading: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="arcade-panel play-rise overflow-hidden">
      <GameArt slug={game.slug} className="block aspect-[16/9] w-full object-cover" />
      <div className="p-5 text-center sm:p-7">
        <h2 className="arcade-title text-3xl sm:text-4xl">{heading}</h2>
        {note && <p className="mt-2 text-[var(--ink-soft)]">{note}</p>}
        <ol className="mt-5 grid gap-2 text-left sm:grid-cols-3">
          {game.steps.map((step, i) => (
            <li key={step} className="play-rise flex items-center gap-3 rounded-2xl bg-[var(--well)] p-3 text-sm font-medium sm:flex-col sm:items-start sm:gap-2" style={{ "--delay": `${120 + i * 90}ms` } as React.CSSProperties}>
              <span aria-hidden className="clay arcade-title grid size-8 shrink-0 place-items-center rounded-full text-[var(--on-g)]" style={{ "--c": "var(--g)" } as React.CSSProperties}>{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {children}
          <HowToPlay game={game} />
        </div>
      </div>
    </div>
  );
}
