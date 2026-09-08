import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';
function setup(){const h=combatHarness();h.exec("screenMap=()=>{};storyMode='classic';selectedDiff=1;startRun(0,['luffy']);run.items={};run.bagLayout={};run.pendingLoot={};");return h;}

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

test('new items require placement; existing stacks merge and quantities never duplicate',()=>{
 const h=setup();h.exec('autoMode=true;');
 assert.equal(h.exec('receiveBackpackItem(run,"carnereal")'),false);
 assert.equal(h.exec('autoMode'),false);
 assert.equal(h.exec('run.items.carnereal||0'),0);
 assert.equal(h.exec('placePendingBackpackItem(run,"carnereal",2,false)'),false);
 assert.equal(h.exec('placePendingBackpackItem(run,"carnereal",2,true)'),true);
 assert.equal(h.exec('placePendingBackpackItem(run,"carnereal",2,true)'),false);
 assert.equal(h.exec('receiveBackpackItem(run,"carnereal",2)'),true);
 assert.equal(h.exec('run.items.carnereal'),3);
 assert.equal(h.exec('run.bagLayout["carnereal:0"].cell'),2);
 assert.equal(h.exec('receiveBackpackItem(run,"carnereal")'),false);
 assert.equal(h.exec('placePendingBackpackItem(run,"carnereal",0,false)'),true);
 assert.equal(h.exec('run.items.carnereal'),4);
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
