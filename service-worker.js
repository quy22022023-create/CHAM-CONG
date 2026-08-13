"use strict";

const APP_VERSION = "OT Pro V8.9.1 Paper Reminder Stable";
const APP_BUILD = "20260813-03";
const CACHE_NAME = `ot-pro-${APP_BUILD}`;
const INDEX_CACHE_KEY = `./index.html?v=${APP_BUILD}`;
const CORE_ASSETS = [
  INDEX_CACHE_KEY,
  `./style.css?v=${APP_BUILD}`,
  `./script.js?v=${APP_BUILD}`,
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./image.PNG"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async cache => {
        // Một asset phụ lỗi không được làm cả Service Worker cài đặt thất bại.
        await Promise.allSettled(
          CORE_ASSETS.map(asset => cache.add(new Request(asset, { cache: "reload" })))
        );
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("ot-pro-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
      .then(async () => {
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        clients.forEach(client => {
          client.postMessage({
            type: "OTPRO_SW_ACTIVATED",
            version: APP_VERSION,
            build: APP_BUILD
          });
        });
      })
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Không cache Supabase, Google Fonts, CDN hay bất kỳ API third-party nào.
  if (url.origin !== self.location.origin) {
    return;
  }

  const isNavigation = request.mode === "navigate";
  const isAppCode =
    isNavigation ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/script.js") ||
    url.pathname.endsWith("/style.css");

  if (isAppCode) {
    event.respondWith((async () => {
      try {
        // Luôn hỏi server trước và bỏ browser HTTP cache để tránh HTML mới + JS cũ.
        const response = await fetch(request, { cache: "no-store" });

        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);

          if (isNavigation || url.pathname.endsWith("/index.html")) {
            await cache.put(INDEX_CACHE_KEY, response.clone());
          } else {
            await cache.put(request, response.clone());
          }
        }

        return response;
      } catch {
        const exact = await caches.match(request);
        if (exact) {
          return exact;
        }

        if (isNavigation || url.pathname.endsWith("/index.html")) {
          const fallback = await caches.match(INDEX_CACHE_KEY);
          if (fallback) {
            return fallback;
          }
        }

        return Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  })());
});

self.addEventListener("push", event => {
  let payload = {};

  try {
    payload = event.data?.json?.() || {};
  } catch {
    payload = {
      title: "OT Pro",
      body: event.data?.text?.() || "Bạn có thông báo mới từ OT Pro."
    };
  }

  const title = String(payload.title || "OT Pro");
  const body = String(payload.body || "Bạn có thông báo mới từ OT Pro.");
  const tag = String(payload.tag || "otpro");
  const targetUrl = new URL(String(payload.url || "./index.html"), self.registration.scope).href;

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, {
      body,
      tag,
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      data: {
        url: targetUrl,
        type: payload.type || "general"
      }
    }),
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: "OTPRO_PUSH_RECEIVED",
            notificationType: payload.type || "general"
          });
        });
      })
  ]));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || new URL("./index.html", self.registration.scope).href;

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of clients) {
      if ("focus" in client) {
        await client.focus();

        if ("navigate" in client && client.url !== targetUrl) {
          try {
            await client.navigate(targetUrl);
          } catch {
            // Nếu navigate bị chặn, focus app hiện tại vẫn tốt hơn mở trùng cửa sổ.
          }
        }

        return;
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
