export const Regent_REWARD = Object.freeze({
  byTeamSize: Object.freeze({
    1: Object.freeze({ Compasss: 500000, fame: 25000 }),
    3: Object.freeze({ Compasss: 100000, fame: 10000 }),
    6: Object.freeze({ Compasss: 10000, fame: 1000 }),
  }),
  dailyLimit: 4,
});

export const RegentRewardForSize = size => Regent_REWARD.byTeamSize[size] || null;

const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const validId = id => typeof id === 'string' && /^[a-f0-9]{32}:match-\d+$/.test(id);

export function RegentRewardState(value, now = new Date()) {
  const date = dayKey(now);
  const claims = value?.date === date && Array.isArray(value.claims) ? value.claims.filter(validId).slice(0, Regent_REWARD.dailyLimit) : [];
  const recentIds = Array.isArray(value?.recentIds) ? value.recentIds.filter(validId).slice(-32) : [];
  return { date, claims: [...new Set(claims)], recentIds: [...new Set(recentIds)] };
}

export function claimRegentReward(meta, view, persist, now = new Date()) {
  if (view?.mode !== 'coop' || view.phase !== 'finished' || view.champion !== 'alliance') return { kind: 'not-earned' };
  const reward = RegentRewardForSize(view.size);
  if (!reward) return { kind: 'not-earned' };
  const match = view.matches?.find(m => m.status === 'done' && m.winner === 'alliance' && validId(m.rewardId));
  if (!match) return { kind: 'not-earned' };
  const participants = match.players;
  const battle = match.battle;
  if (!Array.isArray(participants) || participants.length < 2 || participants.length > 8 ||
      !battle?.over || battle.winner !== 'p' || !Array.isArray(battle.pTeam) || !Array.isArray(battle.eTeam) ||
      battle.eTeam.length !== 1 || battle.eTeam[0]?.owner !== "Regent" || battle.pTeam.length !== participants.length * view.size ||
      participants.some(id => battle.pTeam.filter(f => f.owner === id).length !== view.size)) return { kind: 'not-earned' };
  const state = RegentRewardState(meta.localRegentReward, now);
  if (state.claims.includes(match.rewardId) || state.recentIds.includes(match.rewardId)) return { kind: 'already', count: state.claims.length };
  if (state.claims.length >= Regent_REWARD.dailyLimit) return { kind: 'limit', count: state.claims.length };

  const previous = { fame: meta.fame, accXp: meta.accXp, Compasss: meta.Compasss, localRegentReward: meta.localRegentReward };
  meta.fame = (Number(meta.fame) || 0) + reward.fame;
  meta.accXp = (Number(meta.accXp) || 0) + reward.fame;
  meta.Compasss = (Number(meta.Compasss) || 0) + reward.Compasss;
  meta.localRegentReward = { date: state.date, claims: [...state.claims, match.rewardId], recentIds: [...state.recentIds, match.rewardId].slice(-32) };
  try {
    if (persist() === true) return { kind: 'granted', count: meta.localRegentReward.claims.length, reward };
  } catch {  }
  Object.assign(meta, previous);
  return { kind: 'save-failed', count: state.claims.length };
}
