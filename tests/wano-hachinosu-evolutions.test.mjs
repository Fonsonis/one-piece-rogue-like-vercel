import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('Wano Law and Kid keep four stars and require both levels and Wano progression',()=>{
 for(const [base,form,move,oldMove] of [['law','law-wano','puncturewille','gammaknife'],['kid','kid-wano','damnedpunk','punkrotten']]) {
  const h=combatHarness();
  h.exec(`maxStartLvlCap=()=>100;meta.charUpgrades={${base}:35};meta.sagaDiffWins={};markSagaReached(SAGAS.findIndex(s=>s.id==='wholecake'));`);
  assert.equal(h.exec(`makeChar('${base}',40).id`),base);
  h.exec("markSagaReached(SAGAS.findIndex(s=>s.id==='wano'))");
  assert.equal(h.exec(`makeChar('${base}',39).id`),base);
  assert.equal(h.exec(`makeChar('${base}',40).id`),form);
  assert.equal(h.exec(`CHARS['${form}'].rareza`),4);
  assert.equal(h.exec(`CHARS['${form}'].unlockSaga`),'wano');
  assert.equal(h.exec(`getUltimateMove(makeChar('${base}',40))===MOVES.${move}`),true);
  assert.ok(h.exec(`MOVES.${move}.power*MOVES.${move}.acc>MOVES.${oldMove}.power*MOVES.${oldMove}.acc`));
  assert.equal(h.exec(`makeChar('${base}',39).moves.includes('${move}')`),false);
  h.exec(`meta.charUpgrades.${base}=34`);
  assert.equal(h.exec(`makeChar('${base}',100).id`),base);
 }
});

test('Koby gains a further Hachinosu evolution with Galaxy Impact in Egghead',()=>{
 const h=combatHarness();
 h.exec(`maxStartLvlCap=()=>100;meta.charUpgrades={coby:35};meta.sagaDiffWins={};markSagaReached(SAGAS.findIndex(s=>s.id==='wano'));`);
 assert.equal(h.exec("makeChar('coby',40).id"),'coby2');
 h.exec("markSagaReached(SAGAS.findIndex(s=>s.id==='egghead'))");
 assert.equal(h.exec("makeChar('coby',39).id"),'coby2');
 assert.equal(h.exec("makeChar('coby',40).id"),'coby-hachinosu');
 assert.equal(h.exec("CHARS['coby-hachinosu'].rareza"),4);
 assert.equal(h.exec("CHARS['coby-hachinosu'].unlockSaga"),'egghead');
 assert.equal(h.exec("getUltimateMove(makeChar('coby',40))===MOVES.galaxyimpact"),true);
});

test('new phases share permanent identity and relic affinity, and do not enter recruitment pools',()=>{
 const h=combatHarness();
 for(const [base,form] of [['law','law-wano'],['kid','kid-wano'],['coby','coby-hachinosu']]) {
  assert.equal(h.exec(`baseFormOf('${form}')`),base);
  assert.equal(h.exec(`CHARS['${form}'].saga===CHARS.${base}.saga`),true);
  assert.equal(h.exec(`SAGAS.every(s=>s.islands.every(i=>!i.pool.includes('${form}')))`),true);
  h.exec(`battle=null;const f_${base}=makeChar('${form}',40,false,true);f_${base}.battleRelic='relic_${base}';`);
  assert.equal(h.exec(`equippedRelic(f_${base}).character`),base);
  assert.equal(h.exec(`relicRule(f_${base})===RELICS.relic_${base}.rule`),true);
 }
});
