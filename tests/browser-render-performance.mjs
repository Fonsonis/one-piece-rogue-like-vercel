// Reproducible renderer benchmark; Chromium CPU throttling is not an Android device measurement.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const cdp=await page.context().newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
await cdp.send('Performance.enable');
const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
const report={cpuSlowdown:4,viewport:'390x844'};
try{
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:4190/',{waitUntil:'networkidle'});
 await page.evaluate(()=>{
  document.querySelector('[data-learn-skip]')?.click();autoMode=false;
  startRun(0,['luffy']);run.team=['luffy','zoro','sanji','nami','chopper','usopp'].map(id=>makeChar(id,40));
  startBattle(['shanks','roger','garp','mihawk','smoker','akainu'].map(id=>makeChar(id,40,true)),{wild:true});clearTimeout(battle.timer);
 });
 await page.waitForTimeout(200);
 for(const mode of ['idle','hp']){
  const before=await metrics();
  report[mode]=await page.evaluate(async mode=>{
   refreshHPCards();await new Promise(r=>requestAnimationFrame(r));
   let added=0,mutations=0;const observer=new MutationObserver(records=>{mutations+=records.length;for(const r of records)added+=r.addedNodes.length;});
   observer.observe(document.querySelector('.battle-layout'),{subtree:true,childList:true,attributes:true,characterData:true});
   const reserve=document.querySelector('[data-reserve="1"]');
   const times=[];
   for(let i=0;i<40;i++){
    if(mode==='hp'){battle.curP.hp=Math.max(1,battle.curP.hp-1);battle.curP.ultCharge=(i*3)%101;}
    const start=performance.now();refreshHPCards();times.push(performance.now()-start);
    await new Promise(r=>requestAnimationFrame(r));
   }
   observer.disconnect();times.sort((a,b)=>a-b);
   return {added,mutations,medianMs:times[20],p95Ms:times[38],reservePreserved:reserve===document.querySelector('[data-reserve="1"]'),hpCorrect:document.querySelector('#fc-p-0 .hp-nums').textContent===`${battle.curP.hp}/${battle.curP.maxhp}`};
  },mode);
  const after=await metrics();report[mode].layoutCount=after.LayoutCount-before.LayoutCount;report[mode].styleCount=after.RecalcStyleCount-before.RecalcStyleCount;
 }
 // Compare incremental updates with a full render across non-HP state changes.
 for(const change of ['buffs','xp-status','ko','waiting','resume','form']){
  const result=await page.evaluate(async change=>{
   const f=battle.curP;
   if(change==='buffs')battle.itemBuffs.set(f,{atk:.3,def:.2});
   if(change==='xp-status'){f.xp+=17;f.st.burn=2;f.ultCharge=100;}
   if(change==='ko')battle.pTeam[2].hp=0;
   if(change==='waiting')battle.waiting=true;
   if(change==='resume'){battle.waiting=false;f.st={};}
   if(change==='form')battle.pTeam[1]=makeChar('mihawk',40);
   const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   const snapshot=()=>({
    cards:[...document.querySelectorAll('.fcard')].map(c=>({
     hp:c.querySelector('.hp-nums')?.textContent,
     xp:c.querySelector('.xp-progress')?.outerHTML,
     stats:c.querySelector('.fcard-stats-mini')?.textContent,
     status:c.querySelector('.fcard-st')?.innerHTML,
    })),
    reserves:[...document.querySelectorAll('[data-reserve]')].map(b=>({label:b.getAttribute('aria-label'),disabled:b.disabled,text:b.textContent,classes:[...b.classList].sort()})),
    passives:['p','e'].map(s=>document.querySelector('#passives-'+s).innerHTML),
    synergies:['p','e'].map(s=>document.querySelector('#syn-'+s).innerHTML)
   });
   // Forms require the existing full battle render to update the main portrait.
   if(change==='form')renderBattlePreserveLog();
   refreshHPCards();await settle();const incremental=snapshot();
   renderBattlePreserveLog();refreshHPCards();await settle();
   return {incremental,full:snapshot()};
  },change);
  assert.deepEqual(result.incremental,result.full,change);
 }
 await page.evaluate(()=>{battle=null;screenSagas(0);});await page.waitForTimeout(300);
 const before=await metrics();
 report.map=await page.evaluate(async()=>{
  const chart=document.querySelector('.world-map');chart.style.scrollSnapType='none';
  const bottom=chart.scrollHeight-chart.clientHeight,times=[];let last=performance.now();
  for(let i=0;i<120;i++){chart.scrollTop=bottom-i*30;await new Promise(r=>requestAnimationFrame(r));const now=performance.now();times.push(now-last);last=now;}
  times.sort((a,b)=>a-b);return {frameMedianMs:times[60],frameP95Ms:times[114],ports:document.querySelectorAll('.world-stop').length,overflow:document.documentElement.scrollWidth>innerWidth};
 });
 const after=await metrics();report.map.layoutCount=after.LayoutCount-before.LayoutCount;report.map.styleCount=after.RecalcStyleCount-before.RecalcStyleCount;
 assert.equal(report.idle.hpCorrect,true);assert.equal(report.hp.hpCorrect,true);assert.equal(report.map.ports,70);assert.equal(report.map.overflow,false);assert.deepEqual(errors,[]);
 if(process.argv.includes('--verify')){assert.equal(report.idle.added,0);assert.equal(report.hp.reservePreserved,true);}
 fs.mkdirSync('outputs/android-performance',{recursive:true});fs.writeFileSync(`outputs/android-performance/${process.env.BENCH_LABEL||'result'}.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
