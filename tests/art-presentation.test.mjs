import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const data = fs.readFileSync('public/data.js', 'utf8');
const game = fs.readFileSync('public/game.js', 'utf8').split('// ============ INICIO ============')[0];
const art = fs.readFileSync('public/art/visuals.js', 'utf8');
const pack = JSON.parse(fs.readFileSync('mods/one-piece/pack.json', 'utf8'));
const modAsset = path => `mods/one-piece/assets/${path}`;

test('the One Piece interface art is isolated in the mod and keeps its compact menu asset',()=>{
 const polish=fs.readFileSync('public/art/interface-polish.css','utf8');
 const fullMap=fs.statSync(modAsset('art/asset_1235.png')).size;
 const menuIcon=fs.statSync(modAsset('art/asset_1236.webp')).size;
 assert.match(polish,/asset_1237\.webp/);
 assert.match(polish,/asset_1875\.webp/);
 assert.doesNotMatch(polish,/(?:event|ui)-atlas\.(?:png|webp)/);
 assert.match(game,/\/art\/asset_1236\.webp/);
 assert.ok(pack.assets.includes('art/asset_1235.png'));
 assert.ok(pack.assets.includes('art/asset_1236.webp'));
 assert.ok(menuIcon<fullMap/20,`Menu icon should be much smaller: ${menuIcon} vs ${fullMap}`);
});

function harness(withArt, brokenAnimation = false) {
  let seed = 81372, randomCalls = 0, animations = 0;
  const animationFrames = [];
  const styles = [];
  const memory = new Map(), nodes = new Map();
  function node() {
    return {
      isConnected: true, dataset: {}, style: { setProperty() {} },
      setAttribute() {}, appendChild() {}, remove() {},
      animate(frames) {
        if (brokenAnimation) throw Error('Unsupported browser animation');
        animations++; animationFrames.push(frames);
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
      head: {appendChild(style) {styles.push(style.textContent);}},
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
  return { ctx, styles, stats: () => ({ randomCalls, animations, animationFrames }) };
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
        if (i % 3 === 0) battle.combatProgress.stallRounds = 14;
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
    return {unseen,seen:dexCardHTML('luffy'),icons:Object.keys(CHARS).map(id=>({id:crewSkinFor(id) || CHARS[id].spriteId || id,html:charIcon(id,46)}))};
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

test('crew variants expose their visual identity and use skin-specific geometry', () => {
  const {ctx,styles}=harness(true);
  const icons=vm.runInContext(`Object.entries(CREW_SKINS).flatMap(([id,crews])=>Object.entries(crews).map(([crew,skin])=>({id,skin,html:charIcon(id,64,crew)})))`,ctx);
  for(const {id,skin,html} of icons) {
    assert.ok(html.includes(`data-character="${id}"`),skin);
    assert.ok(html.includes(`data-sprite-id="${skin}"`),skin);
    assert.ok(html.includes(`url('/art/characters/${skin}.png')`),skin);
    assert.ok(html.includes('--unit_393-scale:'),skin);
    assert.ok(html.includes('--motion-fit-y:'),skin);
    const canonicalSkin=Object.entries(pack.legacy.keys)
      .sort((a,b)=>b[0].length-a[0].length)
      .reduce((value,[legacy,canonical])=>value===legacy?canonical:value.startsWith(`${legacy}-`)?canonical+value.slice(legacy.length):value,skin);
    assert.ok(styles.some(css=>css.includes(`.sprite:has(> .dex-sprite[data-sprite-id="${canonicalSkin}"])`)),`Battle wrapper bounds: ${skin}`);
  }
  const croco=icons.find(icon=>icon.skin==='crocodile-guild_07');
  assert.ok(Number(croco.html.match(/--unit_393-scale:([\d.]+)/)[1])<0.8,'Tall CrossGuild artwork must not inherit the base scale');
});

test('the installable mod contains complete, distinct four-frame Dex art', () => {
  const ids=[...new Set(Object.entries(pack.data.CHARS).map(([id,c])=>c.spriteId || id))].sort();
  assert.ok(ids.length > 500);
  const hashes = new Set();
  for(const id of ids) {
    const atlasPath=`art/characters/${id}.png`;
    const portraitPath=`art/portraits/${id}.png`;
    assert.ok(pack.assets.includes(atlasPath),atlasPath);
    assert.ok(pack.assets.includes(portraitPath),portraitPath);
    const png=fs.readFileSync(modAsset(atlasPath));
    assert.equal(png.readUInt32BE(16),768,id);
    assert.equal(png.readUInt32BE(20),192,id);
    assert.equal(png[25],6,'RGBA PNG required: '+id);
    const portrait=fs.readFileSync(modAsset(portraitPath));
    assert.equal(portrait.readUInt32BE(16),192,'Dex portrait: '+id);
    assert.equal(portrait.readUInt32BE(20),192,'Dex portrait: '+id);
    const hash=createHash('sha256').update(png).digest('hex');
    assert.ok(!hashes.has(hash),'Duplicate character art: '+id);
    hashes.add(hash);
  }
});


test('atlas poses change in whole cells while movement remains independently animated',()=>{
 const h=harness(true);
 vm.runInContext(`run={mode:'classic',team:[makeChar('luffy',35)],items:{},saga:0};startBattle([makeChar('zoro',35)],{wild:true});attackWith(battle.curP,battle.curE,MOVES.punetazo);`,h.ctx);
 const poses=h.stats().animationFrames.filter(frames=>frames.some(f=>'backgroundPosition' in f));
 assert.ok(poses.length>0);
 for(const frames of poses)for(const frame of frames){assert.equal(frame.easing,'steps(1,end)');assert.equal('transform' in frame,false);}
 assert.ok(h.stats().animationFrames.some(frames=>frames.some(f=>'transform' in f)&&frames.every(f=>!('backgroundPosition' in f))));
});

test('sprite ultimates own the choreography while normal attacks retain their animation', () => {
  const h = harness(true);
  h.ctx.UltimateFX = {handlesSprites:true};
  vm.runInContext(`
    run={mode:'classic',saga:0,team:[makeChar('sanji',35)],items:{}};
    startBattle([makeChar('kaido',100,true)],{wild:true});
    run.team[0].ultCharge=100;useUltimate(run.team[0]);
  `, h.ctx);
  assert.equal(h.stats().animations,0,'No simultaneous basic motion or detached burst');
  vm.runInContext(`attackWith(run.team[0],battle.curE,MOVES.punetazo);`,h.ctx);
  assert.ok(h.stats().animations>0,'Ordinary attacks still animate');
});
