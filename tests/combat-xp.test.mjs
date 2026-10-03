import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('enemy EXP follows relative levels and preserves boss and encounter bonuses',()=>{
  const h=combatHarness();
  h.exec("var enemy=makeChar('bandido',25),fighter=makeChar('luffy',25);");
  assert.equal(h.exec('enemyCombatXP(enemy,fighter)'),350);
  assert.equal(h.exec('fighter.lvl=50;enemyCombatXP(enemy,fighter)'),175);
  assert.equal(h.exec('fighter.lvl=10;enemyCombatXP(enemy,fighter)'),875);
  assert.equal(h.exec('fighter.lvl=1;enemyCombatXP(enemy,fighter)'),1050);
  assert.equal(h.exec('fighter.lvl=100;enemyCombatXP(enemy,fighter)'),87);
  assert.equal(h.exec('fighter.lvl=25;enemyCombatXP(enemy,fighter,{xpMult:1.5})'),525);
  assert.equal(h.exec("enemyCombatXP(makeChar('arlong',25),fighter)"),560);
});

test('a defeated enemy pays full EXP to living active and reserve nakamas only once, excluding fallen allies',()=>{
  const h=combatHarness();
  h.exec(`run={mode:'classic',saga:0,islandIdx:0,team:['luffy','zoro','bandido'].map(id=>makeChar(id,25)),items:{}};
    tower={team:run.team};startBattle([makeChar('bandido',25)],{tower:true});
    run.team[2].hp=0;run.team[2].xp=xpForLevel(25)-1;battle.eTeam[0].hp=0;
    var expected=run.team.map(f=>f.xp+(f.hp>0?enemyCombatXP(battle.eTeam[0],f,battle.opts):0));
    afterRound();`);
  assert.deepEqual(Array.from(h.exec('run.team.map(f=>f.xp)')),Array.from(h.exec('expected')));
  assert.equal(h.exec('run.team[2].hp'),0,'EXP must not revive a fallen nakama');
  assert.equal(h.exec('run.team[2].lvl'),25,'fallen nakamas must not gain a level');
  h.exec('battle.over=false;afterRound()');
  assert.deepEqual(Array.from(h.exec('run.team.map(f=>f.xp)')),Array.from(h.exec('expected')));
});

test('finishing an encounter grants no extra EXP, including recruitment and fleeing',()=>{
  const h=combatHarness();
  h.exec(`screenMap=()=>{};saveRun=()=>true;
    run={mode:'classic',saga:0,islandIdx:0,team:[makeChar('luffy',25)],items:{},berries:0};
    run.team[0].xp=123;endBattle=originalEndBattle;`);
  for(const args of ['true','false','false,true','true,false,true']){
    h.exec(`battle={opts:{}};endBattle(${args});`);
    assert.equal(h.exec('run.team[0].lvl'),25);
    assert.equal(h.exec('run.team[0].xp'),123);
  }
});

test('tower floors do not add EXP or a free level beyond defeated enemies',()=>{
  const h=combatHarness();
  h.exec(`tower={floor:1,team:[makeChar('luffy',25)],items:{},floorEnemyRarity:1};
    tower.team[0].xp=123;hasPendingLoot=()=>false;towerNextBattle=()=>{};endTowerBattle(true);`);
  assert.equal(h.exec('tower.team[0].lvl'),25);
  assert.equal(h.exec('tower.team[0].xp'),123);
  assert.equal(h.exec('tower.floor'),2);
});

test('levels advance only when accumulated combat EXP crosses the level threshold',()=>{
  const h=combatHarness();
  h.exec(`var fighter=makeChar('luffy',25),enemy=makeChar('bandido',25);
    fighter.xp=xpForLevel(25)-100;gainXP(fighter,enemyCombatXP(enemy,fighter));`);
  assert.equal(h.exec('fighter.lvl'),26);
  assert.equal(h.exec('fighter.xp'),250);
});
