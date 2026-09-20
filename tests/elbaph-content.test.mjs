import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {combatHarness} from './balance-harness.mjs';

test('Elbaph appends eight playable stages and unlocks from Egghead after Sabaody insertion',()=>{
 const h=combatHarness();
 assert.deepEqual(Array.from(h.exec('SAGAS.map(s=>s.id)')),['eastblue','alabasta','skypiea','water7','thriller','sabaody','marineford','gyojin','punkhazard','dressrosa','zou','wholecake','wano','egghead','elbaph']);
 assert.equal(h.exec('SAGAS[14].islands.length'),8);
 assert.equal(h.exec('sagaUnlocked(14)'),false);
 h.exec('meta.sagaDiffWins={egghead:{2:true}}');assert.equal(h.exec('sagaUnlocked(14)'),false);
 h.exec('meta.sagaDiffWins.egghead[3]=true');assert.equal(h.exec('sagaUnlocked(14)'),true);
 assert.equal(h.exec('SAGAS[14].islands.every(i=>i.boss.length && i.pool.length && i.boss.every(id=>CHARS[id]))'),true);
 assert.equal(h.exec("SAGAS[13].islands.every(i=>!i.boss.includes('im')&&!i.pool.includes('im'))"),true);
 assert.equal(h.exec("SAGAS[14].islands.at(-1).boss[0]"),'im');
 assert.equal(h.exec("makeEnemy('im',SAGAS[14].islands.at(-1).bossLvl[0]).id"),'im-revealed');
});

test('God Valley unlocks on base and journey level 25; preserves recruitment, saga and passive identity',()=>{
 const h=combatHarness();h.exec('maxStartLvlCap=()=>100');
 const ids=Array.from(h.exec('GOD_VALLEY_FORMS'));
 assert.equal(ids.length,19);
 for(const id of ids){
  h.ctx.subject=id;
  h.exec('meta.charUpgrades={[subject]:19}');
  assert.equal(h.exec('makeChar(subject,100).id'),id);
  h.exec('meta.charUpgrades[subject]=20');
  assert.equal(h.exec('makeChar(subject,24).id'),id);
  assert.equal(h.exec('makeChar(subject,25).id'),id+'-young');
  assert.equal(h.exec('baseFormOf(subject+"-young")'),id);
  assert.equal(h.exec('CHARS[subject+"-young"].saga'),h.exec('CHARS[subject].saga'));
  assert.equal(h.exec('JSON.stringify(passiveRule({id:subject+"-young"}))'),h.exec('JSON.stringify(passiveRule({id:subject}))'));
  assert.equal(h.exec('SAGAS.every(s=>s.islands.every(i=>!i.pool.includes(subject+"-young")))'),true);
 }
 assert.equal(h.exec("CHARS.bakkin.evo.to"),'bakkin-young');
 assert.equal(h.exec("CHARS.stussy.evo"),undefined);
});

test('Im phases are separate from Gunko and old fighters retain bonuses, XP and KO on migration',()=>{
 const h=combatHarness();h.exec('maxStartLvlCap=()=>100');
 for(const [level,id] of [[24,'im'],[25,'im-gunko'],[39,'im-gunko'],[40,'im-revealed']]){
  h.exec(`meta.charUpgrades={im:${level-5}}`);
  assert.equal(h.exec(`makeChar('im',100).id`),id);
 }
 assert.equal(h.exec("baseFormOf('im-gunko')"),'im');
 assert.equal(h.exec("baseFormOf('gunko-young')"),'gunko');
 h.exec(`meta.charUpgrades={};let veteran=makeChar('garp',60);veteran.hp=0;veteran.maxhp+=27;veteran.atk+=11;veteran.xp=432;
 meta.charUpgrades={garp:20};migrateFighter(veteran);`);
 assert.equal(h.exec('veteran.id'),'garp-young');
 assert.equal(h.exec('veteran.hp'),0);
 assert.equal(h.exec('veteran.xp'),432);
 assert.equal(h.exec("veteran.maxhp-makeChar('garp',60).maxhp"),27);
 assert.equal(h.exec("veteran.atk-makeChar('garp',60).atk"),11);
 h.exec('let once=JSON.stringify(veteran);migrateFighter(veteran)');
 assert.equal(h.exec('JSON.stringify(veteran)===once'),true);
});

test('every new phase has its own four-frame atlas, portrait and catalog destination art',()=>{
 const spec=JSON.parse(fs.readFileSync('docs/elbaph-art-prompts.json'));
 const manifest=JSON.parse(fs.readFileSync('public/art/manifest.json'));
 const h=combatHarness();
 for(const id of Object.keys(spec.assets)){
  h.ctx.assetId=id;assert.equal(h.exec('!!CHARS[assetId]'),true,id);
  assert.equal(manifest.characters[id]?.frames,4,id);
  for(const type of ['characters','portraits'])assert.ok(fs.statSync(`public/art/${type}/${id}.png`).size>1000,id);
 }
 h.exec(fs.readFileSync('public/art/world-locations.js','utf8'));
 assert.equal(h.exec('SAGAS[14].islands.every(i=>i.location.place)'),true);
 assert.ok(fs.statSync('public/art/scenes/elbaph.webp').size>1000);
});

test('all five Gorosei have playable transformations gated by both levels, with matching base identities',()=>{
 const h=combatHarness();h.exec('maxStartLvlCap=()=>100');
 assert.deepEqual(Array.from(h.exec('Object.keys(GOROSEI_FORMS)')).sort(),['jupeter','mars','nusjuro','saturn','warcury']);
 const phases=JSON.parse(h.exec('JSON.stringify(Object.entries(GOROSEI_FORMS).flatMap(([base,forms])=>forms.map(([kind,,level])=>[base,`${base}-${kind}`,level])))'));
 for(const [base,id,level] of phases){
  h.exec(`meta.charUpgrades={${base}:${level-6}}`);
  assert.notEqual(h.exec(`makeChar('${base}',100).id`),id);
  h.exec(`meta.charUpgrades.${base}++`);
  assert.equal(h.exec(`makeChar('${base}',${level}).id`),id);
  assert.notEqual(h.exec(`makeChar('${base}',${level-1}).id`),id);
  assert.equal(h.exec(`baseFormOf('${id}')`),base);
  assert.equal(h.exec(`CHARS['${id}'].saga`),'egghead');
 }
 assert.equal(h.exec("CHARS['saturn-young'].evo.to"),'saturn-hybrid');
});
