// CacheStorage only accepts HTTP(S) request keys, including inside Electron's
// secure custom protocol. These keys are local identifiers; they are never fetched.
export const cacheAddress=path=>new URL(path,'https://umbral.invalid').href;
export async function matchCached(cache,path){return await cache.match(cacheAddress(path))||await cache.match(path);}
export async function deleteCached(cache,path){await cache.delete(cacheAddress(path));await cache.delete(path).catch(()=>{});}
