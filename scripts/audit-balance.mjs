import fs from 'node:fs';
import {combatHarness} from '../tests/balance-harness.mjs';
import {execFileSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
const ref=process.argv[2]||'607b860';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'op-meta-baseline-'));
for(const file of ['data.js','game.js'])fs.writeFileSync(path.join(tmp,file),execFileSync('git',['show',`${ref}:public/${file}`]));
const baseline=combatHarness(tmp), current=combatHarness();
const cases=current.exec(`SAGAS.flatMap(s=>s.islands.map(i=>({saga:s.id,island:i.name,boss:i.boss,levels:i.bossLvl,lvl:i.lvl[0]})))`);
const results=[];
for(const c of cases) {
 let oldWins=0,newWins=0,oldRounds=0,newRounds=0,stalled=0;
 for(const diff of [1,2,3,4,5])for(const seed of [11,77,321]) {
  const team=c.lvl>=20?['luffy2','zoro2','sanji']:['luffy','zoro','sanji'];
  const options={diff,seed,enemyLevels:c.levels};
  const old=baseline.duel(team,c.boss,Math.min(99,c.lvl),options);
  const now=current.duel(team,c.boss,Math.min(99,c.lvl),options);
  oldWins+=old.outcome==='win';newWins+=now.outcome==='win';oldRounds+=old.rounds;newRounds+=now.rounds;stalled+=!now.outcome;
 }
 results.push({saga:c.saga,island:c.island,oldWins,newWins,trials:15,oldMeanRounds:+(oldRounds/15).toFixed(2),newMeanRounds:+(newRounds/15).toFixed(2),stalled});
}
const structural=JSON.parse(baseline.exec(`JSON.stringify({stats:Object.fromEntries(Object.entries(CHARS).map(([id,c])=>[id,c.base])),xp:Array.from({length:99},(_,i)=>xpForLevel(i+1)),difficulties:DIFFICULTIES,sagas:SAGAS.map(s=>({id:s.id,islands:s.islands.map(i=>({lvl:i.lvl,bossLvl:i.bossLvl,rows:i.rows}))}))})`));
const after=JSON.parse(current.exec(`JSON.stringify({stats:Object.fromEntries(Object.entries(CHARS).map(([id,c])=>[id,c.base])),xp:Array.from({length:99},(_,i)=>xpForLevel(i+1)),difficulties:DIFFICULTIES,sagas:SAGAS.map(s=>({id:s.id,islands:s.islands.map(i=>({lvl:i.lvl,bossLvl:i.bossLvl,rows:i.rows}))}))})`));
const summary={baseline:ref,allStatsAndProgressionUnchanged:JSON.stringify(structural)===JSON.stringify(after),scenarios:results.length*15,oldWins:results.reduce((a,r)=>a+r.oldWins,0),newWins:results.reduce((a,r)=>a+r.newWins,0),stalled:results.reduce((a,r)=>a+r.stalled,0),results};
fs.writeFileSync('docs/balance-benchmark.json',JSON.stringify(summary,null,2)+'\n');console.log({...summary,results:undefined});

fs.rmSync(tmp,{recursive:true,force:true});
