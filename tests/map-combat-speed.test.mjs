import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('map speed cycles 1/2/4 without changing the journey or starting auto play', () => {
  const h = combatHarness();
  const button = {textContent:'',setAttribute(){}};
  h.ctx.document.querySelector = () => button;
  h.exec("run={team:[makeChar('luffy',5)],items:{},berries:0,saga:0};var originalRun=JSON.stringify(run);");
  for (const speed of [2,4,1]) {
    h.exec('cycleBattleSpeed()');
    assert.equal(h.exec('autoSpeed'),speed);
    assert.equal(button.textContent,`⏩ x${speed}`);
    assert.equal(h.exec('JSON.stringify(run)'),h.exec('originalRun'));
    assert.equal(h.exec('autoMode'),false);
  }
});

test('map preference reaches the next battle even in auto mode and battle changes carry back', () => {
  for (const auto of [false,true]) {
    const h = combatHarness();
    h.ctx.document.querySelector = () => null;
    h.exec(`run={team:[makeChar('luffy',5)],items:{},berries:0,saga:0};autoMode=${auto};autoSettings.speed='x1';
      cycleBattleSpeed();cycleBattleSpeed();startBattle([makeChar('zoro',5)],{wild:true});`);
    assert.equal(h.exec('battle.speed'),4);
    h.exec('cycleBattleSpeed();battle=null');
    assert.equal(h.exec('autoSpeed'),1);
    assert.match(h.exec('topbar(true,true,true)'),/Velocidad de combate x1/);
  }
});

test('map controls place speed between settings and save, and omit it elsewhere', () => {
  const h = combatHarness();
  const html = h.exec('topbar(true,true,true)');
  assert.ok(html.indexOf('id="btn-settings"') < html.indexOf('id="btn-map-speed"'));
  assert.ok(html.indexOf('id="btn-map-speed"') < html.indexOf('id="btn-save"'));
  assert.doesNotMatch(h.exec('topbar(false)'),/id="btn-map-speed"/);
});
