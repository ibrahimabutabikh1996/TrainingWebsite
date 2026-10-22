/* The service worker that makes the site installable as an app.
 *
 * Deliberately narrow. It keeps two things and nothing else:
 *
 *   - the build's static files (`/_next/static`, the fonts, the logos), which
 *     carry their version in their name or never change, so a stored copy is
 *     always right;
 *   - the `/offline` page, shown when a page cannot be reached at all.
 *
 * Pages themselves are never stored, and neither is anything under `/api`.
 * They belong to one signed-in person — a profile, a training log, a diet
 * plan — and `next.config.ts` marks them `no-store` for exactly that reason.
 * A worker that cached them would hand one trainee's screen to whoever opens
 * the app next on the same phone.
 *
 * Bump VERSION to drop everything stored by an older worker.
 */

const VERSION = "v1";
const CACHE = `static-${VERSION}`;
const OFFLINE_URL = "/offline";

/* Static paths whose content never changes under the same address. */
const STATIC_PREFIXES = ["/_next/static/", "/fonts/", "/images/logo/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const response = await fetch(OFFLINE_URL, { cache: "reload" });
      await cache.put(OFFLINE_URL, response.clone());

      /* The offline page is useless without its stylesheet and the logo it
         shows, and nothing guarantees the visitor has loaded them before. */
      const html = await response.text();
      const assets = [
        ...new Set(
          [...html.matchAll(/(?:href|src)="(\/(?:_next\/static\/|_next\/image\?|images\/logo\/)[^"]+)"/g)].map(
            (match) => match[1].replace(/&amp;/g, "&")
          )
        ),
      ];
      await Promise.all(assets.map((url) => cache.add(url).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* A page: always from the network. Only when the network is gone entirely
     does the stored offline page stand in. */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || Response.error())
    );
    return;
  }

  /* An optimised image: the network first, and the stored copy only for the
     offline page's own logo, which install put there. */
  if (url.pathname === "/_next/image") {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(request)) || Response.error())
    );
    return;
  }

  if (!STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })()
  );
});
