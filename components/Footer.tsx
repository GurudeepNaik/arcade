import Link from "next/link";
import { site } from "@/content/site";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>The Arcade · made by <a className="font-medium text-fg hover:text-accent" href={site.url}>{site.name}</a></p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          <li><a className="hover:text-fg" href={site.url}>Portfolio</a></li>
          <li><a className="hover:text-fg" href={site.links.github} target="_blank" rel="noopener">GitHub</a></li>
          <li><Link className="hover:text-fg" href="/privacy">Privacy</Link></li>
        </ul>
      </div>
    </footer>
  );
}
