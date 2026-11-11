"use client";

import { useEffect, useRef } from "react";
import { playedToday, readProgress } from "@/lib/games/progress";
import type { GameSlug } from "@/lib/games/registry";

/** `/play/<game>?daily=1` (from the Today tab) skips the intro and starts today's challenge, once. */
export function AutoDaily({ slug, start }: { slug: GameSlug; start: () => void }) {
  const started = useRef(false);
  const startRef = useRef(start);
  startRef.current = start;

  useEffect(() => {
    const url = new URL(location.href);
    if (started.current || url.searchParams.get("daily") !== "1") return;
    started.current = true;
    // Drop the flag, so reloading or coming back to the page shows the intro as usual.
    url.searchParams.delete("daily");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    if (!playedToday(readProgress(), slug)) startRef.current();
  }, [slug]);

  return null;
}
