"use client";

import { useCallback, useEffect, useState } from "react";
import { signedIn } from "@/lib/games/store";
import { SavePrompt } from "./SavePrompt";

// Invite links look like /play?friend=abcd2345. Opening one while signed in adds the friend straight away;
// signed out, the code waits in this tab until the player signs in.

const PENDING_KEY = "play.friendInvite";
const pending = {
  get: () => { try { return sessionStorage.getItem(PENDING_KEY); } catch { return null; } },
  set: (code: string) => { try { sessionStorage.setItem(PENDING_KEY, code); } catch { /* lasts as long as the URL does */ } },
  clear: () => { try { sessionStorage.removeItem(PENDING_KEY); } catch { /* nothing kept */ } },
};

async function accept(code: string): Promise<{ friend?: string; error?: string }> {
  const res = await fetch("/api/play/friends", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) }).catch(() => null);
  return ((await res?.json().catch(() => ({}))) ?? { error: "Couldn't add your friend. Try again." }) as { friend?: string; error?: string };
}

/** The banner for someone who opened a friend's invite link. */
export function FriendInvite({ onAdded }: { onAdded?: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [inviter, setInviter] = useState("");
  const [message, setMessage] = useState("");

  const finish = useCallback(async (c: string) => {
    const out = await accept(c);
    pending.clear();
    setMessage(out.friend ? `You and ${out.friend} are now friends. Their scores show on your Friends board.` : out.error ?? "");
    if (out.friend) onAdded?.();
  }, [onAdded]);

  useEffect(() => {
    const url = new URL(location.href);
    const fromUrl = url.searchParams.get("friend");
    if (fromUrl) {
      url.searchParams.delete("friend");
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
      pending.set(fromUrl);
    }
    const c = fromUrl ?? pending.get();
    if (!c) return;
    setCode(c);
    if (signedIn()) void finish(c);
    else
      fetch(`/api/play/friends?code=${encodeURIComponent(c)}`)
        .then(r => r.json() as Promise<{ name?: string; error?: string }>)
        .then(d => (d.name ? setInviter(d.name) : (pending.clear(), setMessage(d.error ?? ""))))
        .catch(() => undefined);
  }, [finish]);

  if (message) return <p role="status" className="play-rise arcade-panel mt-5 p-4 text-center font-semibold">{message}</p>;
  if (!code || !inviter) return null;
  return <SavePrompt always title={`${inviter} invited you`} reason={`Sign in with Google to add ${inviter} as a friend and compare scores.`} onSaved={() => void finish(code)} />;
}

/** Signed-in players: their invite link and their friends. */
export function FriendsCard() {
  const [data, setData] = useState<{ code: string | null; friends: { name: string; picture: string }[] } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!signedIn()) return;
    fetch("/api/play/friends")
      .then(r => (r.ok ? r.json() : null) as Promise<typeof data>)
      .then(setData)
      .catch(() => undefined);
  }, []);

  if (!data?.code) return null;
  const link = `${location.origin}/play?friend=${data.code}`;

  const share = async () => {
    const text = "Play The Arcade with me: daily puzzles, 100 levels each, and a friends leaderboard.";
    try {
      if (navigator.share) {
        await navigator.share({ title: "The Arcade", text, url: link });
        return;
      }
      await navigator.clipboard.writeText(link);
      setNote("Link copied. Send it to a friend.");
    } catch (err) {
      if ((err as Error).name !== "AbortError") setNote(`Copy this link: ${link}`);
    }
  };

  return (
    <section aria-labelledby="friends-title" className="arcade-panel mt-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="friends-title" className="arcade-title text-xl">Friends</h2>
          <p className="text-sm text-[var(--ink-soft)]">
            {data.friends.length ? `${data.friends.length} ${data.friends.length === 1 ? "friend" : "friends"} on your Friends board.` : "Invite friends to get a leaderboard of just you and them."}
          </p>
        </div>
        <button type="button" onClick={() => void share()} className="arcade-btn !min-h-11 !px-5 !text-base">Invite friends</button>
      </div>
      {note && <p role="status" className="mt-2 break-all text-sm">{note}</p>}
      {data.friends.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {data.friends.map((f, i) => (
            <li key={`${f.name}-${i}`} className="soft-chip flex items-center gap-2 py-1 pe-3 ps-1 text-sm font-semibold">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.picture ? <img src={f.picture} alt="" width={24} height={24} referrerPolicy="no-referrer" className="size-6 rounded-full" /> : <span aria-hidden className="size-6 rounded-full bg-[var(--well-2)]" />}
              {f.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
