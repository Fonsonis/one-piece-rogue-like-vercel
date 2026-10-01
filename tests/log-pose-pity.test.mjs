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

function posterHarness() {
 const h=combatHarness();
 h.exec(`document.body={appendChild(){}};
 const posters=Array.from({length:5},()=>({classList:{toggle(){},add(){},remove(){}}}));
 document.createElement=()=>({querySelectorAll:()=>posters,querySelector:()=>posters[0]});
 const legendaryIds=SAGAS.flatMap(s=>sagaBasePirateIds(s.id)).filter(id=>CHARS[id].rareza===5);
 let awardedId=null,compensation='';
 registerRecruit=id=>{awardedId=id;};
 modalInfo=(title,body)=>{compensation=body;};
 Math.random=()=>0;`);
 return h;
}

test('guaranteed legendary is the only missing one even when it has already been seen',()=>{
 const h=posterHarness();
 h.exec(`const missing=legendaryIds.at(-1);meta.roster=legendaryIds.filter(id=>id!==missing);
 meta.dex.push(missing);meta.starPity=500;startLogPoseGacha(SAGAS);
 for(const poster of posters)poster.onclick?.();`);
 assert.equal(h.exec('awardedId'),h.exec('missing'));
 assert.equal(h.exec('meta.starPity'),0);
 assert.equal(h.exec('meta.roster.includes(missing)'),true);
});

test('completed selected sagas compensate without awarding duplicates or other sagas',()=>{
 const h=posterHarness();
 h.exec(`const selected=SAGAS.find(s=>sagaBasePirateIds(s.id).some(id=>CHARS[id].rareza===5));
 meta.roster=sagaBasePirateIds(selected.id).filter(id=>CHARS[id].rareza===5);
 meta.logPoses=17;meta.starPity=500;startLogPoseGacha([selected]);`);
 assert.equal(h.exec('awardedId'),null);
 assert.equal(h.exec('meta.logPoses'),1017);
 assert.equal(h.exec('meta.starPity'),0);
 assert.match(h.exec('compensation'),/1000 Log Poses/);
});

test('menu duplicates award 50, 500 and 1000 Log Poses exactly once',()=>{
 for(const [rarity,roll,reward] of [[3,.8,50],[4,.97,500],[5,.999,1000]]){
  const h=posterHarness();
  h.exec(`meta.roster=SAGAS.flatMap(s=>sagaBasePirateIds(s.id));
  meta.logPoses=12;meta.starPity=0;Math.random=()=>${roll};startLogPoseGacha(SAGAS);
  for(const poster of posters){const click=poster.onclick;if(click){click();click();}}`);
  assert.equal(h.exec('CHARS[awardedId].rareza'),rarity);
  assert.equal(h.exec('meta.logPoses'),12+reward);
 }
});

test('automatic poster pulls charge one at a time and stop without charging remaining pulls',()=>{
 const h=combatHarness();
 h.exec(`
  const control={};
  const posters=Array.from({length:5},()=>({classList:{add(){},remove(){}}}));
  const faces=Array.from({length:5},()=>({innerHTML:''}));
  const scene={
    set innerHTML(value){this.markup=value;},
    querySelectorAll(){return posters;},
    querySelector(selector){
      if(selector.startsWith('[data-p='))return posters[Number(selector.match(/\\d+/)[0])];
      if(selector.startsWith('#pf-'))return faces[Number(selector.match(/\\d+/)[0])];
      return control[selector] ||= {textContent:'',click(){this.onclick?.();}};
    },
    remove(){}
  };
  const summary={set innerHTML(value){this.markup=value;},querySelector(){return {};}};
  let created=0;
  document.body={appendChild(){}};
  document.createElement=()=>++created===1?scene:summary;
  Math.random=()=>0;
  meta.logPoses=5000;
  meta.starPity=0;
  startLogPoseAutoGacha(SAGAS,3,1000);
 `);
 assert.equal(h.exec('meta.logPoses'),4000);
 h.exec(`scene.querySelector('#lp-skip-pull').onclick();`);
 h.tick();
 assert.equal(h.exec('meta.logPoses'),3000);
 h.exec(`scene.querySelector('#lp-stop-auto').onclick();`);
 assert.match(h.exec('summary.markup'),/2 de 3 tiradas completadas/);
 while(h.tick()){}
 assert.equal(h.exec('meta.logPoses'),3000);
 assert.equal(h.exec('meta.starPity'),2);
 assert.ok(h.exec('meta.roster.length')>0);
});
