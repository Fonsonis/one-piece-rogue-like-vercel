import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {combatHarness} from './balance-harness.mjs';
function setup(){
 const h=combatHarness(),nodes=new Map();
 h.ctx.document.querySelector=selector=>{if(!nodes.has(selector))nodes.set(selector,{onclick:null,classList:{add(){},remove(){}}});return nodes.get(selector);};
 h.exec(`screenMap=()=>{};screenHome=()=>{};screenIslands=()=>{};let repeatHTML='';render=s=>repeatHTML=s;storyMode='classic';selectedDiff=1;modalInfo=()=>{};meta.totalIslands=0;meta.global.starterSlots=2;meta.roster=['luffy','zoro'];endBattle=originalEndBattle;`);
 const game=fs.readFileSync('public/game.js','utf8');
 h.exec(game.slice(game.indexOf('function gameOver()'),game.indexOf('// ============ TORRE MARINE')));
 return {h,nodes};
}
function advance(h){const before=h.exec('run');for(let i=0;i<20 && h.exec('run')===before;i++)if(!h.tick())break;assert.notEqual(h.exec('run'),before);}
test('ten attempts count wins and defeats, keep the exact island/team/order, then stop',()=>{
 const {h}=setup();
 h.exec(`storyMode='nuzlocke';selectedDiff=3;meta.islandProgress['eastblue:nuzlocke:3']=[0];meta.charUpgrades.luffy=3;`);
 assert.equal(h.exec(`startIslandRepeats(0,['zoro','luffy'],1,10)`),true);
 const initial=h.exec('JSON.stringify(run.team)'),items=h.exec('JSON.stringify(run.items)');
 for(let i=0;i<10;i++){
  assert.equal(h.exec('JSON.stringify(run.team)'),initial);assert.equal(h.exec('JSON.stringify(run.items)'),items);
  assert.equal(h.exec('run.mode'),'nuzlocke');assert.equal(h.exec('run.diff'),3);assert.equal(h.exec('run.islandIdx'),1);assert.equal(h.exec('run.mapIdx'),0);
  h.exec(`run.mapIdx=2;run.berries=777;run.items={};run.team.reverse();`);
  if(i%2===0)h.exec(`battle={opts:{boss:true}};endBattle(true);`);else h.exec(`run.team=[];gameOver();`);
  assert.equal(h.exec('run.islandRepeat.completed'),i+1);
  if(i<9)advance(h);
 }
 assert.equal(h.exec('run.islandRepeat.wins'),5);assert.equal(h.exec('run.islandRepeat.losses'),5);
 assert.equal(h.exec('meta.totalIslands'),5);assert.equal(h.exec('autoMode'),false);
 const final=h.exec('run');while(h.tick()){}assert.equal(h.exec('run'),final);
 assert.match(h.exec('repeatHTML'),/Serie completada/);assert.doesNotMatch(h.exec('repeatHTML'),/id="repeat-next"/);
});
test('finishing all maps is one attempt; ordinary fights and map travel do not consume attempts',()=>{
 const {h}=setup();h.exec(`startIslandRepeats(0,['luffy'],0,2);`);
 const maps=h.exec('islandMapCount(SAGAS[0].islands[0])');
 for(let map=0;map<maps-1;map++){
  h.exec(`battle={opts:{wild:true}};endBattle(true);enterNode(run.map.rows.length-1,0);`);
  assert.equal(h.exec('run.islandRepeat.completed'),0);assert.equal(h.exec('run.mapIdx'),map+1);
 }
 h.exec('battle={opts:{boss:true}};endBattle(true);');assert.equal(h.exec('run.islandRepeat.completed'),1);
});
test('final island completes the saga and repeat once, without paying twice',()=>{
 const {h}=setup();h.exec(`selectedDiff=5;meta.sagaDiffWins.eastblue={5:true};startIslandRepeats(0,['luffy'],SAGAS[0].islands.length-1,2);battle={opts:{boss:true}};endBattle(true);`);
 assert.equal(h.exec('meta.wins.eastblue'),1);assert.equal(h.exec('run.islandRepeat.completed'),1);
 const fame=h.exec('meta.fame');assert.ok(fame>0);h.exec('sagaComplete();');assert.equal(h.exec('meta.fame'),fame);assert.equal(h.exec('meta.wins.eastblue'),1);
 advance(h);h.exec('battle={opts:{boss:true}};endBattle(true);sagaComplete();');assert.equal(h.exec('meta.wins.eastblue'),2);assert.equal(h.exec('meta.fame'),fame*2);assert.equal(h.exec('autoMode'),false);
});
test('pause, cancellation and stale continuation cannot launch extra attempts',()=>{
 const {h,nodes}=setup();h.exec(`startIslandRepeats(0,['luffy'],0,10);autoMode=false;run.team[0].hp=0;gameOver();`);
 assert.equal(h.exec('autoMode'),false);assert.equal(h.exec('run.islandRepeat.completed'),1);
 const next=nodes.get('#repeat-next').onclick;next();const current=h.exec('run');next();assert.equal(h.exec('run'),current);
 h.exec('cancelIslandRepeats();');assert.equal(h.exec('run.islandRepeat'),undefined);assert.equal(h.exec('autoMode'),false);
 h.exec('run.team[0].hp=0;gameOver();');assert.equal(h.exec('run'),null);
 h.exec(`startIslandRepeats(0,['luffy'],0,2);run.team[0].hp=0;gameOver();`);
 const cancel=nodes.get('#repeat-finish').onclick;cancel();while(h.tick()){}assert.equal(h.exec('run'),null);
});
test('active and completed checkpoints survive JSON reload without re-awarding or auto-starting',()=>{
 const {h}=setup();h.exec(`startIslandRepeats(0,['zoro','luffy'],0,3);saveRun();loadedSave=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run)));validateGameSave(loadedSave);autoMode=false;loadRun();`);
 assert.equal(h.exec('run.islandRepeat.total'),3);assert.equal(h.exec('autoMode'),false);
 h.exec(`battle={opts:{boss:true}};endBattle(true);loadedSave=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run)));validateGameSave(loadedSave);loadRun();showIslandRepeatCheckpoint();`);
 assert.equal(h.exec('run.islandRepeat.completed'),1);assert.equal(h.exec('run.islandRepeat.result'),'win');assert.equal(h.exec('autoMode'),false);
 h.exec(`finishIslandRepeat('win',false);`);assert.equal(h.exec('run.islandRepeat.completed'),1);assert.equal(h.exec('meta.totalIslands'),1);
 for(const bad of [null,{}, {total:0,completed:0,wins:0,losses:0,result:null},{total:2,completed:3,wins:3,losses:0,result:'win'},{total:2,completed:1,wins:0,losses:0,result:'win'},{total:2,completed:0,wins:0,losses:0,result:'loss'},{total:2,completed:2,wins:1,losses:1,result:null}]){
  h.ctx.badRepeat=bad;assert.throws(()=>h.exec('GameSaveStorage.validate(GameSaveStorage.payload(meta,{...run,islandRepeat:badRepeat}));'));
 }
});
test('invalid counts, empty/duplicate/locked teams and locked islands cannot start a series',()=>{
 const {h}=setup();
 for(const count of [0,-1,1.5,1001,NaN,Infinity,'10']){h.ctx.count=count;assert.equal(h.exec(`startIslandRepeats(0,['luffy'],0,count)`),false);}
 for(const team of [[],['missing'],['luffy','luffy'],['luffy2'],['nami']]){h.ctx.team=team;assert.equal(h.exec('startIslandRepeats(0,team,0,10)'),false);}
 assert.equal(h.exec(`startIslandRepeats(0,['luffy'],2,10)`),false);assert.equal(h.exec('run'),null);
 assert.equal(h.exec(`startIslandRepeats(0,['luffy'],0,1)`),true);
 h.exec('run.team[0].hp=0;gameOver();');assert.equal(h.exec('run.islandRepeat.completed'),1);assert.equal(h.exec('autoMode'),false);
});
test('repetitions allow configured recruitment and leave excess loot without pausing',()=>{
 const {h}=setup();h.exec(`startIslandRepeats(0,['luffy'],0,2);let joined=null;addToTeam(makeChar('zoro',5),ok=>joined=ok);`);
 assert.equal(h.exec('joined'),true);assert.equal(h.exec('run.team.length'),2);assert.deepEqual(Array.from(h.exec('run.startingTeam')),['luffy']);
 h.exec(`run.items={carne:27};prepareBackpack(run);`);
 assert.equal(h.exec(`receiveBackpackItem(run,'sake')`),false);assert.equal(h.exec('autoMode'),true);assert.equal(h.exec('hasPendingLoot(run)'),false);
 assert.equal(h.exec('run.items.carne'),27);assert.equal(h.exec('run.islandRepeat.completed'),0);
 h.exec('cancelIslandRepeats();autoMode=true;');assert.equal(h.exec(`receiveBackpackItem(run,'sake')`),false);assert.equal(h.exec('autoMode'),true);
});
test('the existing automatic configuration, including event pauses and speed, remains authoritative',()=>{
 const {h}=setup();h.exec(`autoSettings=normalizeAutoSettings({speed:'x1',pauseEvents:['marine'],wildAction:'manual',specialAction:'gacha',reserveBerries:1234});meta.settings.autoConfig={...autoSettings};const config=JSON.stringify(autoSettings),savedConfig=JSON.stringify(meta.settings.autoConfig);startIslandRepeats(0,['luffy'],0,2);run.map.rows[0][0].type='marine';let entered=false;enterNode=()=>entered=true;advanceAutoNode(0,0);`);
 assert.equal(h.exec('entered'),false);assert.equal(h.exec('autoMode'),false);assert.equal(h.exec('run.islandRepeat.completed'),0);
 assert.equal(h.exec('JSON.stringify(autoSettings)'),h.exec('config'));assert.equal(h.exec('JSON.stringify(meta.settings.autoConfig)'),h.exec('savedConfig'));
 h.exec(`autoMode=true;run.team[0].hp=0;gameOver();`);advance(h);
 assert.equal(h.exec('JSON.stringify(autoSettings)'),h.exec('config'));assert.equal(h.exec('JSON.stringify(meta.settings.autoConfig)'),h.exec('savedConfig'));
});
test('organize button remains on the map but is absent in combat',()=>{
 const {h}=setup();h.exec(`startRun(0,['luffy']);`);
 assert.match(h.exec('backpackHTML(run)'),/data-bag-organize/);
 assert.doesNotMatch(h.exec('backpackHTML(run,true)'),/data-bag-organize|ORGANIZAR MOCHILA/);
 assert.match(h.exec('backpackHTML(run,true)'),/data-bag-item/);
});


