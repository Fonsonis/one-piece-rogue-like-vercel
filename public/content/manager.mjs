import {readModArchive} from './archive.mjs';
import {validatePack} from './validation.mjs';
import {REGISTRY,ACTIVE,activeRecord} from './runtime.mjs';
import {cacheAddress,matchCached,deleteCached} from './cache.mjs';
const LIST='/__content_installed__';
const STAGING_TIMEOUT_MS=30000,STREAM_CHUNK_BYTES=1024*1024;
const mime=path=>({'png':'image/png','webp':'image/webp','jpg':'image/jpeg','jpeg':'image/jpeg','svg':'image/svg+xml','mp3':'audio/mpeg','json':'application/json','ttf':'font/ttf','woff2':'font/woff2'}[path.split('.').pop()]||'application/octet-stream');
export async function installedPacks(){const r=await matchCached(await caches.open(REGISTRY),LIST);return r?await r.json():[];}
async function saveList(list){await(await caches.open(REGISTRY)).put(cacheAddress(LIST),Response.json(list));}
async function restoreEntry(cache,key,response){if(response)await cache.put(cacheAddress(key),response);else await deleteCached(cache,key);}
function throwIfAborted(signal){
  if(!signal?.aborted)return;
  if(typeof signal.throwIfAborted==='function')signal.throwIfAborted();
  throw signal.reason||new DOMException('Instalación cancelada.','AbortError');
}
function stagingOperation(factory,{cacheName,signal,timeoutMs=STAGING_TIMEOUT_MS}){
  throwIfAborted(signal);
  const operationController=new AbortController();
  let settled=false,abandoned=false,timer,abort,pending;
  const guarded=new Promise((resolve,reject)=>{
    const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(value);};
    const timeout=()=>{abandoned=true;const error=Error('El almacenamiento local dejó de responder durante 30 segundos.');error.name='TimeoutError';operationController.abort(error);finish(reject,error);};
    const touch=()=>{if(settled)return;clearTimeout(timer);timer=setTimeout(timeout,timeoutMs);};
    abort=()=>{abandoned=true;const reason=signal.reason||new DOMException('Instalación cancelada.','AbortError');operationController.abort(reason);finish(reject,reason);};
    signal?.addEventListener('abort',abort,{once:true});
    touch();
    try{pending=Promise.resolve(factory(operationController.signal,touch));}catch(error){pending=Promise.reject(error);}
    pending.then(value=>finish(resolve,value),error=>finish(reject,error));
  });
  // A timed-out/aborted CacheStorage operation may still settle. Delete its
  // detached staging cache again so a late write cannot leave installable data.
  pending.finally(()=>{if(abandoned)return caches.delete(cacheName);}).catch(()=>{});
  return guarded;
}
function assetResponse(file,headers,signal,onChunk){
  if(typeof file.read!=='function')return new Response(file.blob,{headers});
  let offset=0,size=file.size??file.blob?.size;
  if(!Number.isSafeInteger(size)||size<0)throw Error(`Tamaño de recurso inválido: ${file.path}.`);
  const body=new ReadableStream({
    async pull(controller){
      try{
        throwIfAborted(signal);
        if(offset>=size){onChunk(0,true,true);controller.close();return;}
        const end=Math.min(size,offset+STREAM_CHUNK_BYTES),bytes=await file.read(offset,end,signal);
        throwIfAborted(signal);
        if(!bytes?.byteLength)throw Error(`No se pudo leer completamente ${file.path}.`);
        offset+=bytes.byteLength;onChunk(bytes.byteLength,offset===size,false);controller.enqueue(bytes);
      }catch(error){controller.error(error);}
    },
    cancel(){},
  },{highWaterMark:0});
  return new Response(body,{headers});
}
export async function installMod(file,onProgress=()=>{},options={}){
  const {onValidation=()=>{},onAssetProgress=()=>{},onCommitting=()=>{},signal,stagingTimeoutMs=STAGING_TIMEOUT_MS}=options||{};
  if(!('caches'in globalThis)||!navigator.serviceWorker?.controller)throw Error('Instalar mods requiere el almacén local del navegador. Usa HTTPS o localhost y recarga.');
  throwIfAborted(signal);
  const {pack,files}=await readModArchive(file,{onProgress:onValidation,signal});
  throwIfAborted(signal);validatePack(pack);throwIfAborted(signal);
  const reserved=new Set(['manifest.json','offline-manifest.json','android-version.json','windows-version.json','distribution.json','content/base.json','content/asset-map.json']);
  if(files.some(f=>reserved.has(f.path)))throw Error('El mod intenta reemplazar un archivo reservado del juego.');
  if(pack.id==='umbral')throw Error('El contenido original está reservado. Elige otro identificador para tu mod.');
  const cacheName=`umbral-mod-${pack.id}-${crypto.randomUUID()}`;
  let cache,registry,previousListResponse,previousActiveResponse,old=[],active=null,publicationStarted=false;
  const record={id:pack.id,title:pack.title,cache:cacheName};
  try{
    throwIfAborted(signal);cache=await stagingOperation(()=>caches.open(cacheName),{cacheName,signal,timeoutMs:stagingTimeoutMs});throwIfAborted(signal);
    registry=await caches.open(REGISTRY);throwIfAborted(signal);
    previousListResponse=await matchCached(registry,LIST);throwIfAborted(signal);
    previousActiveResponse=await matchCached(registry,ACTIVE);throwIfAborted(signal);
    old=previousListResponse?await previousListResponse.clone().json():[];
    active=previousActiveResponse?await previousActiveResponse.clone().json():null;
    throwIfAborted(signal);
    const paths=new Set(files.map(f=>f.path));
    if(pack.assets.some(p=>!paths.has(p)))throw Error('El mod no incluye todos los recursos declarados.');
    throwIfAborted(signal);await stagingOperation(()=>cache.put(cacheAddress('/__pack.json'),Response.json(pack)),{cacheName,signal,timeoutMs:stagingTimeoutMs});throwIfAborted(signal);
    let done=0,bytesDone=0,lastAssetProgress=0;const bytesTotal=files.reduce((sum,asset)=>sum+(asset.size??asset.blob?.size??0),0);
    const reportAsset=(asset,force=false)=>{const now=Date.now();if(!force&&now-lastAssetProgress<32)return;lastAssetProgress=now;onAssetProgress({phase:'assets',path:asset.path,filesDone:done,filesTotal:files.length,bytesDone,bytesTotal});};
    for(const asset of files){throwIfAborted(signal);const {path}=asset,headers={'Content-Type':mime(path),'X-Content-Type-Options':'nosniff'};if(path.endsWith('.svg'))headers['Content-Security-Policy']="default-src 'none'; style-src 'unsafe-inline'; sandbox";await stagingOperation((operationSignal,touch)=>cache.put(cacheAddress('/'+path),assetResponse(asset,headers,operationSignal,(count,final,closed)=>{touch();if(closed)return;bytesDone+=count;reportAsset(asset,final);})),{cacheName,signal,timeoutMs:stagingTimeoutMs});throwIfAborted(signal);onProgress(++done,files.length);reportAsset(asset,true);throwIfAborted(signal);}
    // Publish the new immutable cache only after every CRC and write succeeds.
    throwIfAborted(signal);onCommitting();publicationStarted=true;
    await registry.put(cacheAddress(LIST),Response.json([...old.filter(p=>p.id!==pack.id),record]));
    if(active?.id===pack.id)await registry.put(cacheAddress(ACTIVE),Response.json(record));
  }catch(e){
    // CacheStorage has no transaction spanning entries. Restore both pointers if
    // either registry write fails, then discard the unpublished immutable cache.
    await Promise.allSettled([
      registry&&publicationStarted?restoreEntry(registry,LIST,previousListResponse):Promise.resolve(),
      registry&&publicationStarted?restoreEntry(registry,ACTIVE,previousActiveResponse):Promise.resolve(),
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
  overlay.innerHTML='<div class="modal"><h2>Contenido y mods</h2><p>Instala un archivo .umbralmod. Cada contenido tiene su propia partida. Cambiar contenido recarga el juego; tu progreso guardado se conserva.</p><div data-packs></div><label class="btn green">Instalar mod <input data-import type="file" accept=".umbralmod,.zip" hidden></label><progress data-install-progress max="1" value="0" hidden></progress><p data-status role="status"></p><button class="btn gray" data-cancel hidden>Cancelar</button> <button class="btn gray" data-close>Cerrar</button></div>';
  let installController=null;
  document.body.append(overlay);overlay.querySelector('[data-close]').onclick=()=>{installController?.abort();overlay.remove();};
  const status=overlay.querySelector('[data-status]');
  const progress=overlay.querySelector('[data-install-progress]'),cancel=overlay.querySelector('[data-cancel]');
  cancel.onclick=()=>installController?.abort();
  const sizeLabel=value=>value>=1024*1024?`${(value/1024/1024).toFixed(1)} MB`:value>=1024?`${(value/1024).toFixed(0)} KB`:`${value} B`;
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
    installController=new AbortController();cancel.hidden=false;progress.hidden=false;progress.value=0;progress.max=1;
    const validation=event=>{const labels={directory:'Leyendo directorio',headers:'Comprobando archivos',checksums:'Verificando contenido'},label=labels[event.phase]||'Validando',bytesDone=Number(event.bytesDone)||0,bytesTotal=Number(event.bytesTotal)||0,done=Number(event.done)||0,total=Number(event.total)||0;if(event.phase==='checksums'&&bytesTotal>0){progress.max=bytesTotal;progress.value=Math.min(bytesDone,bytesTotal);status.textContent=`${label}: ${sizeLabel(bytesDone)} / ${sizeLabel(bytesTotal)}…`;}else{progress.max=Math.max(1,total);progress.value=Math.min(done,progress.max);status.textContent=`${label}: ${done}/${total}…`;}};
    const committing=()=>{cancel.disabled=true;cancel.hidden=true;status.textContent='Finalizando instalación…';};
    const assetProgress=event=>{progress.max=Math.max(1,event.bytesTotal);progress.value=Math.min(event.bytesDone,event.bytesTotal);status.textContent=`Instalando ${sizeLabel(event.bytesDone)} / ${sizeLabel(event.bytesTotal)} (${event.filesDone}/${event.filesTotal} recursos)…`;};
    try{status.textContent='Iniciando validación…';const p=await installMod(file,(n,total)=>{if(!progress.max)progress.max=Math.max(1,total);status.textContent=`Instalando ${n}/${total} recursos…`;},{onValidation:validation,onAssetProgress:assetProgress,onCommitting:committing,signal:installController.signal});status.textContent=`${p.title} instalado. Pulsa Jugar para activarlo.`;await refresh();if(globalThis.GameContent?.id===p.id){status.textContent='Mod actualizado. Aplica la actualización para recargar el contenido.';const apply=document.createElement('button');apply.className='btn green';apply.textContent='Aplicar actualización';apply.onclick=()=>activatePack(p.id);status.append(' ',apply);}}
    catch(error){status.textContent=error.name==='AbortError'?'Instalación cancelada. El contenido anterior se conserva.':error.name==='QuotaExceededError'?'No hay espacio suficiente. El contenido anterior se conserva.':error.message;}
    finally{installController=null;cancel.disabled=false;cancel.hidden=true;progress.hidden=true;input.disabled=false;input.value='';}
  };
}
