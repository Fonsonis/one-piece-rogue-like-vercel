import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LOCAL_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.LOCAL_CHROME_PATH || undefined });
try {
  const ctx = await browser.newContext(); const page = await ctx.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.LOCAL_TEST_URL || 'http://127.0.0.1:4173');
  await page.locator('#btn-offline').click(); await page.locator('#offline-start').click();
  await page.waitForFunction(() => document.querySelector('#offline-status')?.textContent.startsWith('Copia lista.'), null, { timeout: 90000 });
  const caches = await page.evaluate(async () => {
    const names = await window.caches.keys();
    const active = await (await window.caches.open('oplike-offline-meta')).match('/__oplike_offline_active__');
    const name = await active.text(); return { names, count: (await (await window.caches.open(name)).keys()).length };
  });
  assert.ok(caches.count > 1000); await ctx.setOffline(true); await page.reload();
  await page.locator('#btn-local').click(); await page.locator('#local-create').click();
  await page.waitForFunction(() => document.querySelector('#local-notice')?.textContent.includes('Internet'));
  assert.equal(await page.locator('.local-room-code').count(), 0);
  assert.deepEqual(errors, []);
  const report = { cachedFiles: caches.count, offlineReload: true, multiplayerRequiresInternet: true, errors };
  writeFileSync('outputs/local-offline-report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { await browser.close(); }
