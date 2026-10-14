import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {writeModArchive} from '../scripts/package-mod.mjs';
import {installMod,activatePack,installedPacks,uninstallPack} from '../public/content/manager.mjs';
import {ACTIVE,REGISTRY,activeRecord} from '../public/content/runtime.mjs';

const LIST='/__content_installed__';

function requestKey(request){
  const value=typeof request==='string'?request:request.url;
  return /^[a-z]+:/i.test(value)?new URL(value).pathname:value;
}

class MemoryCache{
  constructor(owner,name){this.owner=owner;this.name=name;this.entries=new Map();}
  async match(request){const response=this.entries.get(requestKey(request));return response?.clone();}
  async put(request,response){
    const key=requestKey(request);
    if(this.owner.beforePut)await this.owner.beforePut({cache:this.name,key});
    if(this.owner.failPut?.({cache:this.name,key})){
      this.owner.failPut=null;
      throw new DOMException('Injected cache write failure','QuotaExceededError');
    }
    const chunks=[];let length=0;
    try{
      const reader=response.clone().body?.getReader();
      if(reader){for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);length+=value.byteLength;if(this.owner.afterBodyChunk)await this.owner.afterBodyChunk({cache:this.name,key,size:value.byteLength});}}
    }catch(error){this.owner.bodyErrors.push(error);throw error;}
    const body=new Uint8Array(length);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
    this.entries.set(key,new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers}));
  }
  async delete(request){return this.entries.delete(requestKey(request));}
}

class MemoryCacheStorage{
  constructor(){this.stores=new Map();this.failPut=null;this.beforePut=null;this.afterBodyChunk=null;this.bodyErrors=[];}
  async open(name){if(!this.stores.has(name))this.stores.set(name,new MemoryCache(this,name));return this.stores.get(name);}
  async delete(name){return this.stores.delete(name);}
  async keys(){return [...this.stores.keys()];}
  has(name){return this.stores.has(name);}
}

class MemoryStorage{
  constructor(){this.values=new Map();}
  getItem(key){return this.values.has(key)?this.values.get(key):null;}
  setItem(key,value){this.values.set(String(key),String(value));}
  removeItem(key){this.values.delete(String(key));}
}

function pack(id,title=`Pack ${id}`,extraAssets=[]){
  return {
    schemaVersion:1,id,title,texts:{},assets:['art/unit.png',...extraAssets],
    data:{
      TYPES:{hit:{color:'#fff'}},
      MOVES:{hit:{name:'Hit',type:'hit',power:10,acc:1}},
      CHARS:{unit:{name:'Unit',types:['hit'],base:[10,10,10,10],rareza:1,learnset:[[1,'hit']],saga:'saga'}},
      SAGAS:[{id:'saga',name:'Saga',islands:[{name:'Island',boss:['unit'],pool:['unit'],rows:2}]}],
    },
  };
}

function makeArchive(content,{asset=true,additionalAssets=[]}={}){
  const directory=mkdtempSync(join(tmpdir(),'umbral-install-'));
  const source=join(directory,'source');
  mkdirSync(source,{recursive:true});
  writeFileSync(join(source,'pack.json'),JSON.stringify(content));
  if(asset){mkdirSync(join(source,'assets','art'),{recursive:true});writeFileSync(join(source,'assets','art','unit.png'),Buffer.from([137,80,78,71]));}
  for(const item of additionalAssets){const path=typeof item==='string'?item:item.path,target=join(source,'assets',...path.split('/'));mkdirSync(join(target,'..'),{recursive:true});writeFileSync(target,typeof item==='string'?Buffer.from([137,80,78,71,1]):item.bytes);}
  const output=join(directory,`${content.id}.umbralmod`);
  writeModArchive({sourceDirectory:source,outputPath:output});
  const file=new Blob([readFileSync(output)],{type:'application/zip'});
  Object.defineProperty(file,'name',{value:`${content.id}.umbralmod`});
  return {file,cleanup:()=>rmSync(directory,{recursive:true,force:true})};
}

async function withBrowser(run){
  const descriptors=new Map(['caches','navigator','location','localStorage','window'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const cacheStorage=new MemoryCacheStorage(),storage=new MemoryStorage();
  let reloads=0;
  const location={reload(){reloads++;}};
  const navigator={serviceWorker:{controller:{}}};
  Object.defineProperties(globalThis,{
    caches:{value:cacheStorage,configurable:true,writable:true},
    navigator:{value:navigator,configurable:true,writable:true},
    location:{value:location,configurable:true,writable:true},
    localStorage:{value:storage,configurable:true,writable:true},
    window:{value:globalThis,configurable:true,writable:true},
  });
  try{return await run({caches:cacheStorage,storage,reloads:()=>reloads});}
  finally{
    for(const [key,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
}

test('instala un ZIP pequeño validado y publica el caché solo al terminar',()=>withBrowser(async env=>{
  const fixture=makeArchive(pack('tiny'));
  try{
    const progress=[],validation=[];
    const record=await installMod(fixture.file,(done,total)=>progress.push([done,total]),{onValidation:event=>validation.push(event)});
    assert.deepEqual(progress,[[1,1]]);
    assert.deepEqual([...new Set(validation.map(event=>event.phase))],['directory','headers','checksums']);
    assert.ok(validation.every(event=>Number.isFinite(event.done)&&Number.isFinite(event.total)&&Number.isFinite(event.bytesDone)&&Number.isFinite(event.bytesTotal)));
    assert.deepEqual(await installedPacks(),[record]);
    const cache=await env.caches.open(record.cache);
    assert.equal((await (await cache.match('/__pack.json')).json()).id,'tiny');
    assert.deepEqual([...new Uint8Array(await (await cache.match('/art/unit.png')).arrayBuffer())],[137,80,78,71]);
  }finally{fixture.cleanup();}
}));

test('cambiar el contenido activo solo mueve el puntero y recarga',()=>withBrowser(async env=>{
  const first=makeArchive(pack('first')),second=makeArchive(pack('second'));
  try{
    const a=await installMod(first.file),b=await installMod(second.file);
    await activatePack('first');
    assert.deepEqual(await activeRecord(),a);
    assert.equal(env.reloads(),1);
    assert.deepEqual(await installedPacks(),[a,b]);
    await activatePack('umbral');
    assert.equal(await activeRecord(),null);
    assert.equal(env.reloads(),2);
    assert.deepEqual(await installedPacks(),[a,b]);
    assert.equal(env.caches.has(a.cache),true);
    assert.equal(env.caches.has(b.cache),true);
  }finally{first.cleanup();second.cleanup();}
}));

test('desinstalar elimina el caché del mod y conserva su partida',()=>withBrowser(async env=>{
  const fixture=makeArchive(pack('retired'));
  try{
    const record=await installMod(fixture.file);
    const saveKey='umbral:retired:umbral_save';
    env.storage.setItem(saveKey,'{"crew":["unit"]}');
    await uninstallPack('retired');
    assert.deepEqual(await installedPacks(),[]);
    assert.equal(env.caches.has(record.cache),false);
    assert.equal(env.storage.getItem(saveKey),'{"crew":["unit"]}');
  }finally{fixture.cleanup();}
}));

test('un fallo al publicar conserva registro, activo y caché anteriores y limpia staging',()=>withBrowser(async env=>{
  const v1=makeArchive(pack('updatable','Version 1')),v2=makeArchive(pack('updatable','Version 2'));
  try{
    const original=await installMod(v1.file);
    await activatePack('updatable');
    const namesBefore=await env.caches.keys();
    env.caches.failPut=({cache,key})=>cache===REGISTRY&&key===ACTIVE;
    await assert.rejects(installMod(v2.file),error=>error?.name==='QuotaExceededError');
    assert.deepEqual(await installedPacks(),[original]);
    assert.deepEqual(await activeRecord(),original);
    assert.equal(env.caches.has(original.cache),true);
    assert.deepEqual((await env.caches.keys()).sort(),namesBefore.sort());
  }finally{v1.cleanup();v2.cleanup();}
}));

test('reinstalar el activo actualiza ambos punteros sin afectar otros mods',()=>withBrowser(async env=>{
  const v1=makeArchive(pack('same','Old')),otherFixture=makeArchive(pack('other')),v2=makeArchive(pack('same','New'));
  try{
    const old=await installMod(v1.file),other=await installMod(otherFixture.file);
    await activatePack('same');
    const updated=await installMod(v2.file);
    assert.notEqual(updated.cache,old.cache);
    assert.deepEqual(await activeRecord(),updated);
    assert.deepEqual(await installedPacks(),[other,updated]);
    assert.equal(env.caches.has(old.cache),false);
    assert.equal(env.caches.has(other.cache),true);
    assert.equal((await (await (await env.caches.open(updated.cache)).match('/__pack.json')).json()).title,'New');
  }finally{v1.cleanup();otherFixture.cleanup();v2.cleanup();}
}));

test('rechaza un recurso declarado ausente sin publicar ni dejar staging',()=>withBrowser(async env=>{
  const fixture=makeArchive(pack('incomplete','Incomplete',['art/missing.png']));
  try{
    await assert.rejects(installMod(fixture.file),/no incluye todos los recursos declarados/i);
    assert.deepEqual(await installedPacks(),[]);
    assert.equal((await env.caches.keys()).some(name=>name.startsWith('umbral-mod-')),false);
    const registry=await env.caches.open(REGISTRY);
    assert.equal(await registry.match(LIST),undefined);
  }finally{fixture.cleanup();}
}));

test('cancelar durante las escrituras conserva registro, activo y caché anterior',()=>withBrowser(async env=>{
  const v1=makeArchive(pack('cancelable','Version 1'));
  const v2=makeArchive(pack('cancelable','Version 2',['art/second.png']),{additionalAssets:['art/second.png']});
  try{
    const original=await installMod(v1.file);await activatePack('cancelable');
    const namesBefore=(await env.caches.keys()).sort();
    const controller=new AbortController(),writes=[];
    await assert.rejects(installMod(v2.file,(done,total)=>{writes.push([done,total]);controller.abort();},{signal:controller.signal}),error=>error?.name==='AbortError');
    assert.deepEqual(writes,[[1,2]]);
    assert.deepEqual(await installedPacks(),[original]);
    assert.deepEqual(await activeRecord(),original);
    assert.equal(env.caches.has(original.cache),true);
    assert.deepEqual((await env.caches.keys()).sort(),namesBefore);
  }finally{v1.cleanup();v2.cleanup();}
}));

test('una señal ya cancelada no crea caché ni modifica el registro',()=>withBrowser(async env=>{
  const fixture=makeArchive(pack('never-started'));
  try{
    const controller=new AbortController();controller.abort();
    await assert.rejects(installMod(fixture.file,()=>{throw Error('no debe escribir');},{signal:controller.signal}),error=>error?.name==='AbortError');
    assert.deepEqual(await installedPacks(),[]);
    assert.equal((await env.caches.keys()).some(name=>name.startsWith('umbral-mod-')),false);
  }finally{fixture.cleanup();}
}));

test('una escritura de staging que termina tarde tras cancelar no puede publicarse',()=>withBrowser(async env=>{
  const v1=makeArchive(pack('late-write','Version 1')),v2=makeArchive(pack('late-write','Version 2'));
  try{
    const original=await installMod(v1.file);await activatePack('late-write');
    const namesBefore=(await env.caches.keys()).sort();
    let release,enteredResolve;
    const entered=new Promise(resolve=>{enteredResolve=resolve;});
    env.caches.beforePut=({cache,key})=>{
      if(cache.startsWith('umbral-mod-late-write-')&&cache!==original.cache&&key==='/art/unit.png')return new Promise(resolve=>{release=resolve;enteredResolve();});
    };
    const controller=new AbortController();
    const installing=installMod(v2.file,()=>{throw Error('la escritura cancelada no debe informar progreso');},{signal:controller.signal});
    await entered;controller.abort();
    await assert.rejects(installing,error=>error?.name==='AbortError');
    assert.deepEqual(await installedPacks(),[original]);
    assert.deepEqual(await activeRecord(),original);
    release();await new Promise(resolve=>setTimeout(resolve,0));
    assert.deepEqual(await installedPacks(),[original]);
    assert.deepEqual(await activeRecord(),original);
    assert.deepEqual((await env.caches.keys()).sort(),namesBefore);
  }finally{v1.cleanup();v2.cleanup();}
}));

test('el inicio de publicación es el punto de commit y deja de aceptar cancelación',()=>withBrowser(async()=>{
  const fixture=makeArchive(pack('commit-point'));
  try{
    const controller=new AbortController();let commits=0;
    const record=await installMod(fixture.file,()=>{},{signal:controller.signal,onCommitting(){commits++;controller.abort();}});
    assert.equal(commits,1);
    assert.deepEqual(await installedPacks(),[record]);
  }finally{fixture.cleanup();}
}));

test('el watchdog se reinicia cuando un recurso grande sigue avanzando',()=>withBrowser(async env=>{
  const large={path:'audio/long.mp3',bytes:Buffer.alloc(2*1024*1024+64,7)};
  const fixture=makeArchive(pack('slow-progress','Slow progress',[large.path]),{additionalAssets:[large]});
  try{
    env.caches.afterBodyChunk=async({cache,key})=>{if(cache.startsWith('umbral-mod-slow-progress-')&&key==='/audio/long.mp3')await new Promise(resolve=>setTimeout(resolve,60));};
    const events=[],started=Date.now();
    const record=await installMod(fixture.file,()=>{},{stagingTimeoutMs:100,onAssetProgress:event=>events.push(event)});
    assert.ok(Date.now()-started>=120,'la transferencia debe durar más que un plazo fijo');
    assert.equal((await installedPacks())[0].cache,record.cache);
    assert.ok(events.some(event=>event.bytesDone>0&&event.bytesDone<event.bytesTotal));
    assert.equal(events.at(-1).bytesDone,events.at(-1).bytesTotal);
    assert.equal(events.at(-1).filesDone,2);
  }finally{fixture.cleanup();}
}));

test('un stream atascado vence, se aborta y su escritura tardía no se publica',()=>withBrowser(async env=>{
  const oldFixture=makeArchive(pack('stalled','Version 1'));
  const large={path:'audio/stalled.mp3',bytes:Buffer.alloc(2*1024*1024+64,9)};
  const stalledFixture=makeArchive(pack('stalled','Version 2',[large.path]),{additionalAssets:[large]});
  try{
    const original=await installMod(oldFixture.file);await activatePack('stalled');
    const namesBefore=(await env.caches.keys()).sort();let release,enteredResolve,blocked=false;
    const entered=new Promise(resolve=>{enteredResolve=resolve;});
    env.caches.afterBodyChunk=({cache,key})=>{
      if(!blocked&&cache.startsWith('umbral-mod-stalled-')&&cache!==original.cache&&key==='/audio/stalled.mp3'){
        blocked=true;enteredResolve();return new Promise(resolve=>{release=resolve;});
      }
    };
    const writes=[];
    const installing=installMod(stalledFixture.file,(done,total)=>writes.push([done,total]),{stagingTimeoutMs:25});
    await entered;
    await assert.rejects(installing,error=>error?.name==='TimeoutError');
    assert.deepEqual(await installedPacks(),[original]);
    assert.deepEqual(await activeRecord(),original);
    assert.deepEqual(writes,[[1,2]]);
    release();await new Promise(resolve=>setTimeout(resolve,10));
    assert.ok(env.caches.bodyErrors.some(error=>error?.name==='TimeoutError'));
    assert.deepEqual(await installedPacks(),[original]);
    assert.deepEqual(await activeRecord(),original);
    assert.deepEqual((await env.caches.keys()).sort(),namesBefore);
  }finally{oldFixture.cleanup();stalledFixture.cleanup();}
}));
