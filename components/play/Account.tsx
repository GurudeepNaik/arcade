"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adoptAccount, GOOGLE_CLIENT_ID, renderGoogleButton, signInWithGoogle, type PlayerInfo } from "@/lib/games/google-client";
import type { SavedProgress } from "@/lib/games/saved-progress";
import { forgetPlayer, rememberNickname } from "@/lib/games/store";
import { rememberName } from "@/lib/games/progress";
import { NicknameForm } from "./Nickname";
import { localProgress, markSignedIn } from "@/lib/games/sync";

/** Optional sign-in that saves progress across devices. Hidden until the site has a Google client ID. */
export function Account({ onChange }: { onChange?: () => void }) {
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const button = useRef<HTMLDivElement>(null);

  const changed = useRef(onChange);
  changed.current = onChange;
  const adopt = useCallback((info: PlayerInfo, progress?: SavedProgress) => {
    if (progress) adoptAccount(progress);
    if (info.nickname) rememberName(info.nickname);
    rememberNickname(info.nickname || null); // chosen, or the Google first name until they choose
    setPlayer(info);
    changed.current?.();
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    fetch("/api/play/account")
      .then(r => r.json() as Promise<{ player: PlayerInfo | null; progress?: SavedProgress }>)
      .then(d => {
        if (d.player && d.progress) {
          adopt(d.player, d.progress);
          // This browser may hold results the account hasn't seen yet.
          void fetch("/api/play/account", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ progress: localProgress() }) });
        } else markSignedIn(false);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [adopt]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !ready || player || !button.current) return;
    let live = true;
    renderGoogleButton(button.current, async credential => {
      setError("");
      const out = await signInWithGoogle(credential);
      if (!live) return;
      if ("player" in out) adopt(out.player);
      else setError(out.error);
    }).catch(() => setError("Google sign-in couldn't load."));
    return () => { live = false; };
  }, [adopt, player, ready]);

  if (!GOOGLE_CLIENT_ID || !ready) return null;

  const signOut = async () => {
    await fetch("/api/play/account", { method: "DELETE" }).catch(() => undefined);
    window.google?.accounts.id.disableAutoSelect();
    forgetPlayer();
    setPlayer(null);
    changed.current?.();
  };

  if (player && (!player.nicknameChosen || editing)) {
    return (
      <div className="rounded-2xl bg-[var(--well)] p-3">
        <NicknameForm
          current={player.nickname}
          first={!player.nicknameChosen}
          onSaved={nickname => { setPlayer({ ...player, nickname, nicknameChosen: true }); setEditing(false); changed.current?.(); }}
          onCancel={player.nicknameChosen ? () => setEditing(false) : undefined}
        />
      </div>
    );
  }

  if (player) {
    return (
      <div className="soft-chip flex items-center gap-3 !rounded-2xl px-3 py-2">
        {/* A 32px avatar from Google: next/image would need Google's image host allowed for no gain. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {player.picture ? <img src={player.picture} alt="" width={32} height={32} referrerPolicy="no-referrer" className="size-8 rounded-full" /> : null}
        <span className="min-w-0 text-sm">
          <span className="block truncate font-semibold">{player.nickname || player.name}</span>
          <span className="block text-xs text-[var(--ink-soft)]">Progress saved · <button type="button" onClick={() => setEditing(true)} className="underline">Edit nickname</button></span>
        </span>
        <button type="button" onClick={() => void signOut()} className="ml-1 text-xs font-semibold text-[var(--ink-soft)] underline">Sign out</button>
      </div>
    );
  }

  return (
    <div id="sign-in" className="grid gap-1.5">
      <div ref={button} className="h-11 overflow-hidden" /> {/* fixed height: Google's button resizes as it loads */}
      <p className="text-xs text-[var(--ink-soft)]">Keep your progress and join the leaderboards.<span className="hidden sm:inline"> Without it, progress is gone when you close the tab.</span> Gurudeep sees your name and email. <a href="/privacy" className="underline">Privacy</a></p>
      {error && <p role="alert" className="text-xs font-semibold text-[var(--bad)]">{error}</p>}
    </div>
  );
}
