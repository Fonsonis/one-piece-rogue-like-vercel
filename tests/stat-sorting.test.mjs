import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('every stat sort uses the displayed phase at permanent level with ship bonuses',()=>{
 const h=combatHarness();h.exec("meta.charUpgrades={luffy:60,zoro:20,shanks:2};meta.upgrades={zoro:{atk:99,hp:15,spatk:17,def:11,spdef:12,spd:13}};maxStartLvlCap=()=>100;");
 for(const [sort,key] of Object.entries({hpDesc:'maxhp',atkDesc:'atk',defDesc:'def',spatkDesc:'spatk',spdefDesc:'spdef',spdDesc:'spd',statTotalDesc:null})) {
  for(const evolved of [false,true]) {
   const resolve=evolved?"id=>evolutionFormAt(id,startLvlOf(id))":"id=>id";
   const result=h.exec(`(()=>{const resolve=${resolve},ids=['shanks','luffy','zoro'];const expected=ids.map(id=>{const f=applyUpgrades(makeChar(resolve(id),startLvlOf(id),false,true));return {id,value:${key?`f.${key}`:'f.maxhp+f.atk+f.def+f.spatk+f.spdef+f.spd'}};}).sort((a,b)=>b.value-a.value||CHARS[resolve(a.id)].name.localeCompare(CHARS[resolve(b.id)].name)).map(x=>x.id);return {actual:filterSortChars(ids,{sort:'${sort}'},resolve),expected};})()`);
   assert.deepEqual(Array.from(result.actual),Array.from(result.expected),sort);
  }
 }
 assert.equal(h.exec("filterSortChars(['shanks','luffy'],{sort:'atkDesc'})[0]"),'luffy');
 assert.equal(h.exec("filterSortChars(['shanks','zoro'],{sort:'atkDesc'})[0]"),'zoro');
});

test('Dex stats ordering uses base sheet values, filters phases and never mutates progress',()=>{
 const h=combatHarness();h.exec("meta.charUpgrades={luffy:95,shanks:0};maxStartLvlCap=()=>100;const before=JSON.stringify(meta);");
 const ids=Array.from(h.exec("dexFilteredBases({sort:'statTotalDesc'})"));
 const values=ids.map(id=>h.exec(`characterSortStat('${id}','statTotalDesc')`));
 assert.ok(values.every((value,i)=>!i||values[i-1]>=value));
 assert.equal(h.exec("dexFilteredBases({q:'Gear',type:'Haki',sort:'atkDesc'}).join(',')"),'luffy');
 assert.equal(h.exec('JSON.stringify(meta)===before'),true);
});
