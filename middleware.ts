import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { BROWSER_COOKIE, BROWSER_COOKIE_MAX_AGE, isBrowserId, mayUseBrowserCookie } from "@/lib/browser-id";

// Visit logging. Runs at the edge for page views and résumé opens and hands the details to
// /api/visit without delaying the response. Nothing is logged when VISITS_SECRET is unset or the
// owner cookie (set by /visits/auth) is present.
export const config = {
  matcher: ["/((?!_next/|api/|visits|images/|icon|opengraph-image|twitter-image|sitemap\\.xml|robots\\.txt).*)"],
};

/** Keeps or creates the browser id and renews the cookie, so it expires a year after the last visit. */
function assignBrowserId(req: NextRequest, res: NextResponse): string | null {
  if (!mayUseBrowserCookie(req.headers.get("x-vercel-ip-country"))) return null;
  const existing = req.cookies.get(BROWSER_COOKIE)?.value;
  const browserId = isBrowserId(existing) ? existing : crypto.randomUUID();
  res.cookies.set(BROWSER_COOKIE, browserId, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: BROWSER_COOKIE_MAX_AGE });
  return browserId;
}

export function middleware(req: NextRequest, event: NextFetchEvent) {
  const res = NextResponse.next();
  const secret = process.env.VISITS_SECRET;
  if (!secret || req.method !== "GET") return res;
  if (req.cookies.get("owner")?.value === "1") return res;
  const h = req.headers;
  // Only real navigations: skip the router's prefetches and RSC payload fetches.
  if (h.get("next-router-prefetch") || h.get("rsc") || h.get("purpose") === "prefetch") return res;
  const isPdf = req.nextUrl.pathname.endsWith(".pdf");
  if (!isPdf && !(h.get("accept") ?? "").includes("text/html")) return res;

  const city = h.get("x-vercel-ip-city");
  const body = {
    path: req.nextUrl.pathname,
    query: req.nextUrl.search,
    referer: h.get("referer"),
    ua: h.get("user-agent"),
    // Chromium sends this client hint on every request; "?1" means a phone-sized device.
    mobile: h.get("sec-ch-ua-mobile") === "?1" ? true : h.get("sec-ch-ua-mobile") === "?0" ? false : null,
    ip: h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    city: city ? decodeURIComponent(city) : null,
    region: h.get("x-vercel-ip-country-region"),
    country: h.get("x-vercel-ip-country"),
    browserId: assignBrowserId(req, res),
  };
  event.waitUntil(
    fetch(new URL("/api/visit", req.url), {
      method: "POST",
      headers: { "content-type": "application/json", "x-visit-secret": secret },
      body: JSON.stringify(body),
    }).catch(() => undefined),
  );
  return res;
}
