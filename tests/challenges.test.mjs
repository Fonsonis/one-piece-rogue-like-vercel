import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';
function harness(){
 const h=combatHarness();h.exec(`accountLevel=()=>35;screenChallengeBracket=()=>{};maxStartLvlCap=()=>100;meta.roster=['luffy','zoro','shanks','roger'];meta.charUpgrades={luffy:95};`);return h;
}
function finish(h,outcomes){for(const win of outcomes)h.exec(`endChallengeBattle(${win});`);}
test('eight entrants, a real bronze match and exactly one placement payout',()=>{
 for(const [outcomes,rank,reward] of [[[true,true,true],1,7500],[[true,true,false],2,5000],[[true,false,true],3,2500],[[true,false,false],4,0],[[false],5,0]]){
  const h=harness();assert.equal(h.exec(`startChallenge('tournament',['zoro'])`),true);
  assert.equal(h.exec('meta.challenge.entrants.length'),8);
  assert.equal(h.exec('new Set(meta.challenge.entrants.flatMap(e=>e.members.map(baseFormOf))).size'),8);
  finish(h,outcomes);
  assert.equal(h.exec('meta.challenge.placement'),rank);assert.equal(h.exec('meta.logPoses'),reward);
  h.exec('endChallengeBattle(true);finishChallenge(1);');assert.equal(h.exec('meta.logPoses'),reward);
  assert.equal(h.exec('meta.challenge.rounds.at(-1).matches[0].winner!==null'),true);
 }
});
test('eligibility uses unlocked forms and rarity, never fusion or borrowed teams',()=>{
 const h=harness();h.exec(`accountLevel=()=>34;`);assert.equal(h.exec(`startChallenge('tournament',['zoro'])`),false);
 h.exec('accountLevel=()=>35;meta.charUpgrades={};');
 for(const ids of [['luffy','zoro'],['luffy5','shanks'],['shanks','shanks'],['shanks','kaido']])assert.equal(h.exec(`startChallenge('legends',${JSON.stringify(ids)})`),false);
 h.exec('meta.charUpgrades={luffy:95};');assert.equal(h.exec(`challengePool('legends').includes('luffy5')`),true);
 assert.equal(h.exec(`startChallenge('legends',['luffy5','shanks'])`),true);
 assert.equal(h.exec(`startChallenge('tournament',['zoro'])`),false);
 assert.equal(h.exec('meta.challenge.entrants.length'),4);
 assert.equal(h.exec('meta.challenge.entrants.every(e=>e.members.length===2&&e.members.every(id=>CHARS[id].rareza===5))'),true);
 assert.equal(h.exec('new Set(meta.challenge.entrants.flatMap(e=>e.members.map(baseFormOf))).size'),8);
});
test('legendary winner gets a persisted choice, affinity priority and a single relic claim',()=>{
 const h=harness();h.exec(`startChallenge('legends',['shanks','roger']);`);finish(h,[true,true]);
 assert.equal(h.exec('meta.challenge.pendingRelics.length'),3);
 assert.equal(h.exec(`meta.challenge.pendingRelics.includes('relic_shanks')&&meta.challenge.pendingRelics.includes('relic_roger')`),true);
 assert.equal(h.exec(`startChallenge('tournament',['zoro'])`),false);
 h.exec(`loadedSave=JSON.parse(JSON.stringify(GameSaveStorage.payload(meta,null)));loadMeta();`);
 assert.equal(h.exec(`claimChallengeRelic('relic_zoro')`),false);
 assert.equal(h.exec(`claimChallengeRelic('relic_shanks')`),true);
 assert.equal(h.exec(`claimChallengeRelic('relic_shanks')`),false);
 assert.equal(h.exec('meta.relics.length'),1);assert.equal(h.exec('meta.logPoses'),0);
 assert.equal(h.exec(`startChallenge('tournament',['zoro'])`),true);
});
test('an unfinished bracket resumes without changing its draw',()=>{
 const h=harness();h.exec(`startChallenge('tournament',['zoro']);endChallengeBattle(true);const checkpoint=JSON.stringify(meta.challenge);loadedSave=JSON.parse(JSON.stringify(GameSaveStorage.payload(meta,null)));loadMeta();`);
 assert.equal(h.exec('JSON.stringify(meta.challenge)===checkpoint'),true);
 finish(h,[true,true]);assert.equal(h.exec('meta.logPoses'),7500);
});
test('challenge victory, defeat and simultaneous KO never mutate a nuzlocke journey or tower',()=>{
 for(const outcome of ['win','loss','draw']){
  const h=harness();h.exec(`run={mode:'nuzlocke',saga:9,diff:5,team:[makeChar('zoro',20)],items:{carne:9}};tower={floor:12,team:[makeChar('luffy',15)],items:{}};const before=JSON.stringify([run,tower]);
   startChallenge('legends',['shanks','roger']);playChallengeMatch();
   endBattle=originalEndBattle;
   ${outcome!=='loss'?'battle.eTeam.forEach(f=>f.hp=0);':''}
   ${outcome!=='win'?'battle.pTeam.forEach(f=>f.hp=0);':''}
   afterRound();`);
  for(let n=0;n<10&&h.exec('!!battle');n++)h.tick();
  assert.equal(h.exec('JSON.stringify([run,tower])===before'),true,outcome);
  assert.equal(h.exec('battle===null'),true);
  assert.equal(h.exec('meta.logPoses'),0);
 }
});
test('both members on both sides act once in a duo round; KO actors cannot attack',()=>{
 for(const kill of [false,true]){
  const h=harness();h.exec(`startChallenge('legends',['shanks','roger']);playChallengeMatch();clearTimeout(battle.timer);let turns=[];
   const ordered=[...battle.pTeam,...battle.eTeam].sort((a,b)=>effectiveSpeed(b)-effectiveSpeed(a));
   attackWith=(a,d)=>{turns.push(a.id);${kill?'if(turns.length===1)ordered.at(-1).hp=0;':''}};
   afterRound=()=>{battle.over=true;};runRound();`);
  for(let n=0;n<10&&h.tick();n++){}
  assert.equal(h.exec('turns.length'),kill?3:4);
  assert.equal(h.exec('new Set(turns).size'),kill?3:4);
 }
});
test('every identity has an executable signature relic, including legacy relics and evolved forms',()=>{
 const h=harness();
 assert.equal(h.exec(`Object.keys(CHARS).every(id=>RELICS['relic_'+baseFormOf(id)]?.character===baseFormOf(id))`),true);
 assert.equal(h.exec(`Object.values(RELICS).every(r=>r.name&&r.passiveName&&r.passiveDesc&&Object.keys(r.rule).length&&(!r.rule.move||MOVES[r.rule.move]))`),true);
 assert.equal(h.exec(`RELICS.sombrero_paja.character`),'luffy');
});
test('equip rules, common boosts, affinity, battle reset and no accumulated stat mutation',()=>{
 const h=harness();h.exec(`meta.relics=['relic_zoro','relic_luffy'];`);
 assert.equal(h.exec(`equipRelic('relic_kaido','zoro')`),false);
 assert.equal(h.exec(`equipRelic('relic_zoro','kaido')`),false);
 assert.equal(h.exec(`equipRelic('relic_zoro','luffy')`),true);
 h.exec(`run={saga:0,mode:'classic',team:[makeChar('luffy',65)],items:{}};const f=run.team[0],stats=f.atk;startBattle([makeChar('shanks',65,false,true)],{wild:true});`);
 assert.equal(h.exec('relicStatMult(f)'),1.10);assert.equal(h.exec('Object.keys(relicRule(f)).length'),0);
 assert.equal(h.exec(`equipRelic('relic_zoro','zoro')`),false);
 h.exec(`battle=null;equipRelic('relic_luffy','luffy');startBattle([makeChar('shanks',65,false,true)],{wild:true});f.hp=f.maxhp*.4;`);
 assert.equal(h.exec('relicDamageMult(f,battle.curE,MOVES.punetazo)'),1.30);
 h.exec(`battle=null;startBattle([makeChar('shanks',65,false,true)],{wild:true});`);
 assert.equal(h.exec('f.atk===stats'),true);
 h.exec(`battle=null;equipRelic('relic_luffy','');`);assert.equal(h.exec('Object.keys(meta.relicEquipment).length'),0);
});
test('affinity effects alter real damage, criticals, evasion, pierce, speed, statuses and healing',()=>{
 const h=harness();h.exec(`run={saga:0,mode:'classic',team:[makeChar('akainu',65,false,true)],items:{}};startBattle([makeChar('roger',65,false,true)],{wild:true});
  const f=battle.curP,e=battle.curE;f.battleRelic='relic_akainu';Math.random=()=>.5;attackWith(f,e,MOVES.punetazo,'enemy');`);
 assert.equal(h.exec('e.st.burn'),3);
 h.exec(`f.battleRelic=null;const plain=calcDamage(f,e,MOVES.punetazo,false,1).dmg;f.battleRelic='relic_akainu';`);
 assert.ok(h.exec('calcDamage(f,e,MOVES.punetazo,false,1).dmg')>h.exec('plain'));
 h.exec(`f.id='mihawk';f.battleRelic='relic_mihawk';const pierced=calcDamage(f,e,MOVES.punetazo,false,1).dmg;f.battleRelic='relic_akainu';`);
 assert.ok(h.exec('pierced')>h.exec('calcDamage(f,e,MOVES.punetazo,false,1).dmg'));
 h.exec(`f.id='kizaru';f.battleRelic='relic_kizaru';const swift=effectiveSpeed(f);f.battleRelic=null;`);
 assert.ok(h.exec('swift')>h.exec('effectiveSpeed(f)'));
 h.exec(`f.id='zoro';f.battleRelic='relic_zoro';const critical=critChanceFor(f);f.battleRelic=null;`);assert.ok(h.exec('critical')>h.exec('critChanceFor(f)'));
 h.exec(`f.id='smoker';f.battleRelic='relic_smoker';const evade=evaChanceFor(f);f.battleRelic=null;`);assert.ok(h.exec('evade')>h.exec('evaChanceFor(f)'));
 h.exec(`f.id='aokiji';f.battleRelic='relic_aokiji';e.hp=e.maxhp;attackWith(f,e,MOVES.punetazo,'enemy');`);assert.equal(h.exec('e.st.slowRate'),.30);
 h.exec(`f.id='saturn';f.battleRelic='relic_saturn';f.hp=100;f.st={};e.st={};battle.opts.challenge=true;afterRound();`);assert.ok(h.exec('f.hp')>100);
});
test('saved tournaments and equipment survive validation; malformed and unknown content is rejected',()=>{
 const h=harness();h.exec(`startChallenge('legends',['shanks','roger']);const saved=JSON.stringify(GameSaveStorage.payload(meta,null));`);
 assert.doesNotThrow(()=>h.exec('validateGameSave(GameSaveStorage.parse(saved));'));
 for(const mutation of [`d.meta.challenge.entrants[0].members=['zoro','shanks']`, `d.meta.challenge.entrants[0].members=['unknown','shanks']`, `d.meta.challenge.rounds[0].matches[0].a=999`, `d.meta.challenge.pendingRelics=['missing']`, `d.meta.relicEquipment={zoro:'relic_zoro'}`]){
  assert.throws(()=>h.exec(`{const d=JSON.parse(saved);${mutation};validateGameSave(GameSaveStorage.validate(d));}`));
 }
});
test('local multiplayer ignores any relic snapshot from an imported fighter',()=>{
 const h=harness();h.exec(`const f=makeChar('shanks',65,false,true);f.battleRelic='relic_shanks';battle={opts:{local:true}};`);
 assert.equal(h.exec('equippedRelic(f)'),null);assert.equal(h.exec('relicStatMult(f)'),1);
});
test('both challenges use each player permanent level, including after resuming an old bracket',()=>{
 for(const kind of ['tournament','legends']){
  const h=harness();h.exec(`meta.charUpgrades={zoro:7,shanks:42,roger:61};meta.upgrades={shanks:{atk:4}};
   run={mode:'nuzlocke',saga:9,diff:5,team:[makeChar('luffy',99)],items:{}};const before=JSON.stringify(run);
   startChallenge('${kind}',${kind==='legends'?"['shanks','roger']":"['zoro']"});playChallengeMatch();`);
  assert.deepEqual(Array.from(h.exec('battle.pTeam.map(f=>f.lvl)')),kind==='legends'?[47,66]:[12]);
  assert.equal(h.exec('battle.pTeam.every(f=>f.lvl===startLvlOf(f.id)&&f.hp===f.maxhp)'),true);
  if(kind==='legends')assert.equal(h.exec('battle.pTeam[0].atk===statAt(CHARS.shanks.base[1],47)+8'),true);
  assert.equal(h.exec('JSON.stringify(run)===before'),true);
  h.exec(`battle=null;endChallengeBattle(true);loadedSave=JSON.parse(JSON.stringify(GameSaveStorage.payload(meta,null)));loadMeta();meta.charUpgrades.${kind==='legends'?'shanks':'zoro'}+=3;playChallengeMatch();`);
  assert.equal(h.exec('battle.pTeam[0].lvl'),kind==='legends'?50:15);
  assert.equal(h.exec('battle.pTeam.every(f=>f.lvl!==meta.challenge.level)'),true);
 }
});
test('forms follow permanent levels even when the event level is below or above that level',()=>{
 const h=harness();h.exec(`meta.charUpgrades={luffy:95};`);
 assert.equal(h.exec(`startChallenge('tournament',['luffy5'])`),true);
 h.exec('playChallengeMatch();');assert.equal(h.exec('battle.pTeam[0].id'),'luffy5');assert.equal(h.exec('battle.pTeam[0].lvl'),100);
 const low=harness();low.exec(`meta.charUpgrades={luffy:10};`);
 assert.equal(low.exec(`challengePool('tournament').includes('luffy')`),true);
 assert.equal(low.exec(`challengePool('legends').includes('luffy5')`),false);
});
test('every challenge rival has its own affinity, without granting relics to the player',()=>{
 for(const kind of ['tournament','legends']){
  const h=harness();h.exec(`meta.relics=['relic_roger'];meta.relicEquipment={roger:'relic_roger'};const inventory=JSON.stringify([meta.relics,meta.relicEquipment]);
   startChallenge('${kind}',${kind==='legends'?"['shanks','roger']":"['zoro']"});playChallengeMatch();`);
  assert.equal(h.exec('battle.eTeam.every(f=>equippedRelic(f)?.character===baseFormOf(f.id)&&relicStatMult(f)===1.10&&Object.keys(relicRule(f)).length>0)'),true);
  assert.equal(h.exec('JSON.stringify([meta.relics,meta.relicEquipment])===inventory'),true);
  assert.equal(h.exec('battle.pTeam[0].battleRelic'),null);
  if(kind==='legends')assert.equal(h.exec('battle.pTeam[1].battleRelic'),'relic_roger');
  h.exec('battle=null;endChallengeBattle(true);playChallengeMatch();');
  assert.equal(h.exec('battle.eTeam.every(f=>equippedRelic(f)?.character===baseFormOf(f.id))'),true);
 }
});
test('affine enemy relic hooks apply to evolved rivals and reset outside challenges',()=>{
 const h=harness();h.exec(`const enemies=['luffy5','katakuri','brook','aokiji'].map(id=>makeChar(id,65,false,true));
 const team=[makeChar('shanks',30,false,true)];startBattle(enemies,{challenge:true,team,items:{}});`);
 assert.equal(h.exec('enemies[0].battleRelic'),'relic_luffy');
 assert.equal(h.exec('enemies[1].dodgeLeft'),3);assert.equal(h.exec('enemies[2].ultCharge'),68);
 h.exec(`Math.random=()=>.5;attackWith(enemies[3],team[0],MOVES.punetazo,'player');`);
 assert.equal(h.exec('team[0].st.slowRate'),.30);
 h.exec(`run={mode:'classic',saga:0,team,items:{}};team[0].hp=team[0].maxhp;startBattle(enemies,{wild:true});`);
 assert.equal(h.exec('enemies.every(f=>f.battleRelic===null)'),true);
});
