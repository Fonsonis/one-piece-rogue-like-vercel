import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {combatHarness} from './balance-harness.mjs';

test('only established groups are available; each fighter counts for one chosen group', () => {
  const h=combatHarness();
  assert.equal(h.exec("crewOptions('aokiji').join(',')"),'marine,blackbeard');
  assert.equal(h.exec("crewOptions('robin').join(',')"),'straw,baroque');
  assert.equal(h.exec("crewOptions('bonney').length"),0);
  assert.equal(h.exec("crewOptions('luffy').join(',')"),'straw');
  assert.ok(h.exec(`(()=>{const a=makeChar('aokiji',20);a.crewId='blackbeard';const b=makeChar('teach',20);return crewTier([a,b],'blackbeard')===1&&crewTier([a,b],'marine')===0;})()`));
});

test('selected version persists on a fighter and Straw synergy ignores combat types', () => {
  const h=combatHarness();
  h.exec("meta.crewVersions={robin:['baroque'],aokiji:['blackbeard']};meta.formPreferences={crews:{robin:'baroque',aokiji:'blackbeard'}};");
  assert.equal(h.exec("makeChar('robin',20).crewId"),'baroque');
  assert.equal(h.exec("makeChar('aokiji',20).crewId"),'blackbeard');
  assert.equal(h.exec("makeChar('aokiji',20,true).crewId"),'marine');
  const saved=h.exec("(()=>{const f=makeChar('robin',20);meta.formPreferences.crews.robin='straw';return fighterCrew(f);})()");
  assert.equal(saved,'baroque');
  assert.ok(h.exec(`(()=>{const team=['luffy','zoro','sanji'].map(id=>makeChar(id,20));return synergyTier(team,'Nakama')===2&&new Set(team.map(f=>fighterTypes(f)[0])).size>1;})()`));
});

test('alternate crew versions cost 100,000 Log Poses once and require successful saving', () => {
  const h=combatHarness();
  h.exec("meta.roster=['luffy','robin'];meta.logPoses=100000;saveMeta=()=>true;");
  assert.equal(h.exec("buyCrewVersion('robin','baroque')"),true);
  assert.equal(h.exec('meta.logPoses'),0);
  assert.equal(h.exec("crewVersionUnlocked('robin','baroque')"),true);
  assert.equal(h.exec("buyCrewVersion('robin','baroque')"),true);
  assert.equal(h.exec('meta.logPoses'),0);
  assert.equal(h.exec("buyCrewVersion('aokiji','blackbeard')"),false);
  h.exec("meta.roster.push('aokiji');meta.logPoses=100000;saveMeta=()=>false;");
  assert.equal(h.exec("buyCrewVersion('aokiji','blackbeard')"),false);
  assert.equal(h.exec('meta.logPoses'),100000);
  assert.equal(h.exec("crewVersionUnlocked('aokiji','blackbeard')"),false);
});

test('Wano and Straw–Heart alliance bonuses activate with historical crews intact', () => {
  const h=combatHarness();
  assert.ok(h.exec(`(()=>{const team=['luffy','law','kid'].map(id=>makeChar(id,20));return allianceTier(team,'wano')===1&&fighterCrew(team[1])==='heart'&&fighterCrew(team[2])==='kid';})()`));
  assert.ok(h.exec(`(()=>{const team=['luffy','zoro','law'].map(id=>makeChar(id,20));return allianceTier(team,'strawheart')===1&&crewBonus(team,'heal')>=.08;})()`));
});

test('custom artwork is packaged as four-pose atlases and portraits', () => {
  const h=combatHarness();
  const variants=Array.from(h.exec(`Object.entries(CREW_OPTIONS).filter(([id,crews])=>crews.length>1).map(([id,crews])=>[id,crews.map(crew=>crewSkinFor(id,crew)||CHARS[id].spriteId||id)])`));
  for(const [id,skins] of variants) {
    assert.equal(new Set(skins).size,skins.length,`${id} must look different for each affiliation`);
    for(const name of skins) {
      assert.ok(existsSync(`public/art/characters/${name}.png`),name);
      assert.ok(existsSync(`public/art/portraits/${name}.png`),name);
    }
  }
});
