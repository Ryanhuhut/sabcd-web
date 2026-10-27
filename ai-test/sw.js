// ------------------------------------------------------------------
// SERVICE WORKER: cache toàn bộ file của app để chạy offline.
// MỖI LẦN SỬA CODE / THÊM FILE: thêm file mới vào ASSETS rồi chạy `node check-pwa.js --stamp` – tự tăng
// VERSION và ghi lại dấu nội dung (STAMP); điện thoại nhận bản mới khi VERSION đổi.
// `node check-pwa.js` báo lỗi nếu ASSETS thiếu/thừa hoặc code đã đổi mà chưa tăng VERSION.
// Cách chạy: cache trước, không có mới hỏi mạng (và cất lại). Link chia sẻ "#s=…" mở được offline vì
// phần sau # không gửi đi, trang vẫn là index.html trong cache.
// ------------------------------------------------------------------
const VERSION = 77;
const STAMP = 'e82dbde1323e';   // dấu nội dung ASSETS, do check-pwa.js --stamp ghi
const CACHE = 'sabcd-v' + VERSION;

const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'shapes.js',
  'section.js',
  'builder.js',
  'construct.js',
  'view.js',
  'motion.js',
  'sections.js',
  'unfold.js',
  'lesson.js',
  'ratio.js',
  'export2d.js',
  'plane2d.js',
  'theme.js',
  'icons.js',
  'anim.js',
  'capsule-slider.js',
  'state.js',
  'sabcd.js',
  'notebook.js',
  'wizard.js',
  'tools.js',
  'saves.js',
  'exportui.js',
  'codeui.js',
  'plane2d-ui.js',
  'vendor/three/build/three.module.js',
  'vendor/three/examples/jsm/controls/OrbitControls.js',
  'vendor/three/examples/jsm/renderers/CSS2DRenderer.js',
  'vendor/three/examples/jsm/lines/LineSegments2.js',
  'vendor/three/examples/jsm/lines/LineSegmentsGeometry.js',
  'vendor/three/examples/jsm/lines/LineMaterial.js',
  // xuất PDF (chỉ nạp khi bấm PDF, vẫn cache để dùng offline)
  'vendor/jspdf/jspdf.umd.min.js',
  'vendor/svg2pdf/svg2pdf.umd.min.js',
  'vendor/fonts/Tinos-Regular.ttf',
  'vendor/fonts/Tinos-Italic.ttf',
];

self.addEventListener('install', e => {
  // Như cache.addAll, nhưng trang bị máy chủ chuyển hướng (vd index.html → ./) thì cất bản sạch:
  // trình duyệt không dùng phản hồi "redirected" cho lần mở trang.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(async a => {
    const res = await fetch(new Request(a, { cache: 'reload' }));
    if (!res.ok) throw new Error(a + ': ' + res.status);
    await c.put(a, res.redirected ? new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers }) : res);
  }))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('sabcd-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // Bản riêng: cấu hình bật AI và giao diện AI (ai/…) luôn hỏi mạng, không cất (tắt AI là có hiệu lực ngay)
  if (url.pathname.includes('/ai/')) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.status === 200 && res.type === 'basic') (await caches.open(CACHE)).put(req, res.clone()).catch(() => {});
      return res;
    } catch {
      // Offline và không có trong cache: trang (kể cả có ?…) thì trả index.html
      if (req.mode === 'navigate') return caches.match('index.html');
      return Response.error();
    }
  })());
});
