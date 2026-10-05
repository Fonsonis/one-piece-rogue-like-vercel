import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function encounter(opts={boss:true}) {
  const h=combatHarness();
  h.ctx.options=opts;
  h.exec(`
    const player=makeChar('bandido',100,false,true);
    const foes=['bandido','bandido','bandido'].map(id=>makeChar(id,100,true));
    run={mode:'classic',saga:0,team:[player],items:{}};
    startBattle(foes,options);clearTimeout(battle.timer);
    player.maxhp=player.hp=10000;
  `);
  return h;
}

test('each successive enemy resets stagnation without resetting event turns',()=>{
  for(const opts of [{boss:true},{wild:true},{tower:true}]) {
    const h=opts.tower?combatHarness():encounter(opts);
    if(opts.tower)h.exec(`
      const player=makeChar('bandido',100,false,true),foes=[makeChar('bandido',100,true),makeChar('bandido',100,true)];
      tower={team:[player],items:{}};run={mode:'classic',saga:0,team:[player],items:{}};
      startBattle(foes,{tower:true});clearTimeout(battle.timer);player.maxhp=player.hp=10000;
    `);
    h.exec('battle.round=40;battle.combatProgress.stallRounds=30;foes[0].hp=0;afterRound()');
    assert.equal(h.exec('battle.round'),41);
    assert.equal(h.exec('battle.curE===foes[1]'),true);
    assert.equal(h.exec('combatRoundNow()'),1);
    assert.equal(h.exec('combatStallRounds()'),0);
    assert.equal(h.exec('climaxDmgMult()'),1);
    assert.equal(h.exec('healScaleNow()'),1);
    const hp=h.exec('player.hp');
    h.exec('afterRound()');
    assert.equal(h.exec('player.hp'),hp,'new fight does not inherit previous fatigue');
    assert.equal(h.exec('combatRoundNow()'),2);
    assert.equal(h.exec('combatStallRounds()'),1);
  }
});

test('boss damage growth follows consecutive stagnation and never compounds into base stats',()=>{
  const h=encounter();
  h.exec('const before=JSON.stringify(foes[0]);');
  const baseline=h.exec('calcDamage(foes[0],player,MOVES.punetazo,false,1).dmg');
  for(const stalled of [0,9,10,14,19,29]) {
    h.exec(`battle.combatProgress.stallRounds=${stalled}`);
    const expected=1+.1*Math.max(0,stalled-9);
    assert.equal(h.exec('climaxDmgMult()'),expected);
    const damage=h.exec('calcDamage(foes[0],player,MOVES.punetazo,false,1).dmg');
    assert.ok(Math.abs(damage-baseline*expected)<=expected+1);
    assert.equal(h.exec('JSON.stringify(foes[0])'),h.exec('before'));
  }
  h.exec('foes[0].hp=0;afterRound();const fresh=calcDamage(foes[1],player,MOVES.punetazo,false,1).dmg;');
  const unscaled=h.exec(`(()=>{const round=battle.round;battle.round=1;
    const dmg=calcDamage(foes[1],player,MOVES.punetazo,false,1).dmg;battle.round=round;return dmg;})()`);
  assert.equal(h.exec('fresh'),unscaled,'next boss starts at its own unscaled damage');
  h.exec('battle.combatProgress.stallRounds=19');
  assert.equal(h.exec('climaxDmgMult()'),2);
  h.exec('foes[1].hp=0;afterRound()');
  assert.equal(h.exec('combatRoundNow()'),1);
  assert.equal(h.exec('combatStallRounds()'),0);
  assert.equal(h.exec('climaxDmgMult()'),1);
});

test('slow net progress keeps climax inactive for arbitrarily long fights',()=>{
  const h=encounter();
  for(let round=0;round<50;round++) {
    h.exec('foes[0].hp-=1;afterRound()');
    assert.equal(h.exec('combatStallRounds()'),0);
    assert.equal(h.exec('climaxDmgMult()'),1);
    assert.equal(h.exec('healScaleNow()'),1);
  }
  assert.equal(h.exec('combatRoundNow()'),51);
});

test('healing oscillations do not masquerade as progress and fatigue cannot reset itself',()=>{
  const h=encounter();
  h.exec('const full=foes[0].hp;foes[0].hp=full-10;afterRound()');
  assert.equal(h.exec('combatStallRounds()'),0);
  for(let round=0;round<10;round++) {
    h.exec(`foes[0].hp=full-${round%2?5:0};afterRound()`);
  }
  assert.equal(h.exec('combatStallRounds()'),10);
  assert.equal(h.exec('climaxDmgMult()'),1.1);
  assert.equal(h.exec('healScaleNow()'),.8);
  h.exec('battle.combatProgress.stallRounds=29;afterRound()');
  assert.equal(h.exec('combatStallRounds()'),30);
  const hp=h.exec('player.hp');
  h.exec('afterRound()');
  assert.equal(h.exec('combatStallRounds()'),31,'fatigue damage is absorbed into the floor without progress');
  assert.ok(h.exec('player.hp')<hp);
});

test('remaining on the same enemy or manually relaying preserves stagnation',()=>{
  const h=encounter();
  h.exec('const reserve=makeChar("bandido",100);battle.pTeam.push(reserve);resetCombatProgress(battle);battle.combatProgress.stallRounds=12;afterRound()');
  assert.equal(h.exec('combatStallRounds()'),13);
  h.exec('battle.curP=reserve;afterRound()');
  assert.equal(h.exec('combatStallRounds()'),14);
  h.exec('reserve.hp=0;afterRound()');
  assert.equal(h.exec('battle.curP===player'),true);
  assert.equal(h.exec('combatStallRounds()'),0,'a real new team HP minimum is progress, not a scope reset');
});

test('challenge and local sequential enemy replacements also restart climax',()=>{
  for(const opts of [{challenge:true},{local:true}]) {
    const h=combatHarness();
    h.ctx.options=opts;
    h.exec(`
      const player=makeChar('bandido',100),foes=[makeChar('bandido',100,true),makeChar('bandido',100,true)];
      run={mode:'classic',saga:0,team:[player],items:{}};
      startBattle(foes,{...options,team:[player],items:{}});clearTimeout(battle.timer);
      battle.round=20;battle.combatProgress.stallRounds=20;foes[0].hp=0;afterRound();
    `);
    assert.equal(h.exec('battle.round'),21);
    assert.equal(h.exec('combatRoundNow()'),1);
    assert.equal(h.exec('combatStallRounds()'),0);
    assert.equal(h.exec('healScaleNow()'),1);
  }
});

test('level-ups fully heal living fighters, including multiple levels and evolution; XP alone does not',()=>{
  const h=combatHarness();
  h.exec(`const fighter=makeChar('bandido',10);fighter.hp=1;fighter.hpBonus=100;`);
  h.exec('gainXP(fighter,1)');
  assert.equal(h.exec('fighter.hp'),1);
  h.exec('gainXP(fighter,xpForLevel(fighter.lvl)+xpForLevel(fighter.lvl+1))');
  assert.equal(h.exec('fighter.lvl'),12);
  assert.equal(h.exec('fighter.hp'),h.exec('fighter.maxhp'));
  h.exec(`maxStartLvlCap=()=>100;meta.charUpgrades={franky:35};meta.sagaDiffWins={gyojin:{3:true}};
    const franky=makeChar('franky',29);franky.hp=1;gainXP(franky,xpForLevel(29));`);
  assert.equal(h.exec('franky.id'),'franky-newworld');
  assert.equal(h.exec('franky.hp'),h.exec('franky.maxhp'));
  h.exec('fighter.hp=0;gainXP(fighter,xpForLevel(fighter.lvl))');
  assert.equal(h.exec('fighter.hp'),0,'level-up does not revive a KO');
});

test('room victory heals every teammate that levels up before the next opponent',()=>{
  const h=encounter();
  h.exec(`
    const reserve=makeChar('bandido',10);reserve.hp=1;reserve.xp=xpForLevel(10)-1;
    player.lvl=10;player.xp=xpForLevel(10)-1;player.hp=1;battle.pTeam.push(reserve);
    foes[0].hp=0;afterRound();
  `);
  assert.ok(h.exec('player.lvl')>10);
  assert.ok(h.exec('reserve.lvl')>10);
  assert.equal(h.exec('player.hp'),h.exec('player.maxhp'));
  assert.equal(h.exec('reserve.hp'),h.exec('reserve.maxhp'));
});
