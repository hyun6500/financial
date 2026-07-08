/* JH 장부 서비스워커 — 앱 셸 캐시 (오프라인에서도 스냅샷 데이터로 동작) */
const CACHE = 'jh-ledger-v1';
const SHELL = [
  './', './index.html', './css/style.css', './data.js', './manifest.json',
  './js/config.js', './js/utils.js', './js/store.js', './js/insights.js', './js/charts.js',
  './js/story.js', './js/app.js',
  './js/views/home.js', './js/views/spend.js', './js/views/asset.js', './js/views/feed.js', './js/views/hall.js',
  './icons/icon-192.png', './icons/icon-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Apps Script API는 항상 네트워크 우선
  if (url.hostname.includes('script.google')) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit ||
      fetch(e.request).then(res => {
        if (url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }))
  );
});
