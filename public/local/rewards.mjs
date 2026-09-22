export const YONKO_REWARD = Object.freeze({ logPoses: 100000, fame: 10000, dailyLimit: 4 });

const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const validId = id => typeof id === 'string' && /^[a-f0-9]{32}:match-\d+$/.test(id);

export function yonkoRewardState(value, now = new Date()) {
  const date = dayKey(now);
  const claims = value?.date === date && Array.isArray(value.claims) ? value.claims.filter(validId).slice(0, YONKO_REWARD.dailyLimit) : [];
  const recentIds = Array.isArray(value?.recentIds) ? value.recentIds.filter(validId).slice(-32) : [];
  return { date, claims: [...new Set(claims)], recentIds: [...new Set(recentIds)] };
}

export function claimYonkoReward(meta, view, persist, now = new Date()) {
  if (view?.mode !== 'coop' || view.phase !== 'finished' || view.champion !== 'alliance') return { kind: 'not-earned' };
  const match = view.matches?.find(m => m.status === 'done' && m.winner === 'alliance' && validId(m.rewardId));
  if (!match) return { kind: 'not-earned' };
  const state = yonkoRewardState(meta.localYonkoReward, now);
  if (state.claims.includes(match.rewardId) || state.recentIds.includes(match.rewardId)) return { kind: 'already', count: state.claims.length };
  if (state.claims.length >= YONKO_REWARD.dailyLimit) return { kind: 'limit', count: state.claims.length };

  const previous = { fame: meta.fame, accXp: meta.accXp, logPoses: meta.logPoses, localYonkoReward: meta.localYonkoReward };
  meta.fame = (Number(meta.fame) || 0) + YONKO_REWARD.fame;
  meta.accXp = (Number(meta.accXp) || 0) + YONKO_REWARD.fame;
  meta.logPoses = (Number(meta.logPoses) || 0) + YONKO_REWARD.logPoses;
  meta.localYonkoReward = { date: state.date, claims: [...state.claims, match.rewardId], recentIds: [...state.recentIds, match.rewardId].slice(-32) };
  try {
    if (persist() === true) return { kind: 'granted', count: meta.localYonkoReward.claims.length };
  } catch { /* A failed write must not leave a reward in memory. */ }
  Object.assign(meta, previous);
  return { kind: 'save-failed', count: state.claims.length };
}
