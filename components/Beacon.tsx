"use client";

import { useEffect } from "react";

// Reports clicks on outbound links, the résumé, and anything with data-track="name" to
// /api/click, so the visit log can show what a visitor actually opened. Fire-and-forget.
export function Beacon() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      let url: URL;
      try {
        url = new URL(a.href, location.href);
      } catch {
        return;
      }
      const external = url.origin !== location.origin;
      const isResume = /\.pdf$/i.test(url.pathname);
      const name = a.dataset.track ?? (external ? url.hostname.replace(/^www\./, "") : isResume ? "resume" : null);
      if (!name) return;
      const body = JSON.stringify({
        name,
        href: url.href.slice(0, 300),
        path: location.pathname,
        text: (a.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || null,
      });
      const sent = navigator.sendBeacon?.("/api/click", new Blob([body], { type: "application/json" }));
      if (!sent) fetch("/api/click", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => undefined);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);
  return null;
}
