import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('repeatable tracks retain their original tiers and reach 10,000 in every saga',()=>{
 const h=combatHarness();
 assert.equal(h.exec(`GLOBAL_PROGRESSIVE_ACHIEVEMENTS.filter(p=>p.id!=='dex').every(p=>p.goals.at(-1)===10000&&p.goals.length===p.fames.length&&p.goals.every((v,i)=>!i||v>p.goals[i-1])&&p.fames.every((v,i)=>!i||v>p.fames[i-1]))`),true);
 assert.equal(h.exec('SAGA_PROGRESSIVE_ACHIEVEMENTS.length'),143);
 assert.equal(h.exec('ISLAND_DIFF_ACHIEVEMENTS.length'),285);
 assert.equal(h.exec('new Set(PROGRESSIVE_ACHIEVEMENTS.map(p=>p.id)).size===PROGRESSIVE_ACHIEVEMENTS.length'),true);
 h.exec('meta.claimedProg={kills:7};meta.stats.kills=2000;');
 assert.equal(h.exec("claimAchievement('kills',true)"),1350);
 assert.equal(h.exec("claimAchievement('kills',true)"),0);
 h.exec('delete meta.claimedProg.kills;meta.claimedAch=Object.fromEntries(GLOBAL_PROGRESSIVE_ACHIEVEMENTS[0].legacyIds.map(id=>[id,true]));');
 assert.equal(h.exec('getClaimedProgTier(GLOBAL_PROGRESSIVE_ACHIEVEMENTS[0])'),7);
});

test('saga counters follow the current adventure, exclude tower and persist through JSON',()=>{
 const h=combatHarness();
 h.exec("run={mode:'classic',saga:0};trackKills(10);trackItemCollected(3);trackStat('mystery_visit',5);run.saga=1;trackKills(25);battle={tower:true};trackKills(4);battle=null;run=null;trackStat('items',2);");
 assert.equal(h.exec('meta.stats.kills'),39);
 assert.equal(h.exec('meta.sagaStats[SAGAS[0].id].kills'),10);
 assert.equal(h.exec('meta.sagaStats[SAGAS[1].id].kills'),25);
 assert.equal(h.exec('meta.sagaStats[SAGAS[0].id].items'),3);
 assert.equal(h.exec("claimAchievement('saga_prog_'+SAGAS[0].id+'_kills',true)"),50);
 assert.equal(h.exec("claimAchievement('saga_prog_'+SAGAS[0].id+'_kills',true)"),0);
 h.exec('const saved=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,null)));validateGameSave(saved);meta=saved.meta;');
 assert.equal(h.exec('meta.sagaStats[SAGAS[0].id].mystery_visit'),5);
 assert.equal(h.exec("claimAchievement('saga_prog_'+SAGAS[0].id+'_kills',true)"),0);
});

test('island and difficulty achievements recognize saved wins and pay once across both modes',()=>{
 const h=combatHarness();
 h.exec("const a=ISLAND_DIFF_ACHIEVEMENTS[0];meta.islandProgress[islandProgressKey(0,'classic',1)]=[0];");
 assert.equal(h.exec('a.check()'),1);
 assert.equal(h.exec('claimAchievement(a.id)'),25);
 assert.equal(h.exec('claimAchievement(a.id)'),0);
 h.exec("meta.islandProgress[islandProgressKey(0,'nuzlocke',1)]=[0];");
 assert.equal(h.exec('claimAchievement(a.id)'),0);
 assert.equal(h.exec('ISLAND_DIFF_ACHIEVEMENTS[1].check()'),0);
 assert.equal(h.exec('meta.fame'),25);
 h.exec('meta.sagaDiffWins[SAGAS[1].id]={2:true};migrateLegacyIslandWins(meta);');
 assert.equal(h.exec("ISLAND_DIFF_ACHIEVEMENTS.find(a=>a.id==='island_diff_'+SAGAS[1].id+'_0_2').check()"),1);
 for(let saga=0;saga<11;saga++)for(let diff=1;diff<=5;diff++)assert.equal(h.exec(`ISLAND_DIFF_ACHIEVEMENTS.find(a=>a.id==='island_diff_'+SAGAS[${saga}].id+'_0_${diff}').fame`),25*(saga+1)*diff*diff);
});

test('actual island completion advances the saga track and unlocks its first-clear achievement',()=>{
 const h=combatHarness();
 h.exec("screenMap=()=>{};screenIslands=()=>{};modalInfo=()=>{};storyMode='classic';selectedDiff=1;startRun(0,['luffy']);battle={opts:{boss:true}};originalEndBattle(true);");
 assert.equal(h.exec('meta.sagaStats[SAGAS[0].id].islands'),1);
 assert.equal(h.exec('ISLAND_DIFF_ACHIEVEMENTS[0].check()'),1);
});

test('invalid saga counters are rejected and legacy saves need no fabricated event history',()=>{
 const h=combatHarness();
 for(const n of [-1,1.5,'3']){h.ctx.bad=n;assert.throws(()=>h.exec('GameSaveStorage.validate(GameSaveStorage.payload({...meta,sagaStats:{eastblue:{kills:bad}}},null))'));}
 h.exec('delete meta.sagaStats;GameSaveStorage.validate(GameSaveStorage.payload(meta,null));');
 assert.equal(h.exec("SAGA_PROGRESSIVE_ACHIEVEMENTS.find(p=>p.id.endsWith('_kills')).check()"),0);
});
