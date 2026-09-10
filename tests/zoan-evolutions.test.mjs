import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('Zoan roster covers secondary characters and only confirmed awakenings',()=>{
  const h=combatHarness();
  const bases=Array.from(h.exec('Object.keys(ZOAN_FORMS)'));
  assert.deepEqual(bases.sort(),['chopper','lucci','kaku','kaido','yamato','king','queen','marco','chaka','pell','dalton','merrychristmas','jabra','sandersonia','marigold','sengoku','momonosuke','drake','orochi','jack','ulti','pageone','whoswho','sasaki','blackmaria','devon','stronger','onigumo','pierre','pekoms','morgans','tamago'].sort());
  assert.deepEqual(Array.from(h.exec("Object.entries(CHARS).filter(([,c])=>c.zoanForm==='awakened').map(([id])=>id)")).sort(),['kaku-awakened','lucci-awakened','minotauros']);
  assert.equal(h.exec("CHARS['chopper-monster'].zoanForm"),'monster');
  assert.equal(h.exec('CHARS.minotauros.evo'),undefined);
  assert.equal(h.exec("CHARS['sengoku-animal'].name.includes('Daibutsu')"),true);
  assert.equal(h.exec("CHARS.sengoku2.name"),'Kong');
});

test('animal 20, hybrid 25, awakening 40 are exact and share permanent progression',()=>{
  const h=combatHarness();h.exec('maxStartLvlCap=()=>100;');
  for(const base of ['lucci','kaku']){
    for(const [level,kind] of [[20,'animal'],[25,'hybrid'],[40,'awakened']]){
      h.exec(`meta.charUpgrades={${base}:${level-5}};`);
      assert.equal(h.exec(`makeChar('${base}',${level}).id`),`${base}-${kind}`);
      assert.equal(h.exec(`startLvlOf('${base}-${kind}')`),level);
      h.exec(`meta.charUpgrades.${base}--;`);
      assert.notEqual(h.exec(`makeChar('${base}',100).id`),`${base}-${kind}`);
    }
  }
  for(const base of ['zoro','nami','coby','usopp'])assert.equal(h.exec(`CHARS.${base}.evo.lvl`),20);
});

test('new forms migrate old high-level allies without losing bonuses, XP or KO',()=>{
  const h=combatHarness();h.exec('maxStartLvlCap=()=>100;');
  for(const base of ['lucci','kaku','kaido','chopper'])for(const dead of [false,true]){
    assert.equal(h.exec(`(()=>{
      meta.charUpgrades={};const f=makeChar('${base}',55);f.xp=321;f.stars=3;f.maxhp+=13;f.atk+=7;f.hp=${dead?'0':'f.maxhp-9'};
      f.evolutionRulesVersion=1;meta.charUpgrades.${base}=50;
      migrateFighter(f);const expected=makeChar('${base}',55);
      if(f.id!==expected.id||f.maxhp!==expected.maxhp+13||f.atk!==expected.atk+7||f.hp!==${dead?'0':'f.maxhp-9'})return false;
      const once=JSON.stringify(f);migrateFighter(f);
      return f.xp===321&&f.stars===3&&JSON.stringify(f)===once;
    })()`),true);
  }
});

test('forms keep the base saga, passives and recruitment identity without entering wild pools',()=>{
  const h=combatHarness();
  assert.equal(h.exec(`Object.entries(CHARS).filter(([,c])=>c.zoanBase).every(([id,c])=>
    baseFormOf(id)===c.zoanBase&&c.saga===CHARS[c.zoanBase].saga&&
    JSON.stringify(passiveRule({id}))===JSON.stringify(passiveRule({id:c.zoanBase}))&&
    SAGAS.every(s=>s.islands.every(i=>!i.pool.includes(id))))`),true);
});

test('old Gear 3 moves migrate even when the character remains in Gear 3',()=>{
  const h=combatHarness();
  h.exec(`maxStartLvlCap=()=>100;meta.charUpgrades={luffy:20};const f=makeChar('luffy',25);
    f.moves=['hakiarm'];f.evolutionRulesVersion=1;migrateFighter(f);`);
  assert.equal(h.exec('f.id'),'luffy3');
  assert.deepEqual(Array.from(h.exec('f.moves')),['gigantpistol']);
});

test('Chopper cannot use Monster Point before its permanent unlock',()=>{
  const h=combatHarness();h.exec('maxStartLvlCap=()=>100;');
  for(const level of [5,20,25,39]){
    h.exec(`meta.charUpgrades={chopper:${level-5}};const f${level}=makeChar('chopper',100);`);
    assert.equal(h.exec(`f${level}.moves.includes('monsterpoint')`),false);
    assert.notEqual(h.exec(`getUltimateMove(f${level}).name`),h.exec('MOVES.monsterpoint.name'));
  }
  h.exec('meta.charUpgrades={chopper:35};');
  assert.equal(h.exec("makeChar('chopper',40).id"),'chopper-monster');
  assert.equal(h.exec("getUltimateMove(makeChar('chopper',40))===MOVES.monsterpoint"),true);
});
