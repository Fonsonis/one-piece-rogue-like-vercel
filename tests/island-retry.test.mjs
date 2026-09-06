import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {combatHarness} from './balance-harness.mjs';
function setup(){
 const h=combatHarness(),nodes=new Map();
 h.ctx.document.querySelector=selector=>{if(!nodes.has(selector))nodes.set(selector,{onclick:null});return nodes.get(selector);};
 h.exec(`screenMap=()=>{};screenHome=()=>{};let html='';render=s=>html=s;let yes,no;modalConfirm=(title,text,y,n)=>{yes=y;no=n;};storyMode='classic';selectedDiff=1;`);
 const game=fs.readFileSync('public/game.js','utf8');
 h.exec(game.slice(game.indexOf('function gameOver()'),game.indexOf('// ============ TORRE MARINE')));
 return {h,nodes};
}

test('cartels follow maps 1–5 and reset per island; direct hires only depend on stars',()=>{
 const {h}=setup();
 for(let saga=0;saga<11;saga++)for(let island=0;island<h.exec(`SAGAS[${saga}].islands.length`);island++)for(let map=0;map<5;map++){
  h.exec(`run={saga:${saga},islandIdx:${island},mapIdx:${map}};`);
  assert.equal(h.exec('specialGachaPrice()'),300*(map+1));
  for(let stars=1;stars<=4;stars++)assert.equal(h.exec(`hirePrice({rareza:${stars}})`),stars*stars*250);
 }
 h.exec("startRun(0,['luffy']);modalInfo=()=>{};");
 const n=h.exec('islandMapCount(SAGAS[0].islands[0])');
 for(let i=1;i<n;i++){h.exec('enterNode(run.map.rows.length-1,0)');assert.equal(h.exec('specialGachaPrice()'),300*(i+1));}
 h.exec("meta.islandProgress['eastblue:classic:1']=[0];startRun(0,['luffy'],1)");
 assert.equal(h.exec('specialGachaPrice()'),300);
});

test('restart reuses original team order, island, mode and difficulty with fresh map and provisions',()=>{
 const {h}=setup();
 h.exec(`storyMode='nuzlocke';selectedDiff=3;meta.islandProgress['eastblue:nuzlocke:3']=[0];meta.global.carneplus2=true;meta.charUpgrades={luffy:3};startRun(0,['zoro','luffy'],1);var initial=JSON.stringify(run.team);var initialItems=JSON.stringify(run.items);var persistent=JSON.stringify(meta);`);
 h.exec(`run.mapIdx=2;run.team.reverse();run.team[0].lvl=60;run.team[0].stars=2;run.team[0].hp=0;run.team.push(makeChar('buggy',30));run.berries=9999;run.items={};run.nuzCaught={1:true};run.nakamaGuardUsed=true;saveRun();storyMode='classic';selectedDiff=1;retryIsland(islandRetrySpec(run));`);
 assert.equal(h.exec('JSON.stringify(run.team)'),h.exec('initial'));
 assert.equal(h.exec('JSON.stringify(run.items)'),h.exec('initialItems'));
 assert.equal(h.exec('JSON.stringify(meta)'),h.exec('persistent'));
 assert.equal(h.exec('run.mode'),'nuzlocke');assert.equal(h.exec('run.diff'),3);assert.equal(h.exec('run.islandIdx'),1);
 assert.equal(h.exec('run.mapIdx'),0);assert.equal(h.exec('run.pos'),null);assert.equal(h.exec('run.berries'),300);
 assert.equal(h.exec('!!run.nakamaGuardUsed'),false);assert.equal(h.exec('Object.keys(run.nuzCaught).length'),0);
 assert.equal(h.exec('specialGachaPrice()'),300);
});

test('death retry survives removal of every Nuzlocke fighter and cannot be invoked twice',()=>{
 const {h,nodes}=setup();
 h.exec(`storyMode='nuzlocke';startRun(0,['zoro','luffy']);startBattle([makeChar('buggy',30,true)],{wild:true});battle.pTeam.forEach(f=>f.hp=0);afterRound();gameOver();`);
 assert.equal(h.exec('run'),null);
 assert.match(h.exec('html'),/VOLVER A INTENTAR/);
 const retry=nodes.get('#btn-retry-island').onclick;retry();
 assert.deepEqual(Array.from(h.exec('run.team.map(f=>f.id)')),['zoro','luffy']);
 assert.equal(h.exec('run.team.every(f=>f.hp===f.maxhp)'),true);
 h.exec('run.berries=87');retry();assert.equal(h.exec('run.berries'),87);
});

test('canceling restart preserves the attempt and auto mode; accepting starts once with auto off',()=>{
 const {h}=setup();
 h.exec("startRun(0,['luffy']);run.berries=777;autoMode=true;var before=JSON.stringify(run);confirmRestartIsland();");
 assert.equal(h.exec('autoMode'),false);h.exec('no()');assert.equal(h.exec('autoMode'),true);
 assert.equal(h.exec('JSON.stringify(run)'),h.exec('before'));
 h.exec('confirmRestartIsland();yes();run.berries=123;yes();');
 assert.equal(h.exec('autoMode'),false);assert.equal(h.exec('run.berries'),123);
});

test('initial selection survives JSON roundtrip and legacy migration before KO filtering',()=>{
 const {h}=setup();
 h.exec(`storyMode='nuzlocke';startRun(0,['zoro','luffy']);run.team=[];saveRun();loadedSave=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run)));validateGameSave(loadedSave);loadRun();retryIsland(islandRetrySpec(run));`);
 assert.deepEqual(Array.from(h.exec('run.startingTeam')),['zoro','luffy']);
 h.exec(`delete run.startingTeam;run.team[0].hp=0;loadedSave=GameSaveStorage.payload(meta,run);loadRun();`);
 assert.deepEqual(Array.from(h.exec('run.startingTeam')),['zoro','luffy']);
 assert.equal(h.exec('run.team.length'),1);
 for(const invalid of [null,[],{},['missing'],Array(7).fill('luffy'),['luffy2']]){
  h.ctx.badTeam=invalid;
  assert.throws(()=>h.exec('var x=GameSaveStorage.payload(meta,{...run,startingTeam:badTeam});GameSaveStorage.validate(x);validateGameSave(x);'));
 }
});


test('wild recruitment costs only 150 Berries per star, displaying and charging the same price on later islands',()=>{
 const {h}=setup();
 for(let saga=0;saga<11;saga++)for(let island=0;island<7;island++)for(let map=0;map<5;map++){
  h.exec(`run={saga:${saga},islandIdx:${island},mapIdx:${map}};`);
  for(let stars=1;stars<=4;stars++)assert.equal(h.exec(`wildRecruitPrice({rareza:${stars}})`),stars*150);
 }
 const nodes=new Map(),ov={innerHTML:'',remove(){},querySelector(s){if(!nodes.has(s))nodes.set(s,{onclick:null});return nodes.get(s);}};
 h.ctx.document.createElement=()=>ov;h.ctx.document.body={appendChild(){}};
 h.exec(`run={saga:9,islandIdx:6,mapIdx:4,mode:'classic',nuzCaught:{},berries:1000,items:{},team:[makeChar('luffy',5)]};modalInfo=()=>{};wildEncounter(makeChar('zoro',50,true));`);
 const payHTML=ov.innerHTML.match(/<button[^>]*id="we-pay"[^>]*>[\s\S]*?<\/button>/)[0];
 assert.match(payHTML,/450/);assert.doesNotMatch(payHTML,/disabled/);
 nodes.get('#we-pay').onclick();
 assert.equal(h.exec('run.berries'),550);
 assert.equal(h.exec('run.team.length'),2);assert.equal(h.exec('run.team[1].id'),'zoro');
 h.exec(`wildEncounter(makeChar('shanks',50,true));`);
 assert.doesNotMatch(ov.innerHTML,/id="we-pay"/);
});
