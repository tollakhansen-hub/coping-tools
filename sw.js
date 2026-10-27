const CACHE = "coping-tools-v28";
const PAGES = new Set(["/","/body-wont-settle/","/mind-wont-stop/","/too-much-at-once/","/feel-low-or-shut-down/","/something-has-happened/","/not-sure/","/about/","/for-organisations/","/how-tools-are-chosen/","/update-history/","/privacy/"]);
const CORE = [
  "/assets/pebble-icon-96-20261006.png",
  "/assets/pebble-icon-180-20261006.png",
  "/assets/pebble-icon-192-20261006.png",
  "/assets/pebble-icon-512-20261006.png",
  "/favicon.ico",
  "/",
  "/body-wont-settle/",
  "/mind-wont-stop/",
  "/too-much-at-once/",
  "/feel-low-or-shut-down/",
  "/something-has-happened/",
  "/not-sure/",
  "/about/",
  "/for-organisations/",
  "/how-tools-are-chosen/",
  "/update-history/","/privacy/",
  "/assets/app-install.js",
  "/assets/evidence-expand.js",
  "/assets/tool-feedback.js",
  "/assets/guide-actions.js?v=20261026-source-note",
  "/assets/guide-actions.css?v=20261026-source-note",
  "/assets/coping-icon-192.png",
  "/assets/coping-icon-512.png",
  "/assets/coping-icon-96.png",
  "/assets/favicon-96.png",
  "/assets/favicon.svg",
  "/assets/fonts/atkinson-next-v7-italic-latin-ext.woff2",
  "/assets/fonts/atkinson-next-v7-italic-latin.woff2",
  "/assets/fonts/atkinson-next-v7-normal-latin-ext.woff2",
  "/assets/fonts/atkinson-next-v7-normal-latin.woff2",
  "/assets/fonts/literata-v40-normal-latin-ext.woff2",
  "/assets/fonts/literata-v40-normal-latin.woff2",
  "/assets/styles.css?v=20261018-stages",
  "/assets/styles.css?v=20261024-feedback",
  "/assets/styles.css?v=20261024-feedback-tight",
  "/assets/styles.css?v=20261025-two-line-professional-nav",
  "/assets/styles.css?v=20261027-home-footer-spacing",
  "/assets/styles.css?v=20261027-disclaimer-marker",
  "/manifest.webmanifest"
];
const ALLOWED = new Set(CORE);

function cacheKey(request) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return null;
  // Exact keys exclude APIs, Cloudflare endpoints and arbitrary query strings.
  const key = url.pathname + url.search;
  return ALLOWED.has(key) ? key : null;
}

function cacheable(response, request) {
  return response.status === 200 &&
    response.type === "basic" &&
    !response.redirected &&
    response.url === request.url &&
    !/\bno-store\b/i.test(response.headers.get("Cache-Control") || "");
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Precache public routes; an unavailable optional asset must not prevent
    // the service worker from updating the whole site.
    const pending = [...CORE];
    await Promise.all(Array.from({ length: 5 }, async () => {
      while (pending.length) {
        const path = pending.shift();
        try {
          const request = new Request(path, { cache: "reload" });
          const response = await fetch(request);
          if (response.ok && !response.redirected && response.type !== "opaque") {
            await cache.put(path, response);
          }
        } catch {
          // Online access still works. A later successful visit can fill the cache.
        }
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("coping-tools-") && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const key = cacheKey(event.request);
  if (!key) return;

  event.respondWith((async () => {
    try {
      // Revalidate online, including privacy and evidence pages.
      const response = await fetch(event.request, { cache: "no-cache" });
      if (cacheable(response, event.request)) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE)
          .then(cache => cache.put(key, copy))
          .catch(() => {}));
      }
      return response;
    } catch {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(key);
      if (hit) return hit;
      if (event.request.mode === "navigate" && PAGES.has(key)) {
        const home = await cache.match("/");
        if (home) return home;
      }
      return Response.error();
    }
  })());
});
