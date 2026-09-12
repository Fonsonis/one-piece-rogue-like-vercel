import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1360,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin==='http://127.0.0.1:4175')errors.push(`${r.status()} ${r.url()}`);});
fs.mkdirSync('outputs/dex',{recursive:true});
try {
 await page.goto('http://127.0.0.1:4175/');await page.waitForSelector('#btn-dex');
 await page.evaluate(()=>{
   meta.dex=['luffy2','luffy5','zoro2','chopper'];meta.recruited=['luffy5'];meta.roster=['luffy','zoro','chopper'];
   SAGAS.forEach(s=>meta.sagaDiffWins[s.id]={3:true});meta.charUpgrades={luffy:95,zoro:95};
   meta.relics=['relic_luffy','relic_zoro'];meta.relicEquipment={};saveMeta();screenHome();
 });
 await page.locator('#btn-dex').click();
 assert.match(await page.locator('.dex-progress').innerText(),/3\s*\/\s*426/);
 await page.locator('#cf-q').fill('gear');
 assert.equal(await page.locator('.dex-card').count(),1);
 assert.equal(await page.locator('.dex-card').getAttribute('data-id'),'luffy');
 await page.screenshot({path:'outputs/dex/grouped-desktop.png'});
 await page.locator('.dex-card').focus();await page.keyboard.press('Enter');
 const phases=await page.evaluate(()=>characterForms('luffy').map(p=>p.id));
 const before=await page.evaluate(()=>JSON.stringify([meta.charUpgrades,meta.dex,meta.roster,run]));
 for(let i=0;i<phases.length;i++) {
  const id=phases[i];
  assert.equal(await page.locator('.char-sheet-sprite').getAttribute('data-character'),id);
  const expected=await page.evaluate(id=>{
   const f=applyUpgrades(makeChar(id,startLvlOf(id),false,true));return {name:CHARS[id].name,types:fighterTypes(f).map(t=>t.toUpperCase()),moves:f.moves.map(m=>MOVES[m].name),ultimate:getUltimateMove(f)?.name,stats:[f.maxhp,f.atk,f.def,f.spatk,f.spdef,f.spd]};
  },id);
  assert.ok((await page.locator('.char-sheet > h2').innerText()).includes(expected.name));
  assert.deepEqual(await page.locator('.sheet-profile-details > .type-badges .type-badge').allTextContents(),expected.types);
  assert.deepEqual(await page.locator('.sheet-stat > span > b').allTextContents(),expected.stats.map(String));
  const moves=await page.locator('.sheet-move:not(.future)').allTextContents();expected.moves.forEach(m=>assert.ok(moves.some(text=>text.includes(m))));
  if(expected.ultimate)assert.ok((await page.locator('.sheet-ultimate').innerText()).includes(expected.ultimate));
  assert.match(await page.locator('.ultimate-preview-button').getAttribute('aria-label'),new RegExp(expected.name));
  if(i<phases.length-1)await page.locator('#sheet-phase-next').click();
 }
 assert.equal(await page.locator('#sheet-phase-next').isDisabled(),true);
 assert.equal(await page.locator('#sheet-phase-prev').evaluate(el=>el===document.activeElement),true);
 assert.equal(await page.evaluate(()=>JSON.stringify([meta.charUpgrades,meta.dex,meta.roster,run])),before);
 await page.locator('#sheet-relic-select').selectOption('relic_luffy');
 assert.equal(await page.locator('.char-sheet-sprite').getAttribute('data-character'),'luffy5');
 assert.match(await page.locator('.sheet-relic-status').innerText(),/Afinidad activa/);
 await page.screenshot({path:'outputs/dex/gear5-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{meta.settings.theme='dark';applyDisplayPreferences();});
 await page.locator('#sheet-phase-prev').click();
 await page.screenshot({path:'outputs/dex/phases-mobile-dark.png'});
 for(let i=0;i<3;i++)await page.locator('#sheet-phase-prev').click();
 assert.equal(await page.locator('.char-sheet-sprite').getAttribute('data-character'),'luffy');
 assert.equal(await page.locator('#sheet-phase-prev').isDisabled(),true);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.keyboard.press('Escape');assert.equal(await page.locator('.dex-card').evaluate(el=>el===document.activeElement),true);
 await page.locator('.dex-card').click();assert.equal(await page.locator('.char-sheet-sprite').getAttribute('data-character'),'luffy');
 await page.keyboard.press('Escape');await page.locator('#cf-q').fill('chopper');await page.locator('.dex-card').click();
 await page.locator('#sheet-phase-next').click();
 assert.match(await page.locator('.sheet-phase-caption').innerText(),/Vista previa/);
 assert.equal(await page.evaluate(()=>startLvlOf('chopper')),5);
 const chopperPhase=await page.locator('.char-sheet-sprite').getAttribute('data-character');
 await page.evaluate(()=>{meta.logPoses=1000;showCharModal('chopper',document.querySelector('.char-sheet').closest('.overlay'),characterForms('chopper')[1].id);});
 await page.locator('#sheet-upg-btn').click();
 assert.equal(await page.evaluate(()=>startLvlOf('chopper')),6);
 assert.equal(await page.locator('#sheet-upg-btn').evaluate(el=>el===document.activeElement),true);
 assert.equal(await page.locator('.char-sheet-sprite').getAttribute('data-character'),chopperPhase);

 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.char-sheet').count(),0);
 // Visit every transformation chain through the actual arrow handlers and compare all displayed data.
 const catalog=await page.evaluate(async()=>{
   const issues=[];let phases=0;
   for(const base of dexBaseIds(Object.keys(CHARS)).filter(id=>CHARS[id].evo)) {
     showCharModal(base);await Promise.resolve();
     const chain=characterForms(base);
     for(let i=0;i<chain.length;i++) {
       const id=chain[i].id,sheet=document.querySelector('.char-sheet'),f=applyUpgrades(makeChar(id,startLvlOf(id),false,true));phases++;
       if(sheet.querySelector('.char-sheet-sprite').dataset.character!==id)issues.push(id+': sprite');
       if(JSON.stringify([...sheet.querySelectorAll('.sheet-profile-details > .type-badges .type-badge')].map(el=>el.textContent))!==JSON.stringify(fighterTypes(f).map(t=>t.toUpperCase())))issues.push(id+': types');
       if(JSON.stringify([...sheet.querySelectorAll('.sheet-stat > span > b')].map(el=>Number(el.textContent)))!==JSON.stringify([f.maxhp,f.atk,f.def,f.spatk,f.spdef,f.spd]))issues.push(id+': stats');
       const text=[...sheet.querySelectorAll('.sheet-move:not(.future)')].map(el=>el.textContent).join(' ');
       if(f.moves.some(m=>!text.includes(MOVES[m].name)))issues.push(id+': moves');
       const passive=passiveInfo(f),ultimate=getUltimateMove(f);
       if(passive&&!sheet.querySelector('.sheet-passive')?.textContent.includes(passive.desc))issues.push(id+': passive');
       if(ultimate&&!sheet.querySelector('.sheet-ultimate')?.textContent.includes(ultimate.name))issues.push(id+': ultimate');
       if(i<chain.length-1){sheet.querySelector('#sheet-phase-next').click();await Promise.resolve();}
     }
     document.querySelector('#sheet-close').click();
   }
   return {issues,phases};
 });
 assert.deepEqual(catalog.issues,[]);assert.ok(catalog.phases>71);
 // All chains navigate correctly, including characters with no transformations.
 await page.evaluate(()=>showCharModal('shanks'));assert.equal(await page.locator('.sheet-phase-arrow').count(),0);await page.keyboard.press('Escape');
 await page.reload();assert.equal(await page.evaluate(()=>meta.relicEquipment.luffy),'relic_luffy');
 assert.deepEqual(await page.evaluate(()=>meta.dex),['luffy2','luffy5','zoro2','chopper']);
 await page.evaluate(()=>{run={team:[makeChar('luffy',100)],items:{},saga:0,diff:1,berries:0,mode:'classic',badges:[]};startBattle([makeChar('zoro2',50,true)],{wild:true});clearTimeout(battle.timer);battle.waiting=true;showCharModal(battle.pTeam[0]);});
 assert.equal(await page.locator('.char-sheet-sprite').getAttribute('data-character'),'luffy5');
 assert.equal(await page.locator('.sheet-phase-arrow').count(),0);assert.equal(await page.locator('#sheet-relic-select').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: base-only Dex, legacy counts, phase search, full phase data, arrows and keyboard, locked previews, shared relics, persistence and live combat isolation.');
} finally {await browser.close();}
