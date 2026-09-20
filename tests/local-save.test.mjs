import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {RunnerEngine} from '../public/runner/engine.mjs';

function harness(memory = new Map(), blocked = false) {
  const messages = [], nodes = new Map();
  const node = () => ({onclick:null, innerHTML:'', textContent:'', remove(){}, appendChild(){}, classList:{add(){},remove(){}}, querySelector(){return node();}});
  const ctx = vm.createContext({console, Blob, window:{async showSaveFilePicker(){throw {name:'AbortError'};}}, setTimeout(){return 1;},clearTimeout(){},
    document:{querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);}, getElementById(){return null;},addEventListener(){}, createElement:node,body:node()},
    localStorage:{getItem(k){if(blocked)throw Error('Denied');return memory.get(k)??null;},setItem(k,v){if(blocked)throw Error('Quota');memory.set(k,v);}},
    FileReader: class {readAsText(file){this.result=file.text;this.onload();}}
  });
  for(const file of ['save-storage.js','data.js','game.js']) vm.runInContext(readFileSync('public/'+file,'utf8').split('// ============ INICIO ============')[0],ctx);
  vm.runInContext('toast = msg => messages.push(msg); screenHome = () => {};', Object.assign(ctx,{messages}));
  const run = code => vm.runInContext(code,ctx);
  run(`function sampleRun(mode='classic') {
    return {saga:0,islandIdx:0,mode,team:[makeChar('luffy',5)],items:{carne:2},berries:300,badges:[],map:genMap(SAGAS[0].islands[0]),pos:null,nuzCaught:{}};
  }`);
  return {run,memory,messages,ctx};
}

test('imports resolve evolution against imported permanent levels, independently of the current profile',()=>{
 for(const [currentLevel,importedLevel,expected] of [[100,15,'luffy'],[15,35,'luffy3']]){
  const h=harness();
  h.run(`meta.charUpgrades={luffy:${currentLevel-5}};meta.sagaDiffWins=Object.fromEntries(SAGAS.map(s=>[s.id,{3:true}]));
   const incoming=GameSaveStorage.payload({...meta,charUpgrades:{luffy:${importedLevel-5}}},{...sampleRun(),team:[makeChar('luffy5',100,true)]});
   importSaveFile({size:100,text:JSON.stringify(incoming)});`);
  assert.equal(h.run('run.team[0].id'),expected);
  assert.equal(h.run('startLvlOf("luffy")'),importedLevel);
  assert.equal(JSON.parse(h.memory.get('oplike_save')).run.team[0].id,expected);
 }
});

test('manual save overwrites a single JSON and a fresh game restores all progress',()=>{
  const h=harness();
  h.run("run=sampleRun(); meta.fame=41; meta.runnerBest=123; manualSave();");
  assert.equal(h.memory.size,1);
  assert.equal(JSON.parse(h.memory.get('oplike_save')).meta.fame,41);
  h.run('meta.fame=88;run.berries=444;manualSave();');
  assert.equal(h.memory.size,1);
  const restored=harness(h.memory);
  assert.equal(restored.run('meta.fame'),88);
  assert.equal(restored.run('meta.runnerBest'),123);
  assert.equal(restored.run('run.berries'),444);
  assert.equal(restored.run('run.team[0].id'),'luffy');
  restored.run('GameSaveStorage.validate(loadedSave);validateGameSave(loadedSave);');
});

test('Guardar opens the JSON location picker and writes the current game to the selected file',async()=>{
 const h=harness();let options,contents,closed=false;
 h.ctx.window.showSaveFilePicker=async opts=>{options=opts;return {createWritable:async()=>({write:async blob=>{contents=await blob.text();},close:async()=>{closed=true;}})};};
 await h.run('run=sampleRun();meta.fame=125;manualSave();');
 assert.equal(options.suggestedName,'grandlinelike.json');
 assert.equal(options.types[0].accept['application/json'][0],'.json');
 assert.equal(JSON.parse(contents).meta.fame,125);
 assert.equal(JSON.parse(contents).run.berries,300);
 assert.equal(closed,true);
 assert.equal(JSON.parse(h.memory.get('oplike_save')).meta.fame,125);
});

test('canceling the picker keeps the local save, and file saving works when local storage is unavailable',async()=>{
 const h=harness();await h.run('run=sampleRun();manualSave();');
 assert.ok(h.memory.has('oplike_save'));
 assert.ok(!h.messages.some(m=>m.includes('No se pudo guardar el JSON')));
 const blocked=harness(new Map(),true);let written=false;
 blocked.ctx.window.showSaveFilePicker=async()=>({createWritable:async()=>({write:async()=>{written=true;},close:async()=>{}})});
 // The explicit write is authorized even when there is no readable browser storage.
 blocked.run('saveReadError=false;');
 await blocked.run('manualSave();');assert.equal(written,true);
});

test('legacy local saves migrate without deleting the old copy; JSON remains compatible',()=>{
  const old=harness();
  const memory=new Map([
    ['oplike_meta',old.run('JSON.stringify({...meta,fame:55})')],
    ['oplike_run',old.run('JSON.stringify(sampleRun())')],
  ]);
  const h=harness(memory);
  assert.equal(h.run('meta.fame'),55);
  h.run('manualSave();');
  assert.equal(JSON.parse(memory.get('oplike_save')).game,'grandlinelike');
  assert.ok(memory.has('oplike_meta'));
});

test('import commits meta and run together, accepts original JSON and restores settings defaults',()=>{
  const h=harness();
  h.run(`const portable=GameSaveStorage.payload({...meta,fame:99,settings:{customSounds:true}},sampleRun());portable.user='invitado';
    importSaveFile({text:JSON.stringify(portable)});`);
  assert.equal(h.run('meta.fame'),99);
  assert.equal(h.run('meta.settings.showEventConfirm'),true);
  assert.equal(harness(h.memory).run('run.team[0].id'),'luffy');
});

test('bad imports never change the current game or its previous JSON',()=>{
  const h=harness();
  h.run('run=sampleRun();manualSave();');
  const before=h.memory.get('oplike_save');
  for(const patch of ["x.meta=null", "x.meta.roster={}", "x.meta.fame='oops'", "x.version=99", "x.run.team=[null]", "x.run.team[0].id='missing'", "x.run.saga=99", "x.run.map.edges=[[999,0,1000,0]]", "x.run.map.rows[0][0].type='missing'"]) {
    h.run(`{const x=GameSaveStorage.payload({...meta,fame:900},sampleRun());${patch};importSaveFile({text:JSON.stringify(x)});}`);
    assert.equal(h.memory.get('oplike_save'),before,patch);
    assert.equal(h.run('meta.fame'),0,patch);
  }
  h.run(`importSaveFile({text:'{broken'});importSaveFile({text:'{}',size:99999999});`);
  assert.equal(h.memory.get('oplike_save'),before);
});

test('invalid local JSON is preserved instead of silently overwritten by autosaves',()=>{
  const memory=new Map([['oplike_save','{bad json']]);
  const h=harness(memory);
  assert.equal(h.run('saveReadError'),true);
  assert.equal(h.run('saveMeta()'),false);
  assert.equal(memory.get('oplike_save'),'{bad json');
});

test('unavailable browser storage reports failure without claiming a successful save',()=>{
  const h=harness(new Map(),true);
  assert.equal(h.run('persistLocalSave(null,true)'),false);
  assert.ok(h.messages.some(x=>x.includes('No se pudo guardar')));
  assert.ok(!h.messages.some(x=>x.includes('Partida guardada')));
  h.run('importSaveFile({text:JSON.stringify(GameSaveStorage.payload({...meta,fame:99},null))});');
  assert.equal(h.run('meta.fame'),0);
});

test('clearing a run cannot resurrect it after refresh; meta updates keep saved journey isolated',()=>{
  const h=harness();
  h.run('run=sampleRun();saveRun();run.berries=0;meta.fame=6;saveMeta();');
  assert.equal(harness(h.memory).run('run.berries'),300);
  h.run('clearRun();');
  const next=harness(h.memory);
  assert.equal(next.run('run'),null);
  assert.equal(next.run('meta.fame'),6);
});

test('Nuzlocke fallen fighters remain removed after saving and importing',()=>{
  const h=harness();
  h.run("run=sampleRun('nuzlocke');run.team.push({...makeChar('zoro',5),hp:0});saveRun();");
  assert.equal(harness(h.memory).run('run.team.length'),1);
  h.run("const x=GameSaveStorage.payload(meta,sampleRun('nuzlocke'));x.run.team.push({...makeChar('zoro',5),hp:0});importSaveFile({text:JSON.stringify(x)});");
  assert.equal(harness(h.memory).run('run.team.length'),1);
});

test('save during combat asks to finish rather than claiming to persist an incomplete battle',()=>{
  const h=harness();
  h.run('run=sampleRun();manualSave();battle={};run.berries=9;manualSave();');
  assert.equal(harness(h.memory).run('run.berries'),300);
  assert.match(h.messages.at(-1),/Termina el combate/);
});


test('theme and mobile columns persist in the JSON and survive reload and import',()=>{
 const h=harness();
 h.run("setDisplayPreference('theme','dark');setDisplayPreference('mobileColumns',2);");
 const restored=harness(h.memory);
 assert.equal(restored.run('meta.settings.theme'),'dark');
 assert.equal(restored.run('meta.settings.mobileColumns'),2);
 const json=JSON.parse(h.memory.get('oplike_save'));
 assert.equal(json.meta.settings.theme,'dark');
 h.run("setDisplayPreference('theme','invalid');setDisplayPreference('mobileColumns',7);");
 assert.equal(h.run('meta.settings.theme'),'light');assert.equal(h.run('meta.settings.mobileColumns'),3);
 h.run(`importSaveFile({text:${JSON.stringify(JSON.stringify(json))}});`);
 assert.equal(h.run('meta.settings.theme'),'dark');assert.equal(h.run('meta.settings.mobileColumns'),2);
});

test('upgrade saga groups cover every owned character once and in saga order',()=>{
 const h=harness();
 const groups=JSON.parse(h.run('JSON.stringify(groupUpgradeRoster(Object.keys(CHARS)))'));
 const ids=groups.flatMap(g=>g.ids);
 assert.equal(ids.length,h.run('Object.keys(CHARS).length'));assert.equal(new Set(ids).size,ids.length);
 assert.equal(groups[0].id,'eastblue');assert.equal(groups.at(-1).id,'elbaph');
 assert.deepEqual(JSON.parse(h.run('JSON.stringify(groupUpgradeRoster([]))')),[]);
});


test('runner milestone fame is saved immediately and survives leaving and reloading',()=>{
 const h=harness();
 const g=new RunnerEngine({onEvent:(type,data)=>{if(type==='reward')h.run(`gainFame(${data.fame})`);}});
 g.start();g.spawnIn=999;g.distance=14000;g.update(1/120);
 assert.equal(harness(h.memory).run('meta.fame'),25);
 assert.equal(harness(h.memory).run('meta.accXp'),25);
 g.pause();g.update(1);g.resume();g.update(1/120);g.status='over';g.update(1);
 assert.equal(harness(h.memory).run('meta.fame'),25);
 g.start();g.spawnIn=999;g.distance=14000;g.update(1/120);
 assert.equal(harness(h.memory).run('meta.fame'),50);
});

test('Sabaody insertion migrates old journey and last port exactly once and preserves earned access',()=>{
 for(const [oldIndex,newIndex] of [[0,0],[4,4],[5,6],[10,13],[11,14]]){
  const h=harness();h.ctx.oldIndex=oldIndex;
  h.run(`const old={game:'grandlinelike',version:1,meta:{lastCompletedIsland:{saga:oldIndex,island:0},sagaDiffWins:{thriller:{3:true}}},run:sampleRun()};old.run.saga=oldIndex;
  const migrated=GameSaveStorage.parse(JSON.stringify(old));const twice=GameSaveStorage.parse(JSON.stringify(migrated));`);
  assert.equal(h.run('migrated.run.saga'),newIndex);
  assert.equal(h.run('migrated.meta.lastCompletedIsland.saga'),newIndex);
  assert.equal(h.run('JSON.stringify(migrated)===JSON.stringify(twice)'),true);
  assert.equal(h.run('migrated.meta.legacyMarinefordAccess'),true);
  assert.equal(h.run('migrated.meta.sagaDiffWins.sabaody'),undefined);
 }
 const h=harness();h.run(`const current=GameSaveStorage.payload({},sampleRun());current.run.saga=5;const parsed=GameSaveStorage.parse(JSON.stringify(current));`);
 assert.equal(h.run('parsed.run.saga'),5);
 assert.equal(h.run('parsed.meta.legacyMarinefordAccess'),undefined);
 for(const value of ['null','[]','["sabaody","sabaody"]','["unknown"]'])assert.throws(()=>h.run(`GameSaveStorage.validate({...current,sagaOrder:${value}})`));
 h.run(`meta.legacyMarinefordAccess=true`);assert.equal(h.run('sagaUnlocked(6)'),true);
 h.run(`delete meta.legacyMarinefordAccess`);assert.equal(h.run('sagaUnlocked(6)'),false);
});

test('Zou migration preserves old Whole Cake access and understands explicit intermediate saga orders',()=>{
 const h=harness();
 h.run(`const beforeZou=GameSaveStorage.payload({sagaDiffWins:{dressrosa:{3:true}},lastCompletedIsland:{saga:10,index:0}},sampleRun());beforeZou.sagaOrder=beforeZou.sagaOrder.filter(id=>id!=='zou');beforeZou.run.saga=10;
 const restored=GameSaveStorage.parse(JSON.stringify(beforeZou));`);
 assert.equal(h.run('restored.run.saga'),11);assert.equal(h.run('restored.meta.lastCompletedIsland.saga'),11);
 assert.equal(h.run('restored.meta.legacyWholeCakeAccess'),true);
 assert.equal(h.run('restored.meta.sagaDiffWins.zou'),undefined);
 h.run('meta=restored.meta');assert.equal(h.run('sagaUnlocked(11)'),true);
});

test('separating Punk Hazard preserves active map, Dressrosa ports, completed islands and claimed rewards',()=>{
 for(const [oldIsland,newSaga,newIsland] of [[0,8,0],[1,9,0],[5,9,4]]){
  const h=harness();h.ctx.oldIsland=oldIsland;
  h.run(`const old={game:'grandlinelike',version:1,meta:{lastCompletedIsland:{saga:7,index:oldIsland},islandProgress:{'dressrosa:classic:3':[0,1,5]},claimedAch:{island_diff_dressrosa_0_3:true,island_diff_dressrosa_1_3:true,island_diff_dressrosa_5_3:true}},run:sampleRun()};
  old.run.saga=7;old.run.islandIdx=oldIsland;old.run.badges=[0,1,2];const mapBefore=JSON.stringify(old.run.map);const migrated=GameSaveStorage.parse(JSON.stringify(old));`);
  assert.equal(h.run('migrated.run.saga'),newSaga);assert.equal(h.run('migrated.run.islandIdx'),newIsland);
  assert.equal(h.run('migrated.meta.lastCompletedIsland.saga'),newSaga);assert.equal(h.run('migrated.meta.lastCompletedIsland.index'),newIsland);
  assert.equal(h.run('JSON.stringify(migrated.run.map)===mapBefore'),true);
  assert.deepEqual(Array.from(h.run("migrated.meta.islandProgress['punkhazard:classic:3']")),[0]);
  assert.deepEqual(Array.from(h.run("migrated.meta.islandProgress['dressrosa:classic:3']")),[0,4]);
  assert.equal(h.run('migrated.meta.claimedAch.island_diff_punkhazard_0_3'),true);
  assert.equal(h.run('migrated.meta.claimedAch.island_diff_dressrosa_4_3'),true);
  assert.equal(h.run('migrated.meta.legacyDressrosaAccess'),true);
  assert.equal(h.run('JSON.stringify(GameSaveStorage.parse(JSON.stringify(migrated)))===JSON.stringify(migrated)'),true);
 }
});

test('legendary choices already claimed survive relocation of their characters',()=>{
 const h=harness();
 for(const [saga,id] of [['marineford','kizaru'],['marineford','rayleigh'],['egghead','im'],['egghead','garling'],['egghead','xebec']]){
  h.ctx.rewardSaga=saga;h.ctx.rewardId=id;
  assert.doesNotThrow(()=>h.run('validateGameSave(GameSaveStorage.payload({sagaDiffWins:{[rewardSaga]:{5:true}},pirateKingRewards:{[rewardSaga]:rewardId}},null))'));
 }
});
