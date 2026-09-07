import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('automatic healing uses the actual object values, chosen items and threshold',()=>{
 const h=combatHarness();
 h.exec(`saveRun=()=>{};autoMode=true;run={mode:'classic',team:[makeChar('luffy',5)],items:{carne:2,carnereal:1,bocadillo:1}};
 const f=run.team[0];f.maxhp=100;f.hp=20;autoSettings.healItems=['carne'];autoSettings.healThreshold=50;runAutoItems();`);
 assert.equal(h.exec('run.team[0].hp'),50);
 assert.equal(h.exec('run.items.carne'),1);
 assert.equal(h.exec('run.items.carnereal'),1);
 h.exec("autoSettings.healItems=['carne','carnereal','bocadillo'];run.team[0].hp=10;runAutoItems()");
 assert.equal(h.exec('run.team[0].hp'),100);
 assert.equal(h.exec('run.items.bocadillo'),0);
 h.exec('run.team[0].hp=90;runAutoItems()');
 assert.equal(h.exec('run.team[0].hp'),90);
});

test('revival is independent from healing and always respects Nuzlocke',()=>{
 for(const [mode,revive,expected] of [['classic',true,50],['classic',false,0],['nuzlocke',true,0]]){
  const h=combatHarness();h.exec(`saveRun=()=>{};autoMode=true;run={mode:'${mode}',team:[makeChar('luffy',5)],items:{sake:1}};
  run.team[0].maxhp=100;run.team[0].hp=0;autoSettings.healThreshold=0;autoSettings.revive=${revive};runAutoItems()`);
  assert.equal(h.exec('run.team[0].hp'),expected);
  assert.equal(h.exec('run.items.sake'),expected?0:1);
 }
});

test('configured event stops do not enter or consume the node; normal advancement does',()=>{
 const h=combatHarness();let entered=0;h.ctx.enterNode=()=>entered++;
 h.ctx.document.querySelector=()=>null;
 h.exec("screenMap=()=>{};autoMode=true;run={map:{rows:[[{type:'boss',done:false}]]}};autoSettings.pauseEvents=['boss'];advanceAutoNode(0,0)");
 assert.equal(entered,0);assert.equal(h.exec('autoMode'),false);assert.equal(h.exec('run.map.rows[0][0].done'),false);
 h.exec("autoMode=true;autoSettings.pauseEvents=[];advanceAutoNode(0,0)");assert.equal(entered,1);
});

test('automatic spending preserves the reserve and settings survive save normalization',()=>{
 const h=combatHarness();h.exec('run={berries:500};autoSettings.reserveBerries=200');
 assert.equal(h.exec('autoCanSpend(300)'),true);assert.equal(h.exec('autoCanSpend(301)'),false);
 h.exec(`autoSettings=normalizeAutoSettings({nodePriority:'special',specialAction:'gacha',pauseEvents:['boss','bad'],healItems:[],reserveBerries:200,shopItems:[{id:'carne',qty:8}]});
 meta.settings.autoConfig=autoSettings;loadedSave={meta:JSON.parse(JSON.stringify(meta))};loadMeta();`);
 assert.equal(h.exec('autoSettings.nodePriority'),'special');assert.equal(h.exec('autoSettings.specialAction'),'gacha');
 assert.deepEqual(Array.from(h.exec('autoSettings.pauseEvents')),['boss']);
 assert.equal(h.exec('autoSettings.healItems.length'),0);
 assert.equal(h.exec('autoSettings.shopItems[0].qty'),8);
 assert.equal(h.exec("normalizeAutoSettings({reserveBerries:-1,shopItems:[{id:'missing',qty:9},{id:'carne',qty:999}]}).reserveBerries"),0);
 assert.equal(h.exec("normalizeAutoSettings({shopItems:[{id:'missing',qty:9},{id:'carne',qty:999}]}).shopItems[0].qty"),99);
});
