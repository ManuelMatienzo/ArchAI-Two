/* Service Worker de ArchAI — CU-09 · Modelado Móvil y Modo Offline (PWA)
 * Estrategia de Caching:
 * - Navegación / Documentos HTML: Red primero (Network First) con fallback a caché.
 *   Garantiza que al dar F5 se sirva de inmediato el nuevo index.html con los bundles
 *   actualizados, sin quedar atrapado en versiones viejas que obligaban a dar Ctrl+F5.
 * - API (/api/): Red primero con fallback a caché para soporte offline y reanudación.
 * - En entorno localhost/desarrollo: Red primero siempre.
 * - Assets estáticos en producción: Caché primero con fallback a red.
 */
const VERSION = 'archai-v5-account-sessions';
const CACHE_PALABRA = `${VERSION}-static`;
const CACHE_API = `${VERSION}-api`;

const ASSETS_INICIALES = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_PALABRA)
      .then((cache) => cache.addAll(ASSETS_INICIALES))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_PALABRA && k !== CACHE_API).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Solo manejar peticiones GET del mismo origen
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Authenticated API data belongs to a specific account. Session recovery uses scoped IndexedDB.
  if (url.pathname.startsWith('/api/')) return;

  // 2. Navegación HTML / Raíz: RED PRIMERO (Network First)
  // Esto resuelve que al presionar F5 se reciba siempre la versión real más reciente
  const esNavegacionOIndex =
    request.mode === 'navigate' ||
    request.headers.get('accept')?.includes('text/html') ||
    url.pathname === '/' ||
    url.pathname === '/index.html';

  if (esNavegacionOIndex) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE_PALABRA).then((c) => c.put(request, copia)).catch(() => {});
          }
          return resp;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // 3. Si estamos en desarrollo local (localhost / 127.0.0.1): red primero
  const esLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (esLocalhost) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const copia = resp.clone();
            caches.open(CACHE_PALABRA).then((c) => c.put(request, copia)).catch(() => {});
          }
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 4. Assets estáticos: caché primero con fallback a red
  event.respondWith(
    caches.match(request)
      .then((enCache) => enCache || fetch(request).then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE_PALABRA).then((c) => c.put(request, copia)).catch(() => {});
        }
        return resp;
      }))
      .catch(() => caches.match('/index.html'))
  );
});