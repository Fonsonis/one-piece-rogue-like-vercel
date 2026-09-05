/* A single, device-local JSON save. No network, cookies, account or database. */
(function (root) {
  'use strict';
  const KEY = 'oplike_save';
  const MAX_BYTES = 5 * 1024 * 1024;
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function validate(data) {
    if (!record(data) || data.game !== 'grandlinelike' || data.version !== 1 || !record(data.meta)) {
      throw new Error('Ese archivo no es un guardado compatible de GrandLineLike.');
    }
    for (const key of ['dex', 'recruited', 'roster', 'defeated', 'relics']) {
      if (data.meta[key] !== undefined && (!Array.isArray(data.meta[key]) || data.meta[key].some(id => typeof id !== 'string'))) throw new Error('Progreso inválido.');
    }
    for (const key of ['wins', 'nuzWins', 'upgrades', 'global', 'stats', 'settings', 'sagaClears', 'sagaDiffWins', 'teamPresets', 'charUpgrades']) {
      if (data.meta[key] !== undefined && !record(data.meta[key])) throw new Error('Progreso inválido.');
    }
    for (const key of ['fame', 'accXp', 'towerRecord', 'runnerBest', 'logPoses', 'starPity', 'soloWins', 'totalIslands']) {
      if (data.meta[key] !== undefined && (!Number.isFinite(data.meta[key]) || data.meta[key] < 0)) throw new Error('Progreso inválido.');
    }
    if (data.run !== null && data.run !== undefined) {
      const r = data.run;
      if (!record(r) || !Number.isInteger(r.saga) || !Number.isInteger(r.islandIdx) ||
          !['classic', 'nuzlocke'].includes(r.mode) || !Array.isArray(r.team) || !record(r.items) ||
          !Array.isArray(r.badges) || !Number.isFinite(r.berries) || !record(r.map) ||
          !Array.isArray(r.map.rows) || !r.map.rows.length || !Array.isArray(r.map.edges)) throw new Error('Viaje inválido.');
      for (const f of r.team) {
        if (!record(f) || typeof f.id !== 'string' || !Number.isFinite(f.hp) || !Number.isFinite(f.maxhp) ||
            !Number.isInteger(f.lvl) || f.lvl < 1 || !Array.isArray(f.moves)) throw new Error('Tripulación inválida.');
      }
      for (const row of r.map.rows) {
        if (!Array.isArray(row) || !row.length || row.some(n => !record(n) || typeof n.type !== 'string')) throw new Error('Mapa inválido.');
      }
      const position = p => Array.isArray(p) && p.length === 2 && p.every(Number.isInteger) && !!r.map.rows[p[0]]?.[p[1]];
      if (r.pos !== null && !position(r.pos)) throw new Error('Posición inválida.');
      if (r.map.edges.some(e => !Array.isArray(e) || e.length !== 4 || !position(e.slice(0, 2)) || !position(e.slice(2)))) throw new Error('Rutas inválidas.');
    }
    // Reject prototype keys, even in nested imported structures.
    function inspect(value) {
      if (!value || typeof value !== 'object') return;
      for (const key of Object.keys(value)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Formato inválido.');
        inspect(value[key]);
      }
    }
    inspect(data);
    return data;
  }
  function parse(text) {
    if (typeof text !== 'string' || text.length > MAX_BYTES) throw new Error('El archivo de guardado es demasiado grande.');
    return validate(JSON.parse(text));
  }
  function payload(meta, run) {
    return { game: 'grandlinelike', version: 1, date: new Date().toISOString(), user: 'local', meta, run: run || null };
  }
  function create(getStorage) {
    return {
      read() {
        const storage = getStorage();
        const current = storage.getItem(KEY);
        if (current !== null) return parse(current);
        const oldMeta = storage.getItem('oplike_meta');
        const oldRun = storage.getItem('oplike_run');
        return oldMeta ? validate(payload(JSON.parse(oldMeta), oldRun ? JSON.parse(oldRun) : null)) : null;
      },
      write(data) {
        // setItem replaces the entire JSON atomically; failed writes retain the previous save.
        const json = JSON.stringify(data);
        if (json.length > MAX_BYTES) throw new Error('La partida supera el tamaño máximo de guardado.');
        getStorage().setItem(KEY, json);
        return data;
      },
    };
  }
  root.GameSaveStorage = { KEY, MAX_BYTES, parse, validate, payload, create };
})(globalThis);
