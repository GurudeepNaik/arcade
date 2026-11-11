import { subFromCookies } from "@/lib/games/account";
import { addFriend, cleanCode, friendCode, inviterName, listFriends } from "@/lib/games/friends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "cache-control": "private, no-store" };

/** ?code=… : who sent this invite (first name only, works signed out). Otherwise: my code and my friends. */
export async function GET(req: Request): Promise<Response> {
  const code = cleanCode(new URL(req.url).searchParams.get("code"));
  if (code) {
    const name = await inviterName(code).catch(() => null);
    return name ? Response.json({ name }, { headers: PRIVATE }) : Response.json({ error: "This invite link doesn't work." }, { status: 404 });
  }
  const sub = subFromCookies(req.headers.get("cookie"));
  if (!sub) return Response.json({ error: "Sign in to add friends" }, { status: 401 });
  try {
    const [mine, friends] = await Promise.all([friendCode(sub), listFriends(sub)]);
    return Response.json({ code: mine, friends }, { headers: PRIVATE });
  } catch (err) {
    console.error("friends not loaded", err);
    return Response.json({ error: "Couldn't load your friends." }, { status: 500 });
  }
}

/** Accepts an invite: both players become friends. */
export async function POST(req: Request): Promise<Response> {
  const sub = subFromCookies(req.headers.get("cookie"));
  if (!sub) return Response.json({ error: "Sign in to add friends" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
  const code = cleanCode(body?.code);
  if (!code) return Response.json({ error: "This invite link doesn't work." }, { status: 400 });
  try {
    const out = await addFriend(sub, code);
    if ("friend" in out) return Response.json(out);
    return Response.json({ error: out.error === "self" ? "That's your own invite link." : "This invite link doesn't work." }, { status: out.error === "self" ? 409 : 404 });
  } catch (err) {
    console.error("friend not added", err);
    return Response.json({ error: "Couldn't add your friend. Try again." }, { status: 500 });
  }
}
