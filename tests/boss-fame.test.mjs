import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function setup(mode='classic', diff=1) {
  const h=combatHarness();
  h.exec(`screenMap=()=>{};screenIslands=()=>{};sagaComplete=()=>{};
    let notice='', crossoverFame=0;
    modalInfo=(_title,html)=>{notice=html;};
    offerCrossoverPath=(_vets,fame)=>{crossoverFame=fame;};
    storyMode='${mode}';selectedDiff=${diff};startRun(0,['luffy']);
    meta.fame=0;meta.accXp=0;
    startBattle([makeChar('buggy',5),makeChar('buggy',5),makeChar('arlong',5)],{boss:true});
    pauseBattle();`);
  return h;
}

test('each boss pays difficulty-scaled Fama and account XP once, including repeated character IDs',()=>{
  for(const mode of ['classic','nuzlocke']) for(const [i,reward] of [40,52,66,86,110].entries()) {
    for(const finalBoss of [false,true]) {
      const h=setup(mode,i+1);
      if(finalBoss) h.exec('run.islandIdx=SAGAS[0].islands.length-1');
      for(let k=0;k<3;k++) {
        h.exec(`battle.eTeam[${k}].hp=0;afterRound();pauseBattle();`);
        assert.equal(h.exec('meta.fame'),reward*(k+1));
        assert.equal(h.exec('meta.accXp'),reward*(k+1));
        h.exec('afterRound();pauseBattle()');
        assert.equal(h.exec('meta.fame'),reward*(k+1));
      }
      h.exec('originalEndBattle(true)');
      assert.equal(h.exec('meta.fame'),reward*3,'completion must not pay again');
      assert.equal(h.exec('meta.accXp'),reward*3);
      if(!finalBoss) assert.match(h.exec('notice'),new RegExp(`\\+${reward*3} ⭐ Fama`));
      else if(i===4) assert.equal(h.exec('crossoverFame'),reward*3);
    }
  }
});

test('two simultaneous boss kills pay immediately and remain saved after losing to the third',()=>{
  for(const mode of ['classic','nuzlocke']) {
    const h=setup(mode);
    h.exec(`let savedFame=0;saveMeta=()=>{savedFame=meta.fame;};
      battle.eTeam[0].hp=0;battle.eTeam[1].hp=0;battle.pTeam[0].hp=0;afterRound();`);
    assert.equal(h.exec('meta.fame'),80);
    assert.equal(h.exec('meta.accXp'),80);
    assert.equal(h.exec('savedFame'),80);
    for(let i=0;i<10&&!h.exec('auditResult');i++) h.tick();
    assert.equal(h.exec('auditResult'),'loss');
    assert.equal(h.exec('meta.fame'),80);
  }
});

test('ordinary encounters, tower kills and losses with no boss kills do not pay boss Fama',()=>{
  for(const kind of ['wild','marine','crossover','tower','loss']) {
    const h=setup();
    h.exec(`battle.opts=${kind==='tower'||kind==='loss'?'{boss:true}':`{${kind}:true}`};
      battle.tower=${kind==='tower'};
      ${kind==='loss'?'battle.pTeam[0].hp=0':'battle.eTeam[0].hp=0'};afterRound();`);
    assert.equal(h.exec('meta.fame'),0);
    assert.equal(h.exec('meta.accXp'),0);
  }
  const h=combatHarness();
  assert.equal(h.exec('bossFameReward()'),40);
  assert.equal(h.exec('bossFameReward(999)'),40);
});
