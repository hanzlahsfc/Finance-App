// Hisab service worker — app-shell offline support.
// Data offline is handled by the IndexedDB/outbox layer; this caches the shell.
const VERSION = "hisab-v1";
const SHELL = ["/", "/login", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // Never cache Supabase / API traffic — Dexie handles data offline.
  if (url.hostname.includes("supabase") || url.pathname.startsWith("/auth/")) return;

  // Static build assets: cache-first, they are content-hashed.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons")) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(e.request, copy));
            return res;
          })
      )
    );
    return;
  }

  // Navigations: serve the cached shell instantly (stale-while-revalidate);
  // the fresh copy lands in cache for the next open.
  if (e.request.mode === "navigate") {
    e.respondWith(
      caches.match(e.request).then((hit) => {
        const fresh = fetch(e.request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(e.request, copy));
            }
            return res;
          })
          .catch(() => null);
        return hit || fresh.then((r) => r || caches.match("/"));
      })
    );
    return;
  }

  // Everything else: network-first, fall back to cache.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(async () => {
        const hit = await caches.match(e.request);
        if (hit) return hit;
        return Response.error();
      })
  );
});
