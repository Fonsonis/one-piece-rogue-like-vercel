import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {combatHarness} from './balance-harness.mjs';

test('all enemy identities follow combat level and unlocked sagas, never permanent player levels',()=>{
 const h=combatHarness();
 const failures=h.exec(`(() => {
  const failures=[];meta.sagaDiffWins=Object.fromEntries(SAGAS.map(s=>[s.id,{3:true}]));maxStartLvlCap=()=>100;
  for(const id of Object.keys(CHARS)) {
   const forms=characterForms(id);
   const levels=new Set([1,65,100,...forms.flatMap(f=>[Math.max(1,f.level-1),Math.max(1,f.level)])]);
   for(const permanent of [5,20,40,100]) for(const level of levels) {
    meta.charUpgrades={[baseFormOf(id)]:permanent-5};
    const expected=forms.filter(f=>f.level<=level).at(-1).id;
    const actual=makeEnemy(id,level),exact=makeChar(expected,level,false,true);
    for(const key of ['id','lvl','hp','maxhp','atk','def','spatk','spdef','spd','moves'])
     if(JSON.stringify(actual[key])!==JSON.stringify(exact[key]))failures.push(id+':'+level+':'+key);
   }
  }
 return failures;
 })()`);
 assert.deepEqual(Array.from(failures),[]);
 h.exec('meta.charUpgrades={};meta.sagaDiffWins={};');
 assert.equal(h.exec("makeEnemy('lucci-awakened',65).id"),'lucci');
 assert.equal(h.exec("makeEnemy('lucci-awakened',65).lvl"),65);
});

test('story wilds, marine groups, bosses and ambushes create evolved enemies with existing difficulty scaling',()=>{
 const h=combatHarness();
 h.exec(`maxStartLvlCap=()=>100;meta.charUpgrades={};meta.sagaDiffWins={wano:{3:true}};let enemies;wildEncounter=f=>{enemies=[f];};startBattle=fs=>{enemies=fs;};
 saveRun=()=>{};resolveAutoLoot=()=>{};hasPendingLoot=()=>false;
 run={saga:0,islandIdx:0,diff:5,team:[],items:{},map:{rows:[[{type:'wild'}]]}};
 const island=SAGAS[0].islands[0];island.pool=['lucci'];island.lvl=[59,59];island.boss=['lucci'];island.bossLvl=[65];Math.random=()=>0;`);
 for(const type of ['wild','marine','boss']){
  h.exec(`run.map.rows[0][0].type='${type}';enterNode(0,0);`);
  assert.equal(h.exec("enemies.every(e=>e.id==='lucci-awakened'&&e.lvl===65)"),true,type);
  assert.equal(h.exec(`enemies[0].atk===makeChar('lucci-awakened',65,${type!=='boss'},true).atk`),true,type);
  assert.equal(h.exec('enemies.length'),type==='marine'?3:1);
 }
 h.exec(`MYSTERY_EVENTS.splice(0,MYSTERY_EVENTS.length,{kind:'battle',text:'Emboscada'});Math.random=()=>.1;modalInfo=(title,body,callback)=>callback();doMystery(island);`);
 assert.equal(h.exec('enemies[0].id'),'lucci-awakened');
 assert.equal(h.exec('enemies[0].lvl'),66);
});

test('saved tournament and legends combat resolve every opponent from the round level',()=>{
 for(const kind of ['tournament','legends']){
  const h=combatHarness();
  h.exec(`accountLevel=()=>35;screenChallengeBracket=()=>{};maxStartLvlCap=()=>100;
   meta.sagaDiffWins=Object.fromEntries(SAGAS.map(s=>[s.id,{3:true}]));meta.roster=['luffy','shanks','roger'];meta.charUpgrades={};
   startChallenge('${kind}',${kind==='legends'?"['shanks','roger']":"['luffy']"});
   meta.challenge.level=65;
   const match=challengeCurrentMatch(meta.challenge),index=match.a===0?match.b:match.a;
   const members=meta.challenge.entrants[index].members;
   ${kind==='legends'?"['lucci','kaido']":"['lucci']"}.forEach((id,slot)=>{
    for(const entrant of meta.challenge.entrants){
     const old=entrant.members.findIndex(member=>baseFormOf(member)===id);
     if(old>=0){entrant.members[old]=members[slot];break;}
    }
    members[slot]=id;
   });
   validateGameSave(GameSaveStorage.payload(meta,null));
   const checkpoint=JSON.stringify(meta.challenge);
   loadedSave=JSON.parse(JSON.stringify(GameSaveStorage.payload(meta,null)));loadMeta();playChallengeMatch();`);
  assert.equal(h.exec('battle.eTeam[0].id'),'lucci-awakened');
  assert.equal(h.exec('battle.eTeam[0].lvl'),65);
  assert.equal(h.exec('JSON.stringify(meta.challenge)===checkpoint'),true);
  if(kind==='legends')assert.equal(h.exec('battle.eTeam[1].id'),'kaido-hybrid');
  else assert.equal(h.exec('battle.pTeam[0].id'),'luffy');
 }
});

test('cooperative AI respects saga unlocks while PvP keeps player selected forms',()=>{
 const h=combatHarness();h.exec(fs.readFileSync('public/local/combat.js','utf8'));
 h.exec(`const players=[{id:'a',team:['lucci']},{id:'b',team:['luffy']}];`);
 assert.equal(h.exec("LocalCombat.create(players,{mode:'coop',boss:'lucci'}).eTeam[0].id"),'lucci');
 h.exec('maxStartLvlCap=()=>100;meta.charUpgrades={};meta.sagaDiffWins={skypiea:{3:true}};');
 assert.equal(h.exec("LocalCombat.create(players,{mode:'coop',boss:'lucci'}).eTeam[0].id"),'lucci-hybrid');
 assert.equal(h.exec("LocalCombat.create(players,{mode:'pvp'}).eTeam[0].id"),'luffy');
});


test('returning to East Blue uses Wano forms after reaching Wano but preserves combat thresholds',()=>{
 const h=combatHarness();
 h.exec(`maxStartLvlCap=()=>100;meta.charUpgrades={sanji:95};meta.sagaDiffWins={skypiea:{3:true}};run={saga:0,diff:5};`);
 assert.equal(h.exec("makeEnemy('sanji',40,true).id"),'sanji-diable');
 h.exec('meta.charUpgrades={};meta.sagaDiffWins.wholecake={3:true};');
 assert.equal(h.exec("makeEnemy('sanji',40,true).id"),'sanji-ifrit');
 assert.equal(h.exec("makeEnemy('sanji',40,true).lvl"),40);
 assert.equal(h.exec("makeEnemy('sanji',40,true).atk===makeChar('sanji-ifrit',40,true,true).atk"),true);
 assert.equal(h.exec("makeEnemy('sanji',39,true).id"),'sanji-raid');
});
