import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const data = fs.readFileSync('public/data.js', 'utf8');
const game = fs.readFileSync('public/game.js', 'utf8').split('// ============ INICIO ============')[0];
const art = fs.readFileSync('public/art/visuals.js', 'utf8');

function harness(withArt, brokenAnimation = false) {
  let seed = 81372, randomCalls = 0, animations = 0;
  const memory = new Map(), nodes = new Map();
  function node() {
    return {
      isConnected: true, dataset: {}, style: { setProperty() {} },
      setAttribute() {}, appendChild() {}, remove() {},
      animate() {
        if (brokenAnimation) throw Error('Unsupported browser animation');
        animations++;
        return { cancel() {}, finished: Promise.resolve() };
      },
      querySelector() { return node(); }
    };
  }
  const math = Object.create(Math);
  math.random = () => { randomCalls++; seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const ctx = vm.createContext({
    console, Math: math,
    window: { matchMedia: () => ({ matches: false }) },
    document: {
      querySelector: () => node(), addEventListener() {},
      createElement: () => node(),
      getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); }
    },
    localStorage: { getItem: k => memory.get(k) || null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) },
    setTimeout() { return 1; }, clearTimeout() {}
  });
  vm.runInContext(fs.readFileSync('public/save-storage.js','utf8'), ctx);
  vm.runInContext(data, ctx);
  vm.runInContext(game, ctx);
  vm.runInContext(`
    let recordedLogs = [];
    log = value => recordedLogs.push(value);
    toast = value => recordedLogs.push(value);
    refreshHPCards = () => {};
    popDamage = () => {};
    playMusic = () => {};
    renderBattle = () => {};
    scheduleRound = () => {};
  `, ctx);
  if (withArt) vm.runInContext(art, ctx);
  return { ctx, stats: () => ({ randomCalls, animations }) };
}

test('art adapter preserves every character’s attacks, ultimates, RNG and persistent state', () => {
  const script = `(() => {
    const ids = Object.keys(CHARS), results = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      for (const moveId of [...new Set(CHARS[id].learnset.map(pair => pair[1])), 'ULTIMATE', 'INVALID']) {
        const p = makeChar(id, 35), e = makeChar(ids[(i + 17) % ids.length], 35);
        const p2 = makeChar(ids[(i + 1) % ids.length], 35), e2 = makeChar(ids[(i + 18) % ids.length], 35);
        run = {mode:'story', team:[p,p2], items:{carne:3}, saga:0};
        recordedLogs = [];
        startBattle([e,e2], {wild:true});
        p.hp = Math.ceil(p.maxhp * .6);
        p.ultCharge = 100;
        if (i % 3 === 0) battle.round = 15;
        if (moveId === 'ULTIMATE') useUltimate(p);
        else attackWith(p, e, MOVES[moveId], 'enemy');
        results.push({id,moveId,p:p.hp,e:e.hp,p2:p2.hp,e2:e2.hp,charge:p.ultCharge,
          ps:p.st,es:e.st,dodge:e.dodgeLeft,firstHit:battle.firstHit,logs:[...recordedLogs]});
      }
    }
    return JSON.stringify({results,meta,run});
  })()`;
  const baseline = harness(false);
  const presentation = harness(true);
  const expected = vm.runInContext(script, baseline.ctx);
  const actual = vm.runInContext(script, presentation.ctx);
  assert.equal(actual, expected);
  assert.equal(presentation.stats().randomCalls, baseline.stats().randomCalls);
  assert.ok(presentation.stats().animations > 1000, 'Animations must actually execute');
  console.log('Identical gameplay scenarios:', JSON.parse(actual).results.length);
});

test('unsupported animation APIs do not interrupt attacks or change their results', () => {
  const script = `(() => {
    const p=makeChar('luffy',25), e=makeChar('bandido',25);
    run={mode:'story',team:[p],items:{}}; startBattle([e],{wild:true});
    attackWith(p,e,MOVES.pistolagoma,'enemy');
    return JSON.stringify({p,e,meta,logs:recordedLogs});
  })()`;
  assert.equal(vm.runInContext(script,harness(true,true).ctx),vm.runInContext(script,harness(false).ctx));
});

test('Dex discovery rules are preserved and every known character resolves to its own atlas', () => {
  const { ctx } = harness(true);
  const result = vm.runInContext(`(() => {
    meta.dex=[]; meta.recruited=[]; meta.roster=[];
    const unseen=dexCardHTML('luffy');
    meta.dex=['luffy'];
    return {unseen,seen:dexCardHTML('luffy'),icons:Object.keys(CHARS).map(id=>({id,html:charIcon(id,46)}))};
  })()`, ctx);
  assert.ok(!result.unseen.includes('art/characters/'));
  assert.ok(result.unseen.includes('❔'));
  assert.ok(result.seen.includes('art/characters/luffy.png'));
  for (const {id,html} of result.icons) {
    assert.ok(html.includes(`url('/art/characters/${id}.png')`),id);
    assert.ok(html.includes(`url('/art/portraits/${id}.png')`),id);
    assert.ok(html.includes('role="img"') && html.includes('aria-label='),id);
  }
});

test('complete Dex art coverage has four distinct transparent frames per character', () => {
  const manifest = JSON.parse(fs.readFileSync('public/art/manifest.json','utf8'));
  const ctx=vm.createContext({}); vm.runInContext(data,ctx);
  const ids=Array.from(vm.runInContext('Object.keys(CHARS)',ctx)).sort();
  assert.deepEqual(Object.keys(manifest.characters).sort(),ids);
  const hashes = new Set();
  for(const id of ids) {
    const entry=manifest.characters[id];
    assert.equal(entry.frames,4,id);
    const png=fs.readFileSync(`public/art/characters/${id}.png`);
    assert.equal(png.readUInt32BE(16),768,id);
    assert.equal(png.readUInt32BE(20),192,id);
    assert.equal(png[25],6,'RGBA PNG required: '+id);
    const portrait=fs.readFileSync(`public/art/portraits/${id}.png`);
    assert.equal(portrait.readUInt32BE(16),192,'Dex portrait: '+id);
    assert.equal(portrait.readUInt32BE(20),192,'Dex portrait: '+id);
    const hash=createHash('sha256').update(png).digest('hex');
    assert.ok(!hashes.has(hash),'Duplicate character art: '+id);
    hashes.add(hash);
  }
});
