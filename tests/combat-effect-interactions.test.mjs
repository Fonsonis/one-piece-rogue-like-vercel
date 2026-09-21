import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('Ice II preserves stronger relic slows and reinforces weaker slows at six members',()=>{
  const h=combatHarness();
  for(const [size,rate,expected] of [[3,.30,.30],[6,.30,.30],[6,.20,.21]]){
    h.ctx.spec={size,rate};
    const actual=h.exec(`(()=>{
      const p=makeChar('aokiji',35,false,true),e=makeChar('bandido',35,false,true);
      run={mode:'story',saga:0,items:{},team:[p,...Array.from({length:spec.size-1},()=>makeChar('aokiji',35,false,true))]};
      startBattle([e],{wild:true});p.battleRelic='relic_aokiji';
      RELICS.relic_aokiji.rule.slow=spec.rate;Math.random=()=>.5;
      attackWith(p,e,MOVES.punetazo,'enemy');
      const slow=e.st.slowRate;
      afterRound();
      if(e.st.slow!==1)throw Error('Slow must last through the following round');
      return slow;
    })()`);
    assert.ok(Math.abs(actual-expected)<1e-10);
  }
});

test('every transformed move relic boosts its offensive signature, but requires affinity and stays disabled locally',()=>{
  const h=combatHarness();
  const results=h.exec(`(()=>{
    maxStartLvlCap=()=>100;
    meta.charUpgrades=Object.fromEntries(Object.keys(CHARS).map(id=>[id,99]));
    const results=[];
    for(const id of Object.keys(CHARS).filter(id=>BASE_OF[id])){
      const r=RELICS['relic_'+baseFormOf(id)];if(!r.rule.move)continue;
      const p=makeChar(id,100,false,true),e=makeChar('bandido',100,false,true);
      battle={pTeam:[p],eTeam:[e],curP:p,curE:e,round:1,opts:{}};p.battleRelic=r.id;
      const move=id==='marco-animal'?MOVES.zoan_marco_animal:id==='marco-hybrid'?MOVES.zoan_marco_hybrid:getUltimateMove(p);
      const boosted=calcDamage(p,e,move,false,1).dmg;
      const multiplier=relicDamageMult(p,e,move);
      const damage=r.rule.damage;r.rule.damage=1;
      const plain=calcDamage(p,e,move,false,1).dmg;r.rule.damage=damage;
      if(multiplier!==1.35||boosted<=plain)throw Error(id+' signature has no bonus');
      if(relicDamageMult(p,e,MOVES[r.rule.move])!==1.35)throw Error(id+' lost original bonus');
      if(relicDamageMult(p,e,MOVES.punetazo)!==1)throw Error(id+' unrelated attack boosted');
      p.battleRelic='relic_bandido';
      if(relicDamageMult(p,e,move)!==1)throw Error(id+' wrong affinity');
      p.battleRelic=r.id;battle.opts.local=true;
      if(relicDamageMult(p,e,move)!==1)throw Error(id+' local relic active');
      results.push(id);
    }
    return results;
  })()`);
  for(const id of ['marco-animal','marco-hybrid','carrot-sulong','bepo-sulong','momonosuke-adult','momonosuke-dragon'])assert.ok(results.includes(id),id);
});

test('round healing survives an enemy KO without draining the dead or the reserve',()=>{
  const h=combatHarness();
  for(const kind of ['passive','relic','teamRelic','water','drain','climax','darkness','dead']){
    h.ctx.kind=kind;
    const result=h.exec(`(()=>{
      const p=makeChar(kind==='passive'?'chopper':kind==='drain'?'moria':'bandido',35,false,true);
      const e=makeChar('bandido',35,false,true),reserve=makeChar('bandido',35,false,true);
      const team=[p];
      if(kind==='teamRelic')team.push(makeChar('chopper',35,false,true));
      if(kind==='water')team.push(makeChar('jinbe',35,false,true),makeChar('arlong',35,false,true));
      const enemies=[e,reserve];
      if(kind==='darkness')enemies.push(...['teach','moria','bigmom'].map(id=>makeChar(id,35,false,true)));
      run={mode:'story',saga:0,items:{},team};startBattle(enemies,{wild:true});
      if(kind==='teamRelic')team[1].battleRelic='relic_chopper';
      if(['relic','climax','darkness','dead'].includes(kind)){p.id='saturn';p.battleRelic='relic_saturn';}
      p.maxhp=1000;p.hp=kind==='dead'?0:100;e.hp=0;
      if(kind==='climax')battle.round=15;
      const reserveHP=reserve.hp;afterRound();
      return {hp:p.hp,reserveUnchanged:reserve.hp===reserveHP};
    })()`);
    const expected={passive:130,relic:210,teamRelic:140,water:140,drain:100,climax:100,darkness:100,dead:0};
    // Moria's own relic is not equipped, so a dead target provides no drain or healing.
    assert.equal(result.hp,expected[kind],kind);
    assert.equal(result.reserveUnchanged,true,kind+' reserve');
  }
});
