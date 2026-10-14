const MAX_PACK_BYTES = 10 * 1024 * 1024;
const MAX_ASSETS = 5000;
const MAX_DEPTH = 100;
const MAX_NODES = 250000;
const ID_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function fail(message) {
  throw new TypeError(`Invalid content pack: ${message}`);
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireRecord(value, path) {
  if (!isRecord(value)) fail(`${path} must be a plain object`);
  return value;
}

function requireString(value, path, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    fail(`${path} must be a non-empty string of at most ${max} characters`);
  }
  return value;
}

function requireId(value, path) {
  requireString(value, path, 80);
  if (!ID_PATTERN.test(value)) fail(`${path} must match ${ID_PATTERN}`);
  return value;
}

function requireFinite(value, path, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(`${path} must be a finite number between ${min} and ${max}`);
  }
  return value;
}

function inspectJsonTree(root) {
  const active = new Set();
  let nodes = 0;

  function visit(value, path, depth) {
    if (++nodes > MAX_NODES) fail(`content has more than ${MAX_NODES} values`);
    if (depth > MAX_DEPTH) fail(`content is nested more than ${MAX_DEPTH} levels`);
    if (typeof value === 'string') {
      const decoded=value.replace(/&#(?:x([0-9a-f]+)|([0-9]+));?/gi,(_,hex,decimal)=>String.fromCodePoint(Math.min(parseInt(hex||decimal,hex?16:10)||0,0x10ffff))).replace(/&colon;/gi,':').replace(/&Tab;|&NewLine;/gi,'');
      if (/<\s*\/?\s*(?:script|iframe|object|embed|base|meta|link|foreignObject)\b|\bon\w+\s*=|(?:javascript|vbscript)\s*:|data\s*:\s*text\/html/i.test(decoded)) {
        fail(`${path} contains executable markup`);
      }
      return;
    }
    if (value === null || typeof value === 'boolean') return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail(`${path} contains a non-finite number`);
      return;
    }
    if (typeof value !== 'object') fail(`${path} contains a non-JSON value`);
    if (!Array.isArray(value) && !isRecord(value)) fail(`${path} contains a non-plain object`);
    if (active.has(value)) fail(`${path} contains a cycle`);
    active.add(value);
    for (const key of Object.keys(value)) {
      if (DANGEROUS_KEYS.has(key)) fail(`${path}.${key} is not allowed`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) fail(`${path}.${key} must be plain data`);
      visit(descriptor.value, `${path}.${key}`, depth + 1);
    }
    active.delete(value);
  }

  visit(root, 'pack', 0);
}

function validateAsset(path, index) {
  requireString(path, `assets[${index}]`, 500);
  if (path.startsWith('/') || path.includes('\\') || path.includes('?') || path.includes('#') ||
      /[\u0000-\u001f\u007f]/.test(path) || /^[a-z][a-z0-9+.-]*:/i.test(path) || path.includes('%')) {
    fail(`assets[${index}] must be a canonical relative path`);
  }
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) {
    fail(`assets[${index}] must not contain empty or traversal segments`);
  }
}

function validateTypes(types) {
  requireRecord(types, 'data.TYPES');
  const ids = Object.keys(types);
  if (!ids.length) fail('data.TYPES must not be empty');
  for (const id of ids) {
    requireString(id, `data.TYPES key`, 80);
    requireRecord(types[id], `data.TYPES.${id}`);
  }
  return new Set(ids);
}

function validateMoves(moves, typeIds) {
  requireRecord(moves, 'data.MOVES');
  const ids = Object.keys(moves);
  if (!ids.length) fail('data.MOVES must not be empty');
  for (const id of ids) {
    requireId(id, 'data.MOVES key');
    const move = requireRecord(moves[id], `data.MOVES.${id}`);
    requireString(move.name, `data.MOVES.${id}.name`, 200);
    requireString(move.type, `data.MOVES.${id}.type`, 80);
    if (!typeIds.has(move.type)) fail(`data.MOVES.${id}.type references an unknown type`);
    requireFinite(move.power, `data.MOVES.${id}.power`, 0, 1000000);
    requireFinite(move.acc, `data.MOVES.${id}.acc`, 0, 1);
  }
  return new Set(ids);
}

function validateCharacters(chars, moveIds, typeIds) {
  requireRecord(chars, 'data.CHARS');
  const ids = Object.keys(chars);
  if (!ids.length) fail('data.CHARS must not be empty');
  const charIds = new Set(ids);
  for (const id of ids) requireId(id, 'data.CHARS key');

  for (const id of ids) {
    const character = requireRecord(chars[id], `data.CHARS.${id}`);
    requireString(character.name, `data.CHARS.${id}.name`, 200);
    if (!Array.isArray(character.types) || !character.types.length || character.types.length > 8) {
      fail(`data.CHARS.${id}.types must contain between 1 and 8 types`);
    }
    for (const type of character.types) {
      if (typeof type !== 'string' || !typeIds.has(type)) fail(`data.CHARS.${id}.types references an unknown type`);
    }
    if (!Array.isArray(character.base) || character.base.length < 4 || character.base.length > 6) {
      fail(`data.CHARS.${id}.base must contain between 4 and 6 stats`);
    }
    character.base.forEach((stat, index) => requireFinite(stat, `data.CHARS.${id}.base[${index}]`, 0, 1000000));
    if (character.rareza !== undefined && (!Number.isInteger(character.rareza) || character.rareza < 1 || character.rareza > 5)) {
      fail(`data.CHARS.${id}.rareza must be an integer between 1 and 5`);
    }
    if (!Array.isArray(character.learnset) || !character.learnset.length || character.learnset.length > 1000) {
      fail(`data.CHARS.${id}.learnset must be a non-empty array`);
    }
    for (let index = 0; index < character.learnset.length; index++) {
      const entry = character.learnset[index];
      if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[0]) || entry[0] < 1 || entry[0] > 10000 ||
          typeof entry[1] !== 'string' || !moveIds.has(entry[1])) {
        fail(`data.CHARS.${id}.learnset[${index}] is invalid or references an unknown move`);
      }
    }
    if (character.ultimate !== undefined && (typeof character.ultimate !== 'string' || !moveIds.has(character.ultimate))) {
      fail(`data.CHARS.${id}.ultimate references an unknown move`);
    }
    if (character.formBase !== undefined && (typeof character.formBase !== 'string' || !charIds.has(character.formBase))) {
      fail(`data.CHARS.${id}.formBase references an unknown character`);
    }
    if (character.evo !== undefined) {
      const evo = requireRecord(character.evo, `data.CHARS.${id}.evo`);
      if (!Number.isInteger(evo.lvl) || evo.lvl < 1 || evo.lvl > 10000 || typeof evo.to !== 'string' || !charIds.has(evo.to)) {
        fail(`data.CHARS.${id}.evo is invalid or references an unknown character`);
      }
    }
  }
  const parents=new Map();
  for(const id of ids)if(chars[id].evo)parents.set(chars[id].evo.to,id);
  for(const id of ids)if(chars[id].formBase)parents.set(id,chars[id].formBase);
  const complete=new Set();
  for(const id of ids){
    const seen=new Set();let current=id;
    while(parents.has(current)&&!complete.has(current)){
      if(seen.has(current))fail('data.CHARS contains a cyclic evolution or form chain');
      seen.add(current);current=parents.get(current);
    }
    for(const item of seen)complete.add(item);
  }
  return charIds;
}

function validateCharacterList(value, path, charIds) {
  if (!Array.isArray(value) || value.length > 10000) fail(`${path} must be an array`);
  for (const id of value) if (typeof id !== 'string' || !charIds.has(id)) fail(`${path} references an unknown character`);
}

function validateSagas(sagas, charIds) {
  if (!Array.isArray(sagas) || !sagas.length || sagas.length > 1000) fail('data.SAGAS must be a non-empty array');
  const sagaIds = new Set();
  for (let index = 0; index < sagas.length; index++) {
    const saga = requireRecord(sagas[index], `data.SAGAS[${index}]`);
    requireId(saga.id, `data.SAGAS[${index}].id`);
    if (sagaIds.has(saga.id)) fail(`data.SAGAS contains duplicate id ${saga.id}`);
    sagaIds.add(saga.id);
    requireString(saga.name ?? saga.title, `data.SAGAS[${index}].name`, 200);
    if (saga.starters !== undefined) validateCharacterList(saga.starters, `data.SAGAS[${index}].starters`, charIds);
    if (saga.pool !== undefined) validateCharacterList(saga.pool, `data.SAGAS[${index}].pool`, charIds);
    if (!Array.isArray(saga.islands) || !saga.islands.length || saga.islands.length > 1000) {
      fail(`data.SAGAS[${index}].islands must be a non-empty array`);
    }
    for (let islandIndex = 0; islandIndex < saga.islands.length; islandIndex++) {
      const island = requireRecord(saga.islands[islandIndex], `data.SAGAS[${index}].islands[${islandIndex}]`);
      requireString(island.name ?? island.title, `data.SAGAS[${index}].islands[${islandIndex}].name`, 200);
      validateCharacterList(island.boss, `data.SAGAS[${index}].islands[${islandIndex}].boss`, charIds);
      validateCharacterList(island.pool, `data.SAGAS[${index}].islands[${islandIndex}].pool`, charIds);
      if (island.rows !== undefined && (!Number.isInteger(island.rows) || island.rows < 1 || island.rows > 10000)) {
        fail(`data.SAGAS[${index}].islands[${islandIndex}].rows must be a positive integer`);
      }
      for (const key of ['lvl', 'bossLvl']) {
        if (island[key] === undefined) continue;
        if (!Array.isArray(island[key]) || island[key].length > 10000) fail(`data.SAGAS island ${key} must be an array`);
        island[key].forEach((value, valueIndex) => requireFinite(value, `data.SAGAS[${index}].islands[${islandIndex}].${key}[${valueIndex}]`, 0, 1000000));
      }
    }
  }
  return sagaIds;
}

export function validatePack(pack) {
  inspectJsonTree(pack);
  requireRecord(pack, 'pack');
  if (pack.schemaVersion !== 1) fail('schemaVersion must be 1');
  requireId(pack.id, 'id');
  requireString(pack.title, 'title', 200);
  const data = requireRecord(pack.data, 'data');
  const texts = requireRecord(pack.texts, 'texts');
  if (!Array.isArray(pack.assets) || pack.assets.length > MAX_ASSETS) fail(`assets must be an array with at most ${MAX_ASSETS} entries`);

  for (const [key, value] of Object.entries(texts)) {
    requireString(key, 'texts key', 200);
    if (typeof value !== 'string' || value.length > 100000) fail(`texts.${key} must be a string of at most 100000 characters`);
  }
  const assets = new Set();
  pack.assets.forEach((asset, index) => {
    validateAsset(asset, index);
    if (assets.has(asset)) fail(`assets contains duplicate path ${asset}`);
    assets.add(asset);
  });

  for (const required of ['CHARS', 'MOVES', 'SAGAS', 'TYPES']) {
    if (!Object.hasOwn(data, required)) fail(`data.${required} is required`);
  }
  const typeIds = validateTypes(data.TYPES);
  const moveIds = validateMoves(data.MOVES, typeIds);
  const charIds = validateCharacters(data.CHARS, moveIds, typeIds);
  const sagaIds = validateSagas(data.SAGAS, charIds);
  for (const [id, character] of Object.entries(data.CHARS)) {
    if (character.saga !== undefined && (typeof character.saga !== 'string' || !sagaIds.has(character.saga))) {
      fail(`data.CHARS.${id}.saga references an unknown saga`);
    }
  }

  const json = JSON.stringify(pack);
  if (new TextEncoder().encode(json).byteLength > MAX_PACK_BYTES) fail(`serialized content exceeds ${MAX_PACK_BYTES} bytes`);
  return pack;
}

export const CONTENT_PACK_LIMITS = Object.freeze({ maxBytes: MAX_PACK_BYTES, maxAssets: MAX_ASSETS });
