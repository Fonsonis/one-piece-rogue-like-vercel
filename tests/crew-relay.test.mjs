import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

const setup = `
  run={mode:'story',saga:0,team:['luffy','zoro','nami'].map(id=>makeChar(id,20)),items:{}};
  startBattle([makeChar('bandido',50)],{wild:true});
`;

test('one manual relay preserves HP, states, ultimate and team order; resets next encounter',()=>{
  const h=combatHarness();
  h.exec(setup);
  assert.equal(h.exec(`(()=>{
    const f=run.team[1]; f.hp=42; f.st.poison=true; f.ultCharge=73;
    if(!switchBattleFighter(1)||battle.curP!==f||activeP()!==f)return false;
    if(f.hp!==42||!f.st.poison||f.ultCharge!==73||run.team[0].id!=='luffy')return false;
    if(switchBattleFighter(2)||switchBattleFighter(0))return false;
    startBattle([makeChar('bandido',50)],{wild:true});
    return !battle.switchUsed&&battle.curP===run.team[0]&&switchBattleFighter(2);
  })()`),true);
});

test('invalid, KO, paused and finished requests do not spend relay; automatic replacements remain available',()=>{
  const h=combatHarness(); h.exec(setup);
  assert.equal(h.exec(`(()=>{
    if(switchBattleFighter(-1)||switchBattleFighter(99)||switchBattleFighter(0))return false;
    run.team[1].hp=0;if(switchBattleFighter(1))return false;
    battle.waiting=true;if(switchBattleFighter(2))return false;battle.waiting=false;
    battle.over=true;if(switchBattleFighter(2))return false;battle.over=false;
    if(battle.switchUsed)return false;
    if(!switchBattleFighter(2))return false;
    battle.curP.hp=0;afterRound();
    return battle.curP===run.team[0]&&battle.switchUsed;
  })()`),true);
});

test('a relay between attacks redirects the pending hit without adding a turn',()=>{
  const h=combatHarness(); h.exec(setup);
  assert.equal(h.exec(`(()=>{
    let hits=[];
    attackWith=(att,dfd)=>{ hits.push([att,dfd]); if(hits.length===1)switchBattleFighter(1); };
    battle.curP.spd=99999;
    // Execute animation callbacks synchronously to exercise both halves of this round.
    setTimeout=fn=>{fn();return 1;}; scheduleRound=()=>{};
    runRound();
    return hits.length===2&&hits[0][0]===run.team[0]&&hits[1][1]===run.team[1]&&battle.curP===run.team[1];
  })()`),true);
});

test('relay in Marine Tower and Nuzlocke keeps the surviving roster valid',()=>{
  const h=combatHarness(); h.exec(setup);
  assert.equal(h.exec(`(()=>{
    tower={team:run.team,items:{}};
    startBattle([makeChar('bandido',50)],{tower:true});
    if(!switchBattleFighter(1)||battle.curP!==tower.team[1])return false;
    run.mode='nuzlocke';startBattle([makeChar('bandido',50)],{wild:true});
    switchBattleFighter(2);battle.curP.hp=0;afterRound();
    return run.team.length===2&&battle.curP===run.team[0]&&battle.switchUsed;
  })()`),true);
});
