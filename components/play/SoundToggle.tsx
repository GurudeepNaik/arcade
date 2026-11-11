"use client";

import { useEffect, useId, useRef, useState } from "react";
import { buzz, canVibrate, hapticsOn, setHaptics, setSound, sfx, soundOn } from "@/lib/games/sfx";

function Switch({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4">
      <span className="font-semibold">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--good)]" : "bg-[var(--well-2)]"}`}
      >
        <span aria-hidden className={`absolute start-0 top-0.5 size-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

/** The speaker button in every game's top bar: opens Sound and, on phones that can, Vibration. */
export function SoundToggle() {
  const [sound, setSoundState] = useState(true);
  const [haptics, setHapticsState] = useState(true);
  const [vibrates, setVibrates] = useState(false);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    setSoundState(soundOn());
    setHapticsState(hapticsOn());
    setVibrates(canVibrate());
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={panelId} aria-label="Sound and vibration" className="arcade-btn arcade-btn--quiet arcade-btn--small !px-3">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" />
          {sound ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9.5l5 5M22 9.5l-5 5" />}
        </svg>
      </button>
      {open && (
        <div id={panelId} role="group" aria-label="Sound and vibration" className="play-rise arcade-panel absolute end-0 top-full z-30 mt-2 w-56 !rounded-2xl p-3">
          <Switch label="Sound" on={sound} onChange={on => { setSound(on); setSoundState(on); if (on) sfx("tap"); }} />
          {vibrates && <Switch label="Vibration" on={haptics} onChange={on => { setHaptics(on); setHapticsState(on); if (on) buzz(14); }} />}
        </div>
      )}
    </div>
  );
}
