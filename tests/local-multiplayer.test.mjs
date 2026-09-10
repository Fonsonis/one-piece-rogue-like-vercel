import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { combatHarness } from './balance-harness.mjs';
import { encodeSignal, decodeSignal, qrFrames, FrameCollector, LocalLink } from '../public/local/connection.mjs';
import { LocalSession, bracketPairs, validView, RULES } from '../public/local/session.mjs';

function engine() {
  const h = combatHarness();
  // The harness normally suppresses log(), so restore the local log capture for these tests.
  h.exec(`log = msg => { if (battle?.opts?.local) { battle.lines.push(msg.replace(/<[^>]*>/g,'')); battle.lines = battle.lines.slice(-12); } };`);
  h.exec(fs.readFileSync('public/local/combat.js', 'utf8'));
  return { h, api: h.exec('LocalCombat') };
}
const guestId = n => n.toString(16).padStart(32, '0');
const player = (id, size = 1) => ({ id, team: ['luffy', 'zoro', 'nami', 'sanji', 'usopp', 'chopper'].slice(0, size) });
test('local combat supports 1/3/6 teams without changing story, meta, timers or storage', () => {
  const { h, api } = engine();
  h.exec(`run={mode:'nuzlocke',diff:5,team:[makeChar('brook',30)],items:{}};battle={sentinel:true};`);
  const before = h.exec('JSON.stringify({run,meta,battle})');
  for (const size of [1, 3, 6]) {
    const b = api.create([player('host', size), player(guestId(1), size)]);
    assert.deepEqual(Array.from(b.pTeam, f => f.id), player('host', size).team);
    assert.deepEqual(Array.from(b.eTeam, f => f.id), player(guestId(1), size).team);
    assert.equal(b.pTeam[0].maxhp, b.eTeam[0].maxhp);
    for (let step = 0; !b.over && step < 500; step++) api.tick(b);
    assert.ok(b.over); assert.ok(['p', 'e', 'draw'].includes(b.winner));
    assert.equal(b.pTeam[0].lvl, 30); assert.equal(b.eTeam[0].lvl, 30);
  }
  assert.equal(h.exec('JSON.stringify({run,meta,battle})'), before);
});
test('both sides charge ultimates; commands belong to the active owner and consume one charge', () => {
  const { api } = engine(), b = api.create([player('host'), player(guestId(1))]);
  b.eTeam[0].ultCharge = 100;
  assert.equal(api.command(b, guestId(2), 'ultimate'), false);
  assert.equal(api.command(b, guestId(1), 'ultimate'), true);
  assert.equal(api.command(b, guestId(1), 'ultimate'), false);
  api.tick(b);
  assert.ok(b.eTeam[0].ultCharge < 100);
});
test('co-op scales the yonko with players and crew sizes, and every active player participates', () => {
  const { api } = engine();
  const two = api.create([player('host'), player(guestId(1))], { mode: 'coop', boss: 'kaido' });
  const eight = api.create(Array.from({ length: 8 }, (_, i) => player(i ? guestId(i) : 'host', 6)), { mode: 'coop', boss: 'kaido' });
  assert.equal(eight.pTeam.length, 48); assert.ok(eight.eTeam[0].maxhp > two.eTeam[0].maxhp * 10);
  api.tick(eight); assert.equal(eight.localActors.length, 9);
  assert.equal(new Set(eight.localActors.filter(f => f.owner !== 'yonko').map(f => f.owner)).size, 8);
  for (let i = 0; !two.over && i < 500; i++) api.tick(two);
  assert.ok(two.over);
});
test('brackets cover every player once and handle byes for 3–8 entrants', () => {
  for (let n = 3; n <= 8; n++) {
    const ids = Array.from({ length: n }, (_, i) => String(i));
    const pairs = bracketPairs(ids, () => .5);
    assert.deepEqual(pairs.flat().filter(Boolean).sort(), ids.sort());
    assert.ok(pairs.every(pair => pair.some(Boolean)));
  }
});
function room(n = 2) {
  let time = 10000;
  const { api } = engine();
  const s = new LocalSession({ host: true, name: 'Host', engine: api, now: () => time });
  s.configure({ mode: n > 2 ? 'tournament' : 'duel', size: 1 });
  for (let i = 1; i < n; i++) { s.addPeer(guestId(i), () => true); s.receive(guestId(i), { type: 'hello', rules: RULES, name: 'Pirata ' + i }); }
  const heartbeat = () => { for (let i = 1; i < n; i++) s.receive(guestId(i), { type: 'ping', visible: true }); };
  return { s, api, heartbeat, advance: (ms = 2500) => { time += ms; } };
}
test('a full eight-player tournament reaches a champion with seven completed matches', () => {
  const { s, api, heartbeat, advance } = room(8);
  for (const p of s.view.players) s.receive(p.id, { type: 'ready', ready: true });
  s.start();
  for (let i = 0; i < 1000 && s.view.phase !== 'finished'; i++) {
    advance(); heartbeat(); s.pulse();
    assert.equal(validView(JSON.parse(JSON.stringify(s.view)), api), true);
    if (s.view.phase === 'round-end') s.nextRound();
  }
  assert.equal(s.view.phase, 'finished'); assert.ok(s.view.champion);
  assert.equal(s.view.matches.filter(m => ['done', 'bye'].includes(m.status)).length, 7);
});
test('readiness, changed settings, malformed packets, pause and recovery are enforced by host', () => {
  const { s, heartbeat, advance } = room();
  assert.throws(() => s.start(), /listos/);
  s.receive(guestId(1), { type: 'select', team: ['__proto__'] });
  assert.equal(s.view.players[1].team[0], 'luffy');
  for (const p of s.view.players) s.receive(p.id, { type: 'ready', ready: true });
  s.configure({ size: 3 }); assert.ok(s.view.players.every(p => !p.ready));
  for (const p of s.view.players) s.receive(p.id, { type: 'ready', ready: true });
  s.start(); advance(8000); s.pulse();
  assert.equal(s.view.paused, true); assert.equal(s.view.matches[0].battle.round, 1);
  heartbeat(); advance(10); s.pulse(); assert.equal(s.view.paused, false);
  assert.ok(s.view.matches[0].battle.round > 1);
  s.receive(guestId(1), { type: 'ping', visible: false }); s.pulse(); assert.equal(s.view.paused, true);
});
const signal = { v: 1, type: 'offer', room: 'a'.repeat(32), link: 'b'.repeat(32), sdp: 'v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\na=fingerprint:sha-256 AA:BB\r\na=ice-ufrag:test\r\na=candidate:1 1 udp 2122260223 192.168.1.10 50000 typ host\r\n' };
test('QR token roundtrip rejects corrupt data and nonlocal candidates', async () => {
  const token = await encodeSignal(signal); assert.deepEqual(await decodeSignal(token), signal);
  await assert.rejects(decodeSignal('not a code'));
  await assert.rejects(decodeSignal(await encodeSignal({ ...signal, sdp: signal.sdp.replace('typ host', 'typ relay') })));
  await assert.rejects(decodeSignal(await encodeSignal({ ...signal, type: 'bad' })));
  const collector = new FrameCollector();
  const longToken = 'OPL1.' + 'a'.repeat(2200), frames = await qrFrames(longToken);
  let result;
  for (const frame of [...frames].reverse()) result = await collector.add(frame);
  assert.equal(result.token, longToken);
  assert.equal((await collector.add(frames[0])).token, longToken);
  const other = await qrFrames('OPL1.' + 'b'.repeat(1500));
  result = await collector.add(other[0]); assert.equal(result.received, 1);
});
test('WebRTC is constructed with no ICE services and checks answer identity', async () => {
  let configuration;
  class Peer { constructor(config) { configuration = config; this.signalingState = 'have-local-offer'; } close() {} }
  const link = new LocalLink({ Peer });
  assert.deepEqual(configuration.iceServers, []);
  await assert.rejects(link.accept({ ...signal, type: 'answer' }), /otra invitación/); link.close();
});
test('bundled QR generator and decoder roundtrip the actual pairing frame image', async () => {
  const context = vm.createContext({ Uint8ClampedArray, Uint8Array, Int32Array, Uint32Array, Float64Array, Math });
  vm.runInContext(fs.readFileSync('public/local/vendor/qrcode.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('public/local/vendor/jsQR.js', 'utf8'), context);
  const token = await encodeSignal(signal), frame = (await qrFrames(token))[0];
  const qr = context.qrcode(0, 'M'); qr.addData(frame); qr.make();
  const count = qr.getModuleCount(), scale = 5, width = (count + 8) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) if (qr.isDark(y, x)) {
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const at = (((y + 4) * scale + dy) * width + (x + 4) * scale + dx) * 4;
      pixels[at] = pixels[at + 1] = pixels[at + 2] = 0;
    }
  }
  assert.equal(context.jsQR(pixels, width, width).data, frame);
});
