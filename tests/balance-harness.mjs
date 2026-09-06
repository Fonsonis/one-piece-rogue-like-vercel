import fs from 'node:fs';
import vm from 'node:vm';
export function combatHarness(source='public') {
  let seed=1776, queue=[], nextId=0, randomCalls=0;
  const memory=new Map(), math=Object.create(Math);
  math.random=()=>{randomCalls++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const node={style:{},classList:{toggle(){}},querySelector(){return this;},appendChild(){},children:[]};
  const ctx=vm.createContext({console,Math:math,
    document:{querySelector:()=>node,addEventListener(){},createElement:()=>node},
    localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},
    setTimeout(fn){const id=++nextId;queue.push({fn,id});return id;},clearTimeout(id){queue=queue.filter(x=>x.id!==id);},
  });
  const exec=s=>vm.runInContext(s,ctx);
  exec(fs.readFileSync('public/save-storage.js','utf8'));
  exec(fs.readFileSync(source+'/data.js','utf8'));
  exec(fs.readFileSync(source+'/game.js','utf8').split('// ============ INICIO ============')[0]);
  exec(`
    log=()=>{};toast=()=>{};refreshHPCards=()=>{};popDamage=()=>{};playMusic=()=>{};
    renderBattle=()=>{};renderBattlePreserveLog=()=>{};refreshControls=()=>{};
    saveMeta=()=>{};registerDex=()=>{};autoMode=false;
    let auditResult=null;
    endBattle=()=>{auditResult='win';};gameOver=()=>{auditResult='loss';};towerGameOver=gameOver;
  `);
  return {exec,ctx,randomCalls:()=>randomCalls,
    duel(p,e,level=20,options={}) {
      seed=options.seed??1776;queue=[];
      ctx.auditSpec={p:Array.isArray(p)?p:[p],e:Array.isArray(e)?e:[e],level,...options};
      exec(`
        auditResult=null;
        run={mode:'story',team:[],items:{},saga:0,diff:auditSpec.diff||1};
        run.team=auditSpec.p.map(id=>makeChar(id,auditSpec.level));
        var auditEnemies=auditSpec.e.map((id,i)=>makeChar(id,auditSpec.enemyLevels?.[i]||auditSpec.enemyLevel||auditSpec.level,true));
        startBattle(auditEnemies,{wild:true});
        if(auditSpec.legacyMoves) run.team[0].moves=auditEnemies[0].moves=[...auditSpec.legacyMoves];
        if(auditSpec.forceMiss) for(const m of Object.values(MOVES)) m.acc=0;
      `);
      let steps=0;
      while(queue.length&&steps++<4000){const task=queue.shift();task.fn();if(exec('auditResult'))break;}
      return exec(`({outcome:auditResult,rounds:battle.round,p:battle.pTeam.map(f=>f.hp),e:battle.eTeam.map(f=>f.hp)})`);
    }
  };
}
