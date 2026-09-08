import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function setup(towerMode=false) {
  const h=combatHarness();
  h.exec(`screenMap=()=>{};storyMode='classic';selectedDiff=1;startRun(0,['zoro','sanji']);
    run.items={bebida_ataque:2,bebida_defensa:1};`);
  if(towerMode) h.exec('tower={team:run.team,items:{...run.items}}');
  h.exec(`startBattle([makeChar('morgan',30)],{wild:true,tower:${towerMode}})`);
  return h;
}

test('combat bag has its own free space and only displays usable items',()=>{
  const h=setup();
  h.exec('run.items={cartel:4,fruta_diablo:1,carne:1,bebida_ataque:1,bebida_defensa:1};run.pendingLoot={cartel:1}');
  const html=h.exec('backpackHTML(run,true)');
  assert.doesNotMatch(html,/data-bag-item="(?:cartel|fruta_diablo)"|data-bag-collect="cartel"/);
  for(const id of ['carne','bebida_ataque','bebida_defensa']) assert.ok(html.includes(`data-bag-item="${id}"`));
  assert.equal((html.match(/class="bag-cell /g)||[]).length,9);
  assert.doesNotMatch(html,/bag-reserved/);
  assert.equal((html.match(/bag-empty/g)||[]).length,4);
  assert.equal(h.exec('backpackUsed(run.items)'),9);
  assert.match(h.exec('backpackHTML(run)'),/data-bag-item="cartel"/);
  assert.match(h.exec('backpackHTML(run)'),/data-bag-item="fruta_diablo"/);
});

test('drinks boost physical and special damage calculations without changing permanent stats or stacking',()=>{
  const h=setup();
  h.exec(`var f=battle.curP,e=battle.curE;var originalStats=JSON.stringify([f.atk,f.spatk,f.def,f.spdef]);
    var moves=[{type:'Golpe',power:300},{type:'Fuego',power:300}];
    var outgoing=moves.map(m=>calcDamage(f,e,m,false,1).dmg);var incoming=moves.map(m=>calcDamage(e,f,m,false,1).dmg);
    useBattleItem('bebida_ataque');useBattleItem('bebida_defensa');`);
  for(let i=0;i<2;i++) {
    assert.ok(h.exec(`calcDamage(f,e,moves[${i}],false,1).dmg>outgoing[${i}]`));
    assert.ok(h.exec(`calcDamage(e,f,moves[${i}],false,1).dmg<incoming[${i}]`));
  }
  assert.equal(h.exec('JSON.stringify([f.atk,f.spatk,f.def,f.spdef])'),h.exec('originalStats'));
  assert.equal(h.exec('backpackUsed(run.items)'),2);
  h.exec("useBattleItem('bebida_ataque')");
  assert.equal(h.exec('run.items.bebida_ataque'),1);
  assert.equal(h.exec('battleItemMult(f,"atk")'),1.25);
  h.exec('battle.curP=battle.pTeam[1]');
  assert.equal(h.exec('battleItemMult(battle.curP,"atk")'),1);
  assert.equal(h.exec('battleItemMult(f,"atk")'),1.25);
  h.exec('battle.over=true');
  assert.equal(h.exec('battleItemMult(f,"atk")'),1);
  h.exec("startBattle([makeChar('morgan',30)],{wild:true})");
  assert.equal(h.exec('battleItemMult(f,"atk")'),1);
});

test('drinks respect paused and KO guards, tower inventory, and save only their remaining quantity',()=>{
  for(const tower of [false,true]) {
    const h=setup(tower);
    h.exec("battle.waiting=true;useBattleItem('bebida_ataque')");
    assert.equal(h.exec('battle.items.bebida_ataque'),2);
    h.exec("battle.waiting=false;battle.curP.hp=0;useBattleItem('bebida_ataque')");
    assert.equal(h.exec('battle.items.bebida_ataque'),2);
    h.exec("battle.curP.hp=1;useBattleItem('bebida_ataque')");
    assert.equal(h.exec('battle.items.bebida_ataque'),1);
    assert.equal(h.exec('run.items.bebida_ataque'),tower?2:1);
    h.exec('var saved=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run)));validateGameSave(saved)');
    assert.equal(h.exec('saved.run.items.bebida_ataque'),tower?2:1);
    assert.equal(h.exec('saved.run.team[0].itemBuffs'),undefined);
  }
});

test('drinks are sold for 200 Berries and need two free slots; iron stays unavailable',()=>{
  const h=setup();let html='';const button={dataset:{buy:'bebida_defensa'}};
  h.ctx.render=s=>html=s;
  h.ctx.document.querySelectorAll=s=>s==='[data-buy]'?[button]:[];
  h.exec('battle=null;run.items={carne:24};run.berries=500;screenShop()');
  assert.match(html,/data-buy="bebida_ataque"/);assert.match(html,/data-buy="bebida_defensa"/);
  assert.doesNotMatch(html,/data-buy="hierro"/);
  button.onclick();assert.equal(h.exec('run.berries'),500);
  h.exec('run.items.carne=21');button.onclick();
  assert.equal(h.exec('run.berries'),300);assert.equal(h.exec('backpackUsed(run.items)'),9);
  h.exec("useItemFromMap('bebida_defensa')");
  assert.equal(h.exec('run.items.bebida_defensa'),1);
});


test('both bags have independent capacity but one permanent upgrade and save migration',()=>{
  const h=setup();
  h.exec('run.items={cartel:27,carne:27};prepareBackpack(run);meta.fame=300');
  assert.equal(h.exec('backpackUsed(run.items,false)'),9);
  assert.equal(h.exec('backpackUsed(run.items,true)'),9);
  assert.equal(h.exec('hasPendingLoot(run)'),false);
  assert.equal(h.exec('addBackpackItem(run,"cartel")'),false);
  assert.equal(h.exec('addBackpackItem(run,"bebida_ataque")'),false);
  h.exec('run.items.cartel=0');
  assert.equal(h.exec('addBackpackItem(run,"bebida_ataque")'),false);
  assert.equal(h.exec('buyBackpackUpgrade()'),true);
  assert.equal(h.exec('backpackCapacity()'),12);
  assert.equal(h.exec('meta.fame'),0);
  assert.equal(h.exec('addBackpackItem(run,"bebida_ataque")'),true);
  assert.equal(h.exec('addBackpackItem(run,"cartel",48)'),true);
  h.exec('loadedSave=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run)));validateGameSave(loadedSave);loadRun()');
  assert.equal(h.exec('backpackUsed(run.items,false)'),12);
  assert.equal(h.exec('backpackUsed(run.items,true)'),9);
  assert.equal(h.exec('hasPendingLoot(run)'),false);
});
