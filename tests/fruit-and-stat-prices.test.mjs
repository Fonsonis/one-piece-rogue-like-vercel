import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

function fruitHarness(teamSize = 2) {
  const h = combatHarness();
  let markup = '', rows = [], controls = {}, removed = false, renders = 0;
  const overlay = {
    set innerHTML(value) {
      markup = value;
      rows = [...value.matchAll(/class="shop-item fruit-select-item" data-idx="(\d+)"/g)]
        .map(match => ({dataset:{idx:match[1]}}));
      controls = {'#btn-confirm-fruit':{}, '#btn-cancel-fruit':{}};
    },
    querySelectorAll: () => rows,
    querySelector: selector => controls[selector],
    remove() { removed = true; }
  };
  h.ctx.document.createElement = () => overlay;
  h.ctx.document.body = {appendChild(){}};
  h.ctx.screenMap = () => { renders++; };
  h.exec(`run={team:['luffy','zoro'].slice(0,${teamSize}).map(id=>makeChar(id,5)),items:{fruta_diablo:1}};`);
  return {...h, open:()=>h.exec('useItemFromMap("fruta_diablo")'),
    select:i=>rows[i].onclick(), confirm:()=>controls['#btn-confirm-fruit'].onclick(),
    cancel:()=>controls['#btn-cancel-fruit'].onclick(),
    get markup(){return markup;}, get removed(){return removed;}, get renders(){return renders;}};
}

test('fruit renders, selects and grants one new type to each chosen conscious nakama', () => {
  for (const size of [1,2]) {
    const h = fruitHarness(size);
    const before = h.exec('run.team.map(f=>fighterTypes(f).length)');
    assert.doesNotThrow(h.open);
    assert.match(h.markup, /Poder de la Fruta del Diablo/);
    h.confirm();
    assert.equal(h.exec('run.items.fruta_diablo'),1);
    for (let i=0;i<size;i++) h.select(i);
    h.confirm();
    assert.equal(h.exec('run.items.fruta_diablo'),0);
    assert.equal(h.removed,true);
    assert.equal(h.renders,1);
    for (let i=0;i<size;i++) assert.equal(h.exec(`fighterTypes(run.team[${i}]).length`),before[i]+1);
  }
});

test('fruit cancellation and deselection preserve the item and defeated nakamas cannot be picked', () => {
  const h = fruitHarness();
  h.exec('run.team[1].hp=0');
  h.open();
  assert.equal((h.markup.match(/fruit-select-item/g)||[]).length,1);
  h.select(0); h.select(0); h.confirm(); h.cancel();
  assert.equal(h.exec('run.items.fruta_diablo'),1);
  assert.equal(h.exec('run.team.some(f=>f.extraTypes?.length>0)'),false);
  assert.equal(h.removed,true);
  assert.equal(h.renders,0);
});

test('stat training grows by 10 Fama per level and totals the same prices for resale', () => {
  const h = combatHarness();
  assert.deepEqual(Array.from(h.exec('Array.from({length:6},(_,i)=>upgCost(i))')),[30,40,50,60,70,80]);
  h.exec('meta.upgrades={luffy:{atk:5,hp:2}}');
  assert.equal(h.exec('charTotalUpgSpent("luffy")'),320);
  assert.equal(h.exec('charTotalUpgSpent("zoro")'),0);
});
