import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('main-menu guarantee activates at 500 accumulated stars and resets after a legendary',()=>{
 const h=combatHarness();
 h.exec(`document.body={appendChild(){}};
 const posters=Array.from({length:5},()=>({classList:{toggle(){},add(){},remove(){}}}));
 document.createElement=()=>({querySelectorAll:()=>posters,querySelector:()=>posters[0]});
 Math.random=()=>0;
 let awardedRarity;
 registerRecruit=id=>{awardedRarity=CHARS[id].rareza;};`);
 for(const [before,rarity,after] of [[499,1,500],[500,5,0],[750,5,0],[1000,5,0]]){
  h.exec(`meta.starPity=${before};startLogPoseGacha(SAGAS);`);
  h.exec('for(const poster of posters)poster.onclick?.();');
  assert.equal(h.exec('awardedRarity'),rarity);
  assert.equal(h.exec('meta.starPity'),after);
 }
});
