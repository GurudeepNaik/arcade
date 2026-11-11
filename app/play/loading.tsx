import { Pip } from "@/components/play/Pip";

const TIPS = [
  "Double-tap a square to place an owl.",
  "Every level is a brand-new puzzle.",
  "Fewest pours wins in Colour Sort.",
  "No token out in Ludo? Sixes come more often.",
  "Sign in to keep your streak.",
  "Invite a friend to race the same Sudoku.",
];

/** Shown while any Arcade page loads. A short wait shows nothing: the fade starts after 150 ms. */
export default function Loading() {
  // A different tip each minute; a server render keeps it stable for the whole load.
  const tip = TIPS[Math.floor(Date.now() / 60_000) % TIPS.length];
  return (
    <div role="status" aria-live="polite" className="load-fade grid min-h-[70dvh] place-items-center px-4">
      <div className="grid justify-items-center text-center">
        <div className="relative w-28">
          <div className="load-hop origin-bottom"><Pip mood="idle" className="w-28" /></div>
          <span aria-hidden className="load-shadow mx-auto mt-1 block h-2.5 w-16 rounded-full bg-black/40" />
        </div>
        <p className="arcade-title mt-5 flex items-center gap-1 text-2xl">
          Loading
          <span aria-hidden className="flex gap-1 pt-2">
            {[0, 1, 2].map(i => <span key={i} className="load-dot size-1.5 rounded-full bg-current" style={{ animationDelay: `${i * 150}ms` }} />)}
          </span>
        </p>
        <p className="mt-2 max-w-xs text-sm text-[var(--ink-soft)]">Tip: {tip}</p>
      </div>
    </div>
  );
}
