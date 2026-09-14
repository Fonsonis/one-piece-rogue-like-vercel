import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('new draws never use later sagas, even with later characters in the owned roster',()=>{
 const h=combatHarness();
 h.exec(`screenChallengeBracket=()=>{};meta.accXp=xpForAccLevel(35);meta.roster=['shanks','mihawk','roger','kaido','luffy'];`);
 for(let saga=5;saga<=10;saga++)for(const kind of ['tournament','legends'])for(let attempt=0;attempt<12;attempt++) {
  h.exec(`meta.challenge=null;meta.sagaDiffWins=Object.fromEntries(SAGAS.slice(0,${saga}).map(s=>[s.id,{3:true}]));`);
  assert.equal(h.exec(`challengeSagaLimit()`),saga);
  assert.equal(h.exec(`startChallenge('${kind}',${kind==='tournament'?"['shanks']":"['shanks','mihawk']"})`),true);
  assert.equal(h.exec(`meta.challenge.entrants.slice(1).flatMap(e=>e.members).every(id=>SAGAS.findIndex(s=>s.id===CHARS[id].saga)<=${saga})`),true);
  assert.equal(h.exec(`new Set(meta.challenge.entrants.flatMap(e=>e.members.map(baseFormOf))).size`),h.exec(`meta.challenge.entrants.flatMap(e=>e.members).length`));
  if(saga<9)assert.equal(h.exec(`meta.challenge.entrants.slice(1).some(e=>e.members.includes('luffy5'))`),false);
  assert.doesNotThrow(()=>h.exec(`validateGameSave(GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,null))))`));
 }
});

test('a smaller legendary draw completes and preserves the pending reward on reload',()=>{
 const h=combatHarness();
 h.exec(`screenChallengeBracket=()=>{};meta.accXp=xpForAccLevel(35);meta.roster=['shanks','mihawk'];meta.sagaDiffWins=Object.fromEntries(SAGAS.slice(0,5).map(s=>[s.id,{3:true}]));startChallenge('legends',['shanks','mihawk']);`);
 assert.equal(h.exec('meta.challenge.entrants.length'),4);
 h.exec(`endChallengeBattle(true);endChallengeBattle(true);loadedSave=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,null)));loadMeta();`);
 assert.equal(h.exec('meta.challenge.placement'),1);
 assert.equal(h.exec('meta.challenge.pendingRelics.length'),3);
 assert.equal(h.exec('challengeCanStart()'),false);
 assert.equal(h.exec('claimChallengeRelic(meta.challenge.pendingRelics[0])'),true);
 assert.equal(h.exec('challengeCanStart()'),true);
});

test('phase locks use cumulative permanent levels for every transformation chain',()=>{
 const h=combatHarness();
 h.exec(`meta.sagaDiffWins=Object.fromEntries(SAGAS.map(s=>[s.id,{3:true}]));`);
 const chains=JSON.parse(h.exec(`JSON.stringify(Object.keys(CHARS).filter(id=>!BASE_OF[id]&&CHARS[id].evo).map(characterForms))`));
 for(const chain of chains)for(const form of chain.slice(1)) {
  h.exec(`meta.charUpgrades['${chain[0].id}']=${form.level-6};`);
  assert.equal(h.exec(`characterPhaseUnlocked('${form.id}')`),false,form.id+' below threshold');
  h.exec(`meta.charUpgrades['${chain[0].id}']=${form.level-5};`);
  assert.equal(h.exec(`characterPhaseUnlocked('${form.id}')`),true,form.id+' at threshold');
 }
});
