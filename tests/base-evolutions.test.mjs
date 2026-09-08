import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('every evolution requires both permanent and journey levels at its exact threshold',()=>{
 const h=combatHarness();
 h.exec('maxStartLvlCap=()=>100;');
 const chains=JSON.parse(h.exec('JSON.stringify(Object.entries(CHARS).filter(([,c])=>c.evo).map(([id,c])=>[id,baseFormOf(id),c.evo.lvl,c.evo.to]))'));
 assert.equal(chains.length,8);
 for(const [id,base,level,to] of chains){
  h.exec(`meta.charUpgrades={${base}:${level-6}};`);
  assert.equal(h.exec(`makeChar('${to}',100).id`),id,`${to} locked one permanent level before threshold`);
  h.exec(`meta.charUpgrades.${base}++;`);
  assert.equal(h.exec(`makeChar('${base}',${level-1}).id`),id,`${to} requires journey level too`);
  assert.equal(h.exec(`makeChar('${base}',${level}).id`),to);
  assert.equal(h.exec(`(()=>{const f=makeChar('${base}',${level-1});gainXP(f,xpForLevel(f.lvl));return f.id;})()`),to);
 }
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
 h.exec(`maxStartLvlCap=()=>100;meta.charUpgrades={luffy:14};meta.logPoses=10000000;
 run={saga:0,mode:'classic',team:[makeChar('luffy',60)],items:{}};const f=run.team[0];f.xp=99;f.hp=0;f.maxhp+=9;f.atk+=7;
 const originalLevel=f.lvl;upgradeCharLvl('luffy');`);
 assert.equal(h.exec('f.id'),'luffy2');assert.equal(h.exec('f.lvl'),60);
 assert.equal(h.exec('f.hp'),0);assert.equal(h.exec('f.xp'),99);
 assert.equal(h.exec('f.maxhp===makeChar("luffy",60).maxhp+9 && f.atk===makeChar("luffy",60).atk+7'),true);
 assert.equal(h.exec('f.moves.includes("hakiarm")'),true);
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
