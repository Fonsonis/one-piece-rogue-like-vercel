
const META = "umbral-offline-meta", POINTER = "/__umbral_offline_active__", PREFIX = "umbral-offline-";
let downloading = false;
let baseAssetMap;
const cacheAddress=path=>new URL(path,'https://umbral.invalid').href;
const matchCached=async(cache,path)=>await cache.match(cacheAddress(path))||await cache.match(path);
const sameGameOrigin=url=>{const own=new URL(self.location.href);return url.protocol===own.protocol&&url.host===own.host;};
async function aliases(){
  if(!baseAssetMap)baseAssetMap=(async()=>{
    const active=await activeCache();
    const cached=active?await matchCached(await caches.open(active),'/content/asset-map.json'):null;
    const response=cached||await fetch('/content/asset-map.json');
    return response.ok?response.json():{};
  })().catch(()=>{baseAssetMap=null;return {};});
  return baseAssetMap;
}
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
async function activeCache() {
  const meta = await caches.open(META), response = await matchCached(meta,POINTER);
  return response ? response.text() : null;
}
self.addEventListener('message', event => {
  if (event.data?.type !== 'prepare-offline' || !event.ports[0]) return;
  const port = event.ports[0];
  event.waitUntil((async () => {
    if (downloading) { port.postMessage({ error: "Ya hay una descarga en curso en otra ventana." }); return; }
    downloading = true; let cacheName;
    try {
      const response = await fetch('/offline-manifest.json', { cache: 'no-store' });
      if (!response.ok) throw Error('No se pudo obtener la lista de archivos.');
      const manifestResponse = response.clone();
      const manifest = await response.json();
      if (!Array.isArray(manifest.files) || manifest.files.length > 5000 || !/^[a-f0-9]{20}$/.test(manifest.version) ||
          manifest.files.some(url => typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//') || url.includes('..'))) throw Error('Lista de archivos inválida.');
      cacheName = PREFIX + manifest.version + '-' + Date.now();
      const cache = await caches.open(cacheName);
      await cache.put(cacheAddress('/offline-manifest.json'), manifestResponse);
      let cursor = 0, done = 0;

      const results = await Promise.allSettled(Array.from({ length: 4 }, async () => {
        while (cursor < manifest.files.length) {
          const url = manifest.files[cursor++];
          const asset = await fetch(url, { cache: 'no-store' });
          if (!asset.ok) throw Error("Falló la descarga de un recurso. Comprueba internet e inténtalo otra vez.");
          await cache.put(cacheAddress(url), asset); done++;
          port.postMessage({ done, total: manifest.files.length });
        }
      }));
      const failure = results.find(r => r.status === 'rejected'); if (failure) throw failure.reason;
      const meta = await caches.open(META); await meta.put(cacheAddress(POINTER), new Response(cacheName));
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


    const requestUrl = new URL(event.request.url);
    if(sameGameOrigin(requestUrl)){
      const registry=await caches.open('umbral-content-registry-v1');
      const pointer=await matchCached(registry,'/__content_active__');
      if(pointer){
        const record=await pointer.json();
        const asset=await matchCached(await caches.open(record.cache),requestUrl.pathname);
        if(asset)return asset;
      }
      const target=(await aliases())[requestUrl.pathname];
      if(target){
        const active=await activeCache();
        const cached=active?await matchCached(await caches.open(active),target):null;
        return cached||fetch(target);
      }
    }
    if (sameGameOrigin(requestUrl) && requestUrl.pathname === '/offline-manifest.json') {
      try { return await fetch(event.request, { cache: 'no-store' }); }
      catch {
        const active = await activeCache();
        if (active) {
          const cached = await matchCached(await caches.open(active),'/offline-manifest.json');
          if (cached) return cached;
        }
        throw Error('Sin conexión');
      }
    }
    const active = await activeCache();
    if (active) {
      const url = new URL(event.request.url);

      if (!sameGameOrigin(url)) return new Response('', { status: 503 });
      const cache = await caches.open(active);
      const path = url.pathname === '/index.html' ? '/' : url.pathname;
      const cached = await matchCached(cache,path);
      if (cached) return cached;
    }
    return fetch(event.request);
  })());
});
