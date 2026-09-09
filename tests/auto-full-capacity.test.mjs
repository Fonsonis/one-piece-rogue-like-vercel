import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function setup(){
 const h=combatHarness();
 h.ctx.document.querySelector=()=>null;
 h.exec(`screenMap=()=>{};storyMode='classic';selectedDiff=1;startRun(0,['luffy']);
 run.team=['luffy','zoro','nami','usopp','sanji','chopper'].map((id,i)=>makeChar(id,10+i));
 autoMode=true;let results=[];`);
 return h;
}

test('full team can decline automatically and still fuse duplicates without pausing',()=>{
 const h=setup();
 h.exec(`const before=JSON.stringify(run.team);addToTeam(makeChar('robin',30),ok=>results.push(ok));`);
 assert.equal(h.exec('JSON.stringify(run.team)'),h.exec('before'));
 assert.deepEqual(Array.from(h.exec('results')),[false]);
 assert.equal(h.exec('autoMode'),true);
 h.exec(`addToTeam(makeChar('luffy',20),ok=>results.push(ok));`);
 assert.equal(h.exec('run.team.length'),6);
 assert.equal(h.exec('run.team[0].stars'),1);
 assert.deepEqual(Array.from(h.exec('results')),[false,true]);
});

test('replacement selects the lowest level and preserves slots, and ties keep the team',()=>{
 const h=setup();
 h.exec(`autoSettings.fullTeamAction='higherLevel';const kept=run.team.slice(1);
 addToTeam(makeChar('robin',30),ok=>results.push(ok));`);
 assert.equal(h.exec('run.team[0].id'),'robin');
 assert.equal(h.exec('run.team.slice(1).every((f,i)=>f===kept[i])'),true);
 assert.equal(h.exec('autoMode'),true);
 assert.equal(h.exec('loadedSave.run.team[0].id'),'robin');
 h.exec(`addToTeam(makeChar('brook',11),ok=>results.push(ok));`);
 assert.deepEqual(Array.from(h.exec('results')),[true,false]);
 assert.equal(h.exec('run.team.length'),6);
});

test('manual full team pauses without changing the party or invoking completion',()=>{
 const h=setup();let modal;
 h.ctx.document.body={appendChild:ov=>{modal=ov;}};
 h.ctx.document.createElement=()=>({querySelectorAll:()=>[],querySelector:()=>({})});
 h.exec(`autoSettings.fullTeamAction='manual';const before=JSON.stringify(run.team);addToTeam(makeChar('robin',30),ok=>results.push(ok));`);
 assert.equal(h.exec('autoMode'),false);
 assert.equal(h.exec('JSON.stringify(run.team)'),h.exec('before'));
 assert.equal(h.exec('results.length'),0);
 assert.match(modal.innerHTML,/Banda llena/);
});

test('manual overflow retains loot; switching to automatic stores fitting units and leaves excess',()=>{
 const h=setup();
 h.exec(`run.items={carne:26};run.bagLayout={};prepareBackpack(run);
 autoSettings.fullBagAction='manual';receiveBackpackItem(run,'carne',3);`);
 assert.equal(h.exec('autoMode'),false);
 assert.equal(h.exec('run.pendingLoot.carne'),3);
 assert.equal(h.exec('run.items.carne'),26);
 h.exec(`autoSettings.fullBagAction='leave';autoMode=true;resolveAutoLoot(run);`);
 assert.equal(h.exec('autoMode'),true);
 assert.equal(h.exec('run.items.carne'),27);
 assert.equal(h.exec('hasPendingLoot(run)'),false);
});

test('capacity policies normalize safely and survive save roundtrips',()=>{
 const h=setup();
 h.exec(`meta.settings.autoConfig=normalizeAutoSettings({fullTeamAction:'higherLevel',fullBagAction:'manual'});
 const restored=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run)));
 const cfg=normalizeAutoSettings(restored.meta.settings.autoConfig);`);
 assert.equal(h.exec('cfg.fullTeamAction'),'higherLevel');
 assert.equal(h.exec('cfg.fullBagAction'),'manual');
 assert.equal(h.exec("normalizeAutoSettings({fullTeamAction:'invalid'}).fullTeamAction"),'keep');
 assert.equal(h.exec('normalizeAutoSettings({}).fullBagAction'),'leave');
});
