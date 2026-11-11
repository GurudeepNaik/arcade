import { site } from "@/content/site";
import { Pip } from "./Pip";

/** The way from a game back to the portfolio: who built this, and where to see the rest. */
export function MadeBy({ className = "" }: { className?: string }) {
  return (
    // Owl and text side by side; the button drops to its own full-width row on narrow screens.
    <aside aria-label="About the maker" className={`arcade-panel grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:p-5 ${className}`}>
      <Pip mood="idle" className="w-12 shrink-0" />
      <p className="text-sm text-[var(--ink-soft)]">
        <span className="block font-semibold text-[var(--ink)]">Built by {site.name}, {site.title.toLowerCase()}.</span>
        Every puzzle is generated fresh and every leaderboard score is checked on the server.
      </p>
      <a href={`${site.url}/#work`} data-track="arcade-to-work" className="arcade-btn arcade-btn--quiet col-span-2 !min-h-11 !px-5 !text-base sm:col-span-1">See my work</a>
    </aside>
  );
}
