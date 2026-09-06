import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compactBounds} from '../scripts/compact-sprite-bounds.mjs';
import {combatHarness} from './balance-harness.mjs';

test('compact stages contain all four poses of all 457 characters, on both sides',()=>{
  const sizing=JSON.parse(fs.readFileSync('docs/sprite-sizing.json'));
  const motion=JSON.parse(fs.readFileSync('docs/motion-bounds.json'));
  for(const [id,info] of Object.entries(sizing)) {
    const b=compactBounds(id),center=(info.guardBounds[0]+info.guardBounds[2])/2;
    for(const [w,h] of [[130,80],[170,150],[260,200],[600,300]]) {
      const p=Math.min(300,(w-12)*b.x,(h-12)*b.y);
      for(const box of motion[id].frames) for(const x of [box[0],box[2]]) for(const y of [box[1],box[3]]) {
        const sx=w/2+((x-center)*info.atlasScale/192-b.center)*p;
        const sy=h-8-b.floor*p+((y-180.48)*info.atlasScale+.48)*p/192;
        assert.ok(sx>=0&&sx<=w&&sy>=0&&sy<=h,`${id} ${w}x${h}`);
        assert.ok(w-sx>=0&&w-sx<=w,`${id} mirrored`);
      }
    }
  }
});

test('counts show living fighters over the starting roster, including Nuzlocke removals and relays',()=>{
  const h=combatHarness();
  assert.equal(h.exec(`(()=>{
    run={mode:'nuzlocke',saga:0,team:['luffy','zoro','nami'].map(id=>makeChar(id,20)),items:{}};
    startBattle([makeChar('bandido',30),makeChar('buggy',30)],{wild:true});
    if(battleTeamCount('p')!=='3/3 en pie'||battleTeamCount('e')!=='2/2 en pie')return false;
    switchBattleFighter(1);if(battleTeamCount('p')!=='3/3 en pie')return false;
    battle.curP.hp=0;battle.curE.hp=0;afterRound();
    return run.team.length===2&&battleTeamCount('p')==='2/3 en pie'&&battleTeamCount('e')==='1/2 en pie';
  })()`),true);
});
