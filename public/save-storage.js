/* A single, device-local JSON save. No network, cookies, account or database. */
(function (root) {
  'use strict';
  const KEY = 'oplike_save';
  const MAX_BYTES = 5 * 1024 * 1024;
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const SAGA_ORDER = ['eastblue','alabasta','skypiea','water7','thriller','sabaody','marineford','gyojin','punkhazard','dressrosa','zou','wholecake','wano','egghead','elbaph'];
  const LEGACY_SAGA_ORDER = SAGA_ORDER.filter(id=>id!=='sabaody'&&id!=='zou'&&id!=='punkhazard');
  function validate(data) {
    if (!record(data) || data.game !== 'grandlinelike' || data.version !== 1 || !record(data.meta)) {
      throw new Error('Ese archivo no es un guardado compatible de GrandLineLike.');
    }
    for (const key of ['dex', 'recruited', 'roster', 'defeated', 'relics']) {
      if (data.meta[key] !== undefined && (!Array.isArray(data.meta[key]) || data.meta[key].some(id => typeof id !== 'string'))) throw new Error('Progreso inválido.');
    }
    for (const key of ['wins', 'nuzWins', 'upgrades', 'global', 'stats', 'settings', 'sagaClears', 'sagaDiffWins', 'teamPresets', 'characterUsage', 'charUpgrades', 'islandProgress', 'sagaStats', 'pirateKingRewards', 'relicEquipment', 'relicCopies']) {
      if (data.meta[key] !== undefined && !record(data.meta[key])) throw new Error('Progreso inválido.');
    }
    if (Object.values(data.meta.characterUsage || {}).some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('Contadores de uso inválidos.');
    for (const islands of Object.values(data.meta.islandProgress || {})) {
      if (!Array.isArray(islands) || islands.some(i=>!Number.isInteger(i) || i<0)) throw new Error('Progreso de islas inválido.');
    }
    for (const counters of Object.values(data.meta.sagaStats || {})) {
      if (!record(counters) || Object.values(counters).some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('Contadores de saga inválidos.');
    }
    if (Object.values(data.meta.relicEquipment || {}).some(id=>typeof id!=='string') ||
        Object.values(data.meta.relicCopies || {}).some(n=>!Number.isSafeInteger(n)||n<1)) throw new Error('Inventario de reliquias inválido.');
    const dailySteps=data.meta.dailySteps;
    if(dailySteps!==undefined&&(!record(dailySteps)||!/^\d{4}-\d{2}-\d{2}$/.test(dailySteps.date)||
        !Number.isSafeInteger(dailySteps.remaining)||dailySteps.remaining<0||dailySteps.remaining>1000)) throw new Error('Pasos diarios inválidos.');
    const t=data.meta.challenge;
    if(t!==undefined&&t!==null){
      const teamSize=t.kind==='legends'?2:1;
      const size=(t.version===2?16:8)/teamSize;
      const validMatch=m=>record(m)&&[m.a,m.b].every(i=>Number.isInteger(i)&&i>=0&&i<size)&&m.a!==m.b&&[null,m.a,m.b].includes(m.winner);
      const series=t.series;
      const validSeries=series===undefined||(record(series)&&Number.isInteger(series.total)&&series.total>=1&&series.total<=1000&&
        Number.isInteger(series.completed)&&series.completed>=0&&series.completed<=series.total&&Number.isInteger(series.wins)&&series.wins>=0&&
        Number.isInteger(series.losses)&&series.losses>=0&&series.wins+series.losses===series.completed&&Array.isArray(series.members)&&
        series.members.length===teamSize&&new Set(series.members).size===teamSize&&series.members.every(id=>typeof id==='string')&&
        (!t.finished?series.completed<series.total:series.completed>0&&(t.placement===1?series.wins>0:series.losses>0)));
      if(!record(t)||![1,2].includes(t.version)||!['tournament','legends'].includes(t.kind)||
        !Number.isInteger(t.level)||t.level<1||t.level>1000||typeof t.finished!=='boolean'||
        !Array.isArray(t.entrants)||t.entrants.length!==size||t.entrants.some(e=>!record(e)||!Array.isArray(e.members)||e.members.length!==teamSize||e.members.some(id=>typeof id!=='string'))||
        !Array.isArray(t.rounds)||!t.rounds.length||t.rounds.length>Math.log2(size)||t.rounds.some((r,i)=>!record(r)||typeof r.name!=='string'||!Array.isArray(r.matches)||r.matches.length!==size/2**(i+1)||!r.matches.every(validMatch))||
        !Number.isInteger(t.stage)||t.stage<0||t.stage>=t.rounds.length||(t.bronze!==undefined&&!validMatch(t.bronze))||
        ![null,0,1,2,3,4,5,...(size===16?[9]:[])].includes(t.placement)||!Number.isSafeInteger(t.reward)||t.reward<0||
        !Array.isArray(t.pendingRelics)||t.pendingRelics.length>3||t.pendingRelics.some(id=>typeof id!=='string')||
        (t.relicReward!==undefined&&typeof t.relicReward!=='string')||!validSeries) throw new Error('Torneo guardado inválido.');
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
      if (r?.autoPaidMapIdx !== undefined && (!Number.isInteger(r.autoPaidMapIdx) || r.autoPaidMapIdx<0 || r.autoPaidMapIdx>4 || r.autoPaidMapIdx>(r.mapIdx||0))) throw new Error('Consumo automático inválido.');
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
    migrateSagaOrder(data);
    return migrateRetiredContent(data);
  }
  function migrateSagaOrder(data) {
    const previous=data.sagaOrder === undefined ? LEGACY_SAGA_ORDER : data.sagaOrder;
    if(!Array.isArray(previous)||!previous.length||previous.some(id=>typeof id!=='string'||!SAGA_ORDER.includes(id))||new Set(previous).size!==previous.length)
      throw new Error('Orden de sagas incompatible.');
    const remap=index=>{
      const next=SAGA_ORDER.indexOf(previous[index]);
      if(!Number.isInteger(index)||next<0)throw new Error('Saga guardada inválida.');
      return next;
    };
    if(data.run)data.run.saga=remap(data.run.saga);
    const recent=data.meta.lastCompletedIsland;
    if(recent&&Number.isInteger(recent.saga))recent.saga=remap(recent.saga);
    if(!previous.includes('punkhazard')){
      const m=data.meta, dress=SAGA_ORDER.indexOf('dressrosa'), punk=SAGA_ORDER.indexOf('punkhazard');
      const wins=m.sagaDiffWins || {};
      if(Object.entries(wins.gyojin || {}).some(([diff,won])=>won&&Number(diff)>=3)||
          Object.keys(wins).some(id=>SAGA_ORDER.indexOf(id)>=dress&&Object.values(wins[id]||{}).some(Boolean))||
          (data.run&&data.run.saga>=dress))m.legacyDressrosaAccess=true;
      if(data.run?.saga===dress){
        const r=data.run;
        if(r.islandIdx===0){r.saga=punk;r.badges=[];}
        else {r.islandIdx--;r.badges=r.badges.filter(i=>i>0).map(i=>i-1);}
      }
      if(recent?.saga===dress&&Number.isInteger(recent.index)){if(recent.index===0)recent.saga=punk;else recent.index--;}
      for(const [key,indices] of Object.entries(m.islandProgress || {})){
        if(!key.startsWith('dressrosa:'))continue;
        if(indices.includes(0))m.islandProgress[key.replace('dressrosa:','punkhazard:')]=[0];
        m.islandProgress[key]=indices.filter(i=>i>0).map(i=>i-1);
      }
      const claims=Object.entries(m.claimedAch || {}).filter(([key])=>/^island_diff_dressrosa_\d+_[1-5]$/.test(key));
      for(const [key] of claims)delete m.claimedAch[key];
      for(const [key,value] of claims){
        const [,index,diff]=key.match(/^island_diff_dressrosa_(\d+)_([1-5])$/);
        m.claimedAch[Number(index)===0?`island_diff_punkhazard_0_${diff}`:`island_diff_dressrosa_${Number(index)-1}_${diff}`]=value;
      }
    }
    if(!previous.includes('sabaody')) {
      // Preserve already-earned Marineford access without inventing Sabaody wins.
      const wins=data.meta.sagaDiffWins || {};
      if(Object.entries(wins.thriller || {}).some(([diff,won])=>won&&Number(diff)>=3)||
          Object.keys(wins).some(id=>SAGA_ORDER.indexOf(id)>=6&&Object.values(wins[id]||{}).some(Boolean))||
          (data.run&&data.run.saga>=6))data.meta.legacyMarinefordAccess=true;
    }
    if(!previous.includes('zou')){
      const wins=data.meta.sagaDiffWins || {};
      if(Object.entries(wins.dressrosa || {}).some(([diff,won])=>won&&Number(diff)>=3)||
          Object.keys(wins).some(id=>SAGA_ORDER.indexOf(id)>=SAGA_ORDER.indexOf('wholecake')&&Object.values(wins[id]||{}).some(Boolean))||
          (data.run&&data.run.saga>=SAGA_ORDER.indexOf('wholecake')))data.meta.legacyWholeCakeAccess=true;
    }
    data.sagaOrder=[...SAGA_ORDER];
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
    return { game: 'grandlinelike', version: 1, sagaOrder:[...SAGA_ORDER], date: new Date().toISOString(), user: 'local', meta, run: run || null };
  }
  function create(getStorage) {
    return {
      read() {
        const storage = getStorage();
        const current = storage.getItem(KEY);
        if (current !== null) return parse(current);
        const oldMeta = storage.getItem('oplike_meta');
        const oldRun = storage.getItem('oplike_run');
        if(!oldMeta)return null;
        const legacy=payload(JSON.parse(oldMeta),oldRun?JSON.parse(oldRun):null);
        delete legacy.sagaOrder;
        return validate(legacy);
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
