"use client";

import { useEffect, useState } from "react";

/** Seconds since a start time, ticking once a second while running. */
export function useClock(startedAt: number | null, running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    if (!running) return;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt, running]);
  return seconds;
}

export const clockText = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
