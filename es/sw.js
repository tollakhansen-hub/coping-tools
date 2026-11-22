const CACHE_PREFIX = "coping-tools-es-";
const CACHE = CACHE_PREFIX + "v6";
const OFFLINE_PATH = "/es/offline";
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
  "/es/",
  "/es/about/",
  "/es/assets/app-install.js",
  "/es/assets/care-additions.css",
  "/es/assets/care-print.js",
  "/es/assets/coping-icon-192.png",
  "/es/assets/coping-icon-512.png",
  "/es/assets/coping-icon-96.png",
  "/es/assets/evidence-expand.js",
  "/es/assets/favicon-96.png",
  "/es/assets/favicon.svg",
  "/es/assets/guide-actions.css",
  "/es/assets/guide-actions.js",
  "/es/assets/language.js",
  "/es/assets/pebble-icon-180-20261006.png",
  "/es/assets/pebble-icon-192-20261006.png",
  "/es/assets/pebble-icon-512-20261006.png",
  "/es/assets/pebble-icon-96-20261006.png",
  "/es/assets/qr/all-five-guides.svg",
  "/es/assets/qr/body-wont-settle.svg",
  "/es/assets/qr/feel-low-or-shut-down.svg",
  "/es/assets/qr/mind-wont-stop.svg",
  "/es/assets/qr/print/all-five-guides.png",
  "/es/assets/qr/print/all-five-guides.svg",
  "/es/assets/qr/print/body-wont-settle.png",
  "/es/assets/qr/print/body-wont-settle.svg",
  "/es/assets/qr/print/feel-low-or-shut-down.png",
  "/es/assets/qr/print/feel-low-or-shut-down.svg",
  "/es/assets/qr/print/mind-wont-stop.png",
  "/es/assets/qr/print/mind-wont-stop.svg",
  "/es/assets/qr/print/something-has-happened.png",
  "/es/assets/qr/print/something-has-happened.svg",
  "/es/assets/qr/print/too-much-at-once.png",
  "/es/assets/qr/print/too-much-at-once.svg",
  "/es/assets/qr/something-has-happened.svg",
  "/es/assets/qr/too-much-at-once.svg",
  "/es/assets/resource-copy.js",
  "/es/assets/share-links.js",
  "/es/assets/styles.css",
  "/es/assets/tool-feedback.js",
  "/es/body-wont-settle/",
  "/es/feel-low-or-shut-down/",
  "/es/for-organisations/",
  "/es/how-tools-are-chosen/",
  "/es/manifest.webmanifest",
  "/es/mind-wont-stop/",
  "/es/not-sure/",
  OFFLINE_PATH,
  "/es/pdf/es-practical-support-all-five.pdf",
  "/es/pdf/es-practical-support-section-1.pdf",
  "/es/pdf/es-practical-support-section-2.pdf",
  "/es/pdf/es-practical-support-section-3.pdf",
  "/es/pdf/es-practical-support-section-4.pdf",
  "/es/pdf/es-practical-support-section-5.pdf",
  "/es/practical-support/",
  "/es/privacy/",
  "/es/share/",
  "/es/something-has-happened/",
  "/es/too-much-at-once/",
  "/es/update-history/"
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
          // An unavailable asset should not prevent the other files from being cached.
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
