import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('Buggy keeps slash immunity but both current and legacy mirrors finish',()=>{
 const h=combatHarness();
 for(const level of [1,5,8,15,20,50,99]){
  assert.ok(h.duel('buggy','buggy',level).outcome,`Buggy ${level}`);
  assert.ok(h.duel('buggy','buggy',level,{legacyMoves:['cuchillas','cortedoble']}).outcome,`legacy ${level}`);
 }
 assert.equal(h.exec(`calcDamage(battle.curP,battle.curE,MOVES.corte,false,1).dmg`),0);
 assert.notEqual(h.exec('chooseMove(battle.curP,battle.curE).type'),'Corte');
});

test('every character and move is valid; every directed matchup has a damaging choice',()=>{
 const h=combatHarness();
 const result=h.exec(`(()=>{
  let pairs=0;
  for(const [id,c] of Object.entries(CHARS)) {
    if(c.base.length!==6 || c.base.some(n=>!Number.isFinite(n)||n<=0)) throw Error(id+' stats');
    if(!c.types.length || c.types.some(t=>!TYPES[t])) throw Error(id+' types');
    let prev=0;
    for(const [level,move] of c.learnset){if(level<prev||!MOVES[move])throw Error(id+' learnset');prev=level;}
    const ult=getUltimateMove(makeChar(id,35));if(!ult.power||!TYPES[ult.type])throw Error(id+' ultimate');
  }
  for(const [id,m] of Object.entries(MOVES))if(!TYPES[m.type]||m.acc<=0||m.acc>1||m.power<0||(!m.power&&!['heal40','atkup','defup'].includes(m.effect)))throw Error(id);
  const fighters=Object.keys(CHARS).map(id=>makeChar(id,20));
  for(const p of fighters)for(const e of fighters){
    battle={pTeam:[p],eTeam:[e],curP:p,curE:e,round:1};
    const m=chooseMove(p,e);
    if(m.power&&!(calcDamage(p,e,m,false,1).dmg>0))throw Error(p.id+' vs '+e.id);
    if(!m.power){p.st={supportReady:99,atkup:true,defup:true};const backup=chooseMove(p,e);if(!(calcDamage(p,e,backup,false,1).dmg>0))throw Error('support lock '+p.id);p.st={};}
    pairs++;
  }
  return pairs;
 })()`);
 assert.equal(result,460*460);
});

test('all 460 mirrors at four levels and 920 seeded mixed encounters terminate',()=>{
 const h=combatHarness(); const ids=Array.from(h.exec('Object.keys(CHARS)'));
 let max=0,count=0;
 for(const level of [5,20,50,99])for(const id of ids){
  const r=h.duel(id,id,level);assert.ok(r.outcome,id+' '+level);max=Math.max(max,r.rounds);count++;
 }
 for(let i=0;i<ids.length;i++)for(const seed of [917,5801]){
  const r=h.duel(ids[i],ids[(i+73)%ids.length],35,{seed});assert.ok(r.outcome,ids[i]);max=Math.max(max,r.rounds);count++;
 }
 console.log('Balance simulations:',count,'max rounds:',max);
});

test('finite opening dodges, real support buffs, healing cooldown and climax',()=>{
 const h=combatHarness();
 h.duel('gojo','katakuri');
 assert.ok(h.exec('battle.pTeam[0].dodgeLeft===0 && battle.eTeam[0].dodgeLeft===0'));
 assert.ok(h.exec(`(()=>{
  const p=makeChar('chopper',20),e=makeChar('bandido',20);
  run={mode:'story',team:[p],items:{}};startBattle([e],{wild:true});
  const base=calcDamage(p,e,MOVES.punetazo,false,1).dmg;
  attackWith(p,e,MOVES.animo,'enemy');const boosted=calcDamage(p,e,MOVES.punetazo,false,1).dmg;
  attackWith(p,e,MOVES.animo,'enemy');if(calcDamage(p,e,MOVES.punetazo,false,1).dmg!==boosted||boosted<=base)return false;
  p.hp=1;p.moves=['remedytouch'];attackWith(p,e,MOVES.remedytouch,'enemy');
  const hp=p.hp;attackWith(p,e,MOVES.remedytouch,'enemy');if(p.hp!==hp||!chooseMove(p,e).power)return false;
  battle.round=15;p.hp=1;attackWith(p,e,MOVES.remedytouch,'enemy');return p.hp===1;
 })()`));
});

test('unlucky full teams terminate even when all attacks miss',()=>{
 const h=combatHarness();
 const team=['buggy','gojo','katakuri','marco','bigmom','brook'];
 const r=h.duel(team,team,50,{forceMiss:true});
 assert.ok(r.outcome); assert.ok(r.rounds<70,JSON.stringify(r));
});

test('canonical signatures and learned Haki; XP and evolution keep two moves',()=>{
 const h=combatHarness();
 assert.ok(h.exec(`(()=>{
  const luffy=makeChar('luffy2',30),enel=makeChar('enel',30);
  battle={pTeam:[luffy],eTeam:[enel],curP:luffy,curE:enel,round:1};
  if(!hasHaki(luffy)||calcDamage(enel,luffy,MOVES.descarga,false,1).dmg!==0)return false;
  for(const [id,m] of Object.entries(SIGNATURE_MOVES))if(CHARS[id]&&getUltimateMove(makeChar(id,35))!==MOVES[m])return false;
  const f=makeChar('luffy',19);f.xp=xpForLevel(19)-1;gainXP(f,1);
  if(f.id!=='luffy2'||f.lvl!==20||f.xp!==0||f.moves.length!==2)return false;
  f.xp=xpForLevel(20)/2;
  if(!xpBarHTML(f).includes('width:50%')||!xpBarHTML({...f,lvl:100}).includes('Nivel máximo'))return false;
  return true;
 })()`));
});

test('passive drains resolve KOs once and cannot heal through climax; Nuzlocke never revives',()=>{
 const h=combatHarness();
 assert.ok(h.exec(`(()=>{
  const p=makeChar('bigmom',20),e=makeChar('bandido',20);
  run={mode:'story',saga:0,team:[p],items:{}};startBattle([e],{wild:true});
  battle.round=15;p.hp=20;e.hp=1;
  const before=meta.stats?.kills||0;afterRound();
  if(e.hp!==0||p.hp!==20||(meta.stats.kills||0)!==before+1)return false;
  afterRound();if((meta.stats.kills||0)!==before+1)return false;
  const brook=makeChar('brook',20),zoro=makeChar('zoro',20);
  run={mode:'nuzlocke',saga:0,team:[brook,zoro],items:{}};startBattle([makeChar('bandido',20)],{wild:true});
  brook.hp=0;afterRound();return brook.hp===0&&!run.team.includes(brook);
 })()`));
});

test('all advertised passive modifiers are applied and remain bounded',()=>{
 const h=combatHarness();
 const errors=h.exec(`(()=>{
  const errors=[];
  for(const [id,rule] of Object.entries(PASSIVES)) {
   if(!CHARS[id]){errors.push(id+' missing');continue;}
   const p=makeChar(id,35),e=makeChar('bandido',35);
   run={mode:'story',saga:0,team:[p],items:{}};startBattle([e],{wild:true});
   if(rule.dodge&&p.dodgeLeft!==rule.dodge)errors.push(id+' dodge');
   if(evaChanceFor(p)>.60||critChanceFor(p)>.75||!Number.isFinite(effectiveSpeed(p)))errors.push(id+' bounds');
   for(const key of ['attack','physical','special','defense','reduction','dryReduction','critical','evasion','speed','openingSpeed','foeSpeed','types','lowAttack','lowSpeed','hitAttack']) {
    if(rule[key]===undefined)continue;
    if(key==='lowAttack'||key==='lowSpeed')p.hp=1;
    if(key==='hitAttack')p.st.receivedHit=true;
    const moveType=key==='special'?'Fuego':key==='types'?Object.keys(rule.types)[0]:'Golpe';
    const measure=()=>{
      if(['speed','openingSpeed','lowSpeed'].includes(key))return effectiveSpeed(p);
      if(key==='foeSpeed')return effectiveSpeed(e);
      if(key==='critical')return critChanceFor(p);
      if(key==='evasion')return evaChanceFor(p);
      if(['defense','reduction','dryReduction'].includes(key))return calcDamage(e,p,MOVES.punetazo,false,1).dmg;
      return calcDamage(p,e,{type:moveType,power:100,acc:1},false,1).dmg;
    };
    const on=measure(),value=rule[key];delete rule[key];const off=measure();rule[key]=value;
    if(on===off)errors.push(id+' '+key+' inert');
   }
  }
  return errors;
 })()`);
 assert.deepEqual(Array.from(errors),[]);
});


test('three matching nakamas can protect the first falling ally once per journey',()=>{
 const h=combatHarness();
 assert.ok(h.exec(`(()=>{
  const p=makeChar('luffy',20),p2=makeChar('zoro',20),e=makeChar('bandido',20);
  run={mode:'story',saga:0,team:[p,p2,makeChar('nami',20)],items:{}};startBattle([e],{wild:true});
  p.hp=0;afterRound();if(p.hp!==1||!run.nakamaGuardUsed)return false;
  p.hp=0;afterRound();return p.hp===0&&battle.curP===p2;
 })()`));
});
