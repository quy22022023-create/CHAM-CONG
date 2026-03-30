
const CACHE_NAME = 'ot-pro-v3.2-cache';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Cài đặt Service Worker và lưu cache các file tĩnh
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Lấy dữ liệu (Fetch): Ưu tiên mạng, nếu mất mạng thì lấy từ cache
self.addEventListener('fetch', event => {
  // Bỏ qua các request gọi tới Supabase (database) vì nó cần dữ liệu thực tế
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Xóa cache cũ khi có phiên bản mới
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
