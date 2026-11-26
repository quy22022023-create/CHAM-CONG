"use strict";

const APP_VERSION = "OT Pro V1.1.10";
const APP_BUILD = "20261126-04";
const CACHE_PREFIX = `ot-pro-${encodeURIComponent(new URL(self.registration.scope).pathname)}-`;
const CACHE_NAME = `${CACHE_PREFIX}${APP_BUILD}`;
const INDEX_CACHE_KEY = `./index.html?v=${APP_BUILD}`;
const CORE_ASSETS = [
  INDEX_CACHE_KEY,
  `./style.css?v=${APP_BUILD}`,
  `./script.js?v=${APP_BUILD}`,
  `./sync.js?v=${APP_BUILD}`,
  `./paper-logic.js?v=${APP_BUILD}`,
  `./features.js?v=${APP_BUILD}`,
  "./vendor/supabase-2.119.2.js",
  "./vendor/lucide-0.468.0.min.js",
  "./vendor/inter.css",
  "./manifest.json"
];
const OPTIONAL_ASSETS = [
  "./vendor/inter-cyrillic-ext.woff2",
  "./vendor/inter-cyrillic.woff2",
  "./vendor/inter-greek-ext.woff2",
  "./vendor/inter-greek.woff2",
  "./vendor/inter-vietnamese.woff2",
  "./vendor/inter-latin-ext.woff2",
  "./vendor/inter-latin.woff2",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./image.PNG"
];
const assetUrl = path => new URL(path, self.registration.scope).href;
const INDEX_URL = assetUrl(INDEX_CACHE_KEY);
const STATIC_ASSET_URLS = new Set(
  [...CORE_ASSETS, ...OPTIONAL_ASSETS].map(assetUrl)
);

async function validateAppShell(cache) {
  // Từ chối bản triển khai còn lẫn file cũ trong lúc upload lên hosting.
  const expectedMarkers = [
    [INDEX_CACHE_KEY, `name="otpro-build" content="${APP_BUILD}"`],
    [`./script.js?v=${APP_BUILD}`, `const APP_BUILD = "${APP_BUILD}";`],
    [`./sync.js?v=${APP_BUILD}`, `const OTPRO_SYNC_BUILD = "${APP_BUILD}";`],
    [`./paper-logic.js?v=${APP_BUILD}`, `const OTPRO_PAPER_BUILD = "${APP_BUILD}";`],
    [`./features.js?v=${APP_BUILD}`, `const OTPRO_FEATURE_BUILD = "${APP_BUILD}";`],
    [`./style.css?v=${APP_BUILD}`, `/* OT Pro build: ${APP_BUILD} */`]
  ];

  for (const [path, marker] of expectedMarkers) {
    const response = await cache.match(assetUrl(path));
    if (!response || !(await response.text()).includes(marker)) {
      throw new Error(`App shell build mismatch: ${path}`);
    }
  }

  for (const path of CORE_ASSETS.filter(path => path.startsWith("./vendor/"))) {
    const response = await cache.match(assetUrl(path));
    const contentType = response?.headers.get("Content-Type") || "";
    if (!response || !(/javascript|ecmascript|text\/css/i).test(contentType)) {
      throw new Error(`Invalid app dependency: ${path}`);
    }
  }
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // File thiết yếu phải được lưu đủ; nếu lỗi, worker cũ tiếp tục hoạt động.
    await cache.addAll(
      CORE_ASSETS.map(path => new Request(assetUrl(path), { cache: "reload" }))
    );
    await validateAppShell(cache);

    // Font/icon phụ lỗi không được chặn việc cài đặt toàn bộ ứng dụng.
    await Promise.allSettled(
      OPTIONAL_ASSETS.map(path => cache.add(new Request(assetUrl(path), { cache: "reload" })))
    );
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(async key => {
            if (key.startsWith(CACHE_PREFIX)) {
              return caches.delete(key);
            }

            // Dọn cache bản cũ chỉ khi chứa index của đúng thư mục app này.
            if (/^ot-pro-\d{8}-/.test(key)) {
              const oldCache = await caches.open(key);
              const oldIndex = await oldCache.match(
                assetUrl("./index.html"),
                { ignoreSearch: true }
              );
              if (oldIndex) {
                return caches.delete(key);
              }
            }
          })
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

  // API/Supabase luôn đi thẳng ra mạng; chỉ phục vụ các file tĩnh đã liệt kê.
  if (url.origin !== self.location.origin) {
    return;
  }

  const isNavigation =
    request.mode === "navigate" &&
    url.href.startsWith(self.registration.scope);

  if (!isNavigation && !STATIC_ASSET_URLS.has(url.href)) {
    return;
  }

  event.respondWith((async () => {
    // Dùng trọn bộ shell đã cài thành công để không trộn HTML mới với JS/CSS cũ.
    // Bản mới được tải qua vòng đời install/update, không ghi đè giữa phiên.
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(isNavigation ? INDEX_URL : request);
    if (cached) {
      return cached;
    }

    return fetch(request, { cache: "no-store" });
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
      renotify: payload.renotify === true,
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
