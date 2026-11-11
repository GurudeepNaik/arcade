// Where a player's game data lives in the browser.
// Signed in: localStorage, and the account on the server keeps a copy.
// Not signed in: sessionStorage only, so nothing outlives the tab.

const ACCOUNT_KEY = "play.account";

/** Everything that describes a player's play. Sound and theme preferences are not player data and stay put. */
export const PLAYER_KEYS = ["play.v2", "play.levels", "play.badges.seen", "play.sudoku", "play.ludo", "play.savePrompt", "play.nickname", "play.week", "play.last"] as const;

export function signedIn(): boolean {
  try {
    return localStorage.getItem(ACCOUNT_KEY) === "1";
  } catch {
    return false;
  }
}

function move(from: Storage, to: Storage): void {
  for (const key of PLAYER_KEYS) {
    const value = from.getItem(key);
    if (value !== null) to.setItem(key, value);
    from.removeItem(key);
  }
}

let checked = false;

/** The storage player data belongs in right now. Throws when the browser has no storage; callers already catch. */
export function playerStore(): Storage {
  if (!checked) {
    checked = true;
    // Browsers from before sign-in existed hold anonymous data in localStorage: keep it for this tab only.
    if (!signedIn()) move(localStorage, sessionStorage);
  }
  return signedIn() ? localStorage : sessionStorage;
}

/** The signed-in player's name for boards, races and tables: their nickname, or their Google first name. "" when signed out. */
export function savedNickname(): string {
  try {
    return signedIn() ? (localStorage.getItem("play.nickname") ?? "") : "";
  } catch {
    return "";
  }
}

export function rememberNickname(nickname: string | null): void {
  try {
    if (nickname) localStorage.setItem("play.nickname", nickname);
    else localStorage.removeItem("play.nickname");
  } catch {
    // Without storage the name box simply shows.
  }
}

/** Signing out on purpose: the account keeps everything, so this browser keeps nothing. */
export function forgetPlayer(): void {
  setSignedIn(false);
  try {
    for (const key of PLAYER_KEYS) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  } catch {
    // No storage: nothing to forget.
  }
}

/** Signing in keeps this tab's play for good; losing the session (cookie expired) leaves it for this tab only. */
export function setSignedIn(on: boolean): void {
  try {
    if (on === signedIn()) return;
    if (on) {
      localStorage.setItem(ACCOUNT_KEY, "1");
      move(sessionStorage, localStorage);
    } else {
      localStorage.removeItem(ACCOUNT_KEY);
      move(localStorage, sessionStorage);
    }
  } catch {
    // No storage: nothing was kept anyway.
  }
}
