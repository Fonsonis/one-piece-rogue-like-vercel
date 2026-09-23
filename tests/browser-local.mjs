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
const rooms = new Map(); let roomCounter = 0, joinCounter = 0;
function codeFor(index) { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let value = index, code = ''; for (let i = 0; i < 8; i++) { code = alphabet[value % alphabet.length] + code; value = Math.floor(value / alphabet.length); } return code; }
function signal(body) {
  if (body.action === 'create') { const code = codeFor(++roomCounter), hostSecret = `host-${roomCounter}`; rooms.set(code, { hostSecret, joins: new Map() }); return { ok: true, code, hostSecret }; }
  const code = String(body.code || '').replace(/-/g, ''), room = rooms.get(code);
  if (!room) return { ok: false, error: 'No se encuentra esa sala.' };
  if (body.action === 'join') { const joinId = `join-${++joinCounter}`, guestSecret = `guest-${joinCounter}`; room.joins.set(joinId, { guestSecret, status: 'waiting' }); return { ok: true, code, joinId, guestSecret }; }
  if (['host-poll','offer','complete','reject','close'].includes(body.action) && body.hostSecret !== room.hostSecret) return { ok: false, error: 'Sala caducada.' };
  const join = room.joins.get(body.joinId);
  if (body.action === 'host-poll') return { ok: true, code, joins: [...room.joins].map(([joinId, value]) => ({ joinId, status: value.status, answer: value.answer })) };
  if (body.action === 'offer') { Object.assign(join, { status: 'offered', offer: body.offer }); return { ok: true, code }; }
  if (['guest-poll','answer','cancel'].includes(body.action) && join?.guestSecret !== body.guestSecret) return { ok: false, error: 'Solicitud caducada.' };
  if (body.action === 'guest-poll') return { ok: true, code, status: join.status, offer: join.offer, reason: join.reason };
  if (body.action === 'answer') { Object.assign(join, { status: 'answered', answer: body.answer }); return { ok: true, code }; }
  if (body.action === 'complete' || body.action === 'cancel') { room.joins.delete(body.joinId); return { ok: true, code }; }
  if (body.action === 'reject') { Object.assign(join, { status: 'rejected', reason: body.reason }); return { ok: true, code }; }
  if (body.action === 'close') { rooms.delete(code); return { ok: true, code }; }
  return { ok: false, error: 'Operación inválida.' };
}
async function page(name, mobile = false) {
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1200, height: 850 } }); contexts.push(ctx);
  await ctx.route('**/api/multiplayer', async route => {
    const result = signal(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: result.ok ? 200 : 404, contentType: 'application/json', body: JSON.stringify(result) });
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(name + ': ' + e.message));
  await p.goto(base);
  await p.evaluate(() => { meta.roster = ['luffy','zoro','nami','sanji','usopp','chopper']; });
  await p.locator('#btn-local').click(); await p.locator('#local-name').fill(name); return p;
}
async function connect(host, guest) {
  const code = await host.locator('.local-room-code strong').textContent();
  await guest.locator('#local-code').fill(code); await guest.locator('#local-join').click();
  await guest.locator('#local-ready').waitFor({ timeout: 35000 });
}
try {
  const host = await page('Capitán', true); await host.locator('#local-create').click();
  await host.locator('#local-size').selectOption('1');
  const guest = await page('Nakama', true);
  await connect(host, guest);
  assert.equal(await guest.locator('[data-pick="0"] option').count(), 6);
  assert.equal(await guest.locator('[data-pick="0"] option[value="kaido"]').count(), 0);
  await guest.locator('[data-pick="0"]').selectOption('zoro');
  checks.push('Room code signaling connected a direct WebRTC data channel without ICE services');
  console.log(checks.at(-1));
  await host.screenshot({ path: 'outputs/local-lobby-mobile.png', fullPage: true });
  assert.equal(await host.evaluate(() => document.querySelector('.local-game').scrollWidth <= innerWidth), true);
  await host.locator('#local-ready').click(); await guest.locator('#local-ready').click();
  await host.locator('#local-start').click();
  await guest.waitForFunction(() => document.querySelector('#battle-log')?.textContent.includes('usa'), null, { timeout: 20000 });
  assert.equal(await guest.locator('#side-p .fcard.active .fcard-sprite').getAttribute('data-character'), 'zoro');
  assert.equal(await host.locator('#side-p .fcard.active .fcard-sprite').getAttribute('data-character'), 'luffy');
  await guest.waitForFunction(() => !!document.querySelector('#local-arena [data-motion]'), null, { timeout: 10000 });
  await host.waitForFunction(() => !!document.querySelector('#local-arena [data-motion]'), null, { timeout: 10000 });
  await host.screenshot({ path: 'outputs/local-duel-mobile.png' });
  await guest.waitForSelector('.local-result', { timeout: 180000 });
  assert.equal(await host.locator('.local-result h2').textContent(), await guest.locator('.local-result h2').textContent());
  checks.push('PvP completed and both browsers agree on winner');
  console.log(checks.at(-1));
  await host.locator('#local-rematch').click(); await host.locator('#local-mode').selectOption('coop');
  await host.locator('#local-size').selectOption('3');
  await host.locator('#local-ready').click(); await guest.locator('#local-ready').click(); await host.locator('#local-start').click();
  await guest.locator('#battle-log').waitFor();
  assert.equal(await guest.locator('#local-arena .fcard').count(), 7);
  await contexts[1].setOffline(true); await host.waitForTimeout(3500);
  assert.equal(await host.locator('.local-warning').count(), 0);
  await guest.close();
  await host.locator('.local-warning').waitFor();
  const paused = await host.locator('.local-turn').textContent();
  await host.waitForTimeout(2500); assert.equal(await host.locator('.local-turn').textContent(), paused);
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
