import {validatePack} from './validation.mjs';
import {matchCached} from './cache.mjs';
export const REGISTRY='umbral-content-registry-v1';
export const ACTIVE='/__content_active__';
export function revive(value){
  if(Array.isArray(value))return value.map(revive);
  if(value&&typeof value==='object'){
    if(Object.keys(value).length===1&&Array.isArray(value.__set))return new Set(value.__set.map(revive));
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,revive(v)]));
  }
  return value;
}
export function createContent(pack,storage=globalThis.localStorage){
  validatePack(pack);
  const prefix=`umbral:${pack.id}:`;
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const legacyTokens=pack.legacy?new RegExp('(^|[^\\p{L}\\p{N}])('+Object.keys(pack.legacy.keys).sort((a,b)=>b.length-a.length).map(escape).join('|')+')(?=$|[^\\p{L}\\p{N}])','gu'):null;
  const translate=value=>pack.legacy.propertyKeys?.[value]||pack.legacy.keys[value]||value.replace(legacyTokens,(_,prefix,key)=>prefix+pack.legacy.keys[key]);
  function migrate(value){
    if(Array.isArray(value))return value.map(migrate);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[translate(k),migrate(v)]));
    return typeof value==='string'?translate(value):value;
  }
  const scoped={getItem(key){
    const current=storage.getItem(prefix+key);if(current!==null)return current;
    if(!pack.legacy)return null;
    const legacyKey=key.replace(/^umbral/,pack.legacy.storagePrefix);
    const old=storage.getItem(legacyKey);if(old===null)return null;
    // Migration is copied into the pack namespace; the previous edition's save remains intact.
    let next=old;
    if(/_(save|meta|run)$/.test(key)){
      const data=migrate(JSON.parse(old));
      if(key.endsWith('_save')){data.game='umbral';data.contentId=pack.id;}
      next=JSON.stringify(data);
    }
    storage.setItem(prefix+key,next);return next;
  },setItem:(key,v)=>storage.setItem(prefix+key,v),removeItem:key=>storage.removeItem(prefix+key)};
  return {id:pack.id,title:pack.title,data:revive(pack.data),texts:pack.texts,
    migrateSave(value){
      if(pack.legacy&&value?.game===pack.legacy.discriminator){const next=migrate(value);next.game='umbral';next.contentId=pack.id;return next;}
      return value;
    },
    text(key){if(!Object.hasOwn(pack.texts,key))throw Error('Falta un texto del paquete: '+key);return pack.texts[key];},storage:scoped};
}
export async function activeRecord(){
  if(!('caches' in globalThis))return null;
  const response=await matchCached(await caches.open(REGISTRY),ACTIVE);
  return response?response.json():null;
}
export async function loadActivePack(){
  const baseResponse=await fetch('/content/base.json');
  if(!baseResponse.ok)throw Error('No se pudo cargar el contenido del juego.');
  const base=validatePack(await baseResponse.json());
  const record=await activeRecord();
  if(record){
    const response=await matchCached(await caches.open(record.cache),'/__pack.json');
    if(!response)throw Error('El mod activo está incompleto. Vuelve al contenido original desde Mods.');
    const pack=validatePack(await response.json());
    // New mods can inherit the original rules and replace only their catalogs.
    // UI additions in a compatible engine release retain a safe default label.
    const data={...base.data,...pack.data};
    for(const table of ['CHARS','MOVES','TYPES'])data[table]={...base.data[table],...pack.data[table]};
    const campaigns=new Set(pack.data.SAGAS.map(saga=>saga.id));
    data.SAGAS=[...pack.data.SAGAS,...base.data.SAGAS.filter(saga=>!campaigns.has(saga.id))];
    if(pack.data.STARTER_ID&&!pack.data.ALLY_STARTERS)data.ALLY_STARTERS=[pack.data.STARTER_ID];
    return {...pack,data,texts:{...base.texts,...pack.texts}};
  }
  return base;
}
