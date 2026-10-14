import {readModArchive} from './archive.mjs';
import {validatePack} from './validation.mjs';
import {REGISTRY,ACTIVE,activeRecord} from './runtime.mjs';
import {cacheAddress,matchCached,deleteCached} from './cache.mjs';
const LIST='/__content_installed__';
const mime=path=>({'png':'image/png','webp':'image/webp','jpg':'image/jpeg','jpeg':'image/jpeg','svg':'image/svg+xml','mp3':'audio/mpeg','json':'application/json','ttf':'font/ttf','woff2':'font/woff2'}[path.split('.').pop()]||'application/octet-stream');
export async function installedPacks(){const r=await matchCached(await caches.open(REGISTRY),LIST);return r?await r.json():[];}
async function saveList(list){await(await caches.open(REGISTRY)).put(cacheAddress(LIST),Response.json(list));}
async function restoreEntry(cache,key,response){if(response)await cache.put(cacheAddress(key),response);else await deleteCached(cache,key);}
export async function installMod(file,onProgress=()=>{}){
  if(!('caches'in globalThis)||!navigator.serviceWorker?.controller)throw Error('Instalar mods requiere el almacén local del navegador. Usa HTTPS o localhost y recarga.');
  const {pack,files}=await readModArchive(file);validatePack(pack);
  const reserved=new Set(['manifest.json','offline-manifest.json','android-version.json','windows-version.json','distribution.json','content/base.json','content/asset-map.json']);
  if(files.some(f=>reserved.has(f.path)))throw Error('El mod intenta reemplazar un archivo reservado del juego.');
  if(pack.id==='umbral')throw Error('El contenido original está reservado. Elige otro identificador para tu mod.');
  const cacheName=`umbral-mod-${pack.id}-${crypto.randomUUID()}`;
  const cache=await caches.open(cacheName);
  const registry=await caches.open(REGISTRY);
  const previousListResponse=await matchCached(registry,LIST);
  const previousActiveResponse=await matchCached(registry,ACTIVE);
  const old=previousListResponse?await previousListResponse.clone().json():[];
  const active=previousActiveResponse?await previousActiveResponse.clone().json():null;
  const record={id:pack.id,title:pack.title,cache:cacheName};
  try{
    const paths=new Set(files.map(f=>f.path));
    if(pack.assets.some(p=>!paths.has(p)))throw Error('El mod no incluye todos los recursos declarados.');
    await cache.put(cacheAddress('/__pack.json'),Response.json(pack));
    let done=0;for(const {path,blob}of files){const headers={'Content-Type':mime(path),'X-Content-Type-Options':'nosniff'};if(path.endsWith('.svg'))headers['Content-Security-Policy']="default-src 'none'; style-src 'unsafe-inline'; sandbox";await cache.put(cacheAddress('/'+path),new Response(blob,{headers}));onProgress(++done,files.length);}
    // Publish the new immutable cache only after every CRC and write succeeds.
    await registry.put(cacheAddress(LIST),Response.json([...old.filter(p=>p.id!==pack.id),record]));
    if(active?.id===pack.id)await registry.put(cacheAddress(ACTIVE),Response.json(record));
  }catch(e){
    // CacheStorage has no transaction spanning entries. Restore both pointers if
    // either registry write fails, then discard the unpublished immutable cache.
    await Promise.allSettled([
      restoreEntry(registry,LIST,previousListResponse),
      restoreEntry(registry,ACTIVE,previousActiveResponse),
      caches.delete(cacheName),
    ]);
    throw e;
  }
  // Registry publication is the commit point. Superseded caches are only garbage
  // after it, so cleanup failures must not roll back a valid installation.
  await Promise.allSettled(old.filter(p=>p.id===pack.id).map(previous=>caches.delete(previous.cache)));
  return record;
}
export async function activatePack(id){
  const registry=await caches.open(REGISTRY);
  if(id==='umbral')await deleteCached(registry,ACTIVE);
  else{const p=(await installedPacks()).find(p=>p.id===id);if(!p)throw Error('Ese mod no está instalado.');await registry.put(cacheAddress(ACTIVE),Response.json(p));}
  location.reload();
}
export async function uninstallPack(id){
  if((await activeRecord())?.id===id)throw Error('Activa el contenido original antes de desinstalar este mod.');
  const packs=await installedPacks();await saveList(packs.filter(p=>p.id!==id));
  for(const p of packs.filter(p=>p.id===id))await caches.delete(p.cache);
}
export async function openMods(){
  if(document.getElementById('content-mods'))return;
  const overlay=document.createElement('section');overlay.id='content-mods';overlay.className='overlay';
  overlay.innerHTML='<div class="modal"><h2>Contenido y mods</h2><p>Instala un archivo .umbralmod. Cada contenido tiene su propia partida. Cambiar contenido recarga el juego; tu progreso guardado se conserva.</p><div data-packs></div><label class="btn green">Instalar mod <input data-import type="file" accept=".umbralmod,.zip" hidden></label><p data-status role="status"></p><button class="btn gray" data-close>Cerrar</button></div>';
  document.body.append(overlay);overlay.querySelector('[data-close]').onclick=()=>overlay.remove();
  const status=overlay.querySelector('[data-status]');
  async function refresh(){
    const list=overlay.querySelector('[data-packs]');list.replaceChildren();
    const current=(await activeRecord())?.id||'umbral';
    for(const p of [{id:'umbral',title:'Mareas del Umbral'},...await installedPacks()]){
      const row=document.createElement('p'),title=document.createElement('strong');title.textContent=p.title;row.append(title,' ');
      const activate=document.createElement('button');activate.className='btn small';activate.textContent=current===p.id?'Activo':'Jugar';activate.disabled=current===p.id;
      activate.onclick=async()=>{try{await activatePack(p.id);}catch(e){status.textContent=e.message;}};row.append(activate);
      if(p.id!=='umbral'){const remove=document.createElement('button');remove.className='btn small gray';remove.textContent='Desinstalar';remove.disabled=current===p.id;remove.onclick=async()=>{try{await uninstallPack(p.id);await refresh();}catch(e){status.textContent=e.message;}};row.append(' ',remove);}
      list.append(row);
    }
  }
  try{await refresh();}catch(e){status.textContent=e.message;}
  overlay.querySelector('[data-import]').onchange=async e=>{
    const input=e.target,file=input.files[0];if(!file)return;input.disabled=true;
    try{status.textContent='Validando e instalando…';const p=await installMod(file,(n,total)=>{status.textContent=`Instalando ${n}/${total} recursos…`;});status.textContent=`${p.title} instalado. Pulsa Jugar para activarlo.`;await refresh();if(globalThis.GameContent?.id===p.id){status.textContent='Mod actualizado. Aplica la actualización para recargar el contenido.';const apply=document.createElement('button');apply.className='btn green';apply.textContent='Aplicar actualización';apply.onclick=()=>activatePack(p.id);status.append(' ',apply);}}
    catch(error){status.textContent=error.name==='QuotaExceededError'?'No hay espacio suficiente. El contenido anterior se conserva.':error.message;}
    finally{input.disabled=false;input.value='';}
  };
}
