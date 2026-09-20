import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {combatHarness} from './balance-harness.mjs';

test('Sabaody connects Thriller Bark to Marineford and contains the Supernovas and two stages',()=>{
 const h=combatHarness();
 assert.deepEqual(Array.from(h.exec('SAGAS.slice(4,7).map(s=>s.id)')),['thriller','sabaody','marineford']);
 assert.equal(h.exec('SAGAS[5].islands.length'),2);
 for(const id of ['kid','killer','law','bonney','bege','urouge','drake','hawkins','apoo','rayleigh','shakky','camie','pappag','kizaru','kuma','sentomaru','pacifista'])assert.equal(h.exec(`CHARS['${id}'].saga`),'sabaody');
 assert.equal(h.exec('sagaUnlocked(5)'),false);
 h.exec('meta.sagaDiffWins={thriller:{3:true}}');assert.equal(h.exec('sagaUnlocked(5)'),true);
 assert.equal(h.exec('sagaUnlocked(6)'),false);
 h.exec('meta.sagaDiffWins.sabaody={3:true}');assert.equal(h.exec('sagaUnlocked(6)'),true);
});

test('God Valley children are independent collectible recruits with separate progression',()=>{
 const h=combatHarness();h.exec('maxStartLvlCap=()=>100');
 for(const base of ['kuma','ivankov','ginny','dragon']){
  const id=base+'-young';
  assert.equal(h.exec(`baseFormOf('${id}')`),id);
  assert.equal(h.exec(`CHARS.${base}.evo`),undefined);
  assert.equal(h.exec(`EVOLVED_FORMS.has('${id}')`),false);
  assert.equal(h.exec(`SAGAS.find(s=>s.id==='elbaph').islands.some(i=>i.pool.includes('${id}'))`),true);
  h.exec(`meta.charUpgrades={'${base}':50};`);
  assert.equal(h.exec(`startLvlOf('${id}')`),5);
  assert.equal(h.exec(`makeChar('${id}',5).id`),id);
  assert.ok(h.exec(`makeChar('${id}',5).moves.length`)>0);
 }
});

test('new Sabaody and Straw Hat forms all have packaged sprites and portraits',()=>{
 const manifest=JSON.parse(fs.readFileSync('public/art/manifest.json'));
 for(const pack of ['sabaody','strawhat','zou'])for(const id of Object.keys(JSON.parse(fs.readFileSync(`docs/${pack}-art-prompts.json`)).assets)){
  assert.equal(manifest.characters[id]?.frames,4,id);
  for(const folder of ['characters','portraits'])assert.ok(fs.statSync(`public/art/${folder}/${id}.png`).size>1000,id);
 }
});

test('Zoro Nami and Sanji advance through their new forms with separate level gates',()=>{
 const h=combatHarness();h.exec('maxStartLvlCap=()=>100');
 for(const [base,phases] of [['zoro',[[20,'zoro2'],[30,'zoro-enma'],[40,'zoro-kingofhell']]],['nami',[[20,'nami2'],[30,'nami-sorcery'],[40,'nami-zeus']]],['sanji',[[20,'sanji-diable'],[30,'sanji-raid'],[40,'sanji-ifrit']]]]){
  for(const [level,id] of phases){
   h.exec(`meta.charUpgrades={${base}:${level-6}}`);assert.notEqual(h.exec(`makeChar('${base}',100).id`),id);
   h.exec(`meta.charUpgrades.${base}++`);assert.equal(h.exec(`makeChar('${base}',${level}).id`),id);
   assert.notEqual(h.exec(`makeChar('${base}',${level-1}).id`),id);
   assert.equal(h.exec(`baseFormOf('${id}')`),base);
   assert.equal(h.exec(`EVOLVED_FORMS.has('${id}')`),true);
  }
 }
});

test('Zou has two stages, relocates its cast and unlocks Whole Cake through its own campaign',()=>{
 const h=combatHarness();
 assert.deepEqual(Array.from(h.exec('SAGAS.slice(9,12).map(s=>s.id)')),['dressrosa','zou','wholecake']);
 assert.equal(h.exec('SAGAS[10].islands.length'),2);
 for(const id of ['inuarashi','nekomamushi','carrot','wanda','pedro','shishilian','zunesha','raizo','roddy','blackback','giovanni','concelot','miyagi','tristan','sheepshead','ginrummy'])assert.equal(h.exec(`CHARS.${id}.saga`),'zou');
 h.exec('meta.sagaDiffWins={dressrosa:{3:true}}');
 assert.equal(h.exec('sagaUnlocked(10)'),true);assert.equal(h.exec('sagaUnlocked(11)'),false);
 h.exec('meta.sagaDiffWins.zou={3:true}');assert.equal(h.exec('sagaUnlocked(11)'),true);
});

test('shown Sulong forms unlock at 40, preserve identities and never invent Pedro Sulong',()=>{
 const h=combatHarness();h.exec('maxStartLvlCap=()=>100');
 assert.equal(h.exec('SULONG_FORMS.length'),11);
 assert.equal(h.exec("CHARS['pedro-sulong']"),undefined);
 for(const base of Array.from(h.exec('SULONG_FORMS'))){
  const id=base+'-sulong';
  h.exec(`meta.charUpgrades={${base}:34}`);assert.notEqual(h.exec(`makeChar('${base}',100).id`),id);
  h.exec(`meta.charUpgrades.${base}=35`);assert.equal(h.exec(`makeChar('${base}',40).id`),id);
  assert.equal(h.exec(`baseFormOf('${id}')`),base);
  assert.equal(h.exec(`CHARS['${id}'].zoan`),false);
  assert.equal(h.exec(`EVOLVED_FORMS.has('${id}')`),true);
 }
 assert.equal(h.exec("CHARS['pekoms-hybrid'].evo.to"),'pekoms-sulong');
});

test('Momonosuke retains child dragon then unlocks adult and full-grown dragon without losing upgrades',()=>{
 const h=combatHarness();h.exec('maxStartLvlCap=()=>100');
 for(const [level,id] of [[20,'momonosuke-animal'],[30,'momonosuke-adult'],[40,'momonosuke-dragon']]){
  h.exec(`meta.charUpgrades={momonosuke:${level-5}}`);
  assert.equal(h.exec(`makeChar('momonosuke',${level}).id`),id);
  assert.equal(h.exec(`baseFormOf('${id}')`),'momonosuke');
 }
});

test('Punk Hazard is separate, owns its cast and keeps previous saga account caps stable',()=>{
 const h=combatHarness();
 assert.deepEqual(Array.from(h.exec('SAGAS.slice(7,11).map(s=>s.id)')),['gyojin','punkhazard','dressrosa','zou']);
 assert.equal(h.exec('SAGAS[8].islands.length'),2);assert.equal(h.exec('SAGAS[9].islands.length'),5);
 for(const id of ['caesar','monet','vergo','brownbeard','mocha','baby5','buffalo','kinemon','momonosuke'])assert.equal(h.exec(`CHARS.${id}.saga`),'punkhazard');
 assert.deepEqual(Array.from(h.exec("pirateKingLegendaryPool('punkhazard')")),['caesar']);
 assert.equal(h.exec("SAGA_LEVEL_CAPS.marineford"),35);assert.equal(h.exec("SAGA_LEVEL_CAPS.dressrosa"),45);assert.equal(h.exec("SAGA_LEVEL_CAPS.wano"),55);
});
