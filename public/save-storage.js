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
    for (const key of ['wins', 'nuzWins', 'upgrades', 'global', 'stats', 'settings', 'sagaClears', 'sagaDiffWins', 'teamPresets', 'charUpgrades', 'islandProgress', 'sagaStats', 'pirateKingRewards', 'relicEquipment', 'relicCopies']) {
      if (data.meta[key] !== undefined && !record(data.meta[key])) throw new Error('Progreso inválido.');
    }
    for (const islands of Object.values(data.meta.islandProgress || {})) {
      if (!Array.isArray(islands) || islands.some(i=>!Number.isInteger(i) || i<0)) throw new Error('Progreso de islas inválido.');
    }
    for (const counters of Object.values(data.meta.sagaStats || {})) {
      if (!record(counters) || Object.values(counters).some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('Contadores de saga inválidos.');
    }
    if (Object.values(data.meta.relicEquipment || {}).some(id=>typeof id!=='string') ||
        Object.values(data.meta.relicCopies || {}).some(n=>!Number.isSafeInteger(n)||n<1)) throw new Error('Inventario de reliquias inválido.');
    const t=data.meta.challenge;
    if(t!==undefined&&t!==null){
      const teamSize=t.kind==='legends'?2:1;
      const size=(t.version===2?16:8)/teamSize;
      const validMatch=m=>record(m)&&[m.a,m.b].every(i=>Number.isInteger(i)&&i>=0&&i<size)&&m.a!==m.b&&[null,m.a,m.b].includes(m.winner);
      if(!record(t)||![1,2].includes(t.version)||!['tournament','legends'].includes(t.kind)||
        !Number.isInteger(t.level)||t.level<1||t.level>1000||typeof t.finished!=='boolean'||
        !Array.isArray(t.entrants)||t.entrants.length!==size||t.entrants.some(e=>!record(e)||!Array.isArray(e.members)||e.members.length!==teamSize||e.members.some(id=>typeof id!=='string'))||
        !Array.isArray(t.rounds)||!t.rounds.length||t.rounds.length>Math.log2(size)||t.rounds.some((r,i)=>!record(r)||typeof r.name!=='string'||!Array.isArray(r.matches)||r.matches.length!==size/2**(i+1)||!r.matches.every(validMatch))||
        !Number.isInteger(t.stage)||t.stage<0||t.stage>=t.rounds.length||(t.bronze!==undefined&&!validMatch(t.bronze))||
        ![null,0,1,2,3,4,5,...(size===16?[9]:[])].includes(t.placement)||!Number.isSafeInteger(t.reward)||t.reward<0||
        !Array.isArray(t.pendingRelics)||t.pendingRelics.length>3||t.pendingRelics.some(id=>typeof id!=='string')||
        (t.relicReward!==undefined&&typeof t.relicReward!=='string')) throw new Error('Torneo guardado inválido.');
    }
    const bagTier = data.meta.global?.backpackTier;
    if (bagTier !== undefined && (!Number.isInteger(bagTier) || bagTier < 0 || bagTier > 17)) throw new Error('Ampliación de mochila inválida.');
    for (const key of ['fame', 'accXp', 'towerRecord', 'runnerBest', 'logPoses', 'starPity', 'soloWins', 'totalIslands']) {
      if (data.meta[key] !== undefined && (!Number.isFinite(data.meta[key]) || data.meta[key] < 0)) throw new Error('Progreso inválido.');
    }
    if (data.run !== null && data.run !== undefined) {
      const r = data.run;
      if (r?.backpackVersion !== undefined && r.backpackVersion !== 1) throw new Error('Mochila incompatible.');
      if (r?.pendingLoot !== undefined && !record(r.pendingLoot)) throw new Error('Objetos pendientes inválidos.');
      if (r?.bagLayout !== undefined && (!record(r.bagLayout) || Object.values(r.bagLayout).some(p=>!record(p) || !Number.isInteger(p.cell) || p.cell<0 || p.cell>=60 || typeof p.vertical!=='boolean'))) throw new Error('Distribución de mochila inválida.');
      for (const inventory of [r?.items, r?.pendingLoot]) {
        if (inventory && Object.values(inventory).some(n => !Number.isSafeInteger(n) || n < 0 || n > 100000)) throw new Error('Cantidad de objetos inválida.');
      }
      if (r?.startingTeam !== undefined && (!Array.isArray(r.startingTeam) || r.startingTeam.length < 1 || r.startingTeam.length > 6 || r.startingTeam.some(id => typeof id !== 'string'))) throw new Error('Equipo inicial inválido.');
      if (r?.islandRepeat !== undefined) {
        const repeat=r.islandRepeat;
        if (!record(repeat) || !Number.isInteger(repeat.total) || repeat.total<1 || repeat.total>1000 ||
            ['completed','wins','losses'].some(key=>!Number.isInteger(repeat[key]) || repeat[key]<0) ||
            repeat.completed>repeat.total || repeat.wins+repeat.losses!==repeat.completed ||
            ![null,'win','loss'].includes(repeat.result) || (repeat.result===null ? repeat.completed>=repeat.total : repeat.completed===0) ||
            !r.startingTeam?.length || new Set(r.startingTeam).size!==r.startingTeam.length || ![1,2,3,4,5].includes(r.diff)) throw new Error('Repeticiones de isla inválidas.');
      }
      if (r?.mapIdx !== undefined && (!Number.isInteger(r.mapIdx) || r.mapIdx<0 || r.mapIdx>4)) throw new Error('Mapa de isla inválido.');
      if (r?.campaignVersion !== undefined && r.campaignVersion !== 1) throw new Error('Campaña incompatible.');
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
    return migrateRetiredContent(data);
  }
  // IDs conservados solo para importar guardados anteriores a la retirada de estos personajes.
  const retired = new Set(['naruto','narutokurama','sasuke','kakashi','madara','orochimaru','itadori','yuta','gojo','sukuna','tanjiro','zenitsu','inosuke','nezuko','kibutsuji','goku','vegeta','gohan','gokuui','jiren','cell','frieza','zenosama','saitama','genos','garou','tatsumaki']);
  function migrateRetiredContent(data) {
    const m = data.meta;
    for (const key of ['dex','recruited','roster','defeated']) if (m[key]) m[key] = m[key].filter(id => !retired.has(id));
    for (const key of ['charUpgrades','upgrades','sagaClears']) if (record(m[key])) for (const id of retired) delete m[key][id];
    if (record(m.teamPresets)) for (const key of Object.keys(m.teamPresets)) {
      if (Array.isArray(m.teamPresets[key])) m.teamPresets[key] = m.teamPresets[key].filter(id => !retired.has(id));
    }
    for (const id of ['tri_naruto','tri_jjk','tri_kimetsu','tri_db','tri_opm']) if (m.claimedAch) delete m.claimedAch[id];
    const auto = m.settings?.autoConfig;
    if (record(auto)) {
      delete auto.crossoverAction;
      if (auto.nodePriority === 'crossover') auto.nodePriority = 'random';
      if (Array.isArray(auto.pauseEvents)) auto.pauseEvents = auto.pauseEvents.filter(id => id !== 'crossover');
    }
    const r = data.run;
    if (!r) return data;
    const previousTeamSize = r.team.length;
    r.team = r.team.filter(f => !retired.has(f.id));
    if (previousTeamSize && !r.team.length) { data.run = null; return data; }
    if (r.startingTeam) {
      r.startingTeam = r.startingTeam.filter(id => !retired.has(id));
      if (!r.startingTeam.length) { delete r.startingTeam; delete r.islandRepeat; }
    }
    // El antiguo portal solo se añadía después del jefe, en la última fila.
    let removedPortal = false;
    while (r.map.rows.at(-1)?.every(n => n.type === 'crossover')) { r.map.rows.pop(); removedPortal = true; }
    if (!r.map.rows.length) { data.run = null; return data; }
    r.map.edges = r.map.edges.filter(e => r.map.rows[e[0]]?.[e[1]] && r.map.rows[e[2]]?.[e[3]]);
    if (r.pos && !r.map.rows[r.pos[0]]?.[r.pos[1]]) r.pos = [r.map.rows.length - 1, 0];
    if (removedPortal && r.islandComplete) r.retiredFinalReward = true;
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
