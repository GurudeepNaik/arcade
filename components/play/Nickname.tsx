"use client";

import { useState } from "react";
import { rememberName } from "@/lib/games/progress";
import { rememberNickname } from "@/lib/games/store";

async function save(nickname: string): Promise<string> {
  const res = await fetch("/api/play/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ nickname }) });
  const data = (await res.json().catch(() => ({}))) as { nickname?: string; error?: string };
  if (!res.ok || !data.nickname) throw new Error(data.error ?? "Couldn't save your nickname. Try again.");
  rememberName(data.nickname);
  rememberNickname(data.nickname);
  return data.nickname;
}

/**
 * Picks or changes the nickname shown on every leaderboard. `first` asks for it right after sign-in,
 * with the Google first name ready to keep in one tap.
 */
export function NicknameForm({ current, first = false, onSaved, onCancel }: { current: string; first?: boolean; onSaved: (nickname: string) => void; onCancel?: () => void }) {
  const [value, setValue] = useState(current);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSaved(await save(value));
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-2">
      <label htmlFor="nickname" className={first ? "arcade-title text-lg" : "text-sm font-semibold"}>
        {first ? "Pick your nickname" : "Nickname"}
      </label>
      {first && <p className="-mt-1 text-xs text-[var(--ink-soft)]">Shown on every leaderboard. Your scores save under it automatically. Change it any time.</p>}
      <div className="flex gap-2">
        <input
          id="nickname"
          value={value}
          onChange={e => setValue(e.target.value)}
          maxLength={20}
          autoComplete="nickname"
          autoFocus={!first}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "nickname-error" : undefined}
          className="min-h-11 min-w-0 flex-1 rounded-2xl border-2 border-[var(--well-2)] bg-[var(--well)] px-3 text-base font-semibold"
        />
        <button type="submit" disabled={busy || value.trim().length < 2} className="arcade-btn !min-h-11 !px-4 !text-base">{busy ? "Saving" : first ? "Use it" : "Save"}</button>
      </div>
      {error && <p id="nickname-error" role="alert" className="text-xs font-semibold text-[var(--bad)]">{error}</p>}
      {onCancel && <button type="button" onClick={onCancel} className="w-fit text-xs font-semibold text-[var(--ink-soft)] underline">Cancel</button>}
    </form>
  );
}
