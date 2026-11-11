import Link from "next/link";
import { site } from "@/content/site";
import { ThemeToggle } from "./ThemeToggle";

/** The Arcade's header: its own name, the theme switch, and the way back to the maker's portfolio. */
export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-md">
      <nav aria-label="Main" className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link href="/play" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-accent text-base">🦉</span>
          The Arcade
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a href={site.url} data-track="arcade-to-portfolio" className="press inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-medium hover:border-accent">
            <span className="hidden sm:inline">Made by</span> {site.name.split(" ")[0]} ↗
          </a>
        </div>
      </nav>
    </header>
  );
}
