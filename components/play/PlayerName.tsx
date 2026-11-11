"use client";

import { useEffect, useState } from "react";
import { savedNickname } from "@/lib/games/store";

/**
 * The name for a race or a live table. Signed in with a saved nickname: that's the name, no box.
 * Otherwise: the box, so guests and new players can still join.
 */
export function PlayerName({ id, name, setName }: { id: string; name: string; setName: (name: string) => void }) {
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    const saved = savedNickname();
    setNickname(saved);
    if (saved) setName(saved);
  }, [setName]);

  if (nickname) {
    return (
      <p className="mt-5 rounded-[18px] bg-[var(--well)] px-4 py-3 text-left">
        Playing as <strong>{nickname}</strong>
        <span className="block text-xs text-[var(--ink-soft)]">Your nickname. Change it on the Arcade page.</span>
      </p>
    );
  }
  return (
    <>
      <label htmlFor={id} className="mt-5 block text-left font-semibold">Your name</label>
      <input id={id} value={name} onChange={e => setName(e.target.value)} maxLength={20} autoComplete="nickname" placeholder="Your name" className="mt-2 min-h-[54px] w-full rounded-[18px] border-2 border-[var(--well-2)] bg-[var(--well)] px-4 text-base font-semibold" />
    </>
  );
}
