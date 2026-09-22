import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('every evolution requires permanent level, journey level and its saga at the exact threshold',()=>{
 const h=combatHarness();
 h.exec('maxStartLvlCap=()=>100;meta.sagaDiffWins=Object.fromEntries(SAGAS.map(s=>[s.id,{3:true}]));');
 const chains=JSON.parse(h.exec('JSON.stringify(Object.entries(CHARS).filter(([,c])=>c.evo).map(([id,c])=>[id,baseFormOf(id),c.evo.lvl,c.evo.to]))'));
 assert.equal(chains.length,126);
 for(const [id,base,level,to] of chains){
  if(to==='luffy4-boundman')h.exec("meta.formPreferences={luffyGear4:'luffy4-boundman'};");
  h.exec(`meta.charUpgrades={${base}:${level-6}};`);
  assert.equal(h.exec(`makeChar('${to}',100).id`),id,`${to} locked one permanent level before threshold`);
  h.exec(`meta.charUpgrades.${base}++;`);
  assert.equal(h.exec(`makeChar('${base}',${level-1}).id`),id,`${to} requires journey level too`);
  assert.equal(h.exec(`makeChar('${base}',${level}).id`),to);
  assert.equal(h.exec(`(()=>{const f=makeChar('${base}',${level-1});gainXP(f,xpForLevel(f.lvl));return f.id;})()`),to);
 }
});

test('the canonical saga catalog covers every evolution exactly once',()=>{
 const h=combatHarness();
 const audit=h.exec(`(()=>{
  const targets=Object.values(CHARS).filter(c=>c.evo).map(c=>c.evo.to);
  return {
   count:targets.length,unique:new Set(targets).size,
   missing:targets.filter(id=>!CHARS[id].unlockSaga),
   invalid:targets.filter(id=>!SAGAS.some(s=>s.id===CHARS[id].unlockSaga)),
   taggedBases:Object.keys(CHARS).filter(id=>!BASE_OF[id]&&CHARS[id].unlockSaga),
  };
 })()`);
 assert.equal(audit.count,126);
 assert.equal(audit.unique,126);
 assert.deepEqual(Array.from(audit.missing),[]);
 assert.deepEqual(Array.from(audit.invalid),[]);
 assert.deepEqual(Array.from(audit.taggedBases),[]);
 for(const [id,saga] of Object.entries({zoro2:'eastblue',luffy2:'water7','luffy4-boundman':'dressrosa',luffy4:'wholecake','luffy4-tankman':'wholecake',luffy5:'wano','sanji-diable':'water7','sanji-ifrit':'wano','jack-animal':'zou','lucci-awakened':'egghead','im-revealed':'elbaph'}))
  assert.equal(h.exec(`CHARS['${id}'].unlockSaga`),saga,id);
 assert.equal(h.exec("Object.entries(CHARS).filter(([id])=>id.endsWith('-young')&&BASE_OF[id]).every(([,c])=>c.unlockSaga==='elbaph')"),true);
});

test('Luffy can choose each unlocked Gear 4 without leaking that preference to enemies or active journeys',()=>{
 const h=combatHarness();
 h.exec(`maxStartLvlCap=()=>100;meta.charUpgrades={luffy:95};meta.reachedSagas=['eastblue'];
  markSagaReached(SAGAS.findIndex(s=>s.id==='dressrosa'));`);
 assert.equal(h.exec("makeChar('luffy',40).id"),'luffy4-boundman');
 assert.equal(h.exec("enemyFormAt('luffy',40)"),'luffy4-boundman');
 h.exec(`markSagaReached(SAGAS.findIndex(s=>s.id==='zou'));meta.formPreferences={luffyGear4:'luffy4-tankman'};`);
 assert.equal(h.exec("makeChar('luffy',49).id"),'luffy4-boundman','Zou cannot select Whole Cake forms');
 h.exec(`markSagaReached(SAGAS.findIndex(s=>s.id==='wholecake'));meta.formPreferences={luffyGear4:'luffy4-tankman'};var tank=makeChar('luffy',45);`);
 assert.equal(h.exec('tank.id'),'luffy4-tankman');
 assert.equal(h.exec("enemyFormAt('luffy',45)"),'luffy4','enemy canon does not inherit the player choice');
 h.exec(`meta.formPreferences.luffyGear4='luffy4-boundman';syncEvolution(tank);`);
 assert.equal(h.exec('tank.id'),'luffy4-tankman','an active journey keeps its snapshotted Gear 4');
 assert.equal(h.exec("makeChar('luffy',45).id"),'luffy4-boundman','new journeys use the new choice');
 h.exec(`meta.formPreferences.luffyGear4='luffy4';`);
 assert.equal(h.exec("makeChar('luffy',45).id"),'luffy4');
 h.exec(`markSagaReached(SAGAS.findIndex(s=>s.id==='wano'));`);
 assert.equal(h.exec("makeChar('luffy',50).id"),'luffy5','Gear 5 keeps its level and Wano gate');
 assert.equal(h.exec(`(()=>{meta.formPreferences.luffyGear4='not-a-form';try{validateGameSave(GameSaveStorage.payload(meta,null));return false;}catch{return true;}})()`),true,'invalid imported choices are rejected');
});

test('player forms need saga, permanent level and journey level independently',()=>{
 const h=combatHarness();
 h.exec(`maxStartLvlCap=()=>100;meta.charUpgrades={sanji:95};meta.sagaDiffWins={};markSagaReached(SAGAS.findIndex(s=>s.id==='water7'));`);
 assert.equal(h.exec("makeChar('sanji',40).id"),'sanji-diable','Wano form hidden before reaching Wano');
 h.exec("markSagaReached(SAGAS.findIndex(s=>s.id==='wano'));");
 assert.equal(h.exec("makeChar('sanji',39).id"),'sanji-raid','journey threshold remains intact');
 assert.equal(h.exec("makeChar('sanji',40).id"),'sanji-ifrit');
 h.exec('meta.charUpgrades.sanji=34;');
 assert.equal(h.exec("makeChar('sanji',100).id"),'sanji-raid','permanent threshold remains intact');
});

test('Robin and Franky unlock their faithful level 40 combat forms and reserved techniques',()=>{
 const h=combatHarness();h.exec('maxStartLvlCap=()=>100;meta.sagaDiffWins=Object.fromEntries(SAGAS.map(s=>[s.id,{3:true}]));meta.charUpgrades={robin:35,franky:35};');
 assert.equal(h.exec("makeChar('robin',39).id"),'robin');
 assert.equal(h.exec("makeChar('robin',39).moves.includes('demoniofleur')"),false);
 assert.equal(h.exec("makeChar('robin',40).id"),'robin-demoniofleur');
 assert.equal(h.exec("makeChar('robin',40).moves.includes('demoniofleur')"),true);
 assert.equal(h.exec("makeChar('franky',39).id"),'franky');
 assert.equal(h.exec("makeChar('franky',40).id"),'franky-shogun');
 assert.equal(h.exec("makeChar('franky',40).moves.includes('generalcannon')"),true);
});

test('base Luffy 15 reaches journey 20 with a charged base ultimate, and no Gear 2 attacks',()=>{
 const h=combatHarness();
 h.exec(`meta.charUpgrades={luffy:10};run={saga:0,mode:'classic',team:[makeChar('luffy',19)],items:{}};
  const f=run.team[0];gainXP(f,xpForLevel(f.lvl));startBattle([makeChar('bandido',30,true)],{wild:true});
  let usedUltimate=null;attackWith=(att,enemy,mv)=>{usedUltimate=mv;};f.ultCharge=100;useUltimate(f);`);
 assert.equal(h.exec('f.id'),'luffy');assert.equal(h.exec('f.lvl'),20);
 assert.equal(h.exec('startLvlOf(f.id)'),15);
 assert.equal(h.exec('usedUltimate===MOVES.gatlinggoma && f.ultCharge===0'),true);
 assert.deepEqual(Array.from(h.exec('f.moves')),['bazookagoma','gatlinggoma']);
});

test('blocked forms never learn their evolution attacks by grinding or fusion',()=>{
 const h=combatHarness();
 for(const [base,blocked] of [['luffy','jetpistol'],['zoro','santoryuogi'],['nami','thundertempo'],['coby','karatepez'],['usopp','kabuto']]){
  h.exec(`run={saga:0,mode:'classic',team:[makeChar('${base}',15)],items:{}};gainXP(run.team[0],100000000);`);
  assert.equal(h.exec('run.team[0].id'),base);
  assert.equal(h.exec(`run.team[0].moves.includes('${blocked}')`),false);
  assert.equal(h.exec(`getUltimateMove(run.team[0])===MOVES.${blocked}`),false);
  h.exec(`addToTeam(makeChar('${base}',100,true));`);
  assert.equal(h.exec('run.team[0].id'),base);
  assert.equal(h.exec('run.team[0].lvl'),100);
  assert.equal(h.exec('run.team[0].stars'),1);
  assert.equal(h.exec(`run.team[0].moves.includes('${blocked}')`),false);
 }
});

test('legacy evolved allies fall back without losing XP, upgrades, fusion bonuses or KO state',()=>{
 const h=combatHarness();
 for(const dead of [false,true]){
  assert.equal(h.exec(`(()=>{
   const f=makeChar('luffy5',100,true);f.xp=321;f.stars=4;f.maxhp+=27;f.atk+=13;f.hp=${dead?'0':'f.maxhp-30'};
   const team=[f,makeChar('zoro2',50,true),makeChar('nami2',50,true)];
   loadedSave={run:{saga:0,islandIdx:0,mode:'classic',team,items:{}}};loadRun();
   const restored=run.team[0],expected=makeChar('luffy',100);
   if(restored.id!=='luffy'||run.team[1].id!=='zoro'||run.team[2].id!=='nami')return false;
   if(restored.maxhp!==expected.maxhp+27||restored.atk!==expected.atk+13||restored.hp!==${dead?'0':'restored.maxhp-30'})return false;
   const once=JSON.stringify(restored);migrateFighter(restored);
   return restored.xp===321&&restored.stars===4&&JSON.stringify(restored)===once;
  })()`),true);
 }
});

test('buying the threshold level unlocks a high-level journey fighter without healing a KO',()=>{
 const h=combatHarness();
 h.exec(`maxStartLvlCap=()=>100;meta.charUpgrades={luffy:14};meta.sagaDiffWins={};markSagaReached(SAGAS.findIndex(s=>s.id==='water7'));meta.logPoses=10000000;
 run={saga:0,mode:'classic',team:[makeChar('luffy',60)],items:{}};const f=run.team[0];f.xp=99;f.hp=0;f.maxhp+=9;f.atk+=7;
 const originalLevel=f.lvl;upgradeCharLvl('luffy');`);
 assert.equal(h.exec('f.id'),'luffy2');assert.equal(h.exec('f.lvl'),60);
 assert.equal(h.exec('f.hp'),0);assert.equal(h.exec('f.xp'),99);
 assert.equal(h.exec('f.maxhp===makeChar("luffy",60).maxhp+9 && f.atk===makeChar("luffy",60).atk+7'),true);
 assert.equal(h.exec('f.moves.includes("jetpistol")'),true);
 assert.equal(h.exec('f.moves.includes("hakiarm")'),false);
});

test('enemy forms and explicit catalog previews are independent of permanent player level',()=>{
 const h=combatHarness();
 h.exec(`run={saga:0,diff:3,mode:'classic',team:[makeChar('luffy',50)],items:{}};
 const enemy=makeChar('luffy5',100,false,true);const before=JSON.stringify(enemy);startBattle([enemy],{boss:true});`);
 assert.equal(h.exec('enemy.id'),'luffy5');
 assert.equal(h.exec('enemy.maxhp===hpAt(CHARS.luffy5.base[0],100)'),true,'boss difficulty unchanged');
 assert.equal(h.exec('getUltimateMove(enemy)===MOVES.bajranggun'),true);
 assert.equal(h.exec('makeChar("luffy3",5,false,true).id'),'luffy3');
 assert.equal(h.exec('makeChar("luffy3",100).id'),'luffy','recruited forms are gated');
});
