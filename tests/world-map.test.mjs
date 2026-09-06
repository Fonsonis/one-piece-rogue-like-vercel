import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function setup() {
 const h=combatHarness(),nodes=new Map();
 const node=s=>{if(!nodes.has(s))nodes.set(s,{scrollTop:0,scrollHeight:16000,clientHeight:500,offsetTop:15400,offsetHeight:195});return nodes.get(s);};
 h.ctx.document.querySelector=node;
 h.ctx.document.querySelectorAll=()=>[];
 h.exec(`let html='';render=s=>html=s;storyMode='classic';selectedDiff=1;run=null;meta.sagaDiffWins={};meta.islandProgress={};`);
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
 first.onclick();assert.deepEqual(Array.from(h.exec('chosen')),[0,0]);
});
