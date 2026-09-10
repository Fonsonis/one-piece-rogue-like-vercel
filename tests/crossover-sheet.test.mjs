import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function modalHarness() {
 const h=combatHarness(),overlays=[];
 h.ctx.document.body={appendChild:ov=>overlays.push(ov)};
 h.ctx.document.createElement=()=>{
  const ov={nodes:new Map(),html:'',remove(){this.removed=true;},querySelector(selector){
   if(selector==='#sheet-upg-btn:not(:disabled)')return this.nodes.get('#sheet-upg-btn')?.disabled?null:this.nodes.get('#sheet-upg-btn');
   return this.nodes.get(selector)||null;
  }};
  Object.defineProperty(ov,'innerHTML',{get(){return this.html;},set(html){
   this.html=html;this.nodes=new Map([['.modal',{scrollTop:0}]]);
   for(const match of html.matchAll(/<button\b[^>]*id="([^"]+)"[^>]*>/g))
    this.nodes.set('#'+match[1],{disabled:/\sdisabled(?:\s|>)/.test(match[0]),focus(){}});
  }});
  return ov;
 };
 return {h,overlays};
}

test('crossover leader is exactly 50 levels above each final island boss',()=>{
 const {h,overlays}=modalHarness();
 h.exec(`let encounter;startBattle=(enemies,opts)=>{encounter={enemies,opts};};
 run={team:[makeChar('luffy',5)],items:{},saga:0};`);
 for(let index=0;index<h.exec('SAGAS.length');index++){
  h.exec(`run.saga=${index};doCrossoverEvent(SAGAS[${index}].islands.at(-1));`);
  overlays.at(-1).querySelector('#cx-fight').onclick();
  const expected=h.exec(`SAGAS[${index}].islands.at(-1).bossLvl.at(-1)+50`);
  assert.equal(h.exec('encounter.enemies.at(-1).lvl'),expected);
  assert.equal(h.exec('encounter.enemies.at(-1).atk===Math.floor(makeChar(encounter.enemies.at(-1).id,encounter.enemies.at(-1).lvl,false,true).atk*(1+CROSSOVER_BOOST))'),true);
  assert.ok(h.exec('encounter.opts.crossover'));
 }
});

test('sheet upgrade spends the current cost, refreshes evolution and keeps its overlay and close callback',()=>{
 const {h,overlays}=modalHarness();
 h.exec(`meta.sagaDiffWins=Object.fromEntries(SAGAS.map(s=>[s.id,{3:true}]));
 meta.charUpgrades={luffy:14};meta.logPoses=10000;showCharModal('luffy');`);
 const ov=overlays[0],cost=h.exec('logPoseUpgradeCost(19)');
 let closed=false;ov.querySelector('#sheet-close').onclick=()=>{closed=true;};
 ov.querySelector('.modal').scrollTop=140;
 const click=ov.querySelector('#sheet-upg-btn').onclick;click();click();
 assert.equal(h.exec("startLvlOf('luffy')"),20);
 assert.equal(h.exec('meta.logPoses'),10000-cost);
 assert.equal(overlays.length,1);
 assert.equal(ov.querySelector('.modal').scrollTop,140);
 assert.match(ov.html,/Luffy Gear 2/);
 assert.match(ov.html,/Subir a Nivel 21/);
 ov.querySelector('#sheet-upg-btn').onclick();
 assert.equal(h.exec("startLvlOf('luffy')"),21);
 ov.querySelector('#sheet-close').onclick();assert.equal(closed,true);
});

test('sheet respects insufficient funds and stops offering upgrades at the saga cap',()=>{
 const {h,overlays}=modalHarness();
 h.exec(`meta.sagaDiffWins={};meta.charUpgrades={luffy:9};meta.logPoses=0;showCharModal('luffy');`);
 const ov=overlays[0];assert.equal(ov.querySelector('#sheet-upg-btn').disabled,true);
 ov.querySelector('#sheet-upg-btn').onclick();assert.equal(h.exec("startLvlOf('luffy')"),14);
 h.exec('meta.logPoses=10000;');h.ctx.sheet=ov;h.exec("showCharModal('luffy',sheet);");
 ov.querySelector('#sheet-upg-btn').onclick();
 assert.equal(h.exec("startLvlOf('luffy')"),15);
 assert.equal(ov.querySelector('#sheet-upg-btn'),null);
 assert.match(ov.html,/Nivel máximo alcanzado/);
});
