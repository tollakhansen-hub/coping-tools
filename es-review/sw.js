const CACHE_PREFIX = "coping-tools-fundaeps-es-review-";
const CACHE = CACHE_PREFIX + "v4";
const OFFLINE_PATH = "/es-review/offline";
const CORE = [
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
  "/es-review/",
  "/es-review/404.html",
  "/es-review/about/",
  "/es-review/assets/app-install.js",
  "/es-review/assets/care-additions.css",
  "/es-review/assets/care-print.js",
  "/es-review/assets/coping-icon-192.png",
  "/es-review/assets/coping-icon-512.png",
  "/es-review/assets/coping-icon-96.png",
  "/es-review/assets/evidence-expand.js",
  "/es-review/assets/favicon-96.png",
  "/es-review/assets/favicon.svg",
  "/es-review/assets/guide-actions.css",
  "/es-review/assets/guide-actions.js",
  "/es-review/assets/language.js",
  "/es-review/assets/pebble-icon-180-20261006.png",
  "/es-review/assets/pebble-icon-192-20261006.png",
  "/es-review/assets/pebble-icon-512-20261006.png",
  "/es-review/assets/pebble-icon-96-20261006.png",
  "/es-review/assets/qr/all-five-guides.svg",
  "/es-review/assets/qr/body-wont-settle.svg",
  "/es-review/assets/qr/feel-low-or-shut-down.svg",
  "/es-review/assets/qr/mind-wont-stop.svg",
  "/es-review/assets/qr/print/all-five-guides.png",
  "/es-review/assets/qr/print/all-five-guides.svg",
  "/es-review/assets/qr/print/body-wont-settle.png",
  "/es-review/assets/qr/print/body-wont-settle.svg",
  "/es-review/assets/qr/print/feel-low-or-shut-down.png",
  "/es-review/assets/qr/print/feel-low-or-shut-down.svg",
  "/es-review/assets/qr/print/mind-wont-stop.png",
  "/es-review/assets/qr/print/mind-wont-stop.svg",
  "/es-review/assets/qr/print/something-has-happened.png",
  "/es-review/assets/qr/print/something-has-happened.svg",
  "/es-review/assets/qr/print/too-much-at-once.png",
  "/es-review/assets/qr/print/too-much-at-once.svg",
  "/es-review/assets/qr/something-has-happened.svg",
  "/es-review/assets/qr/too-much-at-once.svg",
  "/es-review/assets/resource-copy.js",
  "/es-review/assets/share-links.js",
  "/es-review/assets/styles.css",
  "/es-review/assets/tool-feedback.js",
  "/es-review/body-wont-settle/",
  "/es-review/feel-low-or-shut-down/",
  "/es-review/for-organisations/",
  "/es-review/how-tools-are-chosen/",
  "/es-review/manifest.webmanifest",
  "/es-review/mind-wont-stop/",
  "/es-review/not-sure/",
  OFFLINE_PATH,
  "/es-review/pdf/es-practical-support-all-five.pdf",
  "/es-review/pdf/es-practical-support-section-1.pdf",
  "/es-review/pdf/es-practical-support-section-2.pdf",
  "/es-review/pdf/es-practical-support-section-3.pdf",
  "/es-review/pdf/es-practical-support-section-4.pdf",
  "/es-review/pdf/es-practical-support-section-5.pdf",
  "/es-review/practical-support/",
  "/es-review/privacy/",
  "/es-review/share/",
  "/es-review/something-has-happened/",
  "/es-review/too-much-at-once/",
  "/es-review/update-history/"
];
const allowed = new Set(CORE);

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const pending = [...CORE];
    await Promise.all(Array.from({ length: 5 }, async () => {
      while (pending.length) {
        const path = pending.shift();
        try {
          const response = await fetch(path, { cache: "reload" });
          if (response.ok && !response.redirected) await cache.put(path, response);
        } catch {
          // One unavailable download should not block the rest of the preview.
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
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !allowed.has(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected) {
        const copy = response.clone();
        event.waitUntil(cache.put(url.pathname, copy).catch(() => {}));
      }
      return response;
    } catch {
      const cached = await cache.match(url.pathname);
      if (cached) return cached;
      if (request.mode === "navigate") {
        const offline = await cache.match(OFFLINE_PATH);
        if (offline) return offline;
      }
      return Response.error();
    }
  })());
});
