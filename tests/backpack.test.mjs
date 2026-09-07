import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function setup() {
  const h = combatHarness();
  h.exec(`screenMap=()=>{};storyMode='classic';selectedDiff=1;startRun(0,['luffy','zoro']);`);
  return h;
}

test('nine slots pack ten posters together; large food occupies its full footprint', () => {
  const h = setup();
  assert.equal(h.exec('backpackCapacity()'),9);
  for (const [qty,slots] of [[1,1],[10,1],[11,2],[20,2],[21,3]]) {
    assert.equal(h.exec(`backpackUsed({cartel:${qty}})`),slots);
  }
  assert.equal(h.exec('backpackUsed({carne:1,carnereal:1,sake:1})'),7);
  h.exec('run.items={cartel:11,carne:1,carnereal:1,sake:1}');
  assert.equal(h.exec('backpackUsed(run.items)'),9);
  assert.equal(h.exec('addBackpackItem(run,"carne")'),false);
  assert.equal(h.exec('addBackpackItem(run,"cartel")'),true);
  assert.equal(h.exec('run.items.cartel'),12);
  assert.equal(h.exec('addBackpackItem(run,"carteldorado")'),false);
  h.exec('run.items.sake--');
  assert.equal(h.exec('backpackUsed(run.items)'),5);
  assert.equal(h.exec('addBackpackItem(run,"sake")'),true);
  const html = h.exec('backpackHTML(run)');
  assert.equal((html.match(/class="bag-cell /g)||[]).length,9);
  assert.equal((html.match(/class="bag-icon"/g)||[]).length,5);
  const pieces = id => [...html.matchAll(new RegExp(`<button[^>]*data-bag-item="${id}"[^>]*>[\\s\\S]*?</button>`, 'g'))].map(m=>m[0]);
  assert.equal(pieces('carnereal').length,1);
  assert.match(pieces('carnereal')[0],/grid-column:span 2/);
  assert.equal((pieces('carnereal').join('').match(/bag-occupied/g)||[]).length,2);
  assert.equal((pieces('sake').join('').match(/bag-occupied/g)||[]).length,4);
  assert.equal((pieces('sake').join('').match(/class="bag-icon"/g)||[]).length,1);
  assert.match(html,/×10/);
  assert.match(html,/×2/);
});

test('full bags save pending loot, stop auto travel, and can collect after space is released', () => {
  const h = setup();
  h.exec('run.items={carne:9};autoMode=true;receiveBackpackItem(run,"sake");saveRun()');
  assert.equal(h.exec('autoMode'),false);
  assert.equal(h.exec('run.items.sake || 0'),0);
  assert.equal(h.exec('run.pendingLoot.sake'),1);
  const position = h.exec('JSON.stringify(run.pos)');
  h.exec('enterNode(0,0)');
  assert.equal(h.exec('JSON.stringify(run.pos)'),position);
  h.exec('loadedSave=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run)));validateGameSave(loadedSave);loadRun()');
  assert.equal(h.exec('run.pendingLoot.sake'),1);
  const button = {dataset:{bagCollect:'sake'}};
  h.ctx.bagRoot = {querySelectorAll:selector=>selector==='[data-bag-collect]'?[button]:[]};
  h.exec('bindBackpack(bagRoot,run,false,()=>{})');
  button.onclick();
  assert.equal(h.exec('run.pendingLoot.sake'),1);
  h.exec('run.items.carne-=4');
  button.onclick(); button.onclick();
  assert.equal(h.exec('run.items.sake'),1);
  assert.equal(h.exec('hasPendingLoot(run)'),false);
  assert.equal(h.exec('backpackUsed(run.items)'),9);
});

test('migration and oversized starting provisions preserve every unit without exceeding capacity', () => {
  const h = setup();
  h.exec('delete run.backpackVersion;run.items={cartel:27,carne:4,sake:3,hierro:1};prepareBackpack(run)');
  assert.ok(h.exec('backpackUsed(run.items)')<=9);
  for (const [id,count] of [['cartel',27],['carne',4],['sake',3],['hierro',1]]) {
    assert.equal(h.exec(`(run.items.${id}||0)+(run.pendingLoot.${id}||0)`),count);
  }
  const before = h.exec('JSON.stringify(run)');
  h.exec('prepareBackpack(run)');
  assert.equal(h.exec('JSON.stringify(run)'),before);
  h.exec('meta.global.food_sake3=true;startRun(0,["luffy"])');
  assert.equal(h.exec('(run.items.sake||0)+(run.pendingLoot.sake||0)'),3);
  assert.ok(h.exec('backpackUsed(run.items)')<=9);
});

test('permanent expansion charges 300, 600, 900 Fama and survives a new run and save roundtrip', () => {
  const h = setup();
  h.exec('meta.fame=299');
  assert.equal(h.exec('buyBackpackUpgrade()'),false);
  assert.equal(h.exec('meta.fame'),299);
  h.exec('meta.fame=1800');
  for (const size of [12,15,18]) {
    assert.equal(h.exec('buyBackpackUpgrade()'),true);
    assert.equal(h.exec('backpackCapacity()'),size);
  }
  assert.equal(h.exec('meta.fame'),0);
  h.exec('startRun(0,["luffy"]);meta=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run))).meta');
  assert.equal(h.exec('backpackCapacity()'),18);
  h.exec('meta.global.backpackTier=17;meta.fame=99999');
  assert.equal(h.exec('buyBackpackUpgrade()'),false);
  assert.equal(h.exec('meta.fame'),99999);
});

test('shop hides iron and never charges for a purchase that no longer fits', () => {
  const h = setup();
  let html = '';
  const buy = {dataset:{buy:'sake'}};
  h.ctx.render = s => {html=s;};
  h.ctx.document.querySelectorAll = selector=>selector==='[data-buy]'?[buy]:[];
  h.exec('run.items={carne:9};run.berries=10000;screenShop()');
  assert.doesNotMatch(html,/data-buy="hierro"/);
  assert.match(html,/SIN ESPACIO/);
  buy.onclick();
  assert.equal(h.exec('run.berries'),10000);
  h.exec('run.items.carne=5');
  buy.onclick();
  assert.equal(h.exec('run.berries'),9600);
  assert.equal(h.exec('run.items.sake'),1);
  assert.equal(h.exec('backpackUsed(run.items)'),9);
});

test('combat uses the same bag, frees slots, and rejects empty, paused and Nuzlocke revive actions', () => {
  const h = setup();
  h.exec(`run.items={carne:1,sake:1};startBattle([makeChar('buggy',10)],{wild:true});
    battle.curP.hp=1;useBattleItem('carne');`);
  assert.equal(h.exec('run.items.carne'),0);
  assert.equal(h.exec('backpackUsed(run.items)'),4);
  const hp = h.exec('battle.curP.hp');
  h.exec('useBattleItem("carne")');
  assert.equal(h.exec('battle.curP.hp'),hp);
  h.exec('battle.pTeam[1].hp=0;battle.waiting=true;useBattleItem("sake")');
  assert.equal(h.exec('run.items.sake'),1);
  h.exec('battle.waiting=false;run.mode="nuzlocke";useBattleItem("sake")');
  assert.equal(h.exec('run.items.sake'),1);
  h.exec('run.mode="classic";useBattleItem("sake")');
  assert.equal(h.exec('run.items.sake'),0);
  assert.ok(h.exec('battle.pTeam[1].hp')>0);
});

test('new save fields reject malformed capacity and pending inventory', () => {
  const h = setup();
  for (const tier of [-1,0.5,18,'1']) {
    h.ctx.badTier=tier;
    assert.throws(()=>h.exec('GameSaveStorage.validate(GameSaveStorage.payload({...meta,global:{backpackTier:badTier}},run))'));
  }
  for (const count of [-1,0.5,Infinity,'1']) {
    h.ctx.badCount=count;
    assert.throws(()=>h.exec('GameSaveStorage.validate(GameSaveStorage.payload(meta,{...run,pendingLoot:{carne:badCount}}))'));
  }
  assert.throws(()=>h.exec('validateGameSave(GameSaveStorage.payload(meta,{...run,pendingLoot:{missing:1}}))'));
});

test('tower provisions and floor rewards share the capacity limit and wait for overflow resolution', () => {
  const h = setup();
  h.exec(`tower={floor:2,team:[makeChar('luffy',15)],items:{bocadillo:3,sake:1}};prepareBackpack(tower);`);
  assert.equal(h.exec('backpackUsed(tower.items)'),9);
  assert.equal(h.exec('tower.pendingLoot.sake'),1);
  h.exec(`tower.pendingLoot={};let nextFloor=0,organize=0;showTowerBackpack=()=>organize++;towerNextBattle=()=>nextFloor++;endTowerBattle(true);`);
  assert.equal(h.exec('tower.floor'),3);
  assert.equal(h.exec('tower.items.bocadillo'),3);
  assert.equal(h.exec('tower.pendingLoot.bocadillo'),1);
  assert.equal(h.exec('nextFloor'),0);
  assert.equal(h.exec('organize'),1);
});
