import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function setup({form='chopper',relic=false,enemySide=false}={}) {
  const h=combatHarness();
  h.exec(`
    const fighter=makeChar('bandido',40,false,true), medic=makeChar('${form}',40,false,true);
    const foe=makeChar('bandido',40,false,true);
    run={mode:'story',saga:0,team:${enemySide?'[foe]':'[fighter,medic]'},items:{}};
    startBattle(${enemySide?'[fighter,medic]':'[foe]'},{wild:true});
    clearTimeout(battle.timer);
    fighter.maxhp=1000;fighter.hp=100;foe.maxhp=foe.hp=100000;
    medic.battleRelic=${relic?"'relic_chopper'":'null'};
    Math.random=()=>.5;
    const hit={name:'Golpe de prueba',type:'Golpe',power:50,acc:1};
    const realCalcDamage=calcDamage;
    calcDamage=(...args)=>{const result=realCalcDamage(...args);return {...result,dmg:result.eff===0?0:100};};
  `);
  return h;
}

test('every Chopper form heals its active ally on hits from the reserve, on both sides',()=>{
  for(const form of ['chopper','chopper-animal','chopper-hybrid','chopper-monster'])
    for(const enemySide of [false,true]) {
      const h=setup({form,enemySide});
      h.exec("attackWith(fighter,foe,hit,'enemy')");
      assert.equal(h.exec('fighter.hp'),110,form);
      assert.equal(h.exec('medic.hp'),h.exec('medic.maxhp'));
    }
});

test('signature relic replaces 10% with 50%, caps at max HP and requires a living medic',()=>{
  const h=setup({relic:true});
  h.exec("attackWith(fighter,foe,hit,'enemy')");
  assert.equal(h.exec('fighter.hp'),150);
  h.exec("fighter.hp=980;attackWith(fighter,foe,hit,'enemy')");
  assert.equal(h.exec('fighter.hp'),1000);
  h.exec("fighter.hp=100;medic.hp=0;attackWith(fighter,foe,hit,'enemy')");
  assert.equal(h.exec('fighter.hp'),100);
});

test('misses, dodges, immunity and support moves never trigger hit healing',()=>{
  for(const condition of ['hit.acc=0','foe.dodgeLeft=1','evaChanceFor=()=>1','foe.id="buggy";PASSIVES.buggy.name="Bara Bara";CHARS.buggy.rareza=4;hit.type="Corte"','hit.power=0;hit.effect="atkup"']) {
    const h=setup();
    h.exec(`${condition};attackWith(fighter,foe,hit,'enemy')`);
    assert.equal(h.exec('fighter.hp'),100,condition);
  }
});

test('ultimate hits heal once and round end does not grant the old Chopper regeneration',()=>{
  const h=setup();
  h.exec('getUltimateMove=()=>hit;fighter.ultCharge=100;useUltimate(fighter)');
  assert.equal(h.exec('fighter.hp'),110);
  h.exec('afterRound()');
  assert.equal(h.exec('fighter.hp'),110);
});

test('Chopper respects climax and darkness healing suppression and never revives the active',()=>{
  for(const condition of ['battle.combatProgress.stallRounds=14','fighter.hp=0',`battle.eTeam.push(...['teach','moria','bigmom'].map(id=>makeChar(id,40,false,true)))`]) {
    const h=setup({relic:true});
    h.exec(`${condition};healChopperOnHit(fighter,100)`);
    assert.equal(h.exec('fighter.hp'),condition==='fighter.hp=0'?0:100,condition);
  }
});

test('active Chopper heals only himself from his own damage, with and without his relic',()=>{
  for(const relic of [false,true]) {
    const h=setup({relic});
    h.exec("battle.curP=medic;medic.maxhp=1000;medic.hp=100;attackWith(medic,foe,hit,'enemy')");
    assert.equal(h.exec('medic.hp'),relic?150:110);
    assert.equal(h.exec('fighter.hp'),100);
    h.exec("attackWith(fighter,foe,hit,'enemy')");
    assert.equal(h.exec('medic.hp'),relic?150:110,'reserve attacks do not heal the active');
  }
});

test('healing scales with actual damage, including a finishing hit',()=>{
  const h=setup({relic:true});
  h.exec("foe.hp=20;attackWith(fighter,foe,hit,'enemy')");
  assert.equal(h.exec('fighter.hp'),110);
  assert.equal(h.exec('foe.hp'),0);
});
