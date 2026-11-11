import { timingSafeEqual } from "node:crypto";
import { recordVisit, type VisitInput } from "@/lib/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameSecret(given: string | null): boolean {
  const expected = process.env.VISITS_SECRET;
  if (!expected || !given || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(req: Request): Promise<Response> {
  if (!sameSecret(req.headers.get("x-visit-secret"))) return new Response(null, { status: 401 });
  let body: VisitInput;
  try {
    body = (await req.json()) as VisitInput;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof body.path !== "string") return new Response(null, { status: 400 });
  try {
    await recordVisit(body);
  } catch (err) {
    console.error("visit not recorded", err);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
