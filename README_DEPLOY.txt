OT PRO - WEB READY
==================

1. Upload TOÀN BỘ các file trong thư mục này lên cùng một thư mục web:
   - index.html
   - script.js
   - style.css
   - manifest.json
   - service-worker.js
   - icon-192.png
   - icon-512.png
   - apple-touch-icon.png
   - image.PNG

2. Web nên chạy HTTPS để PWA/service worker hoạt động bình thường.

3. Database:
   - Bản này giữ nguyên Supabase URL/anon key hiện tại trong script.js.
   - Nếu đổi Supabase project, phải cập nhật SB_URL và SB_KEY trong script.js.
   - Database mới phải có đúng các bảng/cột mà app đang sử dụng.

4. App còn tải 3 tài nguyên online từ bên thứ ba:
   - Google Fonts (Inter)
   - Supabase JS CDN
   - Lucide Icons CDN
   Nếu các CDN này bị chặn, giao diện/font/icon hoặc kết nối Supabase có thể bị ảnh hưởng.

5. Khi cập nhật code về sau:
   - Nên đổi CACHE_NAME trong service-worker.js để trình duyệt nhận bản cache mới nhanh hơn.
   - Sau khi upload, hard refresh hoặc đóng/mở lại PWA nếu máy vẫn giữ bản cũ.

6. Không upload các file __runtime_* hoặc file kiểm thử; chúng không nằm trong gói ZIP chính thức.
