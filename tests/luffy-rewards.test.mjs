import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('Luffy keeps his base stats and evolves at 20/35/70/100 with matching stars and signatures',()=>{
 const h=combatHarness();
 assert.deepEqual(Array.from(h.exec('CHARS.luffy.base')),[24,12,8,10,7,10]);
 for(const [lvl,id,stars,ult] of [[5,'luffy',1,'gatlinggoma'],[19,'luffy',1,'gatlinggoma'],[20,'luffy2',2,'jetgatling'],[34,'luffy2',2,'jetgatling'],[35,'luffy3',3,'elephantgatling'],[69,'luffy3',3,'elephantgatling'],[70,'luffy4',4,'kingkonggun'],[99,'luffy4',4,'kingkonggun'],[100,'luffy5',5,'bajranggun']]){
  assert.equal(h.exec(`makeChar('luffy',${lvl}).id`),id);
  assert.equal(h.exec(`CHARS[makeChar('luffy',${lvl}).id].rareza`),stars);
  assert.equal(h.exec(`getUltimateMove(makeChar('luffy',${lvl}))===MOVES.${ult}`),true);
  assert.equal(h.exec(`baseFormOf('${id}')`),'luffy');
 }
 for(const lvl of [20,35,70,100]) {
  assert.equal(h.exec(`(()=>{const f=applyUpgrades(makeChar('luffy',${lvl-1}));f.hp=1;gainXP(f,xpForLevel(f.lvl));return f.id===luffyFormAt('luffy',${lvl})&&f.lvl===${lvl}&&f.moves.length<=2&&f.maxhp===makeChar('luffy',${lvl}).maxhp;})()`),true);
 }
 assert.equal(h.exec(`(()=>{const f=makeChar('luffy',100);gainXP(f,999999);return f.id==='luffy5'&&f.lvl===100&&xpBarHTML(f).includes('Nivel máximo');})()`),true);
 assert.equal(h.exec("makeChar('luffy5',5).id"),'luffy5','Dex previews retain the explicitly selected form');
 assert.equal(h.exec("xpBarHTML(makeChar('luffy',99)).includes('siguiente nivel 100')"),true);
});

test('old Luffy saves migrate once, preserving HP deficit, KO, XP, boosts, fusion and upgrades',()=>{
 const h=combatHarness();
 for(const [lvl,dead] of [[30,false],[35,false],[70,false],[100,false],[100,true]]) {
  assert.equal(h.exec(`(()=>{
   const f=makeChar('luffy2',${lvl},true);delete f.gearRulesVersion;
   f.xp=321;f.stars=3;f.hpBonus=12;f.atkBonus=7;f.maxhp+=29;f.hp=${dead?'0':'f.maxhp-18'};f.atk+=17;
   const before=JSON.stringify({xp:f.xp,stars:f.stars,hpBonus:f.hpBonus,atkBonus:f.atkBonus});
   migrateFighter(f);const expected=makeChar('luffy',${lvl});
   if(f.id!==expected.id||f.maxhp!==expected.maxhp+29||f.atk!==expected.atk+17||f.hp!==${dead?'0':'f.maxhp-18'})return false;
   if(JSON.stringify({xp:f.xp,stars:f.stars,hpBonus:f.hpBonus,atkBonus:f.atkBonus})!==before)return false;
   const once=JSON.stringify(f);migrateFighter(f);
   const save=GameSaveStorage.payload(meta,{saga:0,islandIdx:0,mode:'classic',team:[f],map:genMap(SAGAS[0].islands[0]),items:{},berries:300,badges:[],pos:null});
   validateGameSave(GameSaveStorage.parse(JSON.stringify(save)));
   return JSON.stringify(f)===once&&f.moves.length===2;
  })()`),true,`${lvl}/${dead}`);
 }
});

test('fusion crossing multiple Gear levels uses final form stats and starting inventory rarity',()=>{
 const h=combatHarness();
 assert.equal(h.exec(`(()=>{
  const f=makeChar('luffy',10);run={mode:'classic',saga:0,team:[f],items:{}};
  addToTeam(makeChar('luffy',100));const base=makeChar('luffy',100);
  return f.id==='luffy5'&&f.maxhp===base.maxhp+Math.floor(base.maxhp*.05)&&f.hp===f.maxhp&&f.stars===1&&f.moves.includes('stargun');
 })()`),true);
 h.exec(`maxStartLvlCap=()=>100;meta.charUpgrades={luffy:65};`);
 assert.deepEqual(Array.from(h.exec("filterSortChars(['luffy','bandido'],{rarity:4},id=>luffyFormAt(id,startLvlOf(id)))")),['luffy']);
});

test('each defeated enemy grants 3/4/7 Log Poses in East Blue, scaled across all sagas, without duplicate claims',()=>{
 const h=combatHarness();
 for(let saga=0;saga<11;saga++)for(const [opts,id,base]of [[{wild:true},'bandido',3],[{marine:true},'marineraso',4],[{boss:true},'buggy',7]]){
  h.ctx.rewardSpec={saga,opts,id};
  h.exec(`run={mode:'classic',saga:rewardSpec.saga,diff:1,team:[makeChar('luffy',5)],items:{}};meta.logPoses=0;startBattle([makeChar(rewardSpec.id,5,true),makeChar('bandido',5,true)],rewardSpec.opts);battle.curE.hp=0;afterRound();`);
  assert.equal(h.exec('meta.logPoses'),base*(saga+1));
  h.exec('afterRound()');assert.equal(h.exec('meta.logPoses'),base*(saga+1));
 }
 h.exec(`run={mode:'classic',saga:0,team:[makeChar('luffy',5)],items:{}};meta.logPoses=0;startBattle([makeChar('bandido',5,true)],{wild:true});battle.tower=true;battle.curE.hp=0;afterRound();`);
 assert.equal(h.exec('meta.logPoses'),0);
});

test('pirate and Marine Berries increase, remain ordered, scale and are paid only on a victory',()=>{
 const h=combatHarness();
 for(let saga=0;saga<11;saga++)for(let island=0;island<7;island++){
  h.exec(`Math.random=()=>.999999`);const pirateMax=h.exec(`encounterBerries({wild:true},${saga},${island})`);
  h.exec(`Math.random=()=>0`);const marineMin=h.exec(`encounterBerries({marine:true},${saga},${island})`);
  assert.ok(marineMin>pirateMax);assert.ok(pirateMax>=160*(island+1));
 }
 h.exec(`screenMap=()=>{};Math.random=()=>0;`);
 for(const [victory,fled,recruited,expected] of [[true,false,false,240],[false,true,false,0],[true,false,true,0]]){
  h.exec(`run={mode:'classic',saga:0,islandIdx:0,team:[makeChar('luffy',5)],items:{},berries:0};battle={opts:{marine:true}};originalEndBattle(${victory},${fled},${recruited});`);
  assert.equal(h.exec('run.berries'),expected);
 }
});
