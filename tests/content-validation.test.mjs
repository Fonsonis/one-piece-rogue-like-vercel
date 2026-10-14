import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTENT_PACK_LIMITS, validatePack} from '../public/content/validation.mjs';

function fixture() {
  return {
    schemaVersion: 1,
    id: 'original-realms',
    title: 'Original Realms',
    data: {
      TYPES: {strike:{color:'#fff'}},
      MOVES: {jab:{name:'Jab',type:'strike',power:20,acc:.95}},
      CHARS: {
        hero:{name:'Hero',types:['strike'],base:[20,10,8,9],rareza:1,learnset:[[1,'jab']],saga:'first-realm'},
        guardian:{name:'Guardian',types:['strike'],base:[30,12,12,6],rareza:3,learnset:[[1,'jab']],ultimate:'jab',saga:'first-realm'},
      },
      SAGAS: [{id:'first-realm',name:'First Realm',starters:['hero'],islands:[{
        name:'Old Gate',boss:['guardian'],pool:['hero','guardian'],lvl:[1,8],bossLvl:[10],rows:6,
      }]}],
    },
    texts: {currency:'Coins'},
    assets: ['content/original-realms/hero.png'],
  };
}

test('accepts a minimal data-only pack and returns the same object', () => {
  const pack = fixture();
  assert.equal(validatePack(pack), pack);
  assert.deepEqual(CONTENT_PACK_LIMITS, {maxBytes:10*1024*1024,maxAssets:5000});
});

test('rejects invalid schema, identifiers and non-JSON executable values', () => {
  assert.throws(() => validatePack({...fixture(),schemaVersion:2}), /schemaVersion/);
  assert.throws(() => validatePack({...fixture(),id:'Not Canonical'}), /must match/);
  const executable=fixture();executable.data.hook=()=>true;
  assert.throws(() => validatePack(executable), /non-JSON value/);
  const dated=fixture();dated.data.extra=new Date();
  assert.throws(() => validatePack(dated), /non-plain object/);
});

test('rejects dangerous keys, cycles and accessors recursively', () => {
  const polluted=fixture();polluted.data.extra=JSON.parse('{"nested":{"__proto__":{"admin":true}}}');
  assert.throws(() => validatePack(polluted), /__proto__/);
  const cyclic=fixture();cyclic.data.extra=cyclic;
  assert.throws(() => validatePack(cyclic), /cycle/);
  const accessor=fixture();Object.defineProperty(accessor.data,'secret',{enumerable:true,get(){return 'x';}});
  assert.throws(() => validatePack(accessor), /plain data/);
});

test('validates move, type, character and saga references', () => {
  const badMove=fixture();badMove.data.CHARS.hero.learnset=[[1,'missing']];
  assert.throws(() => validatePack(badMove), /unknown move/);
  const badType=fixture();badType.data.MOVES.jab.type='missing';
  assert.throws(() => validatePack(badType), /unknown type/);
  const badBoss=fixture();badBoss.data.SAGAS[0].islands[0].boss=['missing'];
  assert.throws(() => validatePack(badBoss), /unknown character/);
  const badSaga=fixture();badSaga.data.CHARS.hero.saga='missing';
  assert.throws(() => validatePack(badSaga), /unknown saga/);
});

test('rejects invalid stats and combat values', () => {
  const badStats=fixture();badStats.data.CHARS.hero.base=[20,-1,8,9];
  assert.throws(() => validatePack(badStats), /finite number/);
  const badAccuracy=fixture();badAccuracy.data.MOVES.jab.acc=1.1;
  assert.throws(() => validatePack(badAccuracy), /between 0 and 1/);
  const badRarity=fixture();badRarity.data.CHARS.hero.rareza=6;
  assert.throws(() => validatePack(badRarity), /rareza/);
});

test('accepts only unique canonical relative asset paths', () => {
  for (const path of ['/absolute.png','../escape.png','safe/../escape.png','https://example.test/a.png','safe\\asset.png','safe/a.png?x=1','safe/%2e%2e/a.png']) {
    const pack=fixture();pack.assets=[path];
    assert.throws(() => validatePack(pack), /assets\[0\]/, path);
  }
  const duplicate=fixture();duplicate.assets=['safe/a.png','safe/a.png'];
  assert.throws(() => validatePack(duplicate), /duplicate path/);
});

test('enforces asset count and serialized content size limits', () => {
  const tooMany=fixture();tooMany.assets=Array.from({length:CONTENT_PACK_LIMITS.maxAssets+1},(_,i)=>`a/${i}.png`);
  assert.throws(() => validatePack(tooMany), /at most 5000/);
  const tooLarge=fixture();tooLarge.texts.description='x'.repeat(CONTENT_PACK_LIMITS.maxBytes);
  assert.throws(() => validatePack(tooLarge), /exceeds|at most 100000/);
});
