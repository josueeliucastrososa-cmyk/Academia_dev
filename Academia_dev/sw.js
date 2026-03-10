// ═══════════════════════════════════════════════════════════════
// SERVICE WORKER — Academia Dev
// Estrategia: Network First para app, Cache First para assets
// Compatible con PWABuilder, TWA (Play Store) y Widgets futuros
// ═══════════════════════════════════════════════════════════════

const CACHE_VERSION  = 'academia-v9';
const CACHE_STATIC   = `${CACHE_VERSION}-static`;
const CACHE_PAGES    = `${CACHE_VERSION}-pages`;
const CACHE_ASSETS   = `${CACHE_VERSION}-assets`;

// Archivos críticos — se cachean en install, app funciona offline con ellos
const STATIC_SHELL = [
  '/',
  '/index.html',
  '/auth-page.html',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable-192.png',
  '/assets/icons/icon-maskable-512.png',
];

// JS de la app — se cachean en install
const APP_SCRIPTS = [
  '/js/auth.js',
  '/js/db.js',
  '/js/academia-sync.js',
  '/js/app.js',
  '/js/calificaciones.js',
  '/js/tasks.js',
  '/js/calendar.js',
  '/js/notes.js',
  '/js/chrono.js',
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      // Cachear shell estático
      caches.open(CACHE_STATIC).then(cache =>
        Promise.allSettled(STATIC_SHELL.map(url =>
          cache.add(new Request(url, { cache: 'reload' }))
        ))
      ),
      // Cachear scripts de la app
      caches.open(CACHE_PAGES).then(cache =>
        Promise.allSettled(APP_SCRIPTS.map(url =>
          cache.add(new Request(url, { cache: 'reload' }))
        ))
      ),
    ]).then(() => {
      console.log('[SW] Install completo — academia-v9');
      self.skipWaiting();
    })
  );
});

// ── ACTIVATE — limpiar caches viejas ────────────────────────
self.addEventListener('activate', e => {
  const VALID_CACHES = [CACHE_STATIC, CACHE_PAGES, CACHE_ASSETS];
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !VALID_CACHES.includes(k))
          .map(k => {
            console.log('[SW] Eliminando cache vieja:', k);
            return caches.delete(k);
          })
      )
    ).then(() => {
      console.log('[SW] Activate completo — tomando control');
      self.clients.claim();
    })
  );
});

// ── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Solo manejar peticiones al mismo origen
  if (url.origin !== self.location.origin) return;

  // No interceptar peticiones a Supabase API
  if (url.hostname.includes('supabase.co')) return;

  // No interceptar peticiones POST/PUT/DELETE (formularios, sync)
  if (req.method !== 'GET') return;

  const path = url.pathname;

  // ── JS / HTML / CSS: Network First (siempre código fresco) ──
  if (/\.(js|html|css)$/.test(path) || path === '/' || path === '/index.html') {
    e.respondWith(networkFirstStrategy(req, CACHE_PAGES));
    return;
  }

  // ── Imágenes / fuentes / íconos: Cache First ────────────────
  if (/\.(png|jpg|jpeg|svg|ico|webp|woff|woff2|ttf)$/.test(path)) {
    e.respondWith(cacheFirstStrategy(req, CACHE_ASSETS));
    return;
  }

  // ── Resto: Network First con fallback ───────────────────────
  e.respondWith(networkFirstStrategy(req, CACHE_PAGES));
});

// ── ESTRATEGIAS ──────────────────────────────────────────────

// Network First: intenta red, si falla usa caché
async function networkFirstStrategy(req, cacheName) {
  try {
    const networkRes = await fetch(req);
    if (networkRes.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, networkRes.clone());
    }
    return networkRes;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    // Fallback final: devolver index.html para rutas de la SPA
    return caches.match('/index.html');
  }
}

// Cache First: sirve desde caché, actualiza en background
async function cacheFirstStrategy(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) {
    // Actualizar en background sin bloquear
    fetchAndCache(req, cacheName);
    return cached;
  }
  return fetchAndCache(req, cacheName);
}

async function fetchAndCache(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    return new Response('', { status: 408 });
  }
}

// ── WIDGET SUPPORT (futuro) ──────────────────────────────────
// Cuando el SW recibe un mensaje para actualizar datos del widget
self.addEventListener('widgetinstall',   e => handleWidgetEvent(e, 'install'));
self.addEventListener('widgetuninstall', e => handleWidgetEvent(e, 'uninstall'));
self.addEventListener('widgetresume',    e => handleWidgetEvent(e, 'resume'));

async function handleWidgetEvent(e, type) {
  const widget = e.widget;
  if (!widget) return;

  if (type === 'install' || type === 'resume') {
    // Datos del widget — se leen desde localStorage/cache cuando estén disponibles
    const payload = {
      tasks: [],
      updatedAt: new Date().toISOString(),
      message: 'Abre Academia para ver tus tareas actualizadas'
    };

    if (self.widgets) {
      e.waitUntil(
        self.widgets.updateByTag(widget.definition.tag, {
          data: JSON.stringify(payload),
        })
      );
    }
  }
}

// ── MENSAJES desde la app ────────────────────────────────────
self.addEventListener('message', e => {
  if (!e.data) return;

  // La app puede pedir que el SW actualice el widget con datos frescos
  if (e.data.type === 'UPDATE_WIDGET') {
    if (self.widgets) {
      self.widgets.updateByTag('tareas-widget', {
        data: JSON.stringify(e.data.payload || {}),
      });
    }
  }

  // Forzar actualización inmediata del SW
  if (e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── BACKGROUND SYNC (futuro: guardar offline) ────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'sync-academia-data') {
    console.log('[SW] Background sync: academia-data');
    // La próxima vez que haya red, la app sincroniza automáticamente
    // No necesitamos hacer nada aquí porque academia-sync.js
    // lo maneja cuando visibilitychange/focus se disparan
  }
});

console.log('[SW] academia-v9 cargado');
