import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('enemy hit by our ultimate waits for the visual and keeps its charged ultimate until next round', async () => {
  const h = combatHarness();
  h.exec(`
    run={mode:'story',saga:SAGAS.findIndex(s=>s.id==='marineford'),team:[makeChar('luffy5',100)],items:{}};
    startBattle([makeChar('kaido',100,true)],{wild:true});
    clearTimeout(battle.timer);
    battle.curP.spd=100000; battle.curE.spd=1;
    battle.curP.hp=battle.curP.maxhp=1000000;
    battle.curE.hp=battle.curE.maxhp=1000000;
    battle.curP.ultCharge=battle.curE.ultCharge=100;
    const realUltimate=getUltimateMove;
    getUltimateMove=f=>f===battle.curP?{...realUltimate(f),acc:1}:realUltimate(f);
    autoMode=true;
    let finishVisual;
    battle.playerUltimateVisualPromise=new Promise(resolve=>{finishVisual=resolve;});
    runRound();
  `);
  assert.equal(h.exec('battle.lastPlayerUltimateRound'), 1);
  h.tick(); // Enemy step blocks until Luffy's scene and recoil finish.
  assert.equal(h.pending(), 0);
  assert.equal(h.exec('battle.curE.ultCharge'), 100);
  h.exec('finishVisual()');
  await Promise.resolve();
  h.tick(); // End of round.
  assert.equal(h.exec('battle.curE.ultCharge'), 100);
  assert.equal(h.exec('battle.round'), 2);
  h.tick(); // Luffy's normal attack.
  h.tick(); // Kaido uses the preserved ultimate.
  assert.ok(h.exec('battle.curE.ultCharge') < 100);
});

test('a missed player ultimate still finishes its visual without denying the enemy turn', async () => {
  const h = combatHarness();
  h.exec(`
    run={mode:'story',saga:SAGAS.findIndex(s=>s.id==='marineford'),team:[makeChar('luffy5',100)],items:{}};
    startBattle([makeChar('kaido',100,true)],{wild:true});
    clearTimeout(battle.timer);
    battle.curP.spd=100000; battle.curE.spd=1;
    battle.curP.hp=battle.curP.maxhp=1000000;
    battle.curE.hp=battle.curE.maxhp=1000000;
    battle.curP.ultCharge=battle.curE.ultCharge=100;
    const realUltimate=getUltimateMove;
    getUltimateMove=f=>f===battle.curP?{...realUltimate(f),acc:0}:realUltimate(f);
    autoMode=true;
    let finishVisual;
    battle.playerUltimateVisualPromise=new Promise(resolve=>{finishVisual=resolve;});
    runRound();
  `);
  assert.equal(h.exec('battle.lastPlayerUltimateRound'), undefined);
  h.tick();
  assert.equal(h.pending(), 0, 'the enemy waits for the scene');
  h.exec('finishVisual()');
  await Promise.resolve();
  assert.ok(h.exec('battle.curE.ultCharge') < 100, 'the enemy can use its charged ultimate after the miss');
});
