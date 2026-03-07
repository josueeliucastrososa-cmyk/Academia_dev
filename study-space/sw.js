const CACHE = 'studyspace-v2';
const STATIC = ['/index.html', '/app.html', '/css/style.css',
  '/js/auth.js', '/js/db.js', '/js/app.js',
  '/js/chat.js', '/js/notes.js', '/js/tasks.js', '/js/files.js', '/js/pomodoro.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (/\.(png|jpg|jpeg|svg|ico|webp)$/.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => { const c = res.clone(); caches.open(CACHE).then(cache => cache.put(e.request, c)); return res; })
      .catch(() => caches.match(e.request))
  );
});
