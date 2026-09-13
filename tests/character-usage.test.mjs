import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('usage counts actual starts, groups forms, composes with filters and survives save roundtrips',()=>{
  const h=combatHarness();
  h.exec(`screenMap=()=>{};storyMode='classic';selectedDiff=1;startRun(0,['luffy','zoro']);recordCharacterUsage(['luffy','luffy2','unknown']);`);
  assert.equal(h.exec(`characterUsageCount('luffy5')`),2);
  assert.equal(h.exec(`characterUsageCount('zoro')`),1);
  assert.equal(h.exec(`characterUsageCount('shanks')`),0);
  assert.deepEqual(Array.from(h.exec(`filterSortChars(['zoro','shanks','luffy'],{sort:'usageDesc'})`)),['luffy','zoro','shanks']);
  assert.deepEqual(Array.from(h.exec(`filterSortChars(['zoro','shanks','luffy'],{sort:'usageDesc',q:'zoro'})`)),['zoro']);
  h.exec(`const saved=JSON.parse(JSON.stringify(GameSaveStorage.payload(meta,null)));GameSaveStorage.validate(saved);meta=saved.meta;`);
  assert.equal(h.exec(`characterUsageCount('luffy')`),2);
  for(const value of ['[]','{"luffy":-1}','{"luffy":1.5}','{"luffy":"2"}']) {
    assert.throws(()=>h.exec(`GameSaveStorage.validate({...saved,meta:{...saved.meta,characterUsage:${value}}})`));
  }
  assert.doesNotThrow(()=>h.exec(`delete saved.meta.characterUsage;GameSaveStorage.validate(saved);meta=saved.meta;`));
  assert.equal(h.exec(`characterUsageCount('luffy')`),0);
});

test('challenge rejection and resume do not inflate usage; each new tournament counts once',()=>{
  const h=combatHarness();
  h.exec(`accountLevel=()=>35;screenChallengeBracket=()=>{};meta.roster=['luffy','shanks','roger'];`);
  assert.equal(h.exec(`startChallenge('legends',['luffy','shanks'])`),false);
  assert.equal(h.exec(`characterUsageCount('shanks')`),0);
  assert.equal(h.exec(`startChallenge('legends',['shanks','roger'])`),true);
  h.exec(`screenChallengeBracket();startChallenge('legends',['shanks','roger']);`);
  assert.equal(h.exec(`characterUsageCount('shanks')`),1);
  assert.equal(h.exec(`characterUsageCount('roger')`),1);
});

test('saved teams preserve order while excluding duplicates, locked identities and excess slots',()=>{
  const h=combatHarness();
  h.exec(`meta.teamPresets={1:['unknown','luffy2','shanks','luffy','roger','zoro'],2:'invalid'};`);
  assert.deepEqual(Array.from(h.exec(`eligiblePresetTeam(1,['luffy','shanks','roger'],2)`)),['luffy','shanks']);
  assert.deepEqual(Array.from(h.exec(`eligiblePresetTeam(1,['shanks','roger'],2)`)),['shanks','roger']);
  assert.deepEqual(Array.from(h.exec(`eligiblePresetTeam(2,['luffy'],1)`)),[]);
  assert.deepEqual(Array.from(h.exec(`eligiblePresetTeam(3,['luffy'],1)`)),[]);
});
