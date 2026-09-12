import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('every catalog form belongs to exactly one ordered base entry, with cumulative unlock requirements',()=>{
 const h=combatHarness();
 const entries=h.exec('dexBaseIds(Object.keys(CHARS)).map(id=>characterForms(id))');
 const ids=entries.flatMap(forms=>forms.map(f=>f.id));
 assert.equal(new Set(ids).size,h.exec('Object.keys(CHARS).length'));
 assert.equal(ids.length,new Set(ids).size);
 for(const forms of entries) {
  assert.equal(h.exec(`baseFormOf('${forms[0].id}')`),forms[0].id);
  assert.equal(forms[0].level,0);
  for(let i=1;i<forms.length;i++)assert.ok(forms[i].level>=forms[i-1].level);
 }
 assert.equal(h.exec("characterForms('luffy5').map(f=>f.id).join(',')"),'luffy,luffy2,luffy3,luffy4,luffy5');
});

test('legacy evolved sightings count once and reveal the base without rewriting the save',()=>{
 const h=combatHarness();h.exec("meta.dex=['luffy2','luffy5','zoro','missing'];meta.recruited=['luffy5'];meta.roster=['luffy'];const before=JSON.stringify(meta);");
 assert.equal(h.exec('dexBaseIds(meta.dex).length'),2);
 assert.equal(h.exec("dexEntrySeen('luffy')"),true);
 const card=h.exec("dexCardHTML('luffy5')");assert.match(card,/data-id="luffy"/);assert.match(card,/dex-card seen/);assert.match(card,/5 fases/);
 assert.equal(h.exec('JSON.stringify(meta)===before'),true);
 assert.equal(h.exec("countInDex(['luffy','luffy2','luffy5','zoro'])"),2);
 assert.equal(h.exec("PROGRESSIVE_ACHIEVEMENTS.find(a=>a.id==='dex').check()"),2);
 assert.equal(h.exec("STATIC_ACHIEVEMENTS.find(a=>a.id==='dex_full').goal===dexBaseIds(Object.keys(CHARS)).length"),true);
});

test('search and combined filters find a phase but return one base card',()=>{
 const h=combatHarness();
 assert.equal(h.exec("dexFilteredBases({q:'Gear 5'}).join(',')"),'luffy');
 assert.equal(h.exec("dexFilteredBases({q:'Gear',rarity:5,type:'Haki'}).join(',')"),'luffy');
 assert.equal(h.exec("dexFilteredBases({q:'Gear 5',rarity:1}).length"),0);
 assert.equal(h.exec("dexFilteredBases({}).every(id=>!BASE_OF[id])"),true);
});
