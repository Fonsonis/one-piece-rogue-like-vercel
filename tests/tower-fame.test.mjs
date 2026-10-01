import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {combatHarness} from './balance-harness.mjs';

test('tower Fama follows visible enemy stars and each inclusive 25-floor block',()=>{
  const h=combatHarness();
  for (const [floor,rarity,expected] of [
    [1,1,10],[25,5,50],[26,1,60],[50,5,100],[51,1,110],[76,4,190],
  ]) assert.equal(h.exec(`towerFloorFame(${floor},${rarity})`),expected);
  h.exec(`tower={floor:25,team:[makeChar('luffy',15)],items:{},floorEnemyRarity:5};
    hasPendingLoot=()=>false;towerNextBattle=()=>{};`);
  h.exec('endTowerBattle(true)');
  assert.equal(h.exec('tower.floor'),26);
  assert.equal(h.exec('tower.fameWon'),50);
  h.exec('tower.floorEnemyRarity=1;endTowerBattle(true)');
  assert.equal(h.exec('tower.fameWon'),110);
  assert.equal(h.exec('meta.fame'),0,'Fama se entrega al terminar el ascenso');
  const game=fs.readFileSync('public/game.js','utf8');
  h.exec(game.slice(game.indexOf('function towerGameOver()'),game.indexOf('// ============ TIENDA GLOBAL')));
  h.exec('render=()=>{};topbar=()=>"";playMusic=()=>{};towerGameOver()');
  assert.equal(h.exec('meta.fame'),110);
  assert.equal(h.exec('meta.accXp'),110);
  assert.equal(h.exec('tower'),null);
  h.exec('towerGameOver()');
  assert.equal(h.exec('meta.fame'),110,'el resultado no paga dos veces');
});

test('story saga first and repeat victories pay reduced Fama and account XP',()=>{
  const h=combatHarness();
  h.exec(`screenHome=()=>{};screenMap=()=>{};playMusic=()=>{};render=()=>{};topbar=()=>"";
    storyMode='classic';selectedDiff=1;startRun(0,['luffy']);
    run.islandIdx=SAGAS[0].islands.length-1;run.islandComplete=true;
    meta.fame=0;meta.accXp=0;sagaComplete();`);
  assert.equal(h.exec('meta.fame'),100);
  assert.equal(h.exec('meta.accXp'),100);
  h.exec(`startRun(0,['luffy']);run.islandIdx=SAGAS[0].islands.length-1;run.islandComplete=true;sagaComplete();`);
  assert.equal(h.exec('meta.fame'),120,'repetición de saga paga el 20 %');
  assert.equal(h.exec('meta.accXp'),120);
});
