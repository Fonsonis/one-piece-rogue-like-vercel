import {test} from 'node:test';
import assert from 'node:assert/strict';
import {combatHarness} from './balance-harness.mjs';

test('shop roster combines saga, type, rarity, team, search, and ordering', () => {
  const h = combatHarness();
  const ids = "['luffy','zoro','sanji','nami','robin']";
  assert.deepEqual(Array.from(h.exec(`filterShipRoster(${ids},{saga:'eastblue',type:'Golpe',rarity:3,sort:'name',teamOnly:false})`)), ['sanji']);
  assert.deepEqual(Array.from(h.exec(`filterShipRoster(${ids},{saga:'',type:'',rarity:0,sort:'name',teamOnly:true},'', ['luffy','robin'])`)), ['luffy','robin']);
  assert.deepEqual(Array.from(h.exec(`filterShipRoster(${ids},{saga:'',type:'',rarity:0,sort:'name',teamOnly:false},'na')`)), ['nami']);
  assert.deepEqual(Array.from(h.exec(`filterShipRoster(${ids},{saga:'',type:'',rarity:0,sort:'rarezaDesc',teamOnly:false})`)).slice(-1), ['luffy']);
});

test('base-level resale returns half the recorded actual Log Pose spend once', () => {
  const h = combatHarness();
  h.exec('maxStartLvlCap=()=>40;meta.logPoses=100;');
  assert.equal(h.exec("upgradeCharLvl('luffy')"), true);
  assert.equal(h.exec("upgradeCharLvl('luffy')"), true);
  assert.equal(h.exec("charBaseLevelSpent('luffy')"), 15);
  assert.equal(h.exec("sellCharBaseLevels('luffy')"), 7);
  assert.equal(h.exec('meta.logPoses'), 92);
  assert.equal(h.exec("startLvlOf('luffy')"), 5);
  assert.equal(h.exec("sellCharBaseLevels('luffy')"), 0);
  assert.equal(h.exec('meta.logPoses'), 92);
});

test('legacy levels use the conservative historical schedule and later purchases start a ledger', () => {
  const h = combatHarness();
  h.exec('maxStartLvlCap=()=>40;meta.charUpgrades={luffy:26};meta.charUpgradeSpent={};meta.logPoses=1000000;');
  const legacy = h.exec("charBaseLevelSpent('luffy')");
  assert.equal(legacy, h.exec('Array.from({length:26},(_,i)=>logPoseUpgradeCost(5+i)).reduce((a,b)=>a+b,0)'));
  const next = h.exec('logPoseUpgradeCost(31)');
  assert.equal(h.exec("upgradeCharLvl('luffy')"), true);
  assert.equal(h.exec('meta.charUpgradeSpent.luffy'), legacy + next);
  assert.equal(h.exec("sellCharBaseLevels('luffy')"), Math.floor((legacy + next)/2));
});
