import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /owner?key=… marks this browser as the owner's, so the visit log, click log and game stats leave its
 * activity out (the portfolio does the same at /visits/auth). Wrong or missing key: a plain 404.
 */
export function GET(req: Request): Response {
  const expected = process.env.OWNER_KEY ?? "";
  const given = new URL(req.url).searchParams.get("key") ?? "";
  const ok = expected.length > 0 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new Response(null, { status: 404 });
  const res = NextResponse.redirect(new URL("/play", req.url));
  res.cookies.set("owner", "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return res;
}
