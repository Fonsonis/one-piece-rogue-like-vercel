import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('island and final bosses award difficulty-scaled Fama and account XP once in both modes', () => {
  const rewards = [40,52,66,86,110];
  for (const mode of ['classic','nuzlocke']) for (const [i,reward] of rewards.entries()) {
    for (const finalBoss of [false,true]) {
      const h = combatHarness();
      let rewardHTML = '';
      h.ctx.modalInfo = (_title,html) => { rewardHTML = html; };
      h.exec(`screenMap=()=>{};screenIslands=()=>{};sagaComplete=()=>{};offerCrossoverPath=()=>{};
        storyMode='${mode}';selectedDiff=${i+1};startRun(0,['luffy']);
        run.islandIdx=${finalBoss ? 'SAGAS[0].islands.length-1' : '0'};
        meta.fame=0;meta.accXp=0;battle={opts:{boss:true}};originalEndBattle(true);`);
      assert.equal(h.exec('meta.fame'),reward);
      assert.equal(h.exec('meta.accXp'),reward);
      if (!finalBoss) assert.match(rewardHTML,new RegExp(`\\+${reward} ⭐ Fama`));
      else {
        h.exec('battle={opts:{boss:true}};originalEndBattle(true)');
        assert.equal(h.exec('meta.fame'),reward);
      }
    }
  }
});

test('defeats, escapes and ordinary enemies do not pay boss Fama; legacy difficulty defaults to Grumete', () => {
  for (const [victory,fled,boss] of [[false,false,true],[false,true,true],[true,false,false]]) {
    const h = combatHarness();
    h.exec(`screenMap=()=>{};storyMode='classic';startRun(0,['luffy']);meta.fame=0;meta.accXp=0;
      battle={opts:{boss:${boss}}};originalEndBattle(${victory},${fled});`);
    assert.equal(h.exec('meta.fame'),0);
    assert.equal(h.exec('meta.accXp'),0);
  }
  const h = combatHarness();
  assert.equal(h.exec('bossFameReward()'),40);
  assert.equal(h.exec('bossFameReward(999)'),40);
});
