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
  assert.equal(h.exec('recruitLevelForPlayer()'), 20);

  h.exec("wildEncounter(makeChar('zoro',90,true))");
  nodes.get('#we-pay').onclick();
  assert.equal(h.exec('run.team.find(f=>f.id===\'zoro\').lvl'), 20);
  assert.equal(h.exec("meta.roster.includes('zoro')"), false, 'wild recruits remain pending');

  h.exec(`MYSTERY_EVENTS.splice(0,MYSTERY_EVENTS.length,MYSTERY_EVENTS.find(e=>e.kind==='recruit'));
    doMystery({lvl:[90,100],pool:['nami']});`);
  assert.equal(h.exec("run.team.find(f=>f.id==='nami').lvl"), 20);
  assert.equal(h.exec("meta.roster.includes('nami')"), true, 'accepted mystery recruits are permanent');

  h.exec("specialJoin('sanji',100)");
  assert.equal(h.exec("run.team.find(f=>f.id==='sanji').lvl"), 20);
  assert.equal(h.exec("meta.roster.includes('sanji')"), true, 'Cross Guild recruits are permanent');

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

test('new permanent recruits start at level 5 and keep any purchased base levels', () => {
  const h = combatHarness();
  h.exec(`meta.charUpgrades.nami=2;meta.charUpgradeSpent.nami=123;
    run={islandComplete:true,team:[makeChar('zoro',20),makeChar('nami',20)]};unlockRoster()`);
  assert.equal(h.exec("startLvlOf('zoro')"), 5);
  assert.equal(h.exec('meta.charUpgrades.zoro'), undefined);
  assert.equal(h.exec('meta.charUpgradeSpent.zoro'), undefined);
  assert.equal(h.exec("startLvlOf('nami')"), 7);
  assert.equal(h.exec('meta.charUpgrades.nami'), 2);
  assert.equal(h.exec('meta.charUpgradeSpent.nami'), 123);

  h.exec("meta.sagaDiffWins={eastblue:{3:true},alabasta:{3:true}};awardLogPosePrize('sanji')");
  assert.equal(h.exec("startLvlOf('sanji')"), 5);
  assert.equal(h.exec('meta.charUpgrades.sanji'), undefined);
  assert.equal(h.exec('meta.charUpgradeSpent.sanji'), undefined);
});
