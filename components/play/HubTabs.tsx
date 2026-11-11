"use client";

import { useCallback, useEffect, useRef } from "react";

export const HUB_TABS = ["games", "today", "progress", "badges"] as const;
export type HubTab = (typeof HUB_TABS)[number];

export const tabFromHash = (hash: string): HubTab => (HUB_TABS as readonly string[]).includes(hash.slice(1)) ? (hash.slice(1) as HubTab) : "games";

/** Keeps the open tab in the URL hash, so "See progress" links and the back button work. */
export function useHubTab(tab: HubTab, setTab: (t: HubTab) => void) {
  useEffect(() => {
    const sync = () => setTab(tabFromHash(location.hash));
    sync();
    addEventListener("hashchange", sync);
    return () => removeEventListener("hashchange", sync);
  }, [setTab]);

  return useCallback((next: HubTab) => {
    if (next === tab) return;
    history.replaceState(null, "", next === "games" ? location.pathname + location.search : `#${next}`);
    setTab(next);
    // With the tab bar at the bottom, a new tab opens at its own content, like switching tabs in an app.
    if (matchMedia("(max-width: 639px)").matches) {
      requestAnimationFrame(() => {
        const panel = document.getElementById(`panel-${next}`);
        if (panel) scrollTo({ top: Math.max(0, panel.getBoundingClientRect().top + scrollY - 76) });
      });
    }
  }, [tab, setTab]);
}

/** ARIA tabs: arrow keys move between them, only the open one is in the Tab order. */
const ICONS: Record<HubTab, string> = {
  games: "M6 9h4M8 7v4M15 8h.01M17 10h.01M7.5 4.5h9A4.5 4.5 0 0 1 21 9v4.5a3 3 0 0 1-5.3 1.9L14.4 14H9.6l-1.3 1.4A3 3 0 0 1 3 13.5V9a4.5 4.5 0 0 1 4.5-4.5z",
  today: "M7 3.5v3M17 3.5v3M4.5 9h15M6 5h12a1.5 1.5 0 0 1 1.5 1.5V19A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19V6.5A1.5 1.5 0 0 1 6 5zM9 14.5l2 2 4-4",
  progress: "M5 19.5V13M10 19.5V9M15 19.5v-4M20 19.5V5M3.5 19.5h17",
  badges: "M12 3.5l2.4 4.9 5.3.8-3.9 3.7.9 5.3-4.7-2.5-4.7 2.5.9-5.3-3.9-3.7 5.3-.8z",
};

export function HubTabList({ tab, onSelect, labels }: { tab: HubTab; onSelect: (t: HubTab) => void; labels: Record<HubTab, React.ReactNode> }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: React.KeyboardEvent) => {
    const i = HUB_TABS.indexOf(tab);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? HUB_TABS.length - 1 : step ? (i + step + HUB_TABS.length) % HUB_TABS.length : -1;
    if (to < 0) return;
    e.preventDefault();
    const next = HUB_TABS[to]!;
    onSelect(next);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label="Arcade sections" onKeyDown={onKey} className="hub-tabs grid grid-cols-4 gap-1">
      {HUB_TABS.map(t => (
        <button
          key={t}
          ref={el => { refs.current[t] = el; }}
          id={`tab-${t}`}
          role="tab"
          type="button"
          aria-selected={tab === t}
          aria-controls={`panel-${t}`}
          tabIndex={tab === t ? 0 : -1}
          onClick={() => onSelect(t)}
          className="hub-tab grid min-h-14 place-items-center content-center gap-0.5 rounded-2xl px-1 text-[11px] font-bold sm:flex sm:min-h-11 sm:justify-center sm:gap-1.5 sm:px-2 sm:text-base"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-6 sm:hidden" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[t]} /></svg>
          {labels[t]}
        </button>
      ))}
    </div>
  );
}
