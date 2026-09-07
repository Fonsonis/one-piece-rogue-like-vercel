import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function setup(rows, edges) {
  const h = combatHarness();
  h.ctx.testMap = {rows:rows.map(row=>row.map(type=>({type,done:false}))),edges};
  h.exec("run={map:testMap};autoSettings.nodePriority='special'");
  return h;
}

test('special priority follows connected paths before the event is immediately reachable', () => {
  const h=setup([['wild','item'],['rest','marine'],['boss','special']],
    [[0,0,1,0],[0,1,1,1],[1,0,2,0],[1,1,2,1]]);
  assert.deepEqual(Array.from(h.exec('pickAutoNode([[0,0],[0,1]])')),[0,1]);
  assert.deepEqual(Array.from(h.exec('pickAutoNode([[1,0],[1,1]])')),[1,1]);
  assert.deepEqual(Array.from(h.exec('pickAutoNode([[2,0],[2,1]])')),[2,1]);
});

test('the nearest special wins and completed or disconnected events are ignored', () => {
  const h=setup([['wild','special'],['special','marine']],[[0,0,1,0]]);
  assert.deepEqual(Array.from(h.exec('pickAutoNode([[0,0],[0,1]])')),[0,1]);
  h.exec('run.map.rows[0][1].done=true');
  assert.deepEqual(Array.from(h.exec('pickAutoNode([[0,0],[0,1]])')),[0,0]);
  const isolated=setup([['wild','rest'],['special']],[[0,1,1,0]]);
  assert.deepEqual(Array.from(isolated.exec('pickAutoNode([[0,0]])')),[0,0]);
});

test('no special falls back to reachable nodes, ties stay valid, and other priorities remain intact', () => {
  const h=setup([['item','special','special']],[]);
  for(let i=0;i<20;i++) assert.ok([1,2].includes(h.exec('pickAutoNode([[0,0],[0,1],[0,2]])')[1]));
  h.exec("autoSettings.nodePriority='item'");
  assert.deepEqual(Array.from(h.exec('pickAutoNode([[0,0],[0,1]])')),[0,0]);
  h.exec("autoSettings.nodePriority='special';run.map.rows[0].forEach(n=>n.type='wild')");
  assert.ok([0,1].includes(h.exec('pickAutoNode([[0,0],[0,1]])')[1]));
  assert.equal(h.exec('pickAutoNode([])'),null);
});
