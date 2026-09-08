import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';
function setup(){const h=combatHarness();h.exec("screenMap=()=>{};storyMode='classic';selectedDiff=1;startRun(0,['luffy']);run.items={};run.bagLayout={};run.pendingLoot={};");return h;}

test('pending loot pauses automatic progression and cancels its timer instead of refreshing forever',()=>{
 const h=setup();
 h.ctx.document.querySelector=()=>null;
 h.exec(`run.pendingLoot={cartel:1};autoMode=true;let redraws=0;screenMap=page=>{if(page===2)redraws++;};
 scheduleAutoStep(()=>{throw Error('stale auto step');},750);advanceAutoNode(0,0);`);
 assert.equal(h.exec('autoMode'),false);assert.equal(h.exec('autoTimer'),null);
 assert.equal(h.exec('redraws'),1);assert.equal(h.pending(),0);
 h.exec('advanceAutoNode(0,0);');assert.equal(h.exec('redraws'),1);
 assert.equal(h.exec('run.pendingLoot.cartel'),1);
});

test('rectangular footprints reject row wrapping, bottom overflow and overlap',()=>{
 const h=setup();
 assert.equal(h.exec('backpackCells(2,2,false).length'),0);
 assert.deepEqual(Array.from(h.exec('backpackCells(2,2,true)')),[2,5]);
 assert.equal(h.exec('backpackCells(3,6,true).length'),0);
 assert.deepEqual(Array.from(h.exec('backpackCells(4,3,false)')),[3,4,6,7]);
 h.exec('run.items={carne:1,carnereal:1};prepareBackpack(run);');
 assert.equal(h.exec('moveBackpackStack(run,"carne:0",8,false)'),true);
 assert.equal(h.exec('moveBackpackStack(run,"carnereal:0",2,true)'),true);
 assert.equal(h.exec('moveBackpackStack(run,"carne:0",5,false)'),false);
 assert.equal(h.exec('moveBackpackStack(run,"carne:0",8,false)'),true);
 assert.equal(h.exec('moveBackpackStack(run,"carnereal:0",2,false)'),false);
 assert.equal(h.exec('run.bagLayout["carnereal:0"].vertical'),true);
});

test('new items are placed automatically; existing stacks merge without moving or interrupting auto mode',()=>{
 const h=setup();h.exec('autoMode=true;');
 assert.equal(h.exec('receiveBackpackItem(run,"carnereal")'),true);
 assert.equal(h.exec('autoMode'),true);
 assert.equal(h.exec('run.items.carnereal'),1);
 assert.equal(h.exec('hasPendingLoot(run)'),false);
 assert.equal(h.exec('moveBackpackStack(run,"carnereal:0",2,true)'),true);
 assert.equal(h.exec('placePendingBackpackItem(run,"carnereal",2,true)'),false);
 assert.equal(h.exec('receiveBackpackItem(run,"carnereal",2)'),true);
 assert.equal(h.exec('run.items.carnereal'),3);
 assert.equal(h.exec('run.bagLayout["carnereal:0"].cell'),2);
 assert.equal(h.exec('receiveBackpackItem(run,"carnereal")'),true);
 assert.equal(h.exec('run.items.carnereal'),4);
 assert.equal(h.exec('run.bagLayout["carnereal:0"].cell'),2);
 assert.equal(h.exec('planBackpack(run).missing.length'),0);
});

test('automatic placement rotates to use a vertical gap and reorganizes fragmented space only when needed',()=>{
 const h=setup();
 h.exec('run.items={carne:9,cartel:1};run.bagLayout={"carne:0":{cell:0,vertical:false},"carne:1":{cell:3,vertical:false},"carne:2":{cell:7,vertical:false},"cartel:0":{cell:8,vertical:false}};');
 assert.equal(h.exec('receiveBackpackItem(run,"sake")'),true);
 assert.equal(h.exec('run.bagLayout["carne:0"].cell'),0);
 assert.equal(h.exec('run.bagLayout["carne:1"].cell'),3);
 assert.equal(h.exec('receiveBackpackItem(run,"carnereal")'),true);
 assert.equal(h.exec('run.bagLayout["carnereal:0"].vertical'),true);
 assert.equal(h.exec('run.bagLayout["cartel:0"].cell'),8,'the island bag is independent');
 assert.equal(h.exec('planBackpack(run).missing.length'),0);
 h.exec('run.items={carne:15,cartel:1};run.bagLayout={"carne:0":{cell:0,vertical:false},"carne:1":{cell:2,vertical:false},"carne:2":{cell:4,vertical:false},"carne:3":{cell:6,vertical:false},"carne:4":{cell:8,vertical:false},"cartel:0":{cell:8,vertical:false}};const before=JSON.stringify(run);');
 assert.equal(h.exec('backpackFits(run,"sake")'),true);
 assert.equal(h.exec('JSON.stringify(run)===before'),true,'checking the shop must not mutate the bag');
 assert.equal(h.exec('receiveBackpackItem(run,"sake")'),true);
 assert.equal(h.exec('run.items.carne'),15);
 assert.equal(h.exec('run.items.sake'),1);
 assert.equal(h.exec('run.bagLayout["cartel:0"].cell'),8);
 assert.equal(h.exec('backpackUsed(run.items,true)'),9);
 assert.equal(h.exec('hasPendingLoot(run)'),false);
 assert.equal(h.exec('planBackpack(run).missing.length'),0);
});

test('items that cannot fit remain pending and failed placement does not rearrange or lose inventory',()=>{
 const h=setup();
 h.exec('run.items={sake:3};prepareBackpack(run);autoMode=true;const before=JSON.stringify({items:run.items,layout:run.bagLayout});');
 // Two 2x2 pieces cannot fit in a 3x3 bag even though eight cells are below capacity.
 assert.equal(h.exec('receiveBackpackItem(run,"sake")'),false);
 assert.equal(h.exec('JSON.stringify({items:run.items,layout:run.bagLayout})===before'),true);
 assert.equal(h.exec('run.pendingLoot.sake'),1);
 assert.equal(h.exec('autoMode'),false);
});

test('repacking keeps full rows for large food and fits mixed shapes up to exact capacity',()=>{
 const h=setup();
 h.exec('meta.global.backpackTier=3;const limit=backpackStackLimit();run.items={sake:limit+1,bocadillo:limit+1,carnereal:limit};prepareBackpack(run);');
 assert.equal(h.exec('receiveBackpackItem(run,"carnereal")'),true);
 assert.equal(h.exec('backpackUsed(run.items,true)'),18);
 assert.equal(h.exec('planBackpack(run).missing.length'),0);
 assert.equal(h.exec('hasPendingLoot(run)'),false);
});

test('positions survive save/load, consumption and upgrades; both bags use independent grids',()=>{
 const h=setup();
 h.exec('run.items={carnereal:3,fruta_diablo:1,carne:1};prepareBackpack(run);moveBackpackStack(run,"carne:0",8,false);moveBackpackStack(run,"carnereal:0",2,true);moveBackpackStack(run,"fruta_diablo:0",2,true);saveRun();loadedSave=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run)));validateGameSave(loadedSave);loadRun();');
 assert.equal(h.exec('run.bagLayout["carnereal:0"].cell'),2);
 assert.equal(h.exec('run.bagLayout["fruta_diablo:0"].cell'),2);
 h.exec('run.items.carnereal--;meta.fame=300;buyBackpackUpgrade();prepareBackpack(run);');
 assert.equal(h.exec('run.bagLayout["carnereal:0"].vertical'),true);
 h.exec('run.items.carnereal=0;prepareBackpack(run);');
 assert.equal(h.exec('run.bagLayout["carnereal:0"]'),undefined);
});

test('legacy layouts preserve every unit and invalid imported positions are rejected',()=>{
 const h=setup();h.exec('run.items={carne:9,carnereal:12,sake:4,cartel:40};delete run.bagLayout;prepareBackpack(run);');
 for(const [id,n] of [['carne',9],['carnereal',12],['sake',4],['cartel',40]])assert.equal(h.exec(`(run.items.${id}||0)+(run.pendingLoot.${id}||0)`),n);
 h.exec('validateGameSave(GameSaveStorage.payload(meta,run));run.items={carnereal:1};');
 for(const pos of [{cell:2,vertical:false},{cell:8,vertical:true}]){h.ctx.pos=pos;assert.throws(()=>h.exec('validateGameSave(GameSaveStorage.payload(meta,{...run,bagLayout:{"carnereal:0":pos}}))'));}
});
