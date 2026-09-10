// La descarga solo comienza cuando el jugador pulsa Preparar copia sin conexión.
const META = 'oplike-offline-meta', POINTER = '/__oplike_offline_active__', PREFIX = 'oplike-offline-';
let downloading = false;
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
async function activeCache() {
  const meta = await caches.open(META), response = await meta.match(POINTER);
  return response ? response.text() : null;
}
self.addEventListener('message', event => {
  if (event.data?.type !== 'prepare-offline' || !event.ports[0]) return;
  const port = event.ports[0];
  event.waitUntil((async () => {
    if (downloading) { port.postMessage({ error: 'Ya hay una descarga en curso en otra ventana.' }); return; }
    downloading = true; let cacheName;
    try {
      const response = await fetch('/offline-manifest.json', { cache: 'no-store' });
      if (!response.ok) throw Error('No se pudo obtener la lista de archivos.');
      const manifest = await response.json();
      if (!Array.isArray(manifest.files) || manifest.files.length > 5000 || !/^[a-f0-9]{20}$/.test(manifest.version) ||
          manifest.files.some(url => typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') || url.includes('..'))) throw Error('Lista de archivos inválida.');
      cacheName = PREFIX + manifest.version + '-' + Date.now();
      const cache = await caches.open(cacheName);
      let cursor = 0, done = 0;
      // Esperamos también las descargas pendientes antes de limpiar un intento fallido.
      const results = await Promise.allSettled(Array.from({ length: 4 }, async () => {
        while (cursor < manifest.files.length) {
          const url = manifest.files[cursor++];
          const asset = await fetch(url, { cache: 'no-store' });
          if (!asset.ok) throw Error('Falló la descarga de un recurso. Comprueba internet e inténtalo otra vez.');
          await cache.put(url, asset); done++;
          port.postMessage({ done, total: manifest.files.length });
        }
      }));
      const failure = results.find(r => r.status === 'rejected'); if (failure) throw failure.reason;
      const meta = await caches.open(META); await meta.put(POINTER, new Response(cacheName));
      for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== META && key !== cacheName) await caches.delete(key);
      port.postMessage({ complete: true });
    } catch (error) {
      if (cacheName && await activeCache() !== cacheName) await caches.delete(cacheName);
      port.postMessage({ error: error.name === 'QuotaExceededError' ? 'No hay espacio suficiente en el navegador. La copia anterior se conserva.' : error.message });
    } finally { downloading = false; }
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const active = await activeCache();
    if (active) {
      const url = new URL(event.request.url);
      // La copia descargada funciona sin llamadas a fuentes u otros servicios externos.
      if (url.origin !== self.location.origin) return new Response('', { status: 503 });
      const cache = await caches.open(active);
      const path = url.pathname === '/index.html' ? '/' : url.pathname;
      const cached = await cache.match(path);
      if (cached) return cached;
    }
    return fetch(event.request);
  })());
});
