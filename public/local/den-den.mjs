export const DAILY_DEN_DEN = 4;

const dayKey = now => `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

export function denDenState(value, now = new Date()) {
  const date=dayKey(now);
  if (value?.date!==date) return {date,remaining:DAILY_DEN_DEN};
  return {date,remaining:Number.isSafeInteger(value.remaining) ? Math.max(0,Math.min(DAILY_DEN_DEN,value.remaining)) : DAILY_DEN_DEN};
}

export function denDenRemaining(meta, now = new Date()) {
  return denDenState(meta.denDenMushis,now).remaining;
}

export function spendDenDen(meta, persist, now = new Date()) {
  const state=denDenState(meta.denDenMushis,now);
  if (!state.remaining) return false;
  const previous=meta.denDenMushis;
  meta.denDenMushis={date:state.date,remaining:state.remaining-1};
  try { if (persist()===true) return true; } catch { /* Restore the in-memory balance. */ }
  meta.denDenMushis=previous;
  return false;
}
