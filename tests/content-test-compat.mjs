// Test-only bridge for the legacy mechanics suite. Production files remain in
// their canonical, content-neutral form; VM snippets written against the former
// One Piece identifiers are translated at the VM boundary.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {syncBuiltinESMExports} from 'node:module';
import {createContent} from '../public/content/runtime.mjs';

const require=createRequire(import.meta.url);
const vm=require('node:vm');
const pack=JSON.parse(readFileSync(new URL('../mods/one-piece/pack.json',import.meta.url),'utf8'));
const forward=new Map([...Object.entries(pack.legacy.keys),...Object.entries(pack.legacy.propertyKeys),
  ['hasHaki','hasAether'],['hasFruit','hasCrystal'],['isNakamaUnlocked','isAllyUnlocked'],
  ['logPoses','Compasss'],['showLogPoseGachaModal','showCompassGachaModal'],
  ['startLogPoseAutoGacha','startCompassAutoGacha'],['startLogPoseGacha','startCompassGacha'],
  ['awardLogPosePrize','awardCompassPrize'],['logPoseUpgradeCost','CompassUpgradeCost']]);
for(const [legacy,canonical] of Object.entries({
  FRUTA_NOHAKI_MULT:'Crystal_NOAether_MULT',SABAODY_TECHNIQUES:'CrystalForest_TECHNIQUES',ELBAPH_TECHNIQUES:'Horizon_TECHNIQUES',
  ZOAN_FORMS:'Morph_FORMS',ZOAN_FORM_LEVELS:'Morph_FORM_LEVELS',GOD_VALLEY_FORMS:'AncientHaven_FORMS',
  GOD_VALLEY_FORM_LEVEL:'AncientHaven_FORM_LEVEL',GOD_VALLEY_COLLECTIBLES:'AncientHaven_COLLECTIBLES',
  GOROSEI_FORMS:'Council_FORMS',STRAW_HAT_COMBAT_FORMS:'Voyager_COMBAT_FORMS',SULONG_FORMS:'Ascended_FORMS',
  NAKAMA_STARTERS:'Ally_STARTERS',STRAW_HAT_MEMBERS:'Voyager_MEMBERS',nakamaGuardUsed:'AllyGuardUsed',
  zoan:'Morph',zoanForm:'MorphForm',zoanBase:'MorphBase',
  fruta_diablo:'Crystal_diablo',
}))forward.set(legacy,canonical);
// The old save discriminator must reach GameContent.migrateSave unchanged; a
// token-only rewrite to `umbral` would omit the required contentId.
forward.delete(pack.legacy.discriminator);
const reverse=new Map();
for(const [legacy,canonical] of forward)if(!reverse.has(canonical))reverse.set(canonical,legacy);
for(const collision of ['speed','atlas','vista'])reverse.delete(forward.get(collision));

// Every mapped legacy key except the offline sentinel is one identifier-like
// token (hyphens are used by form ids). Tokenizing once keeps the preload cheap
// even when hundreds of test contexts evaluate the 300 KB engine source.
function mappedAchievementToken(value,mapping){
  for(const prefix of ['island_diff_','saga_diff_']){
    if(!value.startsWith(prefix))continue;
    for(const [from,to] of mapping){
      if(!/^region_\d+$/.test(to)&&!/^region_\d+$/.test(from))continue;
      if(value.startsWith(prefix+from+'_'))return prefix+to+value.slice((prefix+from).length);
    }
  }
  return value;
}
function canonicalToken(value){
  // These legacy character ids are ordinary engine/UI words too. Rewriting
  // them corrupts mechanics such as battle speed and visible Spanish copy.
  if(value==='speed'||value==='atlas'||value==='vista')return value;
  const achievement=mappedAchievementToken(value,forward);
  if(achievement!==value)return achievement;
  if(forward.has(value))return forward.get(value);
  for(const prefix of ['relic_'])if(value.startsWith(prefix)&&forward.has(value.slice(prefix.length)))return prefix+forward.get(value.slice(prefix.length));
  return value;
}
const translateSource=source=>{
  let translated=source
    .replace(/[\p{L}\p{N}_$]+(?:-[\p{L}\p{N}_$]+)*/gu,canonicalToken)
    .replace(/(hasPassive\s*\([^,]+,\s*["'])unit_(\d+)(["'])/g,'$1ability_$2$3')
    .replace(/baseFormOf\(([\w$]+)\s*\+\s*["']-young["']\)/g,'baseFormOf(CHARS[$1+"-young"]?.id||($1+"-young"))')
    .replace(/id:([\w$]+)\s*\+\s*["']-young["']/g,'id:(CHARS[$1+"-young"]?.id||($1+"-young"))')
    .replaceAll('/__oplike_offline_active__','/__umbral_offline_active__');
  // A few legacy tests re-evaluate the game-over section up to the former
  // tower marker. The marker moved, so their slice now also contains the
  // already-loaded top-level declaration.
  if(/^\s*function gameOver\s*\(/.test(translated)){
    const towerStart=/\r?\n\r?\nlet tower = null;/.exec(translated);
    if(towerStart)translated=translated.slice(0,towerStart.index);
  }
  if(/^\s*function towerGameOver\s*\(/.test(translated)){
    const shopStart=/\r?\nconst GLOBAL_ITEMS =/.exec(translated);
    if(shopStart)translated=translated.slice(0,shopStart.index);
  }
  return translated;
};

function legacyString(value){
  if(value==='umbral-one-piece.json')return 'grandlinelike.json';
  return value.replace(/[\p{L}\p{N}_$]+(?:-[\p{L}\p{N}_$]+)*/gu,token=>{
    const achievement=mappedAchievementToken(token,reverse);
    if(achievement!==token)return achievement;
    if(reverse.has(token))return reverse.get(token);
    for(const prefix of ['relic_'])if(token.startsWith(prefix)&&reverse.has(token.slice(prefix.length)))return prefix+reverse.get(token.slice(prefix.length));
    const generated=/^(unit_\d+)(-.+)$/.exec(token);
    return generated&&reverse.has(generated[1])?reverse.get(generated[1])+generated[2]:token;
  });
}
function restoreLegacyInput(value,seen=new WeakSet()){
  if(!value||typeof value!=='object'||seen.has(value))return value;
  seen.add(value);
  if(Array.isArray(value)){
    for(let index=0;index<value.length;index++)value[index]=typeof value[index]==='string'?legacyString(value[index]):restoreLegacyInput(value[index],seen);
    return value;
  }
  for(const key of Object.keys(value)){
    const nextKey=reverse.get(key)??key;
    const item=typeof value[key]==='string'?legacyString(value[key]):restoreLegacyInput(value[key],seen);
    if(nextKey!==key){delete value[key];value[nextKey]=item;}else value[key]=item;
  }
  return value;
}
function legacyResult(value,seen=new WeakMap(),owner,active=new WeakSet()){
  if(typeof value==='string')return legacyString(value);
  if(typeof value==='function'){
    if(seen.has(value))return seen.get(value);
    const wrapped=function(...args){
      const result=Reflect.apply(value,owner??this,canonicalInput(args));
      restoreLegacyInput(args);
      return result?.then instanceof Function?result.then(item=>legacyResult(item)):legacyResult(result);
    };
    seen.set(value,wrapped);return wrapped;
  }
  if(!value||typeof value!=='object'||typeof value.then==='function')return value;
  const prototype=Object.getPrototypeOf(value);
  if(!Array.isArray(value)&&prototype!==null&&Object.prototype.toString.call(value)!=='[object Object]')return value;
  let copy=seen.get(value);
  if(copy&&active.has(value))return copy;
  if(!copy){copy=Array.isArray(value)?[]:{};seen.set(value,copy);}
  active.add(value);
  if(Array.isArray(copy))copy.length=0;
  else for(const key of Object.keys(copy))delete copy[key];
  for(const [key,item] of Object.entries(value))copy[reverse.get(key)??key]=legacyResult(item,seen,value,active);
  active.delete(value);
  return copy;
}

function fallbackStorage(){
  const memory=new Map();
  return {getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(String(key),String(value)),removeItem:key=>memory.delete(String(key))};
}

function compatibilityStorage(storage){
  const prefix=`umbral:${pack.id}:`;
  const physicalKey=key=>{
    const logical=key.startsWith(prefix)?key.slice(prefix.length):key;
    return reverse.get(logical)??logical;
  };
  const jsonValue=(value,toCanonical)=>{
    if(typeof value!=='string'||!/^\s*[{[]/.test(value))return value;
    try{
      let parsed=JSON.parse(value);
      if(toCanonical){parsed=canonicalInput(parsed);if(parsed?.game===pack.legacy.discriminator){parsed.game='umbral';parsed.contentId=pack.id;}}
      else {const canonicalGame=parsed?.game==='umbral';parsed=legacyResult(parsed);if(canonicalGame){parsed.game=pack.legacy.discriminator;delete parsed.contentId;}}
      return JSON.stringify(parsed);
    }catch{return value;}
  };
  return {
    getItem(key){const value=storage.getItem(physicalKey(key));return key.startsWith(prefix)?jsonValue(value,true):value;},
    setItem(key,value){storage.setItem(physicalKey(key),key.startsWith(prefix)?jsonValue(String(value),false):value);},
    removeItem(key){storage.removeItem(physicalKey(key));},
  };
}

function compatibilityContent(storage){
  const content=createContent(pack,compatibilityStorage(storage));
  const legacyIds=[...Object.keys(pack.legacy.keys)].sort((a,b)=>b.length-a.length);
  for(const legacyId of legacyIds){
    const actualId=pack.legacy.keys[legacyId];
    if(!content.data.CHARS[actualId])continue;
    const legacyBase=legacyIds.find(candidate=>legacyId.startsWith(candidate+'-')&&content.data.CHARS[pack.legacy.keys[candidate]]);
    if(!legacyBase)continue;
    const generated=pack.legacy.keys[legacyBase]+legacyId.slice(legacyBase.length);
    if(!Object.hasOwn(content.data.CHARS,generated))Object.defineProperty(content.data.CHARS,generated,{value:{...content.data.CHARS[actualId],id:actualId},configurable:true});
  }
  return content;
}

const hostStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage')?.value;
if(!globalThis.GameContent)globalThis.GameContent=compatibilityContent(hostStorage||fallbackStorage());

function canonicalInput(value,seen=new WeakSet()){
  if(typeof value==='string')return forward.get(value)??value;
  if(!value||typeof value!=='object'||seen.has(value))return value;
  const prototype=Object.getPrototypeOf(value);
  if(!Array.isArray(value)&&prototype!==Object.prototype&&prototype!==null)return value;
  seen.add(value);
  if(Array.isArray(value)){for(let i=0;i<value.length;i++)value[i]=canonicalInput(value[i],seen);return value;}
  for(const key of Object.keys(value)){
    const nextKey=forward.get(key)??key,nextValue=canonicalInput(value[key],seen);
    if(nextKey!==key){delete value[key];value[nextKey]=nextValue;}else value[key]=nextValue;
  }
  return value;
}

const originalCreateContext=vm.createContext;
const originalRunInContext=vm.runInContext;
const contextSnapshots=new WeakMap();
const injectedContent=new WeakMap();
const canonicalContexts=new WeakSet();
const wrappedPickers=new WeakSet();
const wrappedBaseForms=new WeakSet();
const resultCaches=new WeakMap();
vm.createContext=function(sandbox={},...args){
  const context=originalCreateContext.call(this,sandbox,...args);
  if(context.GameContent)canonicalContexts.add(context);
  else {
    context.GameContent=compatibilityContent(context.localStorage||fallbackStorage());
    injectedContent.set(context,context.GameContent);
  }
  contextSnapshots.set(context,new Map([['GameContent',context.GameContent]]));
  resultCaches.set(context,new WeakMap());
  return context;
};
vm.runInContext=function(code,context,...args){
  // New content-system tests install their own GameContent explicitly and must
  // observe canonical ids without the legacy compatibility projection.
  if(canonicalContexts.has(context))return originalRunInContext.call(this,code,context,...args);
  if(injectedContent.has(context)&&context.GameContent!==injectedContent.get(context))return originalRunInContext.call(this,code,context,...args);
  if(typeof context.baseFormOf==='function'&&!wrappedBaseForms.has(context)){
    const baseFormOf=context.baseFormOf;
    context.baseFormOf=id=>baseFormOf(context.CHARS?.[id]?.id||id);
    wrappedBaseForms.add(context);
  }
  const picker=context.window?.showSaveFilePicker;
  if(typeof picker==='function'&&!wrappedPickers.has(picker)){
    const wrapped=async options=>{
      const handle=await picker(legacyResult(options));
      if(typeof handle?.createWritable!=='function')return handle;
      return {...handle,async createWritable(){
        const writer=await handle.createWritable();
        return {...writer,async write(blob){
          if(!(blob instanceof Blob))return writer.write(blob);
          let text=await blob.text();
          try{const canonical=JSON.parse(text),legacy=legacyResult(canonical);if(canonical?.game==='umbral'){legacy.game=pack.legacy.discriminator;delete legacy.contentId;}text=JSON.stringify(legacy);}catch{}
          return writer.write(new Blob([text],{type:blob.type}));
        }};
      }};
    };
    wrappedPickers.add(wrapped);context.window.showSaveFilePicker=wrapped;
  }
  const snapshot=contextSnapshots.get(context)||new Map();
  for(const key of Object.keys(context)){
    if(snapshot.get(key)===context[key])continue;
    const nextKey=forward.get(key)??key,nextValue=canonicalInput(context[key]);
    if(nextKey!==key){delete context[key];context[nextKey]=nextValue;}else context[key]=nextValue;
  }
  const result=originalRunInContext.call(this,typeof code==='string'?translateSource(code):code,context,...args);
  contextSnapshots.set(context,new Map(Object.keys(context).map(key=>[key,context[key]])));
  // Refresh cached compatibility projections so references remain stable while
  // mutations performed inside the VM are visible to later assertions.
  return legacyResult(result,resultCaches.get(context));
};
syncBuiltinESMExports();
