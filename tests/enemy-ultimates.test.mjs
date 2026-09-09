import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {combatHarness} from './balance-harness.mjs';

function setup(sagaOffset=0,tower=false) {
 const h=combatHarness();
 h.exec(`run={saga:SAGAS.findIndex(s=>s.id==='marineford')+${sagaOffset},diff:1,mode:'classic',team:[makeChar('bandido',40)],items:{}};
 tower={team:run.team,items:{}};startBattle([makeChar('bandido',40)],{tower:${tower}});
 clearTimeout(battle.timer);battle.waiting=false;
 battle.curP.hp=battle.curP.maxhp=100000;Math.random=()=>.5;`);
 return h;
}

test('enemy ultimate charge starts in Marineford, applies later and excludes the tower',()=>{
 for(const [offset,tower,expected] of [[-1,false,0],[0,false,100],[1,false,100],[0,true,0]]){
  const h=setup(offset,tower);
  h.exec(`for(let i=0;i<3;i++)attackWith(battle.curE,battle.curP,MOVES.punetazo,'player');`);
  assert.equal(h.exec('battle.curE.ultCharge'),expected);
  const html=h.exec("fighterCardHTML(battle.curE,'e',0,battle.curE)");
  assert.equal(html.includes('ult-bar-wrap'),expected===100);
 }
});

test('a charged enemy uses its ultimate against the player once in its turn, even with player auto ultimates off',()=>{
 const h=setup();
 h.exec(`autoMode=false;autoSettings.useUltimates=false;
 battle.curE.ultCharge=100;battle.curE.spd=99999;
 let attacks=[];attackWith=(att,dfd,mv,side)=>attacks.push({att,dfd,mv,side});runRound();`);
 assert.equal(h.exec('attacks.length'),1);
 assert.equal(h.exec('attacks[0].att===battle.curE && attacks[0].dfd===battle.curP'),true);
 assert.equal(h.exec('attacks[0].mv===getUltimateMove(battle.curE)'),true);
 assert.equal(h.exec('attacks[0].side'),'player');
 assert.equal(h.exec('battle.curE.ultCharge'),0);
 h.tick();
 assert.equal(h.exec('attacks.length'),2);
 assert.equal(h.exec('attacks[1].att===battle.curP'),true);
});

test('enemy ultimate does not activate early, below level 20, before Marineford or after a KO',()=>{
 for(const spec of ['battle.curE.ultCharge=99','battle.curE.lvl=19','run.saga=0','battle.curE.hp=0','battle.curP.hp=0']){
  const h=setup();
  h.exec(`battle.curE.ultCharge=100;${spec};let attacks=0;attackWith=()=>attacks++;`);
  if(spec.includes('=99')||spec.includes('lvl=19')){
   h.exec('battle.curE.spd=99999;runRound();');
   assert.equal(h.exec('battle.curE.ultCharge'),spec.includes('=99')?99:100);
  }else{
   h.exec('useUltimate(battle.curE);');assert.equal(h.exec('attacks'),0);
  }
 }
});

test('enemy ultimate animation targets the player card',()=>{
 const h=setup();
 h.exec(`let effect;UltimateArtProfiles={resolve:()=>({})};UltimateFX={play:spec=>{effect=spec;}};
 document.getElementById=id=>({querySelector:()=>id});
 battle.curE.ultCharge=100;`);
 h.exec(fs.readFileSync('public/art/ultimates/integration.js','utf8'));
 h.exec('useUltimate(battle.curE);');
 assert.equal(h.exec('effect.source'),'fc-e-0');
 assert.equal(h.exec('effect.target'),'fc-p-0');
 assert.equal(h.exec('effect.hit'),true);
});
