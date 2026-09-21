import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
fs.mkdirSync('outputs/mobile-gameplay',{recursive:true});
try{
 await page.goto('http://127.0.0.1:4175');await page.waitForSelector('#btn-dex');
 await page.evaluate(()=>{
  document.querySelectorAll('.overlay').forEach(n=>n.remove());
  meta.dex=['luffy','zoro','nami','bonney','ivankov'];meta.roster=[...meta.dex];
  SAGAS.forEach(s=>meta.sagaDiffWins[s.id]={3:true});meta.charUpgrades={bonney:40,ivankov:25};screenDex();
 });
 await page.locator('#cf-saga').tap();await page.waitForSelector('.game-select-overlay');
 await page.getByRole('button',{name:/SABAODY/}).click();
 assert.equal(await page.locator('#cf-saga').inputValue(),'sabaody');
 assert.equal(await page.locator('.game-select-overlay').count(),0);
 await page.locator('#cf-saga').focus();await page.keyboard.press('Enter');
 await page.getByRole('button',{name:'Todas las sagas',exact:true}).click();
 await page.locator('.dex-card[data-id="luffy"]').click();
 await page.locator('[data-sheet-step="1"]').click();
 assert.match(await page.locator('.char-sheet h2').innerText(),/Zoro/);
 // Real touch gesture, not a direct call to the navigation callback.
 const cdp=await page.context().newCDPSession(page);
 const box=await page.locator('.char-sheet h2').boundingBox();
 const y=box.y+box.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:300,y}]});
 for(const x of [260,220,180,140,100])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.match(await page.locator('.char-sheet h2').innerText(),/Nami/);
 await page.locator('#sheet-close').click();
 await page.evaluate(()=>showInventoryModal());
 await page.locator('.btn-info-inv[data-id="ivankov"]').click();
 assert.match(await page.locator('.char-sheet h2').innerText(),/Ivankov/);
 await page.locator('[data-sheet-step="1"]').click();
 assert.match(await page.locator('.char-sheet h2').innerText(),/Bonney/);
 await page.locator('#sheet-phase-next').click();
 assert.match(await page.locator('.char-sheet h2').innerText(),/Nika/);
 await page.evaluate(async()=>{const img=new Image();img.src='/art/characters/bonney-nika.png';await img.decode();});
 await page.screenshot({path:'outputs/mobile-gameplay/bonney.png'});
 await page.locator('[data-sheet-step="-1"]').click();
 await page.locator('#sheet-phase-next').click();
 assert.match(await page.locator('.char-sheet h2').innerText(),/Forma femenina/);
 await page.evaluate(async()=>{const img=new Image();img.src='/art/characters/ivankov-female.png';await img.decode();});
 await page.screenshot({path:'outputs/mobile-gameplay/ivankov.png'});
 await page.locator('#sheet-close').click();
 await page.locator('#inv-close-x').click();
 await page.evaluate(()=>{
  run={mode:'story',saga:0,diff:1,berries:999999999,team:[makeChar('luffy',35)],items:{}};
  startBattle([makeChar('bandido',35)],{wild:true});pauseBattle();
 });
 for(const width of [320,360,390,768]){
  await page.setViewportSize({width,height:844});
  const result=await page.evaluate(()=>{
   const bar=document.querySelector('.combat-topbar'),b=bar.getBoundingClientRect();
   return {steps:!!bar.querySelector('.daily-steps'),overflow:bar.scrollWidth>bar.clientWidth+1,
    fit:[...bar.querySelectorAll('button')].every(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=b.top&&r.bottom<=b.bottom+1;})};
  });
  assert.deepEqual(result,{steps:false,overflow:false,fit:true},String(width));
  await page.screenshot({path:`outputs/mobile-gameplay/combat-${width}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Filters, touch swipe, ordered inventory sheets, Bonney Nika and combat toolbar verified.');
}catch(error){console.error('Browser errors:',errors);await page.screenshot({path:'outputs/mobile-gameplay/failure.png'});throw error;}finally{await browser.close();}
