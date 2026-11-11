// QuickCart Service Worker v3 — network-first, offline fallback
const CACHE = 'quickcart-v6';
const PRECACHE = ['/', '/index.html', '/landing.html', '/store.html', '/pos.html', '/shop.html', '/qc-db.js', '/qc-live.js', '/assets/shop.css', '/assets/shop.js', '/assets/landing.css', '/assets/landing.js', '/assets/geist-icons.js', '/assets/geist-landing.css'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    // add one by one so a single missing file never blocks installation
    return Promise.all(PRECACHE.map(function (u) { return c.add(u).catch(function () {}); }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = req.url;
  // never touch writes, payment/API calls, Firebase or Paystack
  if (req.method !== 'GET' || url.includes('/api/') || url.includes('firebaseio.com') ||
      url.includes('paystack')) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && url.startsWith(self.location.origin)) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () { return caches.match(req); })
  );
});
