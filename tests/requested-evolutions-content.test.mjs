import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('Jaya recruits five-star Kurohige before his current Emperor evolution',()=>{
 const h=combatHarness();
 const jaya=h.exec("SAGAS.find(s=>s.id==='skypiea').islands.find(i=>i.name==='Jaya')");
 assert.deepEqual(Array.from(jaya.boss),['sarquiss','bellamy','teach']);
 assert.ok(Array.from(jaya.pool).includes('teach'));
 assert.equal(h.exec("CHARS.teach.name"),'Kurohige · Jaya');
 assert.equal(h.exec("CHARS.teach.spriteId"),'teach-jaya');
 assert.equal(h.exec("CHARS.teach.rareza"),5);
 assert.equal(h.exec("CHARS.teach.evo.to"),'teach-yonko');
 assert.equal(h.exec("CHARS['teach-yonko'].rareza"),5);
 assert.equal(h.exec("CHARS['teach-yonko'].spriteId"),'teach');
 assert.equal(h.exec("CHARS['teach-yonko'].ultimate"),'darkquake');
 assert.ok(h.exec("MOVES.darkquake.power")>h.exec("MOVES.blackhole.power"));
});

test('Kurohige current form stays behind its Marineford story gate',()=>{
 const h=combatHarness();
 h.exec("maxStartLvlCap=()=>100;meta.charUpgrades={teach:35};meta.sagaDiffWins={};markSagaReached(SAGAS.findIndex(s=>s.id==='skypiea'));");
 assert.equal(h.exec("makeChar('teach',40).id"),'teach');
 h.exec("markSagaReached(SAGAS.findIndex(s=>s.id==='marineford'));");
 assert.equal(h.exec("makeChar('teach',39).id"),'teach');
 assert.equal(h.exec("makeChar('teach',40).id"),'teach-yonko');
 assert.equal(h.exec("getUltimateMove(makeChar('teach',40))===MOVES.darkquake"),true);
});

test('Hyogoro regains his muscular Wano form as a four-star evolution',()=>{
 const h=combatHarness();
 h.exec("maxStartLvlCap=()=>100;meta.charUpgrades={hyogoro:35};meta.sagaDiffWins={};markSagaReached(SAGAS.findIndex(s=>s.id==='wano'));");
 assert.equal(h.exec("CHARS.hyogoro.evo.to"),'hyogoro-muscled');
 assert.equal(h.exec("makeChar('hyogoro',39).id"),'hyogoro');
 assert.equal(h.exec("makeChar('hyogoro',40).id"),'hyogoro-muscled');
 assert.equal(h.exec("CHARS['hyogoro-muscled'].rareza"),4);
 assert.equal(h.exec("getUltimateMove(makeChar('hyogoro',40))===MOVES.hyogorogoken"),true);
});

test('Franky progresses through four and five stars like the other Straw Hats',()=>{
 const h=combatHarness();
 h.exec("maxStartLvlCap=()=>100;meta.charUpgrades={franky:35};meta.sagaDiffWins={};markSagaReached(SAGAS.findIndex(s=>s.id==='gyojin'));");
 assert.equal(h.exec("makeChar('franky',29).id"),'franky');
 assert.equal(h.exec("makeChar('franky',30).id"),'franky-newworld');
 assert.equal(h.exec("CHARS['franky-newworld'].rareza"),4);
 assert.equal(h.exec("makeChar('franky',40).id"),'franky-shogun');
 assert.equal(h.exec("CHARS['franky-shogun'].rareza"),5);
 assert.equal(h.exec("getUltimateMove(makeChar('franky',40))===MOVES.generalcannon"),true);
});
