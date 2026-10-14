import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { createContent } from '../public/content/runtime.mjs';

const MARKER = '// ============ INICIO ============';
const currentData = readFileSync('public/data.js', 'utf8');
const currentSave = readFileSync('public/save-storage.js', 'utf8');
const currentGame = engineSource('public/game.js');
const basePack = JSON.parse(readFileSync('public/content/base.json', 'utf8'));
const modPack = JSON.parse(readFileSync('mods/one-piece/pack.json', 'utf8'));
const legacyMechanics = JSON.parse(readFileSync('tests/fixtures/legacy-mechanics.json', 'utf8'));

function engineSource(path) {
  const source = readFileSync(path, 'utf8');
  const marker = source.indexOf(MARKER);
  assert.notEqual(marker, -1, `${path} debe separar la inicialización del motor con ${MARKER}`);
  return source.slice(0, marker);
}

function memoryStorage(memory = new Map()) {
  return {
    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { memory.set(key, String(value)); },
    removeItem(key) { memory.delete(key); },
  };
}

function seededMath(initial = 0x6d2b79f5) {
  let seed = initial >>> 0;
  const math = Object.create(Math);
  math.random = () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return math;
}

function contextFor({ pack, memory = new Map(), seed } = {}) {
  const storage = memoryStorage(memory);
  const context = vm.createContext({
    console,
    Math: seededMath(seed),
    localStorage: storage,
    document: {
      querySelector() { return {}; },
      querySelectorAll() { return []; },
      addEventListener() {},
      hasFocus() { return true; },
    },
    setTimeout() { return 1; },
    clearTimeout() {},
  });
  context.GameContent = createContent(pack, storage);
  vm.runInContext(currentData, context, { filename: 'public/data.js' });
  vm.runInContext(currentSave, context, { filename: 'public/save-storage.js' });
  vm.runInContext(currentGame, context, { filename: 'public/game.js' });
  return { context, memory };
}

function jsonValue(context, expression) {
  return JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
}

function characterize(context) {
  return jsonValue(context, `(()=>{
    const finitePositive = value => Number.isFinite(value) && value > 0;
    if (Object.keys(CHARS).length !== 599) throw Error('El catálogo debe contener 599 personajes.');
    if (SAGAS.length !== 15) throw Error('La campaña debe contener 15 sagas.');
    for (const [id, character] of Object.entries(CHARS)) {
      if (!Array.isArray(character.base) || character.base.length !== 6 || !character.base.every(finitePositive)) throw Error('Base inválida: '+id);
      if (!Array.isArray(character.learnset) || !character.learnset.length) throw Error('Learnset vacío: '+id);
      for (const entry of character.learnset) if (!Array.isArray(entry) || !MOVES[entry[1]]) throw Error('Movimiento ausente: '+id);
      const fighter = makeChar(id, 50, true, true);
      for (const key of ['hp','maxhp','atk','def','spatk','spdef','spd']) if (!finitePositive(fighter[key])) throw Error('Atributo inválido: '+id+':'+key);
      if (!fighter.moves.length || fighter.moves.some(move => !MOVES[move])) throw Error('Combatiente sin movimientos: '+id);
    }
    let islands = 0;
    for (const saga of SAGAS) for (const island of saga.islands) {
      islands++;
      const map = genMap(island);
      if (map.rows.length !== island.rows || !map.edges.length) throw Error('Mapa incompleto: '+saga.id);
      for (const [r,i,r2,i2] of map.edges) {
        if (!map.rows[r]?.[i] || !map.rows[r2]?.[i2] || r2 !== r + 1) throw Error('Arista inválida: '+saga.id);
      }
      for (let row = 1; row < map.rows.length; row++) for (let column = 0; column < map.rows[row].length; column++) {
        if (!map.edges.some(edge => edge[2] === row && edge[3] === column)) throw Error('Nodo inalcanzable: '+saga.id);
      }
    }
    const starter = makeChar('unit_001', 5, false, true);
    const bandit = makeChar('unit_021', 5, true, true);
    if (starter.id !== 'unit_001' || bandit.id !== 'unit_021') throw Error('IDs canónicos corruptos.');
    return { characters:Object.keys(CHARS).length, sagas:SAGAS.length, islands, starter:starter.id, bandit:bandit.id };
  })()`);
}

function paritySnapshot(context, ids) {
  context.__contentIds = ids;
  context.__contentLevel = legacyMechanics.level;
  context.__contentVariance = legacyMechanics.variance;
  return jsonValue(context, `(()=>{
    const result = [];
    for (const id of __contentIds) {
      const fighter = makeChar(id, __contentLevel, true, true);
      const defender = makeChar('unit_021', __contentLevel, true, true);
      const damagingMove = CHARS[id].learnset.map(entry => entry[1]).find(move => MOVES[move]?.power > 0);
      let damage = null;
      if (damagingMove) {
        battle = {pTeam:[fighter],eTeam:[defender],curP:fighter,curE:defender,round:1,opts:{}};
        const hit = calcDamage(fighter, defender, MOVES[damagingMove], false, __contentVariance);
        damage = {dmg:hit.dmg,eff:hit.eff,guard:Boolean(hit.CrystalGuard ?? hit.frutaGuard)};
      }
      result.push({id,lvl:fighter.lvl,hp:fighter.hp,maxhp:fighter.maxhp,atk:fighter.atk,def:fighter.def,
        spatk:fighter.spatk,spdef:fighter.spdef,spd:fighter.spd,moves:fighter.moves,damage});
    }
    return result;
  })()`);
}

function mapSnapshot(context) {
  return jsonValue(context, `SAGAS.flatMap(saga => saga.islands.map(island => {
    const map = genMap(island);
    return {rows:map.rows.map(row => row.map(node => node.type)),edges:map.edges};
  }))`);
}

test('los packs original y One Piece conservan catálogos, combatientes y mapas completos', () => {
  const base = characterize(contextFor({ pack: basePack, seed: 1 }).context);
  const mod = characterize(contextFor({ pack: modPack, seed: 1 }).context);
  assert.deepEqual(base, mod);
  assert.deepEqual(base, { characters:599, sagas:15, islands:70, starter:'unit_001', bandit:'unit_021' });
});

test('los packs conservan la caracterización numérica del motor legado', () => {
  assert.equal(legacyMechanics.version, 1);
  const ids = legacyMechanics.fighters.map(fighter => fighter.id);
  for (const pack of [basePack, modPack]) {
    const current = contextFor({ pack, seed: legacyMechanics.seed }).context;
    assert.deepEqual(paritySnapshot(current, ids), legacyMechanics.fighters, `${pack.id}: cambiaron atributos, movimientos o daño`);
    const maps = mapSnapshot(current);
    assert.equal(maps.length, legacyMechanics.mapCount);
    assert.equal(createHash('sha256').update(JSON.stringify(maps)).digest('hex'), legacyMechanics.mapsSha256,
      `${pack.id}: cambió la generación determinista de mapas`);
  }
});

test('createContent y el motor aíslan la persistencia por pack', () => {
  const memory = new Map();
  const storage = memoryStorage(memory);
  const baseContent = createContent(basePack, storage);
  const modContent = createContent(modPack, storage);
  baseContent.storage.setItem('probe', 'base');
  modContent.storage.setItem('probe', 'mod');
  assert.equal(baseContent.storage.getItem('probe'), 'base');
  assert.equal(modContent.storage.getItem('probe'), 'mod');
  assert.equal(memory.get('umbral:umbral:probe'), 'base');
  assert.equal(memory.get('umbral:one-piece:probe'), 'mod');

  const base = contextFor({ pack: basePack, memory }).context;
  const mod = contextFor({ pack: modPack, memory }).context;
  vm.runInContext(`localSave.write(GameSaveStorage.payload({slot:'base'},null))`, base);
  vm.runInContext(`localSave.write(GameSaveStorage.payload({slot:'mod'},null))`, mod);
  assert.equal(JSON.parse(memory.get('umbral:umbral:umbral_save')).meta.slot, 'base');
  assert.equal(JSON.parse(memory.get('umbral:one-piece:umbral_save')).meta.slot, 'mod');
  assert.equal(memory.has('umbral_save'), false, 'el motor no debe escribir guardados fuera del almacenamiento del pack');
});
