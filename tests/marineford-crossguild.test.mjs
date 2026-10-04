import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('Marineford starts at level 100 and ends against the three admirals and Sengoku',()=>{
  const h=combatHarness();
  h.exec("var saga=SAGAS.find(s=>s.id==='marineford');");
  assert.deepEqual(Array.from(h.exec('saga.islands[0].lvl')),[100,106]);
  assert.equal(h.exec('saga.islands[1].lvl[0]'),108);
  assert.deepEqual(Array.from(h.exec('saga.islands.at(-1).boss')),['akainu','kizaru','aokiji','sengoku']);
  assert.equal(h.exec(`SAGAS.filter(s=>s.id!=='marineford').every(s=>{
    const order=['eastblue','alabasta','skypiea','water7','thriller','marineford','gyojin','dressrosa','wholecake','wano','egghead','elbaph'];
    const idx=({sabaody:4.5,punkhazard:7,zou:7.5})[s.id]??order.indexOf(s.id);
    const base=Math.round(8+7*idx+(idx>=3?Math.pow(idx-2,2.2)*2.2:0));
    return s.islands[0].lvl[0]===base+(s.id==='dressrosa'?8:0);
  })`),true,'other sagas retain their levels');
  h.exec(`screenMap=()=>{};startBattle=enemies=>{globalThis.finalEnemies=enemies;};
    run={saga:SAGAS.indexOf(saga),islandIdx:saga.islands.length-1,mapIdx:4,diff:3,
      mode:'classic',team:[],items:{},map:{rows:[[{type:'boss'}]]}};enterNode(0,0);`);
  assert.equal(h.exec('finalEnemies.length'),4);
  assert.equal(h.exec('finalEnemies.every((f,i)=>baseFormOf(f.id)===saga.islands.at(-1).boss[i])'),true);
  assert.equal(h.exec('finalEnemies.every((f,i)=>f.lvl===islandBossLevel(saga.islands.at(-1),i))'),true);
});

test('Cross Guild grants permanent ownership immediately even when the team has no space',()=>{
  const h=combatHarness();
  h.exec(`screenMap=()=>{};modalInfo=()=>{};saveRun=()=>true;
    run={saga:0,islandIdx:0,mode:'classic',team:[],items:{},nuzCaught:{}};
    addToTeam=(fighter,done)=>done(false);specialJoin('zoro',100);`);
  assert.equal(h.exec("meta.roster.includes('zoro')"),true);
  assert.equal(h.exec("meta.recruited.includes('zoro')"),true);
  assert.equal(h.exec("startLvlOf('zoro')"),5);
  h.exec("specialJoin('zoro',100);run=null");
  assert.equal(h.exec("meta.roster.filter(id=>id==='zoro').length"),1);
});

test('Cross Guild normalizes permanent forms and preserves purchased base levels',()=>{
  const h=combatHarness();
  h.exec(`screenMap=()=>{};modalInfo=()=>{};saveRun=()=>true;
    run={saga:0,islandIdx:0,mode:'classic',team:[],items:{},nuzCaught:{}};
    meta.charUpgrades.nami=2;meta.charUpgradeSpent.nami=123;
    addToTeam=(fighter,done)=>{run.team.push(fighter);done(true);};
    specialJoin('zoro2',100);specialJoin('nami',100);`);
  assert.equal(h.exec("meta.roster.includes('zoro')&&!meta.roster.includes('zoro2')"),true);
  assert.equal(h.exec("startLvlOf('nami')"),7);
  assert.equal(h.exec('meta.charUpgradeSpent.nami'),123);
  assert.equal(h.exec('run.team.every(f=>f.lvl===recruitLevelForPlayer())'),true);
});

test('wild pirate ownership still requires island completion',()=>{
  const h=combatHarness();
  h.exec(`run={islandComplete:false,team:[makeChar('zoro',20)]};registerRecruit('zoro');unlockRoster();`);
  assert.equal(h.exec("meta.roster.includes('zoro')"),false);
  h.exec('run.islandComplete=true;unlockRoster()');
  assert.equal(h.exec("meta.roster.includes('zoro')"),true);
});

test('accepted mystery recruits are permanent without completing the island',()=>{
  const h=combatHarness();
  h.exec(`screenMap=()=>{};modalInfo=()=>{};saveRun=()=>true;
    run={saga:0,islandIdx:0,mapIdx:0,mode:'classic',team:[],items:{},nuzCaught:{}};
    addToTeam=(fighter,done)=>{run.team.push(fighter);done(true);};
    MYSTERY_EVENTS.splice(0,MYSTERY_EVENTS.length,MYSTERY_EVENTS.find(e=>e.kind==='recruit'));
    doMystery({pool:['nami']});`);
  assert.equal(h.exec("meta.roster.includes('nami')"),true);
});
