import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { combatHarness } from './balance-harness.mjs';

function setup(saga=0, diff=5, mode='classic') {
  const h=combatHarness();
  h.exec(`render=()=>{};topbar=()=>'';showPirateKingReward=()=>{};screenHome=()=>{};
    run={saga:${saga},islandIdx:SAGAS[${saga}].islands.length-1,mode:'${mode}',diff:${diff},
      islandComplete:true,team:[makeChar('luffy',30)],items:{},badges:[],berries:0,map:genMap(SAGAS[${saga}].islands.at(-1)),pos:null};`);
  return h;
}

test('every saga offers its own base legendary and no retired character can appear',()=>{
  const h=setup();
  assert.equal(h.exec('Object.keys(CHARS).length'),497);
  assert.equal(h.exec(`SAGAS.every(s=>pirateKingLegendaryPool(s.id).length>0&&pirateKingLegendaryPool(s.id).every(id=>CHARS[id].rareza===5&&CHARS[id].saga===s.id&&!BASE_OF[id]))`),true);
  assert.equal(h.exec(`['naruto','narutokurama','goku','gojo','saitama'].every(id=>!CHARS[id]&&!PASSIVES[id])`),true);
  assert.equal(h.exec(`SAGAS.every(s=>s.islands.every(i=>genMap(i).rows.flat().every(n=>n.type!=='crossover')))`),true);
  assert.equal(h.exec("pirateKingLegendaryPool('water7').includes('lucci') && pirateKingLegendaryPool('gyojin').includes('jinbe')"),true);
  assert.equal(fs.existsSync('public/art/characters/naruto.png'),false);
});

test('first final-island victories in Rey Pirata grant one persistent choice per saga',()=>{
  for(let saga=0;saga<11;saga++) {
    const h=setup(saga); h.exec('sagaComplete();');
    assert.equal(h.exec(`meta.pirateKingRewards[SAGAS[${saga}].id]`),'pending');
    h.exec(`const sagaId=SAGAS[${saga}].id, choice=pirateKingLegendaryPool(sagaId)[0];`);
    assert.equal(h.exec('claimPirateKingReward(sagaId,choice)'),true);
    assert.equal(h.exec('meta.roster.includes(choice)&&meta.dex.includes(choice)&&meta.recruited.includes(choice)'),true);
    assert.equal(h.exec('claimPirateKingReward(sagaId,choice)'),false);
    h.exec('preparePirateKingRewards(meta);');
    assert.equal(h.exec('meta.pirateKingRewards[sagaId]===choice'),true);
  }
});

test('lower difficulties and nonfinal islands cannot unlock the legendary reward',()=>{
  for(const diff of [1,2,3,4]) { const h=setup(0,diff); h.exec('sagaComplete();'); assert.equal(h.exec('pendingPirateKingRewards().length'),0); }
  const h=setup(); h.exec('run.islandIdx=0;run.islandComplete=false;sagaComplete();preparePirateKingRewards(meta);');
  assert.equal(h.exec('pendingPirateKingRewards().length'),0);
});

test('claim persists through export, import and reload; a second mode or win cannot repay it',()=>{
  const h=setup(); h.exec(`sagaComplete();claimPirateKingReward('eastblue','mihawk');
    const data=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,null)));validateGameSave(data);
    meta=data.meta;preparePirateKingRewards(meta);`);
  assert.equal(h.exec('pendingPirateKingRewards().length'),0);
  h.exec(`run={saga:0,islandIdx:SAGAS[0].islands.length-1,mode:'nuzlocke',diff:5,islandComplete:true,team:[makeChar('luffy',30)],items:{},berries:0};sagaComplete();`);
  assert.equal(h.exec('meta.pirateKingRewards.eastblue'),'mihawk');
  assert.equal(h.exec('claimPirateKingReward("eastblue","shanks")'),false);
});

test('legacy Rey Pirata wins get a pending choice without paying Fama again',()=>{
  const h=setup();h.exec(`meta.sagaDiffWins={eastblue:{5:true},water7:{5:true},alabasta:{4:true}};meta.fame=250;preparePirateKingRewards(meta);preparePirateKingRewards(meta);`);
  assert.deepEqual(Array.from(h.exec('pendingPirateKingRewards()')),['eastblue','water7']);
  assert.equal(h.exec('meta.fame'),250);
});

test('foreign choices and failed persistence cannot consume the reward',()=>{
  const h=setup();h.exec('sagaComplete();');
  assert.equal(h.exec('claimPirateKingReward("eastblue","kaido")'),false);
  assert.equal(h.exec('claimPirateKingReward("eastblue","naruto")'),false);
  h.exec('saveMeta=()=>false;');
  assert.equal(h.exec('claimPirateKingReward("eastblue","mihawk")'),false);
  assert.equal(h.exec('meta.pirateKingRewards.eastblue'),'pending');
  assert.equal(h.exec('meta.roster.includes("mihawk")'),false);
});

test('old saves retire characters, upgrades, presets and portals while preserving One Piece progress',()=>{
  const h=setup();
  h.exec(`const old=GameSaveStorage.payload({...meta,fame:4321,logPoses:789,roster:['luffy','naruto','mihawk'],dex:['luffy','narutokurama'],recruited:['goku'],defeated:['cell'],charUpgrades:{naruto:20,luffy:8},sagaClears:{naruto:5,luffy:3},teamPresets:{1:['naruto','luffy']},settings:{autoConfig:{nodePriority:'crossover',pauseEvents:['crossover','boss'],crossoverAction:'fight'}}},run);
    old.run.team.push({...makeChar('luffy',30),id:'naruto'});old.run.startingTeam=['luffy','naruto'];
    const row=old.run.map.rows.length;old.run.map.rows.push([{r:row,i:0,type:'crossover',done:false}]);old.run.map.edges.push([row-1,0,row,0]);old.run.pos=[row,0];
    const migrated=GameSaveStorage.parse(JSON.stringify(old));validateGameSave(migrated);`);
  assert.equal(h.exec('migrated.meta.fame'),4321);assert.equal(h.exec('migrated.meta.logPoses'),789);
  assert.deepEqual(Array.from(h.exec('migrated.meta.roster')),['luffy','mihawk']);
  assert.deepEqual(Array.from(h.exec('migrated.run.team.map(f=>f.id)')),['luffy']);
  assert.equal(h.exec('migrated.meta.charUpgrades.luffy'),8);assert.equal(h.exec('migrated.meta.charUpgrades.naruto'),undefined);
  assert.deepEqual(Array.from(h.exec('migrated.meta.teamPresets[1]')),['luffy']);
  assert.equal(h.exec('migrated.run.retiredFinalReward'),true);
  assert.equal(h.exec('migrated.run.map.rows.flat().some(n=>n.type==="crossover")'),false);
  assert.equal(h.exec('migrated.meta.settings.autoConfig.nodePriority'),'random');
});

test('an all-retired crew ends its obsolete journey; an already empty Nuzlocke crew remains recoverable',()=>{
  const h=setup();
  h.exec(`const old=GameSaveStorage.payload(meta,run);old.run.team=[{...makeChar('luffy',30),id:'goku'}];const cleaned=GameSaveStorage.parse(JSON.stringify(old));`);
  assert.equal(h.exec('cleaned.run'),null);
  h.exec('old.run.team=[];const empty=GameSaveStorage.parse(JSON.stringify(old));');
  assert.notEqual(h.exec('empty.run'),null);
});

test('a migrated final portal completes its saga exactly once without another battle',()=>{
  const h=setup();h.exec('run.retiredFinalReward=true;finishRetiredJourney();');
  assert.equal(h.exec('run'),null);
  assert.equal(h.exec('meta.wins.eastblue'),1);
  assert.equal(h.exec('meta.pirateKingRewards.eastblue'),'pending');
  assert.equal(h.exec('finishRetiredJourney()'),false);
  assert.equal(h.exec('meta.wins.eastblue'),1);
});
