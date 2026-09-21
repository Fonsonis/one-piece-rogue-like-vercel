import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('starting supplies retain previous tiers, including legacy saves',()=>{
 const h=combatHarness();
 for(const [global,expected] of [
  [{},{cartel:3,carne:1}],
  [{carneplus:true},{cartel:3,carne:2}],
  [{food_carnereal2:true},{cartel:3,carnereal:2,carne:3}],
  [{food_sake3:true},{cartel:3,sake:3,carnereal:3,carne:3}],
  [{carnerealplus:true},{cartel:3,carnereal:1,carne:3}],
 ]){
  h.ctx.upgrades=global;h.exec('meta.global=upgrades');
  assert.deepEqual(JSON.parse(h.exec('JSON.stringify(startingSupplies())')),expected);
 }
 h.exec('meta.global={food_sake3:true};backpackCapacity=()=>6;');
 assert.deepEqual(JSON.parse(h.exec('JSON.stringify(startingSupplies())')),{cartel:3,sake:3,carnereal:3});
 assert.equal(h.exec('planBackpack({items:startingSupplies()}).missing.length'),0);
});

test('Bonney has only Nika at 45, Ivankov transforms at 30, and permanent unlocks are required',()=>{
 const h=combatHarness();h.exec('maxStartLvlCap=()=>100;');
 assert.deepEqual(Array.from(h.exec('characterForms("bonney").map(f=>f.id)')),['bonney','bonney-nika']);
 for(const [base,form,level] of [['bonney','bonney-nika',45],['ivankov','ivankov-female',30]]){
  h.ctx.spec={base,form,level};
  assert.equal(h.exec(`(()=>{
   meta.charUpgrades={[spec.base]:spec.level-5};
   if(makeChar(spec.base,spec.level-1).id!==spec.base||makeChar(spec.base,spec.level).id!==spec.form)return false;
   meta.charUpgrades[spec.base]--;
   if(makeChar(spec.base,100).id!==spec.base)return false;
   meta.charUpgrades[spec.base]++;
   const foe=makeEnemy(spec.base,spec.level);
   if(foe.id!==spec.form||!getUltimateMove(foe).power||baseFormOf(foe.id)!==spec.base)return false;
   foe.battleRelic='relic_'+spec.base;
   battle={pTeam:[foe],eTeam:[],opts:{}};
   return EVOLVED_FORMS.has(spec.form)&&CHARS[spec.form].saga===CHARS[spec.base].saga&&relicRule(foe)===RELICS[foe.battleRelic].rule;
  })()`),true,form);
 }
});

test('combat topbar omits steps while map topbar retains them',()=>{
 const h=combatHarness();
 assert.doesNotMatch(h.exec('topbar(true,true,true,false,true)'),/daily-steps/);
 assert.match(h.exec('topbar(true,true,true,false,true)'),/combat-topbar/);
 assert.match(h.exec('topbar(true,true,true)'),/daily-steps/);
});
