import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function setup() {
  const h = combatHarness();
  h.exec(`screenMap=()=>{};storyMode='classic';selectedDiff=1;startRun(0,['luffy','zoro']);`);
  return h;
}

test('all items stack in threes and royal meat follows the requested space boundaries', () => {
  const h = setup();
  for (const id of h.exec('Object.keys(ITEMS)')) {
    h.ctx.itemId = id;
    assert.equal(h.exec('backpackUsed({[itemId]:3})'),h.exec('ITEMS[itemId].slotSize'),id);
    assert.equal(h.exec('backpackUsed({[itemId]:4})'),h.exec('ITEMS[itemId].slotSize * 2'),id);
  }
  for (const [count,spaces] of [[1,2],[3,2],[4,4],[6,4],[7,6]]) {
    assert.equal(h.exec(`backpackUsed({carnereal:${count}})`),spaces);
  }
  h.exec('run.items={carnereal:6}');
  assert.deepEqual(Array.from(h.exec('backpackStacks(run).map(s=>s.count)')),[3,3]);
  h.exec('meta.fame=900;buyBackpackUpgrade()');
  assert.equal(h.exec('backpackStackLimit()'),4);
  assert.equal(h.exec('backpackUsed({carnereal:4})'),2);
  assert.deepEqual(Array.from(h.exec('backpackStacks(run).map(s=>s.count)')),[4,2]);
  h.exec('buyBackpackUpgrade()');
  assert.equal(h.exec('backpackStackLimit()'),5);
  assert.equal(h.exec('backpackUsed({carnereal:5})'),2);
  assert.equal(h.exec('run.items.carnereal'),6);
});

test('nine slots pack three identical items together; large food keeps its footprint', () => {
  const h = setup();
  assert.equal(h.exec('backpackCapacity()'),9);
  for (const [qty,slots] of [[1,1],[3,1],[4,2],[6,2],[7,3]]) {
    assert.equal(h.exec(`backpackUsed({cartel:${qty}})`),slots);
  }
  assert.equal(h.exec('backpackUsed({carne:1,carnereal:1,sake:1})'),7);
  h.exec('run.items={cartel:4,carne:9,carnereal:1,sake:1}');
  assert.equal(h.exec('backpackUsed(run.items,true)'),9);
  assert.equal(h.exec('backpackUsed(run.items,false)'),2);
  assert.equal(h.exec('addBackpackItem(run,"carne")'),false);
  assert.equal(h.exec('addBackpackItem(run,"cartel")'),true);
  assert.equal(h.exec('run.items.cartel'),5);
  assert.equal(h.exec('backpackFits(run,"carteldorado")'),true);
  h.exec('run.items.sake--');
  assert.equal(h.exec('backpackUsed(run.items,true)'),5);
  assert.equal(h.exec('addBackpackItem(run,"sake")'),true);
  const html = h.exec('backpackHTML(run)');
  assert.equal((html.match(/class="bag-cell /g)||[]).length,18);
  assert.equal((html.match(/class="bag-icon"/g)||[]).length,7);
  const pieces = id => [...html.matchAll(new RegExp(`<button[^>]*data-bag-item="${id}"[^>]*>[\\s\\S]*?</button>`, 'g'))].map(m=>m[0]);
  assert.equal(pieces('carnereal').length,1);
  assert.match(pieces('carnereal')[0],/ocupa (?:1 por 2|2 por 1) casillas/);
  assert.equal((pieces('carnereal').join('').match(/bag-occupied/g)||[]).length,2);
  assert.equal((pieces('sake').join('').match(/bag-occupied/g)||[]).length,4);
  assert.equal((pieces('sake').join('').match(/class="bag-icon"/g)||[]).length,1);
  assert.match(html,/×3/);
  assert.match(html,/×2/);
});

test('full bags save pending loot, stop auto travel, and can collect after space is released', () => {
  const h = setup();
  h.exec('run.items={carne:27};autoMode=true;receiveBackpackItem(run,"sake");saveRun()');
  assert.equal(h.exec('autoMode'),false);
  assert.equal(h.exec('run.items.sake || 0'),0);
  assert.equal(h.exec('run.pendingLoot.sake'),1);
  const position = h.exec('JSON.stringify(run.pos)');
  h.exec('enterNode(0,0)');
  assert.equal(h.exec('JSON.stringify(run.pos)'),position);
  h.exec('loadedSave=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run)));validateGameSave(loadedSave);loadRun()');
  assert.equal(h.exec('run.pendingLoot.sake'),1);
  assert.equal(h.exec('placePendingBackpackItem(run,"sake",4,false)'),false);
  assert.equal(h.exec('run.pendingLoot.sake'),1);
  h.exec('run.items.carne-=12;prepareBackpack(run);moveBackpackStack(run,"carne:3",6,false);moveBackpackStack(run,"carne:4",3,false);');
  assert.equal(h.exec('placePendingBackpackItem(run,"sake",4,false)'),true);
  assert.equal(h.exec('placePendingBackpackItem(run,"sake",4,false)'),false);
  assert.equal(h.exec('run.items.sake'),1);
  assert.equal(h.exec('hasPendingLoot(run)'),false);
  assert.equal(h.exec('backpackUsed(run.items)'),9);
});

test('migration and oversized starting provisions preserve every unit without exceeding capacity', () => {
  const h = setup();
  h.exec('delete run.backpackVersion;run.items={cartel:90,carne:4,sake:3,hierro:1};prepareBackpack(run)');
  assert.ok(h.exec('[false,true].every(combat=>backpackUsed(run.items,combat)<=9)'));
  for (const [id,count] of [['cartel',90],['carne',4],['sake',3],['hierro',1]]) {
    assert.equal(h.exec(`(run.items.${id}||0)+(run.pendingLoot.${id}||0)`),count);
  }
  const before = h.exec('JSON.stringify(run)');
  h.exec('prepareBackpack(run)');
  assert.equal(h.exec('JSON.stringify(run)'),before);
  h.exec('meta.global.food_sake3=true;startRun(0,["luffy"])');
  assert.equal(h.exec('(run.items.sake||0)+(run.pendingLoot.sake||0)'),3);
  assert.ok(h.exec('[false,true].every(combat=>backpackUsed(run.items,combat)<=9)'));
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
  assert.equal(h.exec('backpackStackLimit()'),6);
  h.exec('meta.global.backpackTier=17;meta.fame=99999');
  assert.equal(h.exec('buyBackpackUpgrade()'),false);
  assert.equal(h.exec('meta.fame'),99999);
  assert.equal(h.exec('backpackStackLimit()'),20);
});

test('shop hides iron and never charges for a purchase that no longer fits', () => {
  const h = setup();
  let html = '';
  const buy = {dataset:{buy:'sake'}};
  h.ctx.render = s => {html=s;};
  h.ctx.document.querySelectorAll = selector=>selector==='[data-buy]'?[buy]:[];
  h.exec('showBackpackOrganizer=()=>{throw Error("A fitting purchase should be stored automatically");};');
  h.exec('run.items={carne:27};run.berries=10000;screenShop()');
  assert.doesNotMatch(html,/data-buy="hierro"/);
  assert.match(html,/SIN ESPACIO/);
  buy.onclick();
  assert.equal(h.exec('run.berries'),10000);
  h.exec('run.items.carne=15');
  buy.onclick();
  assert.equal(h.exec('run.berries'),9600);
  assert.equal(h.exec('run.pendingLoot.sake||0'),0);
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
  h.exec(`tower={floor:2,team:[makeChar('luffy',15)],items:{bocadillo:9,sake:1}};prepareBackpack(tower);`);
  assert.equal(h.exec('(tower.items.bocadillo||0)+(tower.pendingLoot.bocadillo||0)'),9);
  assert.equal(h.exec('(tower.items.sake||0)+(tower.pendingLoot.sake||0)'),1);
  h.exec(`tower.items={bocadillo:9};tower.bagLayout={};tower.pendingLoot={};prepareBackpack(tower);let nextFloor=0,organize=0;showTowerBackpack=()=>organize++;towerNextBattle=()=>nextFloor++;endTowerBattle(true);`);
  assert.equal(h.exec('tower.floor'),3);
  assert.equal(h.exec('tower.items.bocadillo'),9);
  assert.equal(h.exec('tower.pendingLoot.bocadillo'),1);
  assert.equal(h.exec('nextFloor'),0);
  assert.equal(h.exec('organize'),1);
});
