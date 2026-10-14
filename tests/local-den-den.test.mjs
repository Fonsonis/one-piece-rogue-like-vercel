import {test} from 'node:test';
import assert from 'node:assert/strict';
import {radioRemaining,radioState,spendRadio} from '../public/local/radio.mjs';

test('four den den mushis are available each local day and persisted victories spend them',()=>{
  const meta={RadioMushis:null},today=new Date(2026,8,23,12),tomorrow=new Date(2026,8,24,12);
  assert.equal(radioRemaining(meta,today),4);
  for(let n=3;n>=0;n--){assert.equal(spendRadio(meta,()=>true,today),true);assert.equal(radioRemaining(meta,today),n);}
  assert.equal(spendRadio(meta,()=>true,today),false);
  assert.equal(radioRemaining(meta,tomorrow),4);
});

test('failed persistence restores the daily balance',()=>{
  const meta={RadioMushis:null};
  assert.equal(spendRadio(meta,()=>false),false);
  assert.equal(radioRemaining(meta),4);
  assert.equal(meta.RadioMushis,null);
  assert.equal(radioState({date:'2000-01-01',remaining:0}).remaining,4);
});
