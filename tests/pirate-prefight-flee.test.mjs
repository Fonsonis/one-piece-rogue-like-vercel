import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function setup() {
  const h=combatHarness(),nodes=new Map();
  const overlay={innerHTML:'',remove(){this.removed=true;},querySelector(selector){
    if(!nodes.has(selector))nodes.set(selector,{onclick:null});
    return nodes.get(selector);
  }};
  h.ctx.document.createElement=()=>overlay;
  h.ctx.document.querySelector=()=>null;
  h.ctx.document.body={appendChild(){}};
  h.exec(`let maps=0,starts=0,confirmYes,confirmNo;
    screenMap=()=>maps++;startBattle=(team,opts)=>{starts++;globalThis.started={team,opts};};
    modalConfirm=(title,text,yes,no)=>{confirmYes=yes;confirmNo=no;};
    run={mode:'nuzlocke',saga:0,islandIdx:0,mapIdx:0,nuzCaught:{},items:{},berries:300,team:[makeChar('luffy',5)]};
    var pirate=makeEnemy('shanks',20);wildEncounter(pirate);`);
  return {h,nodes,overlay};
}

test('pre-fight pirate escape succeeds below 70%, consumes the encounter without rewards or recruitment',()=>{
  const {h,nodes,overlay}=setup();
  assert.match(overlay.innerHTML,/id="we-flee"[^>]*>[^<]*70 %/);
  nodes.get('#we-flee').onclick();
  h.ctx.Math.random=()=>0.69;h.exec('confirmYes();confirmYes();');
  assert.equal(h.exec('maps'),1);assert.equal(h.exec('starts'),0);
  assert.equal(h.exec('run.berries'),300);assert.equal(h.exec('Object.keys(run.nuzCaught).length'),0);
  assert.equal(overlay.removed,true);
});

test('failed pre-fight escape starts one battle against the same pirate; cancellation keeps the choice open',()=>{
  const {h,nodes,overlay}=setup();
  nodes.get('#we-flee').onclick();h.exec('confirmNo()');
  assert.equal(overlay.removed,undefined);assert.equal(h.exec('starts'),0);
  nodes.get('#we-flee').onclick();
  h.ctx.Math.random=()=>0.7;h.exec('confirmYes();confirmYes();');
  assert.equal(h.exec('starts'),1);assert.equal(h.exec('maps'),0);
  assert.equal(h.exec('started.team[0]===pirate'),true);assert.equal(h.exec('started.opts.wild'),true);
});

test('choosing to flee pauses the scheduled automatic fight before asking for confirmation',()=>{
  const {h,nodes}=setup();
  h.exec('autoMode=true;scheduleAutoStep(()=>starts++,700)');
  nodes.get('#we-flee').onclick();
  while(h.tick()){}
  assert.equal(h.exec('autoMode'),false);assert.equal(h.exec('starts'),0);
});
