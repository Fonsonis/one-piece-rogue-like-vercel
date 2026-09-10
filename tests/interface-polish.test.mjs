import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('East Blue allows purchased starting levels up to 15',()=>{
  const h=combatHarness();
  assert.equal(h.exec(`meta.sagaDiffWins={};meta.wins={};meta.nuzWins={};maxStartLvlCap()`),15);
  assert.equal(h.exec(`meta.charUpgrades={luffy:20};startLvlOf('luffy')`),15);
});

test('scroll cancels reordering; holding then dragging reorders; cancellation clears hold',()=>{
  const h=combatHarness();const moves=[];
  const items=[0,1].map(i=>({dataset:{idx:String(i)},isConnected:true,setAttribute(){},classList:{add(){},remove(){}},closest(){return this;}}));
  h.ctx.document.elementFromPoint=()=>items[1];
  h.ctx.dragContainer={querySelectorAll:()=>items};h.ctx.onMove=(a,b)=>moves.push([a,b]);
  h.exec(`makeListReorderable(dragContainer,'.team-slot',onMove)`);
  const event=y=>({touches:[{clientX:0,clientY:y}],changedTouches:[{clientX:0,clientY:y}],target:{closest:()=>null},cancelable:true,preventDefault(){this.prevented=true;}});
  items[0].ontouchstart(event(0));const scroll=event(30);items[0].ontouchmove(scroll);h.tick();items[0].ontouchend(event(30));
  assert.equal(scroll.prevented,undefined);assert.deepEqual(moves,[]);
  items[0].ontouchstart(event(0));h.tick();const drag=event(30);items[0].ontouchmove(drag);items[0].ontouchend(event(30));
  assert.equal(drag.prevented,true);assert.deepEqual(moves,[[0,1]]);
  items[0].ontouchstart(event(0));items[0].ontouchcancel();h.tick();items[0].ontouchend(event(30));assert.equal(moves.length,1);
});

test('journey effects and XP survive the next fight; combat passive flags reset',()=>{
  const h=combatHarness();
  assert.equal(h.exec(`(()=>{
    run={saga:0,islandIdx:0,mode:'classic',team:[makeChar('luffy',12)],items:{},berries:0};
    const f=run.team[0];f.xp=17;f.hp-=3;
    f.st={burn:2,burnRate:.04,poison:1,poisonDefense:.3,slow:2,slowRate:.2,receivedHit:true};
    const hp=f.hp;
    startBattle([makeChar('zoro',5)],{wild:true});
    if(f.xp!==17||f.hp!==hp||f.st.burn!==2||f.st.poisonDefense!==.3||f.st.receivedHit)return false;
    screenMap=()=>{};
    originalEndBattle(true);
    return f.lvl===13&&f.xp===17&&f.st.burn===2;
  })()`),true);
});

test('replaying an earlier island records its completion as most recent and saves it',()=>{
  const h=combatHarness();
  assert.equal(h.exec(`(()=>{
    screenMap=()=>{};screenIslands=()=>{};modalInfo=()=>{};storyMode='classic';selectedDiff=1;
    meta.islandProgress={'eastblue:classic:1':[0,1,2]};
    meta.lastCompletedIsland={saga:0,index:2,mode:'classic',diff:1};
    startRun(0,['luffy'],0);battle={opts:{boss:true}};originalEndBattle(true);
    const parsed=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run)));
    return parsed.meta.lastCompletedIsland.index===0&&completedIslands(0).includes(2);
  })()`),true);
});

test('catalogue excludes defeated five-star characters while random posters keep them',()=>{
  const h=combatHarness();let markup='';
  const modal={set innerHTML(s){markup=s;},querySelector(){return {};},querySelectorAll(){return [];}};
  h.ctx.document.createElement=()=>modal;h.ctx.document.body={appendChild(){}};
  h.exec(`run={saga:0,islandIdx:0,items:{},berries:999999};meta.defeated=Object.keys(CHARS);renderSpecialCatalog(10);`);
  const ids=[...markup.matchAll(/data-hire="([^"]+)"/g)].map(m=>m[1]);
  assert.ok(ids.length);
  for(const id of ids)assert.ok(h.exec(`CHARS[${JSON.stringify(id)}].rareza`)<5);
  assert.ok(h.exec('poolByRareza(5).length')>0);
});
