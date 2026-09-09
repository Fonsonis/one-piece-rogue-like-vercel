import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {combatHarness} from './balance-harness.mjs';

function setup() {
 const h=combatHarness();
 h.exec(`screenMap=()=>{};let html='';render=value=>{html=value;};
 storyMode='classic';selectedDiff=1;startRun(0,['luffy']);`);
 return h;
}

test('journey totals persist across reloads and exclude spending and unrelated fame',()=>{
 const h=setup();
 h.exec(`trackJourneyRewards(80,50);meta.logPoses=50;meta.logPoses-=20;gainFame(999);
 saveRun();run=null;loadRun();`);
 assert.equal(h.exec('run.rewards.fame'),80);
 assert.equal(h.exec('run.rewards.logPoses'),50);
 assert.match(h.exec('journeyRewardsHTML()'),/Fama: <strong>80<\/strong>/);
 assert.match(h.exec('journeyRewardsHTML()'),/Log Poses: <strong>50<\/strong>/);
 h.exec("startRun(0,['luffy']);");
 assert.equal(h.exec('run.rewards.fame+run.rewards.logPoses'),0);
});

test('boss kills accumulate once and defeat includes consolation before clearing the run',()=>{
 const h=setup();
 const source=fs.readFileSync('public/game.js','utf8');
 h.exec(source.slice(source.indexOf('function gameOver() {'),source.indexOf('// ============ TORRE MARINE')));
 h.exec(`startBattle([makeChar('buggy',5),makeChar('arlong',5)],{boss:true});pauseBattle();
 battle.eTeam[0].hp=0;afterRound();pauseBattle();afterRound();pauseBattle();`);
 assert.equal(h.exec('run.rewards.fame'),40);
 assert.equal(h.exec('run.rewards.logPoses'),7);
 h.exec('run.badges=[0];gameOver();');
 assert.equal(h.exec('run'),null);
 assert.match(h.exec('html'),/Fama: <strong>50<\/strong>/);
 assert.match(h.exec('html'),/Log Poses: <strong>7<\/strong>/);
});

test('saga victory includes its first or repeated reward in the displayed total',()=>{
 for(const repeated of [false,true]) {
  const h=setup();
  h.exec(`trackJourneyRewards(40,21);run.islandComplete=true;
  meta.sagaDiffWins={eastblue:${repeated?'{1:true}':'{}'}};sagaComplete();`);
  assert.equal(h.exec('run'),null);
  assert.match(h.exec('html'),new RegExp(`Fama: <strong>${repeated?140:540}</strong>`));
  assert.match(h.exec('html'),/Log Poses: <strong>21<\/strong>/);
 }
});

test('legacy journeys show that historical rewards are unavailable',()=>{
 const h=setup();
 h.exec('delete run.rewards;trackJourneyRewards(40,7);');
 assert.match(h.exec('journeyRewardsHTML()'),/desde esta actualización/);
 assert.equal(h.exec('run.rewards.fame'),40);
});
