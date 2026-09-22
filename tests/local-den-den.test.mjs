import {test} from 'node:test';
import assert from 'node:assert/strict';
import {denDenRemaining,denDenState,spendDenDen} from '../public/local/den-den.mjs';

test('four den den mushis are available each local day and only successful starts spend them',()=>{
  const meta={denDenMushis:null},today=new Date(2026,8,23,12),tomorrow=new Date(2026,8,24,12);
  assert.equal(denDenRemaining(meta,today),4);
  for(let n=3;n>=0;n--){assert.equal(spendDenDen(meta,()=>true,today),true);assert.equal(denDenRemaining(meta,today),n);}
  assert.equal(spendDenDen(meta,()=>true,today),false);
  assert.equal(denDenRemaining(meta,tomorrow),4);
});

test('failed persistence restores the daily balance',()=>{
  const meta={denDenMushis:null};
  assert.equal(spendDenDen(meta,()=>false),false);
  assert.equal(denDenRemaining(meta),4);
  assert.equal(meta.denDenMushis,null);
  assert.equal(denDenState({date:'2000-01-01',remaining:0}).remaining,4);
});
