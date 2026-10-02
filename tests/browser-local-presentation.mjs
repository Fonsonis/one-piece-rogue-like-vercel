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
    await page.evaluate(() => {
      const fight = LocalCombat.create([{ id: 'host', team: ['luffy'] }, { id: 'guest', team: ['zoro'] }], { mode: 'coop', boss: 'kaido' });
      [...fight.pTeam, ...fight.eTeam].forEach(f => { f.maxhp = f.hp = 1000000; });
      const container = document.createElement('div'); container.className = 'local-game'; container.innerHTML = '<div id="local-arena"></div>'; document.body.append(container);
      const root = container.firstChild;
      const session = { self: 'host', view: { mode: 'coop', paused: false }, ultimate: () => {}, relay: () => {} };
      const match = { id: 'coop-match', battle: LocalCombat.snapshot(fight) };
      const render = () => { match.battle = LocalCombat.snapshot(fight); LocalBattleView.update(root, match, session, id => id); };
      render(); window.coopFixture = { fight, root, render };
    });
    assert.equal(await page.locator('.local-coop #side-p .fcard.active').count(), 2);
    assert.equal(await page.evaluate(() => {
      const side = document.querySelector('.local-coop #side-p').getBoundingClientRect();
      const cards = [...document.querySelectorAll('.local-coop #side-p .fcard.active')].map(card => card.getBoundingClientRect());
      return cards[0].right <= cards[1].left + 1 && cards.every(card => card.left >= side.left && card.right <= side.right);
    }), true);
    await page.evaluate(() => {
      const { fight, render } = coopFixture;
      fight.pTeam.forEach(f => { f.ultCharge = 100; });
      LocalCombat.command(fight, 'host', 'ultimate'); LocalCombat.command(fight, 'guest', 'ultimate');
      LocalCombat.tick(fight); render();
    });
    await page.waitForFunction(() => document.querySelectorAll('.ultimate-scene').length === 2);
    assert.equal(await page.locator('.local-coop #side-p .fcard.active').count(), 2);
    await page.evaluate(() => coopFixture.root.parentElement.remove());
    await page.waitForFunction(() => !document.querySelector('.ultimate-scene'));
    await page.evaluate(() => {
      const fight = LocalCombat.create([
        { id: 'host', team: ['luffy'] }, { id: 'guest', team: ['zoro'] }, { id: 'third', team: ['nami'] },
      ], { mode: 'coop', boss: 'kaido' });
      const container = document.createElement('div'); container.className = 'local-game'; container.innerHTML = '<div id="local-arena"></div>'; document.body.append(container);
      const root = container.firstChild;
      LocalBattleView.update(root, { id: 'coop-three', battle: LocalCombat.snapshot(fight) },
        { self: 'host', view: { mode: 'coop', paused: false }, ultimate: () => {}, relay: () => {} }, id => id);
      window.threePlayerRoot = root;
    });
    assert.equal(await page.locator('.local-coop #side-p .fcard.active').count(), 3);
    assert.equal(await page.evaluate(() => {
      const slots = threePlayerRoot.querySelector('.local-coop-slots');
      const fits = slots.scrollWidth > slots.clientWidth && threePlayerRoot.parentElement.scrollWidth <= innerWidth;
      slots.scrollLeft = slots.scrollWidth - slots.clientWidth;
      const last = slots.querySelector('.fcard.active:last-child').getBoundingClientRect();
      const bounds = slots.getBoundingClientRect();
      return fits && last.left >= bounds.left && last.right <= bounds.right + 1;
    }), true);
    await page.evaluate(() => threePlayerRoot.parentElement.remove());
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log('Shared battle layout, six reserves, two stable cooperative slots, scrollable larger alliance, simultaneous ultimates, relay and cleanup verified at 390 and 1440 px; rendering consumes no RNG.');
} finally { await browser.close(); }
