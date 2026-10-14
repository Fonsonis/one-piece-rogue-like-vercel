export const DAILY_RADIO = 4;

const dayKey = now => `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

export function radioState(value, now = new Date()) {
  const date=dayKey(now);
  if (value?.date!==date) return {date,remaining:DAILY_RADIO};
  return {date,remaining:Number.isSafeInteger(value.remaining) ? Math.max(0,Math.min(DAILY_RADIO,value.remaining)) : DAILY_RADIO};
}

export function radioRemaining(meta, now = new Date()) {
  return radioState(meta.RadioMushis,now).remaining;
}

export function spendRadio(meta, persist, now = new Date()) {
  const state=radioState(meta.RadioMushis,now);
  if (!state.remaining) return false;
  const previous=meta.RadioMushis;
  meta.RadioMushis={date:state.date,remaining:state.remaining-1};
  try { if (persist()===true) return true; } catch { }
  meta.RadioMushis=previous;
  return false;
}
