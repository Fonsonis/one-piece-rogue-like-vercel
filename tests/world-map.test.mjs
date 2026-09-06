import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';
import fs from 'node:fs';

function setup() {
 const h=combatHarness(),nodes=new Map();
 const node=s=>{if(!nodes.has(s))nodes.set(s,{scrollTop:0,scrollHeight:16000,clientHeight:500,offsetTop:15400,offsetHeight:195,classList:{add(){},remove(){}}});return nodes.get(s);};
 h.ctx.document.querySelector=node;
 h.ctx.document.querySelectorAll=()=>[];
 h.exec(`let html='';render=s=>html=s;storyMode='classic';selectedDiff=1;run=null;meta.sagaDiffWins={};meta.islandProgress={};`);
 h.exec(fs.readFileSync('public/art/world-locations.js','utf8'));
 return {h,nodes,node};
}

test('one chart renders every saga and island in reverse order, preserving modes and information',()=>{
 const {h}=setup();h.exec('screenSagas()');const html=h.exec('html');
 assert.equal((html.match(/class="world-saga"/g)||[]).length,11);
 assert.equal((html.match(/data-world-island=/g)||[]).length,57);
 assert.equal((html.match(/data-island-info=/g)||[]).length,57);
 assert.equal((html.match(/data-saga-info=/g)||[]).length,11);
 assert.ok(html.indexOf('id="world-saga-10"')<html.indexOf('id="world-saga-0"'));
 assert.ok(html.indexOf('id="world-island-0-5"')<html.indexOf('id="world-island-0-0"'));
 assert.ok(html.indexOf('id="world-saga-1"')<html.indexOf('RED LINE · REVERSE MOUNTAIN'));
 assert.ok(html.indexOf('RED LINE · REVERSE MOUNTAIN')<html.indexOf('id="world-saga-0"'));
 assert.ok(html.indexOf('id="world-saga-7"')<html.indexOf('RED LINE · NUEVO MUNDO'));
 assert.ok(html.indexOf('RED LINE · NUEVO MUNDO')<html.indexOf('id="world-saga-6"'));
 for(const id of ['tab-classic','tab-nuz','btn-diff-trigger','btn-saga-probs-all'])assert.ok(html.includes(`id="${id}"`));
});

test('unified chart enforces saga, sequential difficulty and mode-specific island locks',()=>{
 const {h}=setup();
 assert.equal(h.exec('worldIslandState(0,0).available'),true);
 assert.equal(h.exec('worldIslandState(0,1).available'),false);
 assert.match(h.exec('worldIslandState(1,0).reason'),/EAST BLUE.*Capitán/);
 h.exec("meta.sagaDiffWins.eastblue={3:true};");
 assert.equal(h.exec('worldIslandState(1,0).available'),true);
 h.exec('selectedDiff=2');
 assert.match(h.exec('worldIslandState(1,0).reason'),/Grumete/);
 h.exec("selectedDiff=1;meta.islandProgress['eastblue:classic:1']=[0];");
 assert.equal(h.exec('worldIslandState(0,1).available'),true);
 h.exec("storyMode='nuzlocke'");
 assert.equal(h.exec('worldIslandState(0,1).available'),false);
});

test('active attempt can resume only in its mode and difficulty, completed attempt cannot',()=>{
 const {h}=setup();
 h.exec("run={saga:1,islandIdx:2,mode:'classic',diff:1,mapIdx:2};");
 assert.equal(h.exec('worldIslandState(1,2).active'),true);
 assert.match(h.exec('worldSagaHTML(1)'),/Continuar · mapa 3/);
 h.exec('selectedDiff=2');assert.equal(h.exec('worldIslandState(1,2).active'),false);
 h.exec("selectedDiff=1;storyMode='nuzlocke'");assert.equal(h.exec('worldIslandState(1,2).active'),false);
 h.exec("storyMode='classic';run.islandComplete=true;");assert.equal(h.exec('worldIslandState(1,2).active'),false);
});

test('mode changes preserve chart position and navigation independently rechecks locks',()=>{
 const {h,nodes,node}=setup();h.exec('screenSagas()');
 node('#world-map').scrollTop=7890;nodes.get('#tab-nuz').onclick();
 assert.equal(node('#world-map').scrollTop,7890);assert.equal(h.exec('storyMode'),'nuzlocke');
 const locked={dataset:{worldSaga:'1',worldIsland:'0'}},first={dataset:{worldSaga:'0',worldIsland:'0'}};
 h.ctx.document.querySelectorAll=s=>s==='[data-world-island]'?[locked,first]:[];
 h.exec('let chosen=null;screenStarter=(s,i)=>chosen=[s,i];screenSagas();');
 locked.onclick();assert.equal(h.exec('chosen'),null);
 first.onclick();assert.equal(h.exec('chosen'),null,'selecting a destination only opens its panel');
 nodes.get('#world-enter').onclick();assert.deepEqual(Array.from(h.exec('chosen')),[0,0]);
});

test('destination panel separates completion by mode and difficulty and keeps entry explicit',()=>{
 const {h,node}=setup();
 h.exec("meta.islandProgress={'eastblue:classic:1':[0], 'eastblue:classic:3':[0], 'eastblue:nuzlocke:2':[0]};");
 const panel=h.exec('worldIslandPanelHTML(0,0)');
 assert.equal((panel.match(/class="won"/g)||[]).length,3);
 assert.match(panel,/Isla Yotsuba/);assert.match(panel,/Shells Town/);
 assert.match(panel,/Clásico/);assert.match(panel,/Nuzlocke/);
 h.exec('let chosen=null;screenStarter=(s,i)=>chosen=[s,i];selectWorldIsland(0,1);');
 h.exec('worldNavigator={sailing:true};enterWorldIsland();');assert.equal(h.exec('chosen'),null);
 h.exec("worldNavigator=null;meta.islandProgress['eastblue:classic:1']=[];enterWorldIsland();");
 assert.equal(h.exec('chosen'),null,'locks checked again at entry time');
 h.exec('selectWorldIsland(1,0);');assert.equal(node('#world-enter').disabled,true);
});

test('explicit entry resumes an active journey and preserves replacement confirmation',()=>{
 const {h}=setup();
 h.exec("let resumed=false,chosen=false,confirmAction=null;screenMap=()=>resumed=true;screenStarter=()=>chosen=true;modalConfirm=(title,text,fn)=>confirmAction=fn;run={saga:1,islandIdx:2,mode:'classic',diff:1,mapIdx:2};selectWorldIsland(1,2);");
 assert.equal(h.exec('resumed'),false);
 h.exec('enterWorldIsland();');assert.equal(h.exec('resumed'),true);
 h.exec('selectWorldIsland(0,0);enterWorldIsland();');assert.equal(h.exec('chosen'),false);
 assert.equal(h.exec('typeof confirmAction'),'function');h.exec('confirmAction();');assert.equal(h.exec('chosen'),true);
});

test('legacy victories do not claim an unrecorded mode was completed',()=>{
 const {h}=setup();h.exec('meta.sagaDiffWins={eastblue:{2:true}}');
 assert.equal(h.exec("worldIslandCompletion(0,0,'classic',2)"),'legacy');
 assert.equal(h.exec("worldIslandCompletion(0,0,'nuzlocke',2)"),'legacy');
 assert.match(h.exec('worldIslandPanelHTML(0,0)'),/modo no registrado/);
 h.exec("meta.islandProgress['eastblue:classic:2']=[0]");
 assert.equal(h.exec("worldIslandCompletion(0,0,'classic',2)"),true);
 assert.equal(h.exec("worldIslandCompletion(0,0,'nuzlocke',2)"),false);
});
