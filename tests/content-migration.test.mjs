import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createContent} from '../public/content/runtime.mjs';
const original=JSON.parse(fs.readFileSync('public/content/base.json')),mod=JSON.parse(fs.readFileSync('mods/one-piece/pack.json'));
function storage(){const memory=new Map();return {memory,getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};}
function saveContext(pack,memory){const ctx=vm.createContext({GameContent:createContent(pack,memory)});vm.runInContext(fs.readFileSync('public/save-storage.js','utf8'),ctx);return ctx;}
const oldSave={game:'grandlinelike',version:1,sagaOrder:['eastblue','alabasta','skypiea','water7','thriller','sabaody','marineford','gyojin','punkhazard','dressrosa','zou','wholecake','wano','egghead','elbaph'],meta:{roster:['luffy','zoro'],dex:['luffy'],formPreferences:{luffyGear4:'luffy4'},claimedAch:{island_diff_dressrosa_1_2:true},islandProgress:{'eastblue:classic:1':[0]}},run:null};
test('el mod migra una copia del guardado anterior sin tocar el original',()=>{
 const s=storage(),legacy=JSON.stringify(oldSave);s.setItem('oplike_save',legacy);const content=createContent(mod,s);
 const next=JSON.parse(content.storage.getItem('umbral_save'));
 assert.equal(next.contentId,'one-piece');assert.equal(next.game,'umbral');assert.deepEqual(next.meta.roster,['unit_001','unit_008']);
 assert.equal(next.meta.formPreferences.VanguardGear4,'unit_005');assert.equal(next.meta.claimedAch.island_diff_region_10_1_2,true);
 assert.deepEqual(next.meta.islandProgress['region_01:classic:1'],[0]);assert.equal(s.getItem('oplike_save'),legacy);
 assert.equal(createContent(original,s).storage.getItem('umbral_save'),null);
});
test('importar un JSON antiguo solo funciona con el mod correspondiente activo',()=>{
 const s=storage(),fan=saveContext(mod,s),base=saveContext(original,s);fan.input=JSON.stringify(oldSave);base.input=fan.input;
 const result=vm.runInContext('GameSaveStorage.parse(input)',fan);assert.equal(result.contentId,'one-piece');assert.equal(result.meta.roster[0],'unit_001');
 assert.throws(()=>vm.runInContext('GameSaveStorage.parse(input)',base));
 fan.input=JSON.stringify({game:'umbral',version:1,contentId:'umbral',sagaOrder:original.data.SAGAS.map(s=>s.id),meta:{},run:null});assert.throws(()=>vm.runInContext('GameSaveStorage.parse(input)',fan));
});
