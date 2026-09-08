import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function setup() {
  const h = combatHarness();
  h.exec(`screenMap=()=>{};storyMode='classic';selectedDiff=1;startRun(0,['luffy','zoro']);
    run.items={carne:2,carnereal:1};run.team.forEach(f=>{f.maxhp=100;f.hp=40;});`);
  return h;
}

test('auto consumption is opt-in, independent of auto travel, and saves its choices', () => {
  const h = setup();
  assert.equal(h.exec('runAutoItems()'),false);
  h.exec('setAutoBackpackSettings({enabled:true,items:{carnereal:false}})');
  assert.equal(h.exec('autoMode'),false);
  assert.equal(h.exec('runAutoItems()'),true);
  assert.equal(h.exec('run.team[0].hp'),70);
  assert.equal(h.exec('run.team[1].hp'),70);
  assert.equal(h.exec('run.items.carne'),0);
  assert.equal(h.exec('run.items.carnereal'),1);
  assert.equal(h.exec('backpackUsed(run.items)'),2);
  h.exec('meta=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run))).meta');
  assert.equal(h.exec('autoBackpackSettings().enabled'),true);
  assert.equal(h.exec('autoBackpackSettings().items.carnereal'),false);
});

test('thresholds and scope govern map and combat consumption, including paused fights', () => {
  const h = setup();
  h.exec('setAutoBackpackSettings({enabled:true,where:"combat",threshold:25})');
  assert.equal(h.exec('runAutoItems()'),false);
  h.exec('startBattle([makeChar("buggy",10)],{wild:true})');
  assert.equal(h.exec('runAutoItems()'),false);
  h.exec('battle.curP.hp=25;battle.waiting=true');
  assert.equal(h.exec('runAutoItems()'),false);
  h.exec('battle.waiting=false;setAutoBackpackSettings({where:"map"})');
  assert.equal(h.exec('runAutoItems()'),false);
  h.exec('setAutoBackpackSettings({where:"combat"})');
  assert.equal(h.exec('runAutoItems()'),true);
  assert.equal(h.exec('battle.curP.hp'),100);
  assert.equal(h.exec('run.items.carnereal'),0);
});

test('smallest sufficient heal wins, any damage includes under one percent, and healthy or KO allies consume nothing', () => {
  const h = setup();
  h.exec('setAutoBackpackSettings({enabled:true,threshold:99});run.team[0].maxhp=1000;run.team[0].hp=999;run.team[1].hp=0');
  assert.equal(h.exec('runAutoItems()'),true);
  assert.equal(h.exec('run.team[0].hp'),1000);
  assert.equal(h.exec('run.items.carne'),1);
  assert.equal(h.exec('run.items.carnereal'),1);
  assert.equal(h.exec('runAutoItems()'),false);
});

test('revival requires its own permission, never chains a heal, and respects Nuzlocke but allows tower revivals', () => {
  const h = setup();
  h.exec('run.items={sake:1,carne:1};run.team[0].hp=0;run.team[1].hp=100;setAutoBackpackSettings({enabled:true})');
  assert.equal(h.exec('runAutoItems()'),false);
  h.exec('setAutoBackpackSettings({items:{sake:true}});run.mode="nuzlocke"');
  assert.equal(h.exec('runAutoItems()'),false);
  h.exec('run.mode="classic"');
  assert.equal(h.exec('runAutoItems()'),true);
  assert.equal(h.exec('run.team[0].hp'),h.exec('Math.floor(100*ITEMS.sake.val)'));
  assert.equal(h.exec('run.items.carne'),1);
  h.exec(`run.mode='nuzlocke';tower={items:{sake:1},team:[makeChar('luffy',10),makeChar('zoro',10)]};
    battle={tower:true,pTeam:tower.team};tower.team[0].hp=0;`);
  assert.equal(h.exec('runAutoItems()'),true);
  assert.equal(h.exec('tower.items.sake'),0);
  assert.ok(h.exec('tower.team[0].hp')>0);
});

test('limited supplies never go negative and pending loot is not consumed', () => {
  const h = setup();
  h.exec('run.items={carne:1};run.pendingLoot={carnereal:2};setAutoBackpackSettings({enabled:true})');
  assert.equal(h.exec('runAutoItems()'),true);
  assert.equal(h.exec('run.team[0].hp'),70);
  assert.equal(h.exec('run.team[1].hp'),40);
  assert.equal(h.exec('run.items.carne'),0);
  assert.equal(h.exec('runAutoItems()'),false);
  assert.equal(h.exec('run.pendingLoot.carnereal'),2);
});

test('legacy automatic-mode choices migrate once and never overwrite backpack preferences', () => {
  const h = setup();
  h.exec(`meta.settings.autoConfig={healThreshold:0,revive:true,healItems:['carne'],shopItems:[{id:'hierro',qty:2}]};
    loadedSave={meta:JSON.parse(JSON.stringify(meta))};loadMeta();`);
  assert.equal(h.exec('autoBackpackSettings().enabled'),true);
  assert.equal(h.exec('autoBackpackSettings().threshold'),0);
  assert.equal(h.exec('autoBackpackSettings().items.sake'),true);
  assert.equal(h.exec('autoBackpackSettings().items.carnereal'),false);
  assert.equal(h.exec('autoSettings.shopItems.length'),0);
  h.exec(`setAutoBackpackSettings({enabled:false,where:'combat',threshold:25,items:{sake:false}});
    loadedSave={meta:JSON.parse(JSON.stringify(meta))};loadMeta();`);
  assert.equal(h.exec('autoBackpackSettings().enabled'),false);
  assert.equal(h.exec('autoBackpackSettings().where'),'combat');
  assert.equal(h.exec('autoBackpackSettings().threshold'),25);
  assert.equal(h.exec('autoBackpackSettings().items.sake'),false);
});
