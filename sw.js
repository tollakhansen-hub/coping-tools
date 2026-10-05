const CACHE = "coping-tools-v6";
const PAGES = new Set(["/","/body-wont-settle/","/mind-wont-stop/","/too-much-at-once/","/feel-low-or-shut-down/","/something-has-happened/","/not-sure/","/about/","/how-tools-are-chosen/","/privacy/"]);
const CORE = [
  "/",
  "/body-wont-settle/",
  "/mind-wont-stop/",
  "/too-much-at-once/",
  "/feel-low-or-shut-down/",
  "/something-has-happened/",
  "/not-sure/",
  "/about/",
  "/how-tools-are-chosen/",
  "/privacy/",
  "/assets/app-install.js",
  "/assets/coping-icon-192.png",
  "/assets/coping-icon-512.png",
  "/assets/coping-icon-96.png",
  "/assets/favicon-96.png",
  "/assets/favicon.svg",
  "/assets/fonts/atkinson-next-v7-italic-latin-ext.woff2",
  "/assets/fonts/atkinson-next-v7-italic-latin.woff2",
  "/assets/fonts/atkinson-next-v7-normal-latin-ext.woff2",
  "/assets/fonts/atkinson-next-v7-normal-latin.woff2",
  "/assets/fonts/literata-v40-normal-cyrillic-ext.woff2",
  "/assets/fonts/literata-v40-normal-cyrillic.woff2",
  "/assets/fonts/literata-v40-normal-greek-ext.woff2",
  "/assets/fonts/literata-v40-normal-greek.woff2",
  "/assets/fonts/literata-v40-normal-latin-ext.woff2",
  "/assets/fonts/literata-v40-normal-latin.woff2",
  "/assets/fonts/literata-v40-normal-vietnamese.woff2",
  "/assets/styles.css?v=20261001",
  "/assets/styles.css?v=20261005",
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
    // Fetch every public route, not a visitor-specific selection of pages.
    await cache.addAll(CORE.map(path => new Request(path, { cache: "reload" })));
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
