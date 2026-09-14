import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
fs.mkdirSync('outputs/challenges',{recursive:true});
try {
 await page.goto('http://127.0.0.1:4175/');await page.waitForSelector('#mode-challenge');
 await page.evaluate(()=>{meta.accXp=xpForAccLevel(35);meta.sagaDiffWins=Object.fromEntries(SAGAS.slice(0,5).map(s=>[s.id,{3:true}]));meta.roster=['luffy','shanks','mihawk'];meta.charUpgrades={shanks:42,mihawk:45};screenChallenges();});
 for(const kind of ['tournament','legends'])for(const width of [320,390,1440]) {
  await page.setViewportSize({width,height:844});
  await page.evaluate(kind=>{meta.challenge=null;startChallenge(kind,kind==='legends'?['shanks','mihawk']:['shanks']);},kind);
  assert.ok(await page.locator('#challenge-fight-view').isVisible());
  assert.ok(await page.locator('#challenge-draw-view').isHidden());
  assert.equal(await page.locator('.challenge-contender figure').count(),kind==='legends'?4:2);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(width===390) {
   assert.ok(await page.locator('#challenge-fight').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'fight button is visible on first mobile screen');
   await page.screenshot({path:`outputs/challenges/remodel-${kind}-mobile.png`,fullPage:true});
  }
  await page.locator('#challenge-tab-draw').click();
  assert.ok(await page.locator('#challenge-fight-view').isHidden());
  assert.ok(await page.locator('.tournament-viewport').evaluate(el=>{const outer=el.getBoundingClientRect(),inner=el.querySelector('.tournament-canvas').getBoundingClientRect();return inner.right<=outer.right+1&&inner.bottom<=outer.bottom+1;}));
  await page.locator('#challenge-tab-fight').click();
  await page.locator('#btn-back').click();
  assert.equal(await page.locator('#challenge-resume,#challenge-relics').count(),0);
  assert.match(await page.locator(`[data-challenge="${kind}"]`).innerText(),/CONTINUAR/i);
  await page.locator(`[data-challenge="${kind}"]`).click();
 }
 await page.evaluate(()=>{endChallengeBattle(true);endChallengeBattle(true);screenChallenges();});
 assert.equal(await page.locator('#challenge-resume,#challenge-relics').count(),0);
 await page.locator('[data-challenge="legends"]').click();
 assert.equal(await page.locator('[data-claim-relic]').count(),3);
 await page.locator('[data-claim-relic]').first().click();await page.locator('#btn-back').click();
 assert.ok(await page.locator('[data-challenge="tournament"]').isEnabled());
 assert.doesNotMatch(await page.locator('.challenge-hub').innerText(),/VER RESULTADO|RELIQUIAS/);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'outputs/challenges/remodel-menu-mobile.png'});
 await page.evaluate(()=>{meta.sagaDiffWins=Object.fromEntries(SAGAS.map(s=>[s.id,{3:true}]));meta.charUpgrades.luffy=44;showCharModal('luffy');});
 for(let i=0;i<4;i++)await page.locator('#sheet-phase-next').click();
 assert.match(await page.locator('.sheet-phase-caption').innerText(),/Bloqueada.*50/);
 assert.equal(await page.locator('.art-preview-button,.ultimate-preview-button,.sheet-stats,.sheet-move').count(),0);
 assert.equal(await page.locator('.char-sheet-sprite').evaluate(el=>getComputedStyle(el).filter),'brightness(0)');
 assert.equal(await page.locator('.char-sheet > h2 .dex-sprite').count(),0);
 await page.screenshot({path:'outputs/challenges/gear5-bloqueado-mobile.png',fullPage:true});
 await page.locator('#sheet-phase-prev').click();
 assert.equal(await page.locator('.art-preview-button,.ultimate-preview-button').count(),2);
 await page.evaluate(()=>{meta.charUpgrades.luffy=45;showCharModal('luffy',document.querySelector('.char-sheet').closest('.overlay'),'luffy5');});
 assert.equal(await page.locator('.phase-locked').count(),0);
 await page.locator('.art-preview-button').click();await page.locator('.ultimate-preview-button').click();
 assert.deepEqual(errors,[]);
 console.log('PASS: focused matchups at 320–1440px, mobile fight CTA, full bracket, card-based resume/reward, and locked Gear 5 without previews.');
} finally {await browser.close();}
