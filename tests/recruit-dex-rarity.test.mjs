import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function recruitmentHarness() {
  const h = combatHarness();
  const nodes = new Map();
  const overlay = {
    innerHTML: '',
    remove() {},
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, {onclick: null});
      return nodes.get(selector);
    },
    querySelectorAll() { return []; },
  };
  h.ctx.document.createElement = () => overlay;
  h.ctx.document.body = {appendChild() {}, contains: () => true};
  h.exec(`screenMap=()=>{};modalInfo=()=>{};
    run={saga:SAGAS.findIndex(s=>s.id===CHARS.arlong.saga),islandIdx:0,mapIdx:0,mode:'classic',
      nuzCaught:{},berries:99999,items:{},team:[makeChar('luffy',5)]};`);
  return {h, overlay, nodes};
}

test('wild encounter blocks base four-star recruitment but allows evolved four-star pirates', () => {
  const {h, overlay, nodes} = recruitmentHarness();
  h.exec("meta.dex=[];wildEncounter(makeChar('arlong',10,true))");
  assert.match(overlay.innerHTML, /Nuevo en tu Dex/);
  assert.match(overlay.innerHTML, /PIRATA DE 4 ESTRELLAS/);
  assert.doesNotMatch(overlay.innerHTML, /id="we-pay"|id="we-chains"/);
  h.exec("meta.dex=['arlong'];wildEncounter(makeChar('arlong',10,true))");
  assert.match(overlay.innerHTML, /Ya en tu Dex/);

  h.exec("wildEncounter(makeEnemy('zoro',20,true))");
  assert.equal(h.exec("CHARS.zoro2.rareza"), 4);
  assert.match(overlay.innerHTML, /id="we-pay"/);
  assert.match(overlay.innerHTML, /id="we-chains"/);
  nodes.get('#we-pay').onclick();
  assert.equal(h.exec("run.team.some(f=>f.id==='zoro2')"), false);
  assert.equal(h.exec("run.team.some(f=>f.id==='zoro'&&f.lvl===7)"), true);
});

test('mystery recruitment excludes four-star pirates while Crossguild keeps them', () => {
  const {h, overlay} = recruitmentHarness();
  h.exec(`MYSTERY_EVENTS.splice(0,MYSTERY_EVENTS.length,MYSTERY_EVENTS.find(e=>e.kind==='recruit'));
    doMystery({lvl:[8,10],pool:['arlong','zoro']})`);
  assert.equal(h.exec("run.team.some(f=>f.id==='arlong')"), false);
  assert.equal(h.exec("run.team.some(f=>f.id==='zoro')"), true);
  assert.equal(h.exec("poolByRareza(4).includes('arlong')"), true);
  h.exec("meta.defeated=['arlong'];renderSpecialCatalog(10)");
  assert.match(overlay.innerHTML, /data-hire="arlong"/);
});
