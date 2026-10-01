import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function harness() {
  const h=combatHarness();
  h.exec(`accountLevel=()=>35;screenChallengeBracket=()=>{};meta.roster=['luffy','zoro','shanks'];`);
  return h;
}

test('legend challenges unlock with Wano and accept one owned character of any rarity',()=>{
  const h=harness();
  h.exec(`meta.sagaDiffWins=Object.fromEntries(SAGAS.slice(0,SAGAS.findIndex(s=>s.id==='wano')-1).map(s=>[s.id,{3:true}]));`);
  assert.equal(h.exec('legendsUnlocked()'),false);
  assert.equal(h.exec(`startChallenge('legends',['zoro'])`),false);
  h.exec(`meta.sagaDiffWins.wholecake={3:true};`);
  assert.equal(h.exec('legendsUnlocked()'),true);
  assert.equal(h.exec(`startChallenge('legends',['zoro'])`),true);
  assert.equal(h.exec('meta.challenge.legendCharacter'),'zoro');
  assert.equal(h.exec('meta.challenge.entrants.length'),8);
  assert.equal(h.exec('meta.challenge.entrants.every(e=>e.members.length===1)'),true);
  assert.doesNotThrow(()=>h.exec('validateGameSave(GameSaveStorage.payload(meta,null))'));
});

test('three Wano-level wins grant only the selected character relic and persist it',()=>{
  const h=harness();
  h.exec(`meta.sagaDiffWins=Object.fromEntries(SAGAS.map(s=>[s.id,{3:true}]));startChallenge('legends',['zoro']);`);
  const levels=[];
  for(let i=0;i<3;i++) {
    levels.push(h.exec('challengeEnemyLevel(meta.challenge)'));
    h.exec('endChallengeBattle(true)');
  }
  assert.equal(levels.length,3);
  assert.ok(levels[0]<levels[1]&&levels[1]<levels[2]);
  assert.equal(h.exec('meta.challenge.placement'),1);
  assert.equal(h.exec('meta.challenge.relicReward'),'relic_zoro');
  assert.deepEqual(Array.from(h.exec('meta.relics')),['relic_zoro']);
  assert.equal(h.exec('meta.challenge.pendingRelics.length'),0);
  assert.equal(h.exec(`claimChallengeRelic('relic_shanks')`),false);
  assert.doesNotThrow(()=>h.exec('validateGameSave(GameSaveStorage.payload(meta,null))'));
});

test('legacy duo legend brackets remain valid and retain their original reward flow',()=>{
  const h=harness();
  h.exec(`meta.sagaDiffWins=Object.fromEntries(SAGAS.map(s=>[s.id,{3:true}]));
    const oldIds=Object.keys(CHARS).filter(id=>!BASE_OF[id]&&CHARS[id].rareza===5).slice(0,16);
    const entrants=Array.from({length:8},(_,i)=>({members:oldIds.slice(i*2,i*2+2)}));
    meta.challenge={version:2,kind:'legends',level:266,entrants,stage:0,rounds:[{name:'Cuartos de final',matches:[challengeMatch(0,1),challengeMatch(2,3),challengeMatch(4,5),challengeMatch(6,7)]}],finished:false,placement:null,reward:0,pendingRelics:[]};`);
  // A current-style legacy bracket has eight pairs; the saved format's version
  // value describes total characters, not the number of entrants.
  assert.doesNotThrow(()=>h.exec('validateGameSave(GameSaveStorage.payload(meta,null))'));
});
