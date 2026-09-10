// Optional real-browser integration: set LOCAL_PLAYWRIGHT_PATH to a Playwright installation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.LOCAL_PLAYWRIGHT_PATH || 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.LOCAL_CHROME_PATH || undefined,
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const base = process.env.LOCAL_TEST_URL || 'http://127.0.0.1:4173';
mkdirSync('outputs', { recursive: true });
const errors = [], checks = [], contexts = [];
async function page(name, mobile = false) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1200, height: 850 }, permissions: ['camera'] }); contexts.push(ctx);
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(name + ': ' + e.message));
  await p.goto(base); await p.locator('#btn-local').click(); await p.locator('#local-name').fill(name); return p;
}
async function imageFrames(p) {
  await p.locator('#pair-output').waitFor({ state: 'attached' });
  await p.waitForFunction(() => document.querySelector('#pair-output')?.value.length > 10);
  await p.locator('#pair-animation').click();
  const count = Number((await p.locator('#pair-frame').textContent()).match(/de (\d+)/)[1]);
  const result = [];
  for (let i = 0; i < count; i++) {
    const data = await p.locator('.local-qr canvas').evaluate(c => c.toDataURL('image/png').split(',')[1]);
    result.push(Buffer.from(data, 'base64')); await p.locator('#pair-next').click();
  }
  return result;
}
async function uploadFrames(p, frames) {
  for (const buffer of frames) { await p.locator('#pair-file').setInputFiles({ name: 'pair.png', mimeType: 'image/png', buffer }); await p.waitForTimeout(350); }
}
async function connect(host, guest, qr = false) {
  await host.locator('#local-invite').click();
  await host.waitForFunction(() => document.querySelector('#pair-output')?.value.length > 10);
  await guest.locator('#local-join').click();
  if (qr) await uploadFrames(guest, await imageFrames(host));
  else { const offer = await host.locator('#pair-output').inputValue(); await guest.locator('details').last().locator('summary').click(); await guest.locator('#pair-input').fill(offer); await guest.locator('#pair-apply').click(); }
  await guest.waitForFunction(() => document.querySelector('#pair-output')?.value.length > 10);
  if (qr) await uploadFrames(host, await imageFrames(guest));
  else { const answer = await guest.locator('#pair-output').inputValue(); await host.locator('details').last().locator('summary').click(); await host.locator('#pair-input').fill(answer); await host.locator('#pair-apply').click(); }
  await guest.locator('#local-ready').waitFor({ timeout: 35000 });
  await host.locator('.local-pair-backdrop').waitFor({ state: 'detached' });
}
try {
  const host = await page('Capitán', true); await host.locator('#local-create').click();
  await host.locator('#local-size').selectOption('1');
  const guest = await page('Nakama', true);
  await connect(host, guest, true);
  checks.push('Real QR images decoded in both directions and WebRTC data channel connected without ICE services');
  console.log(checks.at(-1));
  await host.screenshot({ path: 'outputs/local-lobby-mobile.png', fullPage: true });
  assert.equal(await host.evaluate(() => document.querySelector('.local-game').scrollWidth <= innerWidth), true);
  await host.locator('#local-ready').click(); await guest.locator('#local-ready').click();
  await host.locator('#local-start').click();
  await guest.waitForFunction(() => document.querySelector('.local-log')?.textContent.includes('usa'), { timeout: 20000 });
  await host.screenshot({ path: 'outputs/local-duel-mobile.png' });
  await guest.waitForSelector('.local-result', { timeout: 180000 });
  assert.equal(await host.locator('.local-result h2').textContent(), await guest.locator('.local-result h2').textContent());
  checks.push('PvP completed and both browsers agree on winner');
  console.log(checks.at(-1));
  await host.locator('#local-rematch').click(); await host.locator('#local-mode').selectOption('coop');
  await host.locator('#local-size').selectOption('3');
  await host.locator('#local-ready').click(); await guest.locator('#local-ready').click(); await host.locator('#local-start').click();
  await guest.locator('.local-log').waitFor();
  assert.equal(await guest.locator('.local-fighter').count(), 7);
  await contexts[1].setOffline(true); await host.waitForTimeout(3500);
  assert.equal(await host.locator('.local-warning').count(), 0);
  await guest.close();
  await host.locator('.local-warning').waitFor();
  const paused = await host.locator('.local-panel h3').last().textContent();
  await host.waitForTimeout(2500); assert.equal(await host.locator('.local-panel h3').last().textContent(), paused);
  checks.push('Co-op shows six allied nakamas and a scaled yonko; blocking HTTP preserves the channel; closing the peer pauses the host');
  console.log(checks.at(-1));
  // New session for an eight-player lobby, preserving distinct browser contexts.
  const tournamentHost = await page('Torneo'); await tournamentHost.locator('#local-create').click();
  await tournamentHost.locator('#local-mode').selectOption('tournament'); await tournamentHost.locator('#local-size').selectOption('1');
  const guests = [];
  for (let i = 1; i < 8; i++) { const p = await page('Pirata ' + i); await connect(tournamentHost, p); guests.push(p); }
  assert.equal(await tournamentHost.locator('.local-player').count(), 8);
  await tournamentHost.locator('#local-ready').click(); for (const g of guests) await g.locator('#local-ready').click();
  await tournamentHost.locator('#local-start').click();
  await guests[6].locator('.local-bracket').waitFor();
  assert.equal(await guests[6].locator('.local-match').count(), 4);
  await tournamentHost.screenshot({ path: 'outputs/local-tournament.png', fullPage: true });
  checks.push('Eight independent browser sessions join and start a four-match tournament');
  console.log(checks.at(-1));
  assert.deepEqual(errors, []);
  writeFileSync('outputs/local-browser-report.json', JSON.stringify({ checks, errors, limitation: 'Same machine, isolated browser contexts. Physical cameras and cross-device Wi-Fi still require user testing.' }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally { await browser.close(); }
