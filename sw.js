const CACHE_NAME = "fitnesshelp-static-v4";

const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles/base.css",
  "./styles/layout.css",
  "./styles/form.css",
  "./styles/timer.css",
  "./styles/saved.css",
  "./js/main.js",
  "./js/constants.js",
  "./js/util.js",
  "./js/hooks.js",
  "./js/dom.js",
  "./js/storage.js",
  "./js/audio.js",
  "./js/transfer.js",
  "./js/form.js",
  "./js/timer.js",
  "./js/shell.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/**
 * Network-first for app shell so updates (nieuwe knoppen e.d.) niet blijven hangen
 * achter een oude PWA-cache. Offline valt terug op cache.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          return caches.match("./index.html");
        }
        return undefined;
      })
  );
});
