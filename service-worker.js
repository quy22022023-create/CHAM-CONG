"use strict";

const CACHE_VERSION = "ot-pro-v8-7-1";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css?v=8.7.1",
  "./script.js?v=8.7.1",
  "./manifest.json",
  "./image.PNG"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_FILES))
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames =>
        Promise.all(
          cacheNames
            .filter(cacheName => cacheName !== CACHE_VERSION)
            .map(cacheName => caches.delete(cacheName))
        )
      ),

      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, {
        cache: "no-store"
      })
        .then(async response => {
          const cache = await caches.open(CACHE_VERSION);

          await cache.put(
            "./index.html",
            response.clone()
          );

          return response;
        })
        .catch(() => caches.match("./index.html"))
    );

    return;
  }

  event.respondWith(
    fetch(request)
      .then(async response => {
        const cache = await caches.open(CACHE_VERSION);

        await cache.put(
          request,
          response.clone()
        );

        return response;
      })
      .catch(() => caches.match(request))
  );
});