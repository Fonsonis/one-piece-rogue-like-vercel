import test from 'node:test';
import assert from 'node:assert/strict';
import { claimYonkoReward, yonkoRewardState, yonkoRewardForSize } from '../public/local/rewards.mjs';

const day = new Date(2026, 8, 22, 23, 59);
const win = (n, size = 3) => ({ mode: 'coop', size, phase: 'finished', champion: 'alliance', matches: [{
  status: 'done', winner: 'alliance', rewardId: `${'a'.repeat(32)}:match-${n}`, players: ['host', 'guest'],
  battle: { over: true, winner: 'p', pTeam: ['host', 'guest'].flatMap(owner => Array.from({ length: size }, () => ({ owner }))), eTeam: [{ owner: 'yonko' }] },
}] });
const account = () => ({ fame: 50, accXp: 70, logPoses: 30 });

test('yonko reward grants each account exactly once per completed alliance win', () => {
  const host = account(), guest = account(); let hostWrites = 0, guestWrites = 0;
  assert.equal(claimYonkoReward(host, win(1), () => { hostWrites++; return true; }, day).kind, 'granted');
  assert.equal(claimYonkoReward(guest, win(1), () => { guestWrites++; return true; }, day).kind, 'granted');
  assert.deepEqual([host.fame, host.accXp, host.logPoses], [10050, 10070, 100030]);
  assert.deepEqual([guest.fame, guest.accXp, guest.logPoses], [10050, 10070, 100030]);
  assert.equal(claimYonkoReward(host, win(1), () => { hostWrites++; return true; }, day).kind, 'already');
  assert.deepEqual([hostWrites, guestWrites], [1, 1]);
});

test('yonko rewards scale by chosen crew size', () => {
  assert.deepEqual(yonkoRewardForSize(1), { logPoses: 500000, fame: 25000 });
  assert.deepEqual(yonkoRewardForSize(3), { logPoses: 100000, fame: 10000 });
  assert.deepEqual(yonkoRewardForSize(6), { logPoses: 10000, fame: 1000 });
  const solo = account(), full = account();
  assert.equal(claimYonkoReward(solo, win(11, 1), () => true, day).kind, 'granted');
  assert.equal(claimYonkoReward(full, win(12, 6), () => true, day).kind, 'granted');
  assert.deepEqual([solo.fame, solo.accXp, solo.logPoses], [25050, 25070, 500030]);
  assert.deepEqual([full.fame, full.accXp, full.logPoses], [1050, 1070, 10030]);
  assert.equal(claimYonkoReward(account(), win(13, 2), () => true, day).kind, 'not-earned');
});

test('at most four wins pay per local day and a new local day renews the allowance', () => {
  const meta = account(), writes = [];
  for (let n = 1; n <= 4; n++) assert.equal(claimYonkoReward(meta, win(n), () => { writes.push(n); return true; }, day).kind, 'granted');
  assert.equal(claimYonkoReward(meta, win(5), () => { writes.push(5); return true; }, day).kind, 'limit');
  assert.deepEqual(writes, [1, 2, 3, 4]);
  assert.deepEqual([meta.fame, meta.accXp, meta.logPoses], [40050, 40070, 400030]);
  const tomorrow = new Date(2026, 8, 23, 0, 1);
  assert.deepEqual(yonkoRewardState(meta.localYonkoReward, tomorrow).claims, []);
  assert.equal(claimYonkoReward(meta, win(5), () => true, tomorrow).kind, 'granted');
  assert.equal(claimYonkoReward(meta, win(1), () => true, tomorrow).kind, 'already');
});

test('losses, draws, PvP and unfinished combat never pay', () => {
  const meta = account(); let writes = 0;
  const cases = [
    { ...win(1), champion: 'yonko' },
    { ...win(1), champion: 'draw' },
    { ...win(1), mode: 'duel' },
    { ...win(1), mode: 'tournament' },
    { ...win(1), phase: 'playing' },
    { ...win(1), matches: [{ ...win(1).matches[0], status: 'playing' }] },
    { ...win(1), matches: [{ ...win(1).matches[0], battle: { ...win(1).matches[0].battle, over: false } }] },
    { ...win(1), matches: [{ ...win(1).matches[0], battle: { ...win(1).matches[0].battle, pTeam: [{ owner: 'host' }] } }] },
  ];
  for (const view of cases) assert.equal(claimYonkoReward(meta, view, () => { writes++; return true; }, day).kind, 'not-earned');
  assert.equal(writes, 0); assert.deepEqual(meta, account());
});

test('failed persistence rolls all balances and claim history back', () => {
  const meta = account();
  assert.equal(claimYonkoReward(meta, win(1), () => false, day).kind, 'save-failed');
  assert.deepEqual(meta, { ...account(), localYonkoReward: undefined });
  assert.equal(claimYonkoReward(meta, win(1), () => { throw Error('Quota'); }, day).kind, 'save-failed');
  assert.equal(claimYonkoReward(meta, win(1), () => true, day).kind, 'granted');
});
