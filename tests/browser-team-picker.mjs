import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
fs.mkdirSync('outputs/challenges',{recursive:true});
try {
 await page.goto(process.env.LOCAL_TEST_URL||'http://127.0.0.1:4175/');
 await page.waitForSelector('#mode-challenge');
 await page.evaluate(()=>{
  meta.accXp=xpForAccLevel(50);SAGAS.forEach(s=>meta.sagaDiffWins[s.id]={3:true});
  meta.roster=['luffy','zoro','nami','shanks','roger'];meta.global.starterSlots=3;
  meta.characterUsage={shanks:8,roger:3,zoro:2};screenHome();
 });
 for(const width of [320,390,768,1440]) {
  await page.setViewportSize({width,height:844});
  await page.evaluate(()=>screenChallenges());
  const cards=await page.locator('.challenge-event').evaluateAll(cards=>cards.map(c=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right};}));
  assert.equal(cards[0].y,cards[1].y);assert.ok(cards[0].right<=cards[1].x);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'outputs/challenges/menu-mobile.png',fullPage:true});
 await page.locator('[data-challenge="legends"]').click();
 for(const [slot,id] of [[0,'shanks'],[1,'roger']]) {
  await page.locator(`[data-challenge-slot="${slot}"]`).click();
  if(slot===0)await page.locator('#np-used').click();
  assert.equal(await page.locator('#np-used').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#np-roster [data-id]').first().getAttribute('data-id'),'shanks');
  await page.locator(`#np-roster [data-id="${id}"]`).click();
 }
 await page.locator('[data-team-save="1"]').click();
 assert.deepEqual(await page.evaluate(()=>meta.teamPresets[1]),['shanks','roger']);
 await page.locator('[data-challenge-slot="0"]').click();
 await page.locator('#np-roster [data-id="roger"]').click();
 assert.match(await page.locator('[data-challenge-slot="0"]').innerText(),/Roger/);
 assert.match(await page.locator('[data-challenge-slot="1"]').innerText(),/Shanks/);
 await page.locator('[data-challenge-remove="1"]').click();
 assert.ok(await page.locator('#challenge-start').isDisabled());
 await page.locator('[data-team-load="1"]').click();
 assert.ok(await page.locator('#challenge-start').isEnabled());
 await page.screenshot({path:'outputs/challenges/equipo-mobile.png',fullPage:true});
 await page.locator('#challenge-start').click();
 assert.deepEqual(await page.evaluate(()=>meta.characterUsage),{shanks:9,roger:4,zoro:2});
 await page.reload();await page.locator('#mode-challenge').click();await page.locator('#challenge-resume').click();
 assert.equal(await page.evaluate(()=>meta.characterUsage.shanks),9);
 await page.evaluate(()=>{finishChallenge(0);screenStarter(0,0);});
 await page.locator('.empty-slot').first().click();
 await page.locator('#np-used').click();
 assert.equal(await page.locator('#np-roster [data-id]').first().getAttribute('data-id'),'shanks');
 await page.locator('#np-search').fill('zoro');
 assert.equal(await page.locator('#np-roster [data-id]').count(),1);
 await page.locator('#np-reset').click();
 assert.equal(await page.locator('#np-used').getAttribute('aria-pressed'),'false');
 await page.keyboard.press('Escape');
 await page.locator('.btn-load-preset[data-slot="1"]').click();
 assert.match(await page.locator('.starter-team-grid').innerText(),/Shanks/);
 await page.evaluate(()=>screenTowerIntro());
 await page.locator('#tower-used').click();
 assert.equal(await page.locator('[data-tower]').first().getAttribute('data-tower'),'shanks');
 await page.locator('#tower-search').fill('roger');
 assert.equal(await page.locator('[data-tower]:visible').count(),1);
 await page.locator('[data-team-load="1"]').click();
 assert.match(await page.locator('#tower-picked').innerText(),/2\/3/);
 await page.locator('#tower-search').fill('zoro');await page.locator('[data-tower="zoro"]').click();
 assert.ok(await page.locator('#btn-start').isEnabled());
 await page.locator('#btn-start').click();
 assert.deepEqual(await page.evaluate(()=>meta.characterUsage),{shanks:10,roger:5,zoro:3});
 assert.deepEqual(errors,[]);
 console.log('PASS: horizontal menu at 320–1440px, shared presets, swap/remove, usage search in story/tower/challenges, and persistence.');
} finally {await browser.close();}
