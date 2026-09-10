import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LOCAL_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.LOCAL_CHROME_PATH || undefined });
const errors = [];
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    const page = await browser.newPage({ viewport }); page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.LOCAL_TEST_URL || 'http://127.0.0.1:4173');
    await page.evaluate(() => {
      const crew = ['luffy','zoro','nami','sanji','usopp','chopper'];
      const fight = LocalCombat.create([{ id: 'host', team: crew }, { id: 'guest', team: crew }]);
      [...fight.pTeam,...fight.eTeam].forEach(f => { f.maxhp = f.hp = 10000; });
      const container = document.createElement('div'); container.className = 'local-game'; container.innerHTML = '<div id="local-arena"></div>'; document.body.append(container);
      const root = container.firstChild; document.body.style.overflow = 'hidden';
      const session = { self: 'host', view: { mode: 'duel', paused: false }, ultimate: () => LocalCombat.command(fight,'host','ultimate'), relay: (id, index) => LocalCombat.command(fight,'host','relay',index) };
      const match = { id: 'match-1', battle: LocalCombat.snapshot(fight) };
      const render = () => {
        match.battle = LocalCombat.snapshot(fight);
        const previous = Math.random;
        Math.random = () => { throw Error('La presentación no debe simular azar.'); };
        try { LocalBattleView.update(root, match, session, id => id); } finally { Math.random = previous; }
      };
      render(); window.fixture = { fight, root, render, session };
    });
    assert.equal(await page.locator('.battle-reserve').count(), 6);
    await page.evaluate(() => {
      const { fight, render, root } = fixture;
      window.previousStage = root.querySelector('#fc-p-0 .fcard-sprite');
      fight.pTeam[0].ultCharge = 100; LocalCombat.command(fight,'host','ultimate'); LocalCombat.tick(fight); render();
    });
    await page.locator('.ultimate-scene canvas').waitFor();
    assert.equal(await page.evaluate(() => Number(getComputedStyle(document.querySelector('.ultimate-scene')).zIndex) > Number(getComputedStyle(document.querySelector('.local-game')).zIndex)), true);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => previousStage === fixture.root.querySelector('#fc-p-0 .fcard-sprite')), true);
    await page.screenshot({ path: `outputs/local-ultimate-${viewport.width}.png`, fullPage: true });
    await page.evaluate(() => { LocalCombat.tick(fixture.fight); fixture.render(); });
    assert.equal(await page.evaluate(() => previousStage === fixture.root.querySelector('#fc-p-0 .fcard-sprite')), true);
    await page.locator('[data-reserve="1"]').click();
    await page.evaluate(() => fixture.render());
    assert.equal(await page.locator('#side-p .fcard.active .fcard-sprite').getAttribute('data-character'), 'zoro');
    assert.equal(await page.locator('.battle-reserve:not([disabled])').count(), 0);
    const bounds = await page.locator('.battle-cols').boundingBox();
    assert.ok(bounds.width <= viewport.width && bounds.height >= 300);
    assert.equal(await page.evaluate(() => document.querySelector('.local-game').scrollWidth <= innerWidth), true);
    await page.evaluate(() => fixture.root.parentElement.remove());
    await page.waitForFunction(() => !document.querySelector('.ultimate-scene'));
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('Shared battle layout, six reserves, ultimate effects, stable sprite nodes, relay and cleanup verified at 390 and 1440 px; rendering consumes no RNG.');
} finally { await browser.close(); }
