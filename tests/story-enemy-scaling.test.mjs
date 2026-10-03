import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function setup() {
  const h=combatHarness();h.ctx.Math.random=()=>0.1;
  h.exec(`screenMap=()=>{};saveRun=()=>true;let enemies;
    wildEncounter=f=>{enemies=[f];};startBattle=fs=>{enemies=fs;};
    modalInfo=(title,html,done)=>done?.();
    run={saga:0,islandIdx:0,mapIdx:0,diff:1,mode:'classic',items:{},team:[],map:{rows:[[{type:'boss'}]]}};`);
  return h;
}

test('story bosses apply all five difficulty multipliers to their final-map stats',()=>{
  const h=setup();
  for(const [saga,island] of [[0,0],[2,3],[3,3]])for(let diff=1;diff<=5;diff++){
    h.exec(`run.saga=${saga};run.islandIdx=${island};run.diff=${diff};
      var island=SAGAS[run.saga].islands[run.islandIdx];run.mapIdx=islandMapCount(island)-1;enterNode(0,0);`);
    assert.equal(h.exec(`enemies.every((enemy,k)=>{
      const base=makeEnemy(island.boss[k],enemy.lvl),mult=DIFFICULTIES[run.diff-1].mult;
      return ['maxhp','hp','atk','def','spatk','spdef','spd'].every(stat=>enemy[stat]===Math.floor(base[stat]*mult));
    })`),true,`saga ${saga}, difficulty ${diff}`);
    assert.equal(h.exec('enemies.every((enemy,k)=>enemy.lvl===islandBossLevel(island,k))'),true);
  }
});

test('wild pirates, marines, ambushes and bosses grow across maps and reset for a fresh island attempt',()=>{
  const h=setup();
  h.exec(`var island=SAGAS[0].islands[0];island.pool=['bandido'];
    MYSTERY_EVENTS.splice(0,MYSTERY_EVENTS.length,{kind:'battle',text:'Emboscada'});`);
  for(const type of ['wild','marine','mystery','boss']){
    h.exec(`run.map.rows[0][0].type='${type}';run.mapIdx=0;enterNode(0,0);var first=enemies.map(e=>e.lvl);`);
    for(const mapIdx of [1,2,3]){
      h.exec(`run.mapIdx=${mapIdx};enterNode(0,0)`);
      assert.equal(h.exec(`enemies.every((e,k)=>e.lvl===first[k]+${mapIdx*2})`),true,type);
    }
    h.exec('run.mapIdx=0;enterNode(0,0)');
    assert.deepEqual(Array.from(h.exec('enemies.map(e=>e.lvl)')),Array.from(h.exec('first')));
  }
});

test('map growth is independent of the player level and leaves non-story enemy construction unscaled',()=>{
  const h=setup();
  h.exec(`run.mapIdx=3;run.diff=5;run.map.rows[0][0].type='wild';SAGAS[0].islands[0].pool=['bandido'];
    run.team=[makeChar('luffy',5)];enterNode(0,0);var low=enemies[0].lvl;
    run.team=[makeChar('luffy',100)];enterNode(0,0);`);
  assert.equal(h.exec('enemies[0].lvl'),h.exec('low'));
  assert.equal(h.exec("makeEnemy('bandido',20).maxhp"),h.exec("makeChar('bandido',20,false,true).maxhp"));
  assert.equal(h.exec("makeEnemy('bandido',120).lvl"),120);
});

test('the world destination displays the grown final boss level and common enemy range across maps',()=>{
  const h=setup();
  const html=h.exec('worldIslandPanelHTML(2,3)');
  assert.match(html,/Enemigos comunes Nv\. 46–56/);
  assert.match(html,/Enel · Nv\. 61/);
  assert.match(html,/\+2 niveles por mapa/);
});
