import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {combatHarness} from './balance-harness.mjs';

test('daily steps migrate old saves, keep the current balance and refill on a new local day',()=>{
 const h=combatHarness();
 assert.equal(h.exec(`normalizeDailySteps(null,new Date(2026,8,20)).remaining`),1000);
 assert.equal(h.exec(`normalizeDailySteps({date:'2026-09-20',remaining:347},new Date(2026,8,20)).remaining`),347);
 assert.equal(h.exec(`normalizeDailySteps({date:'2026-09-19',remaining:0},new Date(2026,8,20)).remaining`),1000);
});

test('daily step data and automatic map markers are validated in portable saves',()=>{
 const h=combatHarness();
 assert.doesNotThrow(()=>h.exec(`GameSaveStorage.validate(GameSaveStorage.payload({...meta,dailySteps:{date:'2026-09-20',remaining:0}},null))`));
 for(const value of [-1,1001,1.5,'3']){
  h.ctx.value=value;
  assert.throws(()=>h.exec(`GameSaveStorage.validate(GameSaveStorage.payload({...meta,dailySteps:{date:'2026-09-20',remaining:value}},null))`));
 }
 h.exec(`screenMap=()=>{};startRun(0,['luffy']);run.autoPaidMapIdx=0;`);
 assert.doesNotThrow(()=>h.exec(`GameSaveStorage.validate(GameSaveStorage.payload(meta,run))`));
 h.exec('run.autoPaidMapIdx=1;');
 assert.throws(()=>h.exec(`GameSaveStorage.validate(GameSaveStorage.payload(meta,run))`));
});

test('Joy Boy belongs to the final saga and never enters the Gyojin encounter pool',()=>{
 const h=combatHarness();
 assert.equal(h.exec(`CHARS.joyboy.saga`),'egghead');
 assert.equal(h.exec(`SAGAS.find(s=>s.id==='gyojin').islands.every(island=>!island.pool.includes('joyboy'))`),true);
 assert.equal(h.exec(`SAGAS.find(s=>s.id==='egghead').islands.every(island=>island.pool.includes('joyboy'))`),true);
});

test('iPhone top controls reserve safe areas on general, challenge and team screens',()=>{
 const html=fs.readFileSync('public/play.html','utf8');
 const base=fs.readFileSync('public/style.css','utf8');
 const challenges=fs.readFileSync('public/art/challenges.css','utf8');
 const team=fs.readFileSync('public/art/interface-polish.css','utf8');
 assert.match(html,/viewport-fit=cover/);
 assert.match(base,/\.back-btn\s*\{[^}]*safe-area-inset-top/s);
 assert.match(challenges,/#app:has\(\.challenge-panel\) > \.back-btn\s*\{[^}]*position:sticky[^}]*safe-area-inset-top/s);
 assert.match(team,/#app:has\(#starter-slots-container\) > #btn-back\s*\{[^}]*safe-area-inset-top[^}]*safe-area-inset-left/s);
});
