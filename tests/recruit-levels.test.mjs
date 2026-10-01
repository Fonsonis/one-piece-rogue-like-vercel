import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('every recruitment route uses the current saga base cap rather than the enemy level', () => {
  const h = combatHarness();
  const nodes = new Map();
  const overlay = {
    innerHTML: '',
    remove() {},
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, {onclick: null});
      return nodes.get(selector);
    },
  };
  h.ctx.document.createElement = () => overlay;
  h.ctx.document.body = {appendChild() {}, contains: () => true};
  h.ctx.Math.random = () => 0.5;
  h.exec(`screenMap=()=>{};modalInfo=()=>{};
    run={saga:SAGAS.findIndex(s=>s.id==='marineford'),islandIdx:0,mapIdx:0,mode:'classic',
      nuzCaught:{},berries:9999,items:{},team:[makeChar('luffy',5)]};`);
  assert.equal(h.exec('recruitLevelForCurrentSaga()'), 35);

  h.exec("wildEncounter(makeChar('zoro',90,true))");
  nodes.get('#we-pay').onclick();
  assert.equal(h.exec('run.team.find(f=>f.id===\'zoro\').lvl'), 35);

  h.exec(`MYSTERY_EVENTS.splice(0,MYSTERY_EVENTS.length,MYSTERY_EVENTS.find(e=>e.kind==='recruit'));
    doMystery({lvl:[90,100],pool:['nami']});`);
  assert.equal(h.exec("run.team.find(f=>f.id==='nami').lvl"), 35);

  h.exec("specialJoin('sanji',100)");
  assert.equal(h.exec("run.team.find(f=>f.id==='sanji').lvl"), 35);

  h.exec("run.saga=SAGAS.findIndex(s=>s.id==='gyojin');specialJoin('chopper',100)");
  assert.equal(h.exec("run.team.find(f=>f.id==='chopper').lvl"), 40);
});
