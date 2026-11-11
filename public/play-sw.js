// The Arcade's service worker. Scope: /play. Keeps the app opening offline and receives streak reminders.
// Bump VERSION to drop old caches after a change to this file.
const VERSION = "arcade-v1";
const SHELL = ["/play", "/play/icons/icon-192.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // Build files have content hashes in their names, so a cached copy is always right.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/play/icons/")) {
    event.respondWith(
      caches.match(request).then(hit => hit || fetch(request).then(res => {
        if (res.ok) caches.open(VERSION).then(cache => cache.put(request, res.clone()));
        return res;
      })),
    );
    return;
  }

  // Pages: always try the network for fresh puzzles and scores, fall back to the last copy offline.
  if (request.mode === "navigate" && url.pathname.startsWith("/play")) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) caches.open(VERSION).then(cache => cache.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match("/play"))),
    );
  }
});

self.addEventListener("push", event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "The Arcade", {
      body: data.body || "Today's puzzles are waiting.",
      icon: "/play/icons/icon-192.png",
      badge: "/play/icons/icon-192.png",
      tag: data.tag || "arcade",
      data: { url: data.url || "/play#today" },
    }),
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/play", location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const open = list.find(c => c.url.startsWith(location.origin + "/play"));
      if (open) return open.navigate(target).then(c => c && c.focus());
      return self.clients.openWindow(target);
    }),
  );
});
