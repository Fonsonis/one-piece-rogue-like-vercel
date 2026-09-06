import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function harness() {
  const h=combatHarness();
  h.exec(`screenMap=()=>{};screenIslands=()=>{};let notice='';modalInfo=(title,html)=>{notice=title+html;};storyMode='classic';selectedDiff=1;`);
  return h;
}

test('all 57 islands have 3–5 maps, exactly one boss encounter and unchanged enemy definitions',()=>{
  const h=harness();
  assert.equal(h.exec(`(()=>{
    const before=JSON.stringify(SAGAS);
    for(const saga of SAGAS)for(const island of saga.islands){
      const n=islandMapCount(island);if(n<3||n>5)return false;
      let bosses=0;
      for(let i=0;i<n;i++){
        const map=genIslandMap(island,i),nodes=map.rows.flat();
        bosses+=nodes.filter(x=>x.type==='boss').length;
        if(i<n-1&&(!nodes.some(x=>x.type==='travel')||nodes.some(x=>x.type==='boss'||x.type==='crossover')))return false;
        for(const e of map.edges)if(!map.rows[e[0]]?.[e[1]]||!map.rows[e[2]]?.[e[3]])return false;
      }
      if(bosses!==1)return false;
    }
    return JSON.stringify(SAGAS)===before;
  })()`),true);
});

test('travel preserves HP, inventory, team and recruits; only the island boss grants permanent characters',()=>{
  const h=harness();
  assert.equal(h.exec(`(()=>{
    startRun(0,['luffy']);run.team.push(makeChar('zoro',12));registerRecruit('zoro');run.team[0].hp=11;
    const team=JSON.stringify(run.team),items=JSON.stringify(run.items);
    if(isNakamaUnlocked('zoro')||unlockRoster().length)return false;
    const n=islandMapCount(SAGAS[0].islands[0]);
    for(let i=0;i<n-1;i++){
      enterNode(run.map.rows.length-1,0);
      if(run.mapIdx!==i+1||JSON.stringify(run.team)!==team||JSON.stringify(run.items)!==items||isNakamaUnlocked('zoro'))return false;
      const parsed=GameSaveStorage.parse(JSON.stringify(GameSaveStorage.payload(meta,run)));validateGameSave(parsed);
    }
    battle={opts:{boss:true}};originalEndBattle(true);
    return run===null&&isNakamaUnlocked('zoro')&&completedIslands(0).includes(0)&&islandAvailable(0,1)&&!islandAvailable(0,2);
  })()`),true);
});

test('defeat or abandoning an unfinished expedition cannot unlock its recruits',()=>{
  const h=harness();
  assert.equal(h.exec(`(()=>{
    startRun(0,['luffy']);run.team.push(makeChar('zoro',12));registerRecruit('zoro');
    run.mapIdx=1;unlockRoster();clearRun();
    return !isNakamaUnlocked('zoro')&&!islandAvailable(0,1);
  })()`),true);
});

test('progress is separated by mode and difficulty and locked islands cannot start',()=>{
  const h=harness();
  assert.equal(h.exec(`(()=>{
    startRun(0,['luffy'],1);if(run)return false;
    meta.islandProgress[islandProgressKey(0,'classic',1)]=[0];
    if(!islandAvailable(0,1)||islandAvailable(0,1,'nuzlocke',1)||islandAvailable(0,1,'classic',2))return false;
    startRun(0,['luffy'],1);
    return run.islandIdx===1&&run.mapIdx===0;
  })()`),true);
});

test('legacy journeys keep their current map and previous unlocks, entering the new final-map stage',()=>{
  const h=harness();
  assert.equal(h.exec(`(()=>{
    const legacy={saga:0,mode:'classic',diff:1,islandIdx:1,badges:[0],team:[makeChar('luffy',12)],map:genMap(SAGAS[0].islands[1]),pos:null};
    const before=JSON.stringify(legacy.map),progress=META_DEFAULTS();migrateIslandJourney(legacy,progress);
    return legacy.mapIdx===islandMapCount(SAGAS[0].islands[1])-1&&JSON.stringify(legacy.map)===before&&progress.islandProgress['eastblue:classic:1'][0]===0;
  })()`),true);
});

test('invalid imported map indices and island progress are rejected',()=>{
  const h=harness();h.exec(`startRun(0,['luffy']);`);
  assert.throws(()=>h.exec(`const bad=GameSaveStorage.payload(meta,run);bad.run.mapIdx=99;GameSaveStorage.validate(bad);`));
  assert.throws(()=>h.exec(`meta.islandProgress={'eastblue:classic:1':[999]};validateGameSave(GameSaveStorage.payload(meta,null));`));
});

test('new saga wins do not unlock another mode; historical wins survive migration',()=>{
  const h=harness();
  assert.equal(h.exec(`(()=>{
    meta.sagaDiffWins={eastblue:{1:true}};
    migrateLegacyIslandWins(meta);
    if(completedIslands(0,'classic',1).length!==6||completedIslands(0,'nuzlocke',1).length!==6)return false;
    meta.islandProgress={'eastblue:classic:1':[0,1,2,3,4,5]};
    migrateLegacyIslandWins(meta);
    return completedIslands(0,'nuzlocke',1).length===0;
  })()`),true);
});

test('matching tags activate at 2 and 3; full six boosts 25% to 35% without losing II to an unrelated KO',()=>{
  const h=harness();
  assert.equal(h.exec(`(()=>{
    const team=['luffy','luffy','luffy','zoro','nami','sanji'].map(id=>makeChar(id,20));
    if(synergyTier(team.slice(0,1),'Golpe')!==0||synergyTier(team.slice(0,2),'Golpe')!==1||synergyTier(team.slice(0,3),'Golpe')!==2)return false;
    team[3].hp=0;if(synergyTier(team,'Golpe')!==2)return false;
    const six=Array.from({length:6},()=>makeChar('luffy',20));
    if(Math.abs(synergyBonus(six,'Golpe',.12,.25)-.35)>1e-10)return false;
    six[5].hp=0;return synergyBonus(six,'Golpe',.12,.25)===.25;
  })()`),true);
});

test('flee confirmation pauses between hits, cancellation resumes one pending step, confirmation runs once',()=>{
  const h=harness();
  h.exec(`startRun(0,['luffy']);startBattle([makeChar('bandido',30)],{wild:true});let yes,no,hits=0;modalConfirm=(t,m,y,n)=>{yes=y;no=n;};attackWith=()=>{hits++;};`);
  h.tick(); // first attack, next animation callback is pending
  h.exec(`confirmBattleFlee();`);
  assert.equal(h.exec('battle.waiting'),true);
  assert.equal(h.pending(),0);
  h.exec('no();no();');
  assert.equal(h.pending(),1);
  h.tick();
  assert.equal(h.exec('hits'),2);
  h.exec(`let attempts=0;tryFlee=()=>{attempts++;};confirmBattleFlee();yes();yes();`);
  assert.equal(h.exec('attempts'),1);
});
