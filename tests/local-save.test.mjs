import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {RunnerEngine} from '../public/runner/engine.mjs';

function harness(memory = new Map(), blocked = false) {
  const messages = [], nodes = new Map();
  const node = () => ({onclick:null, innerHTML:'', textContent:'', remove(){}, appendChild(){}, classList:{add(){},remove(){}}, querySelector(){return node();}});
  const ctx = vm.createContext({console, setTimeout(){return 1;},clearTimeout(){},
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
 assert.equal(ids.length,460);assert.equal(new Set(ids).size,460);
 assert.equal(groups[0].id,'eastblue');assert.equal(groups.at(-1).id,'crossover');
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
