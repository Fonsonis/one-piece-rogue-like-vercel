import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiplayerService, ServiceError } from '../server/multiplayer-service.mjs';
import { formatRoomCode, normalizeRoomCode, roomSignal, signalingEndpoint } from '../public/local/signaling.mjs';

function fakeRedis() {
  const values = new Map(), lists = new Map();
  const command = async ([operation, key, ...args]) => {
    switch (operation) {
      case 'GET': return values.get(key) ?? null;
      case 'SET': {
        const [value, ...options] = args;
        if (options.includes('NX') && values.has(key)) return null;
        values.set(key, value); return 'OK';
      }
      case 'LLEN': return (lists.get(key) || []).length;
      case 'RPUSH': { const list = lists.get(key) || []; list.push(...args); lists.set(key, list); return list.length; }
      case 'LRANGE': return [...(lists.get(key) || [])];
      case 'MGET': return [key, ...args].map(item => values.get(item) ?? null);
      case 'LREM': {
        const target = args[1], list = lists.get(key) || [], kept = list.filter(value => value !== target);
        lists.set(key, kept); return list.length - kept.length;
      }
      case 'DEL': { let count = 0; for (const item of [key, ...args]) { count += values.delete(item) ? 1 : 0; count += lists.delete(item) ? 1 : 0; } return count; }
      case 'EXPIRE': return values.has(key) || lists.has(key) ? 1 : 0;
      default: throw new Error(`Unsupported fake Redis command: ${operation}`);
    }
  };
  return { command, values, lists };
}

function deterministicBytes() {
  let value = 0;
  return size => Buffer.alloc(size, ++value);
}

const protocol = 'egghead-local-4';
const offer = 'OPL1.' + 'a'.repeat(80);
const answer = 'OPL1.' + 'b'.repeat(80);

test('room codes are normalized, formatted and use the correct endpoint per platform', () => {
  assert.equal(normalizeRoomCode('ab-cd 2345!'), 'ABCD2345');
  assert.equal(formatRoomCode('abcd2345'), 'ABCD-2345');
  assert.equal(signalingEndpoint({ protocol: 'https:', hostname: 'game.example', origin: 'https://game.example' }), 'https://game.example/api/multiplayer');
  assert.equal(signalingEndpoint({ protocol: 'http:', hostname: '127.0.0.1', origin: 'http://127.0.0.1:4173' }), 'http://127.0.0.1:4173/api/multiplayer');
  assert.equal(signalingEndpoint({ protocol: 'oprl:', hostname: 'game', origin: 'null' }), 'https://one-piece-rogue-like-vercel.vercel.app/api/multiplayer');
  assert.equal(signalingEndpoint({ protocol: 'https:', hostname: 'localhost', origin: 'https://localhost' }, true), 'https://one-piece-rogue-like-vercel.vercel.app/api/multiplayer');
});

test('room signaling converts API and connectivity failures into useful messages', async () => {
  const ok = await roomSignal('create', {}, { endpoint: '/api/test', fetcher: async () => ({ ok: true, json: async () => ({ ok: true, code: 'ABCDEFGH' }) }) });
  assert.equal(ok.code, 'ABCDEFGH');
  await assert.rejects(roomSignal('join', {}, { endpoint: '/api/test', fetcher: async () => ({ ok: false, json: async () => ({ ok: false, error: 'Sala inexistente.' }) }) }), /Sala inexistente/);
  await assert.rejects(roomSignal('join', {}, { endpoint: '/api/test', fetcher: async () => { throw new TypeError('offline'); } }), /Internet/);
});

test('host and guest complete an authenticated offer-answer exchange', async () => {
  const redis = fakeRedis(), service = createMultiplayerService({ command: redis.command, bytes: deterministicBytes() });
  const created = await service('create', { protocol });
  assert.match(created.code, /^[A-Z2-9]{8}$/); assert.equal(created.hostSecret.length, 32);
  assert.equal([...redis.values.values()].some(value => String(value).includes(created.hostSecret)), false);

  const joined = await service('join', { code: created.code, protocol });
  assert.equal(joined.guestSecret.length, 32);
  assert.equal([...redis.values.values()].some(value => String(value).includes(joined.guestSecret)), false);
  let host = await service('host-poll', { code: created.code, hostSecret: created.hostSecret });
  assert.deepEqual(host.joins, [{ joinId: joined.joinId, status: 'waiting', answer: undefined }]);

  await service('offer', { code: created.code, hostSecret: created.hostSecret, joinId: joined.joinId, offer });
  await service('offer', { code: created.code, hostSecret: created.hostSecret, joinId: joined.joinId, offer });
  const guest = await service('guest-poll', { code: created.code, joinId: joined.joinId, guestSecret: joined.guestSecret });
  assert.equal(guest.status, 'offered'); assert.equal(guest.offer, offer);
  await service('answer', { code: created.code, joinId: joined.joinId, guestSecret: joined.guestSecret, answer });
  await service('answer', { code: created.code, joinId: joined.joinId, guestSecret: joined.guestSecret, answer });
  host = await service('host-poll', { code: created.code, hostSecret: created.hostSecret });
  assert.equal(host.joins[0].answer, answer);
  await service('complete', { code: created.code, hostSecret: created.hostSecret, joinId: joined.joinId });
  assert.deepEqual((await service('host-poll', { code: created.code, hostSecret: created.hostSecret })).joins, []);
});

test('rooms reject incompatible versions, forged credentials and replaced answers', async () => {
  const redis = fakeRedis(), service = createMultiplayerService({ command: redis.command, bytes: deterministicBytes() });
  const created = await service('create', { protocol });
  await assert.rejects(service('join', { code: created.code, protocol: 'egghead-local-3' }), error => error instanceof ServiceError && error.status === 409);
  const joined = await service('join', { code: created.code, protocol });
  await assert.rejects(service('host-poll', { code: created.code, hostSecret: 'A'.repeat(32) }), /caducado/);
  await service('offer', { code: created.code, hostSecret: created.hostSecret, joinId: joined.joinId, offer });
  await service('answer', { code: created.code, joinId: joined.joinId, guestSecret: joined.guestSecret, answer });
  await assert.rejects(service('answer', { code: created.code, joinId: joined.joinId, guestSecret: joined.guestSecret, answer: offer }), error => error.status === 409);
  await service('close', { code: created.code, hostSecret: created.hostSecret });
  await assert.rejects(service('join', { code: created.code, protocol }), error => error.status === 404);
});
