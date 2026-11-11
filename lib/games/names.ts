// Name rules shared by the leaderboard, live tables and share cards. No server-only imports, so the
// image route at the edge can use it too.

const BLOCKED_WORDS = /fuck|shit|bitch|cunt|nigg|fag|rape|porn|chutiya|madarchod|bhenchod|randi/i;

/** Trims a typed name to something safe to show publicly, or null when it is not acceptable. */
export function cleanName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!/^[\p{L}\p{N} .'_-]{2,20}$/u.test(name) || BLOCKED_WORDS.test(name)) return null;
  return name;
}

/** A name as a ref tag: "Priya K" becomes "priya-k", so the visit log shows who shared. */
export function refTag(name: string | null): string {
  const slug = (name ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return slug ? `share-${slug}` : "share";
}
