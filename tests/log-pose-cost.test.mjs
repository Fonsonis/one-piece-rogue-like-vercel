import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('Log Pose costs preserve original costs through level 30 and grow linearly afterwards',()=>{
 const h=combatHarness();
 let previous=0;
 for(let level=5;level<=100;level++){
  const cost=h.exec(`logPoseUpgradeCost(${level})`);
  assert.ok(Number.isSafeInteger(cost)&&cost>previous);
  if(level<=30)assert.equal(cost,Math.floor(3*1.5**(level-5)+(level-5)*2+3));
  // Every late-game step adds the same amount, including the transition.
  if(level>=30)assert.equal(cost-previous,25253);
  previous=cost;
 }
 assert.equal(h.exec('logPoseUpgradeCost(30)'),75806);
 assert.equal(h.exec('logPoseUpgradeCost(39)'),303083);
});

test('level 30–40 purchases charge the balanced price and reject insufficient funds',()=>{
 const h=combatHarness();
 h.exec('maxStartLvlCap=()=>40;meta.charUpgrades={luffy:25};meta.logPoses=1894445;');
 for(let level=30;level<40;level++){
  const before=h.exec('meta.logPoses');
  const cost=h.exec(`logPoseUpgradeCost(${level})`);
  assert.equal(h.exec("upgradeCharLvl('luffy')"),true);
  assert.equal(h.exec("startLvlOf('luffy')"),level+1);
  assert.equal(h.exec('meta.logPoses'),before-cost);
 }
 assert.equal(h.exec('meta.logPoses'),0);
 assert.equal(h.exec("upgradeCharLvl('luffy')"),false);
 h.exec('meta.charUpgrades={luffy:25};meta.logPoses=75805;');
 assert.equal(h.exec("upgradeCharLvl('luffy')"),false);
 assert.equal(h.exec("startLvlOf('luffy')"),30);
 assert.equal(h.exec('meta.logPoses'),75805);
});
