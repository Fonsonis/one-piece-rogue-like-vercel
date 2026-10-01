import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function setup() {
  const h=combatHarness();
  h.exec("screenMap=()=>{};storyMode='classic';selectedDiff=1;startRun(0,['luffy']);run.items={carne:1,cartel:1};prepareBackpack(run);");
  return h;
}

test('combat backpack openness persists between battles and in exported JSON',()=>{
  const h=setup();
  h.exec("meta.settings.battleBackpackOpen=true;startBattle([makeChar('morgan',30)],{wild:true});");
  assert.equal(h.exec('battleBackpackExpanded'),true);
  h.exec("meta.settings.battleBackpackOpen=false;startBattle([makeChar('morgan',30)],{wild:true});");
  assert.equal(h.exec('battleBackpackExpanded'),false);
  h.exec("meta.settings.battleBackpackOpen=true;loadedSave=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run)));validateGameSave(loadedSave);loadMeta();");
  assert.equal(h.exec('meta.settings.battleBackpackOpen'),true);
  assert.equal(h.exec('GameSaveStorage.payload(meta,run).meta.settings.battleBackpackOpen'),true);
  assert.throws(()=>h.exec("GameSaveStorage.parse(JSON.stringify({...GameSaveStorage.payload(meta,run),meta:{...meta,settings:{...meta.settings,battleBackpackOpen:'yes'}}}))"));
  h.exec("delete loadedSave.meta.settings.battleBackpackOpen;loadMeta()");
  assert.equal(h.exec('meta.settings.battleBackpackOpen'),undefined,'legacy JSON keeps the viewport default');
});

test('bag objects expose direct selection and can be dragged to a free slot',()=>{
  const h=setup();
  const html=h.exec('backpackHTML(run)');
  assert.match(html,/data-bag-stack="carne:0"[^>]*draggable="true"/);
  assert.match(html,/data-bag-cell="4"/);
  const button={dataset:{bagItem:'carne',bagCount:'1',bagStack:'carne:0'},classList:{add(){},remove(){}},setPointerCapture(){}};
  const grid={closest:()=>({querySelector:()=>({dataset:{bagOrganize:'true'}})})};
  h.ctx.bagRoot={querySelectorAll:selector=>selector==='[data-bag-item]'?[button]:selector==='.backpack .bag-grid'?[grid]:[]};
  h.exec('var selectedStack=null;showBackpackItem=(...args)=>{selectedStack=args[5]};bindBackpack(bagRoot,run,false,()=>{});');
  button.onclick();
  assert.equal(h.exec('selectedStack'),'carne:0');
  let draggedKey='';
  button.ondragstart({dataTransfer:{setData(_type,key){draggedKey=key;},effectAllowed:''}});
  assert.equal(draggedKey,'carne:0');
  grid.ondrop({preventDefault(){},dataTransfer:{getData:()=>draggedKey},target:{closest:()=>({dataset:{bagCell:'4'}})}});
  assert.equal(h.exec('run.bagLayout["carne:0"].cell'),4);
});

test('map backpack no longer renders saga emblems',()=>{
  const h=setup();
  assert.doesNotMatch(h.exec('screenMap.toString()'),/EMBLEMAS DE LA SAGA|badge-grid/);
});
