import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:4175/')&&r.status()>=400)errors.push(r.status()+' '+r.url());});
fs.mkdirSync('outputs/luffy',{recursive:true});
try{
 await page.goto('http://127.0.0.1:4175/gear5-preview.html',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>!document.querySelector('#play').disabled);
 for(const id of ['luffy','luffy2','luffy3','luffy4','luffy5']){
  await page.locator('#form').selectOption(id);
  for(const phase of [0,480,640]){
   await page.locator('#frame').fill(String(phase));
   await page.locator('#frame').dispatchEvent('input');
   await page.locator('canvas').screenshot({path:`outputs/luffy/${id}-${phase}.png`});
  }
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'outputs/luffy/preview-mobile.png'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.goto('http://127.0.0.1:4175/',{waitUntil:'networkidle'});
 await page.evaluate(()=>{maxStartLvlCap=()=>100;meta.charUpgrades={luffy:95};});
 for(const id of ['luffy4','luffy5']){
  await page.evaluate(id=>{document.querySelectorAll('.overlay').forEach(el=>el.remove());showCharModal(id);},id);
  await page.locator('.art-preview-button').click();
  if(id==='luffy5')await page.waitForSelector('.ultimate-scene[data-presentation="attack"][data-phase="attack"]');
  else {const motion=await page.locator('.char-sheet-hero .dex-sprite').evaluate(sprite=>{
   const animations=sprite.getAnimations();animations.forEach(a=>{a.pause();a.currentTime=a.effect.getTiming().duration*.64;});
   return {count:animations.length,transform:getComputedStyle(sprite).transform,pose:getComputedStyle(sprite).backgroundPosition};
  });
  assert.ok(motion.count>=2);assert.ok(motion.pose.startsWith('66.6667'));
  }
  await page.screenshot({path:`outputs/luffy/${id}-sheet-mobile.png`});
  await page.locator('.char-sheet-hero .dex-sprite').evaluate(el=>el.getAnimations().forEach(a=>a.cancel()));
  await page.evaluate(()=>UltimateFX.cancelAll());
  await page.locator('.ultimate-preview-button').click();
  await page.waitForSelector(`.ultimate-scene[data-character="${id}"][data-phase="attack"]`);
  await page.screenshot({path:`outputs/luffy/${id}-ultimate-mobile.png`});
  await page.evaluate(()=>UltimateFX.cancelAll());
 }
 assert.deepEqual(errors,[]);
 console.log('Five Luffy attacks, mobile preview, Snakeman and Gear 5 sheet/ultimate verified without errors.');
}finally{await browser.close();}
