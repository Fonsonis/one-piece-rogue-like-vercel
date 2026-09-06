import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('complete character database, all saga maps, moves, damage and Nuzlocke persistence',()=>{
  const memory=new Map();
  const ctx=vm.createContext({console,document:{querySelector(){return {}},addEventListener(){}},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},setTimeout(){return 1},clearTimeout(){}});
  vm.runInContext(fs.readFileSync('public/save-storage.js','utf8'),ctx);
  vm.runInContext(fs.readFileSync('public/data.js','utf8'),ctx);
  vm.runInContext(fs.readFileSync('public/game.js','utf8').split('// ============ INICIO ============')[0],ctx);
  const stats=vm.runInContext(`(()=>{
    if(Object.keys(CHARS).length!==460) throw Error('Missing characters');
    if(SAGAS.length!==11) throw Error('Missing sagas');
    for(const [id,c] of Object.entries(CHARS)) {
      const f=makeChar(id,5);
      if(!Number.isFinite(f.maxhp)||f.maxhp<=0||!f.moves.length) throw Error(id);
      for(const [,m] of c.learnset) if(!MOVES[m]) throw Error(id+': '+m);
    }
    let islands=0;
    for(const saga of SAGAS) for(const island of saga.islands) {
      islands++;
      const map=genMap(island);
      if(!map.rows.length||!map.edges.length) throw Error('Empty map');
      for(const [r,i,r2,i2] of map.edges) if(!map.rows[r]?.[i]||!map.rows[r2]?.[i2]) throw Error('Broken edge');
    }
    const p=makeChar('luffy',5),e=makeChar('bandido',5);
    battle={pTeam:[p],eTeam:[e],round:1};
    const hit=calcDamage(p,e,MOVES.pistolagoma,false);
    if(!Number.isFinite(hit.dmg)||hit.dmg<=0) throw Error('Invalid damage');
    run={mode:'nuzlocke',team:[p,{...e,hp:0}]};saveRun();
    if(run.team.length!==1) throw Error('Nuzlocke KO not removed');
    loadRun();if(run.team[0].id!=='luffy') throw Error('Run restore failed');
    return {characters:Object.keys(CHARS).length,sagas:SAGAS.length,islands,achievements:getAchievementsInfo().totalAchievements};
  })()`,ctx);
  assert.equal(stats.achievements,140);
  console.log('Verified original game content:',stats);
});
