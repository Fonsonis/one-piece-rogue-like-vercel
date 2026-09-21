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
 await page.evaluate(()=>{
  meta.accXp=xpForAccLevel(35);meta.sagaDiffWins=Object.fromEntries(SAGAS.map(s=>[s.id,{3:true}]));
  meta.roster=['luffy'];meta.charUpgrades={lucci:95};startChallenge('tournament',['luffy']);
  meta.challenge.level=65;const m=challengeCurrentMatch(meta.challenge);
  const opponent=meta.challenge.entrants[m.a===0?m.b:m.a];
  const existing=meta.challenge.entrants.find(e=>e.members.includes('lucci'));
  if(existing)existing.members=opponent.members;
  opponent.members=['lucci'];validateGameSave(GameSaveStorage.payload(meta,null));saveMeta();screenChallengeBracket();
 });
 assert.match(await page.locator('#challenge-fight-view').innerText(),/Leopardo despertado/);
 await page.locator('#challenge-tab-draw').click();
 assert.match(await page.locator('.challenge-match.current-match').innerText(),/Leopardo despertado/);
 await page.reload();await page.waitForSelector('#mode-challenge');
 await page.locator('#mode-challenge').click();await page.locator('[data-challenge="tournament"]').click();
 assert.match(await page.locator('#challenge-fight-view').innerText(),/Leopardo despertado/);
 await page.screenshot({path:'outputs/challenges/lucci-evolved-preview.png',fullPage:true});
 await page.locator('#challenge-fight').click();
 const state=await page.evaluate(()=>{
  clearTimeout(battle.timer);
  const enemy=battle.eTeam[0],exact=makeChar('lucci-awakened',65,false,true);
  return {enemy:enemy.id,level:enemy.lvl,player:battle.pTeam[0].id,moves:enemy.moves,expectedMoves:exact.moves,atk:enemy.atk,expectedAtk:exact.atk};
 });
 assert.equal(state.enemy,'lucci-awakened');assert.equal(state.level,65);assert.equal(state.player,'luffy');
 assert.deepEqual(state.moves,state.expectedMoves);assert.equal(state.atk,state.expectedAtk);
 await page.screenshot({path:'outputs/challenges/lucci-evolved-combat.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: mobile preview, bracket, saved tournament reload and actual level-65 awakened Lucci combat; player unlocks preserved; no browser errors.');
}finally{await browser.close();}
