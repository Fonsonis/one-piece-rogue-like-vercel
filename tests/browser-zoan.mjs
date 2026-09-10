// Local smoke/flow verification. PLAYWRIGHT_MODULE can point to the bundled runtime.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1360,height:900}});
const failures=[];
page.on('pageerror',e=>failures.push(e.message));
page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).origin==='http://127.0.0.1:4175')failures.push(`${r.status()} ${r.url()}`);});
fs.mkdirSync('outputs/zoan',{recursive:true});
try{
 await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
 assert.ok((await page.locator('body').innerText()).trim().length>100);
 await page.screenshot({path:'outputs/zoan/home.png'});
 if(process.argv.includes('--smoke')){assert.deepEqual(failures,[]);console.log('Home loads without errors');}
 else{
  await page.evaluate(()=>{maxStartLvlCap=()=>100;meta.charUpgrades={lucci:34};meta.logPoses=logPoseUpgradeCost(39);run={mode:'classic',saga:0,berries:0,team:[makeChar('lucci',40)],items:{}};});
  assert.equal(await page.evaluate(()=>run.team[0].id),'lucci-hybrid');
  assert.equal(await page.evaluate(()=>upgradeCharLvl('lucci')),true);
  await page.evaluate(()=>showCharModal(run.team[0]));
  assert.equal(await page.evaluate(()=>run.team[0].id),'lucci-awakened');
  await page.screenshot({path:'outputs/zoan/lucci-sheet.png'});
  await page.evaluate(()=>{document.querySelectorAll('.overlay').forEach(o=>o.remove());run.team=[makeChar('lucci',40)];startBattle([makeChar('kaido-hybrid',40,false,true)],{wild:true});clearTimeout(battle.timer);});
  await page.screenshot({path:'outputs/zoan/combat-desktop.png'});
  const outcome=await page.evaluate(()=>{const f=run.team[0];f.ultCharge=100;useUltimate(f);return {id:f.id,charge:f.ultCharge,enemyHP:battle.eTeam[0].hp};});
  assert.equal(outcome.id,'lucci-awakened');assert.ok(outcome.charge<100);assert.ok(Number.isFinite(outcome.enemyHP));
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'outputs/zoan/combat-mobile.png'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto('http://127.0.0.1:4175/art/zoan-gallery.html',{waitUntil:'networkidle'});
  assert.equal(await page.locator('section').count(),34);
  await page.locator('#search').fill('Kaku');assert.equal(await page.locator('.card').count(),4);
  await page.locator('#pose').selectOption('2');
  assert.ok(await page.locator('.sprite').first().evaluate(el=>el.style.backgroundPosition.startsWith('66.6667')));
  await page.locator('#animate').click();assert.equal(await page.locator('#animate').getAttribute('aria-pressed'),'true');
  await page.screenshot({path:'outputs/zoan/gallery-mobile.png'});
  await page.setViewportSize({width:1360,height:1000});await page.locator('#search').fill('');await page.locator('#pose').selectOption('0');
  await page.screenshot({path:'outputs/zoan/gallery-desktop.png'});
  assert.deepEqual(failures,[]);console.log('Zoan flow verified: permanent upgrade, sheet, ultimate, desktop/mobile, gallery and asset requests');
 }
}finally{await browser.close();}
