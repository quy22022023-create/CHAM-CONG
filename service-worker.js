const CACHE_NAME = 'ot-pro-v3.4-cache';
const assetsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap'
];

// Cài đặt và lưu trữ tài nguyên mới vào cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assetsToCache);
    })
  );
  self.skipWaiting();
});

// Kích hoạt và dọn dẹp các bản cache cũ (V3.2, V3.3)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Kiểm soát yêu cầu mạng
self.addEventListener('fetch', event => {
  // Tuyệt đối không cache dữ liệu từ Supabase để đảm bảo ghi chú và giờ giấc luôn chính xác
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
