import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1360,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
fs.mkdirSync('outputs/combat-shortcuts',{recursive:true});
try {
 await page.goto(process.env.TEST_URL||'http://127.0.0.1:4175/',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#mode-challenge');
 await page.evaluate(()=>{
  autoMode=false;storyMode='classic';selectedDiff=1;startRun(0,['luffy','zoro','sanji']);
  run.map={rows:[[{type:'rest'},{type:'rest'},{type:'rest'}],[{type:'rest'},{type:'rest'}]],edges:[[0,1,1,1],[0,1,1,0]]};
  run.pos=null;screenMap();
 });
 assert.deepEqual(await page.locator('.map-route-key').allTextContents(),['1','2','3']);
 await page.screenshot({path:'outputs/combat-shortcuts/map-desktop.png'});
 await page.keyboard.press('r');assert.match(await page.locator('.overlay h2').innerText(),/Reiniciar isla/);
 await page.keyboard.press('r');await page.keyboard.press('2');assert.equal(await page.locator('.overlay').count(),1);
 assert.equal(await page.evaluate(()=>run.pos),null);await page.locator('#mc-no').click();
 await page.evaluate(()=>{const input=document.createElement('input');input.id='shortcut-input';document.body.append(input);input.focus();});
 await page.keyboard.type('r123');assert.equal(await page.locator('.overlay').count(),0);
 await page.locator('#shortcut-input').evaluate(el=>el.remove());
 await page.keyboard.press('Alt+r');assert.equal(await page.locator('.overlay').count(),0);
 await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'r',repeat:true,bubbles:true})));
 assert.equal(await page.locator('.overlay').count(),0);
 await page.keyboard.press('2');await page.locator('#node-confirm-overlay').waitFor();
 assert.equal(await page.evaluate(()=>run.pos),null);
 // Cancel using the same dialog as a pointer selection.
 await page.locator('#node-confirm-overlay .btn.gray').click();
 await page.evaluate(()=>{meta.settings.showEventConfirm=false;});
 await page.keyboard.press('2');assert.deepEqual(await page.evaluate(()=>run.pos),[0,1]);
 await page.locator('#modal-ok').click();
 assert.deepEqual(await page.locator('.map-node[data-route-key]').evaluateAll(nodes=>nodes.map(n=>[n.dataset.routeKey,n.dataset.i])),[['1','0'],['2','1']]);
 await page.keyboard.press('9');assert.equal(await page.locator('.overlay').count(),0);
 await page.keyboard.press('1');assert.deepEqual(await page.evaluate(()=>run.pos),[1,0]);
 await page.locator('#modal-ok').click();
 await page.keyboard.press('r');await page.locator('#mc-yes').click();
 assert.equal(await page.evaluate(()=>run.pos),null);
 // Battle uses a real adventure, real item handlers and actual HP changes.
 await page.evaluate(()=>{
  run.items={carne:3,bebida_ataque:1};prepareBackpack(run);
  run.team=['luffy','zoro','sanji','shanks','roger'].map(id=>makeChar(id,40));
  startBattle(['shanks','roger','luffy'].map(id=>makeChar(id,40)),{wild:true});
  clearTimeout(battle.timer);battle.curP.hp=1;refreshHPCards();
 });
 for(const width of [1360,390]) {
  await page.setViewportSize({width,height:900});
  await page.locator('#battle-backpack').scrollIntoViewIfNeeded();
  const bag=await page.locator('#battle-backpack').boundingBox(),arena=await page.locator('.battle-cols').boundingBox();
  assert.ok(bag.y+bag.height<=arena.y+1);assert.ok(bag.y>=0&&bag.y<300);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:`outputs/combat-shortcuts/battle-top-${width}.png`});
  await page.locator('.battle-team-passives').scrollIntoViewIfNeeded();
  const chips=await page.locator('#passives-p .team-passive').evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));
  assert.ok(chips.length>=3);assert.ok(chips.every(c=>c.y===chips[0].y));assert.ok(chips[1].x>chips[0].x);
  const strip=page.locator('#passives-p');await strip.focus();await page.keyboard.press('End');
  await strip.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
  if(width===390)assert.ok(await strip.evaluate(el=>el.scrollLeft>0));
  await page.screenshot({path:`outputs/combat-shortcuts/passives-${width}.png`});
 }
 await page.locator('#battle-backpack [data-bag-item="carne"]').click();await page.locator('[data-bag-use]').click();
 assert.equal(await page.evaluate(()=>run.items.carne),2);assert.ok(await page.evaluate(()=>battle.curP.hp>1));
 await page.evaluate(()=>{clearTimeout(battle.timer);meta.settings.quickBattleItems=true;battle.curP.hp=1;});
 await page.locator('#battle-backpack [data-bag-item="carne"]').click();
 assert.equal(await page.evaluate(()=>run.items.carne),1);assert.equal(await page.locator('.bag-item-modal').count(),0);
 await page.keyboard.press('r');assert.equal(await page.locator('#mc-yes').count(),0);
 await page.evaluate(()=>{clearTimeout(battle.timer);});
 assert.deepEqual(errors,[]);
 console.log('PASS: R confirms/restarts; numbered routes advance in visual order; dialogs, editing, modifiers and repeat are guarded; horizontal passives and top backpack work at 390/1360px; normal and quick item use heal and consume one unit.');
} finally {await browser.close();}
