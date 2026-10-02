import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('recruitment uses the highest base level available to the player', () => {
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
    run={saga:0,islandIdx:0,mapIdx:0,mode:'classic',
      nuzCaught:{},berries:9999,items:{},team:[makeChar('luffy',5)]};`);
  assert.equal(h.exec('recruitLevelForPlayer()'), 15);

  h.exec("wildEncounter(makeChar('zoro',90,true))");
  nodes.get('#we-pay').onclick();
  assert.equal(h.exec('run.team.find(f=>f.id===\'zoro\').lvl'), 15);

  h.exec(`MYSTERY_EVENTS.splice(0,MYSTERY_EVENTS.length,MYSTERY_EVENTS.find(e=>e.kind==='recruit'));
    doMystery({lvl:[90,100],pool:['nami']});`);
  assert.equal(h.exec("run.team.find(f=>f.id==='nami').lvl"), 15);

  h.exec("specialJoin('sanji',100)");
  assert.equal(h.exec("run.team.find(f=>f.id==='sanji').lvl"), 15);

  h.exec("meta.sagaDiffWins={eastblue:{3:true},alabasta:{3:true}};specialJoin('chopper',100)");
  assert.ok(h.exec('maxStartLvlCap()') > 15);
  assert.equal(h.exec("run.team.find(f=>f.id==='chopper').lvl"), h.exec('maxStartLvlCap()'));
});

test('the second and third starting nakamas unlock at account level 7', () => {
  const h = combatHarness();
  assert.equal(h.exec('nextStarterSlotItem().lvl'), 7);
  h.exec('meta.global.starterSlots=2');
  assert.equal(h.exec('nextStarterSlotItem().lvl'), 7);
  h.exec('meta.global.starterSlots=3');
  assert.equal(h.exec('nextStarterSlotItem().lvl'), 11);
});

test('new permanent recruits receive the available base level without refundable free upgrades', () => {
  const h = combatHarness();
  h.exec("run={islandComplete:true,team:[makeChar('zoro',15)]};unlockRoster()");
  assert.equal(h.exec("startLvlOf('zoro')"), 15);
  assert.equal(h.exec('meta.charUpgradeSpent.zoro'), 0);

  h.exec("meta.sagaDiffWins={eastblue:{3:true},alabasta:{3:true}};awardLogPosePrize('nami')");
  assert.equal(h.exec("startLvlOf('nami')"), h.exec('maxStartLvlCap()'));
  assert.equal(h.exec('meta.charUpgradeSpent.nami'), 0);
  assert.equal(h.exec("sellCharBaseLevels('nami')"), 0);
});
