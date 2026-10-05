import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {combatHarness} from './balance-harness.mjs';

test('stat purchase buttons accept rapid clicks and recheck the current price, funds and cap',()=>{
  const h=combatHarness();
  const source=fs.readFileSync('public/game.js','utf8');
  const start=source.indexOf("    container.querySelectorAll('[data-up]').forEach");
  const end=source.indexOf("    container.querySelectorAll('[data-sell-stats]')",start);
  assert.ok(start>=0&&end>start);
  h.exec(`
    meta.fame=100000;meta.upgrades={};
    const maxLvl=3, buttons=['atk','def'].map(stat=>({dataset:{up:'luffy',stat}}));
    const container={querySelectorAll(){return buttons;},querySelector(){return null;}};
    const renderRosterUI=()=>{};
    Date.now=()=>1000;
  `);
  h.exec(source.slice(start,end));
  const initial=h.exec('meta.fame');
  h.exec('buttons[0].onclick();buttons[0].onclick();buttons[1].onclick();buttons[0].onclick();');
  assert.equal(h.exec('meta.upgrades.luffy.atk'),3);
  assert.equal(h.exec('meta.upgrades.luffy.def'),1);
  assert.equal(h.exec('meta.fame'),initial-h.exec('upgCost(0)*2+upgCost(1)+upgCost(2)'));
  h.exec('buttons[0].onclick()');
  assert.equal(h.exec('meta.upgrades.luffy.atk'),3);
  h.exec('meta.fame=upgCost(1);buttons[1].onclick();buttons[1].onclick();');
  assert.equal(h.exec('meta.upgrades.luffy.def'),2);
  assert.equal(h.exec('meta.fame'),0);
});
