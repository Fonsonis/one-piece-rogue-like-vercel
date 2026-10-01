import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('only displayed four and five star forms have passive rules and effects', () => {
  const h = combatHarness();
  assert.equal(h.exec(`Object.entries(CHARS).every(([id,c]) => c.rareza >= 4 || !passiveRule({id}).name)`), true);
  assert.equal(h.exec(`!!passiveRule({id:'luffy'}).name`), false);
  assert.equal(h.exec(`!!passiveRule({id:'luffy4'}).name`), true);
  assert.equal(h.exec(`!!passiveRule({id:'zoro'}).name`), false);
  assert.equal(h.exec(`!!passiveRule({id:'zoro2'}).name`), true);
  assert.equal(h.exec(`!!passiveRule({id:'buggy'}).name`), false);
  assert.equal(h.exec(`!!passiveRule({id:'arlong'}).name`), true);
  assert.equal(h.exec(`(()=>{const p=makeChar('buggy',20), e=makeChar('zoro',20);run={mode:'story',saga:0,team:[p],items:{}};startBattle([e],{wild:true});return calcDamage(e,p,MOVES.toragari,false,1).dmg > 0})()`), true);
});

test('every character biography is short and principal characters have individual text', () => {
  const h = combatHarness();
  assert.equal(h.exec(`Object.values(CHARS).every(c => typeof c.bio === 'string' && c.bio.trim().split(/\s+/).length <= 30)`), true);
  assert.match(h.exec(`CHARS.luffy.bio`), /Sombrero de Paja/);
  assert.match(h.exec(`CHARS.robin.bio`), /Ohara/);
  assert.match(h.exec(`CHARS.gem.bio`), /Gem.*Baroque Works/);
});
