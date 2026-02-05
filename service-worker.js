// Service Worker cho Chấm Công Pro PWA
const CACHE_NAME = 'cham-cong-pro-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/supabase-client.js',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Cài đặt Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

// Kích hoạt Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Xử lý fetch requests
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Trả về file từ cache nếu có
                if (response) {
                    return response;
                }

                // Nếu không có trong cache, fetch từ network
                return fetch(event.request)
                    .then(response => {
                        // Kiểm tra response hợp lệ
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone response để lưu vào cache
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Fallback cho các trang
                        if (event.request.url.includes('/index.html')) {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// Xử lý thông báo push
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'Thông báo từ Chấm Công Pro',
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Mở ứng dụng',
                icon: 'icon-192.png'
            },
            {
                action: 'close',
                title: 'Đóng',
                icon: 'icon-192.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Chấm Công Pro', options)
    );
});

// Xử lý click vào thông báo
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Xử lý sync
self.addEventListener('sync', event => {
    if (event.tag === 'sync-records') {
        event.waitUntil(syncRecords());
    }
});

async function syncRecords() {
    // Logic đồng bộ dữ liệu
    // Triển khai khi cần
}