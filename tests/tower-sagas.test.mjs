import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('tower opponents and bosses never exceed the furthest unlocked saga',()=>{
 const h=combatHarness();
 h.exec(`let encounter;
 startBattle=(enemies,opts)=>{encounter={enemy:enemies[0],opts};};`);
 const count=h.exec('SAGAS.length');
 for(let saga=0;saga<count;saga++)for(const floor of [1,5,50,101]){
  h.exec(`meta.sagaDiffWins={};
  for(let i=0;i<${saga};i++)meta.sagaDiffWins[SAGAS[i].id]={3:true};
  tower={floor:${floor}};`);
  const expected=JSON.parse(h.exec(`JSON.stringify(Object.keys(CHARS).filter(id=>{
   const index=SAGAS.findIndex(s=>s.id===CHARS[id].saga);
   return index>=0&&index<=${saga}&&(${floor}%5===0?CHARS[id].boss:!BASE_OF[id]);
  }))`));
  assert.ok(expected.length>0);
  const offered=expected.map((_,i)=>h.exec(`Math.random=()=>${(i+.5)/expected.length};towerNextBattle();encounter.enemy.id;`));
  assert.deepEqual(offered,expected);
  assert.equal(h.exec('encounter.opts.tower'),true);
  assert.equal(h.exec('encounter.enemy.lvl'),13+floor*2+(floor%5===0?2:0));
 }
});

test('tower limit follows global progress regardless of selected difficulty, mode or replayed saga',()=>{
 const h=combatHarness();
 h.exec(`let enemy;Math.random=()=>.999999;startBattle=enemies=>{enemy=enemies[0];};
 meta.sagaDiffWins={};
 for(let i=0;i<3;i++)meta.sagaDiffWins[SAGAS[i].id]={3:true};
 meta.sagaDiffWins[SAGAS[3].id]={1:true,2:true};tower={floor:5};`);
 for(const mode of ['classic','nuzlocke'])for(const diff of [1,2,3,4,5]){
  h.exec(`storyMode='${mode}';selectedDiff=${diff};run={saga:0,mode:'${mode}',diff:${diff}};towerNextBattle();`);
  assert.equal(h.exec('SAGAS.findIndex(s=>s.id===CHARS[enemy.id].saga)<=3'),true);
  assert.equal(h.exec('enemy.id'),h.exec('Object.keys(CHARS).filter(id=>CHARS[id].boss&&SAGAS.slice(0,4).some(s=>s.id===CHARS[id].saga)).at(-1)'));
 }
});
