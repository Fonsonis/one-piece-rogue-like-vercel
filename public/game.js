// ============ GRAND LINE LIKE — Motor del juego ============
'use strict';

const $ = sel => document.querySelector(sel);
const app = $('#app');
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Mapa forma evolucionada -> forma base (para el roster de iniciales)
const BASE_OF = {};
for (const [id, c] of Object.entries(CHARS)) if (c.evo) BASE_OF[c.evo.to] = id;
function baseFormOf(id) { while (BASE_OF[id]) id = BASE_OF[id]; return id; }

// ---------- Sprites de personajes ----------
// Coloca cada PNG en la carpeta sprites/ con el nombre <id>.png (o mapeado en SPRITES) y añade el id aquí.
const SPRITES = {
  luffy: 'luffy',
  zoro: 'zoro',
  nami: 'nami',
  usopp: 'usopp',
  usopp2: 'usopp2',
  sanji: 'sanji',
  arlong: 'arlong',
  bandido: 'bandido',
  marineraso: 'marineraso',
  benn: 'benn',
  brook: 'brook',
  buggy: 'buggy',
  morgan: 'morgan',
  chopper: 'chopper',
  coby: 'coby',
  crocodile: 'crocodile',
  enel: 'enel',
  franky: 'franky',
  gin: 'gin',
  marco: 'marco',
  mihawk: 'mihawk',
  robin: 'robin',
  lucci: 'lucci',
  shanks: 'shanks',
  smoker: 'smoker',
  tashigi: 'tashigi',
  vivi: 'vivi',
  wapol: 'wapol',
};

function spriteOf(id) {
  if (Array.isArray(SPRITES)) {
    if (SPRITES.includes(id)) return id;
    const b = baseFormOf(id);
    return SPRITES.includes(b) ? b : null;
  }
  if (SPRITES[id]) return SPRITES[id];
  const b = baseFormOf(id);
  return SPRITES[b] || null;
}
// Icono de personaje: sprite PNG si existe, emoji si no
function charIcon(id, px = 26) {
  const s = spriteOf(id);
  // si el PNG no está (aún), vuelve al emoji en vez de mostrar una imagen rota
  return s ? `<img class="pix" src="sprites/${s}.png" style="height:${px}px" alt="${CHARS[id].name}" onerror="this.replaceWith('${CHARS[id].emoji}')">`
    : CHARS[id].emoji;
}

// ---------- Guardado en este dispositivo ----------
const localSave = GameSaveStorage.create(() => localStorage);
let loadedSave = null;
let saveReadError = false;
let saveWriteError = false;
let lastSavedAt = null;
try {
  loadedSave = localSave.read();
  lastSavedAt = loadedSave?.date || null;
} catch (e) {
  saveReadError = true;
}

let autoMode = false;
let autoTimer = null;
let autoSettings = {
  speed: 'x2', // 'x1' (normal, mitad) o 'x2' (rápida, actual)
  healThreshold: 50, // 0 = desactivo, 25, 50, 75, 99
  nodePriority: 'random', // 'random', 'item', 'battle', 'rest'
  wildAction: 'fight', // 'fight', 'recruit', 'chains'
  shopItems: [
    { id: 'carne', qty: 3 },
    { id: 'sake', qty: 2 },
    { id: 'cartel', qty: 2 },
  ],
};

function stopAutoMode() {
  autoMode = false;
  if (autoTimer) {
    clearTimeout(autoTimer);
    autoTimer = null;
  }
  toast('⏹️ Modo Automático DETENIDO');
  screenMap();
}

function scheduleAutoStep(fn, ms = 700) {
  if (!autoMode) return;
  if (autoTimer) clearTimeout(autoTimer);
  const mult = (autoSettings.speed === 'x1') ? 2 : 1;
  autoTimer = setTimeout(() => {
    autoTimer = null;
    if (autoMode) fn();
  }, ms * mult);
}

function runAutoItems() {
  if (!autoMode || !autoSettings.healThreshold) return;
  const isCombat = typeof battle !== 'undefined' && battle && !battle.over;
  const targetRun = isCombat ? { items: battle.items, team: battle.pTeam } : run;
  if (!targetRun || !targetRun.items || !targetRun.team) return;
  const isNuz = typeof run !== 'undefined' && run && run.mode === 'nuzlocke';
  const thresh = autoSettings.healThreshold;

  if (!isNuz && (targetRun.items.sake || 0) > 0) {
    const dead = targetRun.team.find(f => f.hp <= 0);
    if (dead) {
      targetRun.items.sake--;
      dead.hp = Math.floor(dead.maxhp * 0.5);
      const msg = `🤖 Auto: ${charName(dead)} revivido con Sake 🍶`;
      if (isCombat) log(msg); else toast(msg);
    }
  }
  for (const f of targetRun.team) {
    if (f.hp > 0) {
      const pct = (f.hp / f.maxhp) * 100;
      if (pct <= thresh) {
        if ((targetRun.items.carnereal || 0) > 0 && f.hp < f.maxhp * 0.5) {
          targetRun.items.carnereal--;
          f.hp = f.maxhp;
          const msg = `🤖 Auto: Carne Real usada en ${charName(f)} 🥩`;
          if (isCombat) log(msg); else toast(msg);
        } else if ((targetRun.items.carne || 0) > 0) {
          targetRun.items.carne--;
          f.hp = Math.min(f.maxhp, f.hp + 40);
          const msg = `🤖 Auto: Carne usada en ${charName(f)} 🍖`;
          if (isCombat) log(msg); else toast(msg);
        } else if ((targetRun.items.bocadillo || 0) > 0) {
          targetRun.items.bocadillo--;
          f.hp = Math.min(f.maxhp, f.hp + 25);
          const msg = `🤖 Auto: Bocadillo usado en ${charName(f)} 🥪`;
          if (isCombat) log(msg); else toast(msg);
        }
      }
    }
  }
  if (isCombat) {
    refreshHPCards();
    refreshControls();
  } else if (typeof saveRun === 'function') {
    saveRun();
  }
}

function pickAutoNode(reach) {
  if (!reach || !reach.length) return null;
  const pref = autoSettings.nodePriority;
  if (pref === 'random') return pick(reach);

  const rows = run.map.rows;
  let matches = [];
  if (pref === 'item') {
    matches = reach.filter(([r, i]) => ['item', 'mystery', 'shop'].includes(rows[r][i].type));
  } else if (pref === 'battle') {
    matches = reach.filter(([r, i]) => ['wild', 'marine', 'boss'].includes(rows[r][i].type));
  } else if (pref === 'rest') {
    matches = reach.filter(([r, i]) => ['rest', 'shop', 'item'].includes(rows[r][i].type));
  }

  if (matches.length > 0) return pick(matches);
  return pick(reach);
}

function showAutoSettingsModal() {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" style="max-width:440px;">
    <h2>🤖 Opciones del Modo Automático</h2>
    
    <div style="display:flex;flex-direction:column;gap:12px;margin:14px 0;text-align:left;">
      
      <div style="background:rgba(0,0,0,0.3);padding:10px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);">
        <label style="font-size:9px;font-weight:bold;color:var(--gold);display:block;margin-bottom:4px;">
          ⚡ Velocidad del Modo Automático
        </label>
        <div style="font-size:7.5px;color:#aaa;margin-bottom:6px;">Elige el ritmo de avance en mapa y combate:</div>
        <select id="auto-speed-sel" style="width:100%;padding:5px;font-size:9px;background:#222;color:#fff;border:1px solid #555;border-radius:4px;">
          <option value="x2" ${autoSettings.speed === 'x2' || !autoSettings.speed ? 'selected' : ''}>⚡ Modo x2 (Rápido - Velocidad actual)</option>
          <option value="x1" ${autoSettings.speed === 'x1' ? 'selected' : ''}>🚶 Modo x1 (Normal - Mitad de velocidad)</option>
        </select>
      </div>

      <div style="background:rgba(0,0,0,0.3);padding:10px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);">
        <label style="font-size:9px;font-weight:bold;color:var(--gold);display:block;margin-bottom:4px;">
          🍖 Consumo Automático de Objetos
        </label>
        <div style="font-size:7.5px;color:#aaa;margin-bottom:6px;">Usar objetos de curación o Sake cuando el PS baje de:</div>
        <select id="auto-heal-sel" style="width:100%;padding:5px;font-size:9px;background:#222;color:#fff;border:1px solid #555;border-radius:4px;">
          <option value="0" ${autoSettings.healThreshold === 0 ? 'selected' : ''}>❌ Desactivado (no usar objetos)</option>
          <option value="25" ${autoSettings.healThreshold === 25 ? 'selected' : ''}>❤️ Crítico: Menos del 25% de PS</option>
          <option value="50" ${autoSettings.healThreshold === 50 ? 'selected' : ''}>🧡 Medio: Menos del 50% de PS</option>
          <option value="75" ${autoSettings.healThreshold === 75 ? 'selected' : ''}>💛 Leve: Menos del 75% de PS</option>
          <option value="99" ${autoSettings.healThreshold === 99 ? 'selected' : ''}>💚 Cualquier daño recibido (<100% PS)</option>
        </select>
      </div>

      <div style="background:rgba(0,0,0,0.3);padding:10px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);">
        <label style="font-size:9px;font-weight:bold;color:var(--gold);display:block;margin-bottom:4px;">
          🗺️ Prioridad de Rutas en el Mapa
        </label>
        <div style="font-size:7.5px;color:#aaa;margin-bottom:6px;">Tipo de casilla preferida al elegir camino:</div>
        <select id="auto-node-sel" style="width:100%;padding:5px;font-size:9px;background:#222;color:#fff;border:1px solid #555;border-radius:4px;">
          <option value="random" ${autoSettings.nodePriority === 'random' ? 'selected' : ''}>🎲 Al azar / Sin preferencia</option>
          <option value="item" ${autoSettings.nodePriority === 'item' ? 'selected' : ''}>🎁 Priorizar Tesoros, Misterios y Tiendas</option>
          <option value="battle" ${autoSettings.nodePriority === 'battle' ? 'selected' : ''}>⚔️ Priorizar Enfrentamientos y Combates</option>
          <option value="rest" ${autoSettings.nodePriority === 'rest' ? 'selected' : ''}>⛺ Priorizar Campamentos y Descanso</option>
        </select>
      </div>

      <div style="background:rgba(0,0,0,0.3);padding:10px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);">
        <label style="font-size:9px;font-weight:bold;color:var(--gold);display:block;margin-bottom:4px;">
          🏴‍☠️ Encuentros con Piratas Salvajes
        </label>
        <div style="font-size:7.5px;color:#aaa;margin-bottom:6px;">Acción por defecto al encontrar un pirata salvaje:</div>
        <select id="auto-wild-sel" style="width:100%;padding:5px;font-size:9px;background:#222;color:#fff;border:1px solid #555;border-radius:4px;">
          <option value="fight" ${autoSettings.wildAction === 'fight' ? 'selected' : ''}>⚔️ Luchar (ganar Experiencia para la banda)</option>
          <option value="recruit" ${autoSettings.wildAction === 'recruit' ? 'selected' : ''}>💋 Reclutar / Seducir (pagando Berries)</option>
          <option value="chains" ${autoSettings.wildAction === 'chains' ? 'selected' : ''}>⛓️ Tentar a la suerte (3 Cadenas)</option>
        </select>
      </div>

      <div style="background:rgba(0,0,0,0.3);padding:10px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);">
        <label style="font-size:9px;font-weight:bold;color:var(--gold);display:block;margin-bottom:4px;">
          🏪 Compras Automáticas en Tiendas (Prioridad de 3 Objetos)
        </label>
        <div style="font-size:7.5px;color:#aaa;margin-bottom:8px;">
          Elige 3 objetos en orden de prioridad y cuántos deseas mantener en inventario:
        </div>
        ${[0, 1, 2].map(idx => {
    const sList = autoSettings.shopItems || [];
    const itemSetting = sList[idx] || { id: 'none', qty: 0 };
    return `
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
            <span style="font-size:9px;font-weight:bold;color:var(--gold);width:16px;">#${idx + 1}</span>
            <select id="auto-shop-item-${idx}" style="flex:1;padding:4px;font-size:8.5px;background:#222;color:#fff;border:1px solid #555;border-radius:4px;">
              <option value="none" ${itemSetting.id === 'none' ? 'selected' : ''}>❌ Ninguno (vacío)</option>
              <option value="carne" ${itemSetting.id === 'carne' ? 'selected' : ''}>🍖 Carne de Cerdo (40 PS)</option>
              <option value="carnereal" ${itemSetting.id === 'carnereal' ? 'selected' : ''}>🥩 Carne Real (100% PS)</option>
              <option value="bocadillo" ${itemSetting.id === 'bocadillo' ? 'selected' : ''}>🥪 Bocadillo de Arroz (25 PS)</option>
              <option value="sake" ${itemSetting.id === 'sake' ? 'selected' : ''}>🍶 Sake de Binks (Revivir)</option>
              <option value="cartel" ${itemSetting.id === 'cartel' ? 'selected' : ''}>📜 Cartel de Recluta (1 Cadena)</option>
              <option value="carteldorado" ${itemSetting.id === 'carteldorado' ? 'selected' : ''}>🏅 Cartel Dorado (2 Cadenas)</option>
              <option value="cartelbuster" ${itemSetting.id === 'cartelbuster' ? 'selected' : ''}>📯 Buster Call (3 Cadenas)</option>
              <option value="hierro" ${itemSetting.id === 'hierro' ? 'selected' : ''}>🛡️ Hierro Forjado (Exp)</option>
            </select>
            <span style="font-size:8px;color:#aaa;">Hasta:</span>
            <select id="auto-shop-qty-${idx}" style="width:50px;padding:4px;font-size:8.5px;background:#222;color:#fff;border:1px solid #555;border-radius:4px;">
              <option value="0" ${itemSetting.qty === 0 ? 'selected' : ''}>0</option>
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(q => `<option value="${q}" ${itemSetting.qty === q ? 'selected' : ''}>${q}</option>`).join('')}
            </select>
          </div>`;
  }).join('')}
      </div>

    </div>

    <div class="actions" style="flex-direction:column;gap:6px;">
      <button class="btn green" id="auto-apply-start">▶️ ${autoMode ? 'GUARDAR Y CONTINUAR' : 'ACTIVAR MODO AUTOMÁTICO'}</button>
      ${autoMode ? `<button class="btn red" id="auto-apply-stop">⏹️ DESACTIVAR MODO AUTOMÁTICO</button>` : ''}
      <button class="btn gray" id="auto-apply-close">CANCELAR / CERRAR</button>
    </div>
  </div>`;

  document.body.appendChild(ov);

  const saveFormSettings = () => {
    autoSettings.speed = ov.querySelector('#auto-speed-sel').value;
    autoSettings.healThreshold = +ov.querySelector('#auto-heal-sel').value;
    autoSettings.nodePriority = ov.querySelector('#auto-node-sel').value;
    autoSettings.wildAction = ov.querySelector('#auto-wild-sel').value;
    autoSettings.shopItems = [0, 1, 2].map(idx => ({
      id: ov.querySelector(`#auto-shop-item-${idx}`).value,
      qty: +ov.querySelector(`#auto-shop-qty-${idx}`).value
    }));
  };

  ov.querySelector('#auto-apply-start').onclick = () => {
    saveFormSettings();
    autoMode = true;
    ov.remove();
    toast('🤖 Modo Automático ACTIVADO');
    screenMap();
  };

  if (autoMode) {
    const stopBtn = ov.querySelector('#auto-apply-stop');
    if (stopBtn) {
      stopBtn.onclick = () => {
        ov.remove();
        stopAutoMode();
      };
    }
  }

  ov.querySelector('#auto-apply-close').onclick = () => ov.remove();
}

// ---------- Dificultades de la aventura ----------
const DIFFICULTIES = [
  { id: 1, name: 'Grumete', emoji: '⚓', mult: 1.00, desc: 'Normal (Atributos base de la saga)' },
  { id: 2, name: 'Pirata', emoji: '🏴‍☠️', mult: 1.30, desc: 'Desafiante (rivales +30% atributos)' },
  { id: 3, name: 'Capitán', emoji: '⚔️', mult: 1.65, desc: 'Difícil (rivales +65% atributos — algo menor que la saga posterior)' },
  { id: 4, name: 'Supernova', emoji: '⚡', mult: 2.15, desc: 'Muy Difícil (rivales +115% atributos — muy superior al jefe de la saga posterior)' },
  { id: 5, name: 'Rey Pirata', emoji: '👑', mult: 2.75, desc: 'Extremo (rivales +175% atributos — equivalente al jefe de la 2ª saga posterior)' },
];
let selectedDiff = 1;

// ---------- Meta persistente ----------
const META_DEFAULTS = () => ({
  wins: {}, nuzWins: {}, dex: [], recruited: [], roster: [], towerRecord: 0,
  fame: 0, upgrades: {}, accXp: 0, global: {}, defeated: [],
  sagaClears: {}, // id base -> nº de sagas conquistadas con ese nakama en la banda
  sagaDiffWins: {}, // sagaId -> { diffLevel: true }
  teamPresets: { 1: [], 2: [], 3: [] },
  stats: { kills: 0, items: 0 },
  relics: [],
  soloWins: 0,
  logPoses: 0,
  starPity: 0,
  charUpgrades: {},
  settings: { showEventConfirm: true, customSounds: false, theme: 'light', mobileColumns: 3 },
});
let meta = META_DEFAULTS();
function loadMeta() {
  meta = META_DEFAULTS();
  try {
    if (loadedSave) meta = Object.assign(meta, loadedSave.meta);
  } catch (e) { }
  meta.logPoses = meta.logPoses || 0;
  meta.starPity = meta.starPity || 0;
  meta.charUpgrades = meta.charUpgrades || {};
  meta.roster = meta.roster || [];
  if (!meta.roster.includes('luffy')) {
    meta.roster.push('luffy');
  }
  meta.settings = Object.assign({ showEventConfirm: true, customSounds: false, theme: 'light', mobileColumns: 3 }, meta.settings || {});
  if (!meta.totalIslands) {
    const totalWins = Object.values(meta.wins || {}).reduce((a, b) => a + b, 0) +
      Object.values(meta.nuzWins || {}).reduce((a, b) => a + b, 0);
    const rosterCount = (meta.roster || []).length;
    const dexCount = (meta.dex || []).length;
    meta.totalIslands = totalWins * 4 + Math.floor(dexCount / 2) + rosterCount;
  }
}
loadMeta();

// Keep meta and the last saved journey together in one JSON document.
let savedRun = loadedSave?.run || null;
function saveStatusText() {
  if (saveReadError) return 'No se pudo leer el guardado. Importa una copia o pulsa Guardar.';
  if (saveWriteError) return 'No se pudo guardar. Exporta una copia JSON.';
  return lastSavedAt ? 'Guardado en este dispositivo · ' + new Date(lastSavedAt).toLocaleTimeString('es', {hour:'2-digit', minute:'2-digit'}) : 'Partida local · sin cuentas';
}
function updateSaveStatus() {
  const el = document.getElementById?.('local-save-status');
  if (el) el.textContent = saveStatusText();
}
function persistLocalSave(journey = savedRun, explicit = false) {
  if (saveReadError && !explicit) return false;
  try {
    const data = GameSaveStorage.payload(meta, journey);
    // Snapshot before writing so later combat mutations do not alter the saved checkpoint.
    const snapshot = JSON.parse(JSON.stringify(data));
    localSave.write(snapshot);
    savedRun = snapshot.run;
    loadedSave = snapshot;
    lastSavedAt = snapshot.date;
    saveReadError = false;
    saveWriteError = false;
    updateSaveStatus();
    return true;
  } catch (e) {
    if (!saveWriteError) toast('⚠️ No se pudo guardar en este navegador. Exporta un JSON para conservar tu progreso.');
    saveWriteError = true;
    updateSaveStatus();
    return false;
  }
}
function saveMeta() { return persistLocalSave(); }
function manualSave() {
  if (battle) return toast('💾 Termina el combate para guardar el viaje. El progreso se conserva en cada punto de guardado.');
  const write = () => {
    if (persistLocalSave(run, true)) toast('💾 Partida guardada en este dispositivo');
  };
  if (saveReadError) {
    modalConfirm('💾 ¿Sustituir el guardado?', 'No se pudo leer la copia anterior. Guardar la sustituirá por el progreso actual.', write);
  } else write();
}

// ---------- Copias JSON portátiles, compatibles con el juego original ----------
function exportSave() {
  const payload = GameSaveStorage.payload(meta, battle ? savedRun : run);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = 'grandlinelike.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('💾 Copia JSON exportada');
}
function importSaveFile(file) {
  if (file.size > GameSaveStorage.MAX_BYTES) return toast('❌ El archivo de guardado es demasiado grande.');
  const reader = new FileReader();
  reader.onerror = () => toast('❌ No se pudo leer el archivo.');
  reader.onload = () => {
    try {
      const data = GameSaveStorage.parse(reader.result);
      validateGameSave(data);
      const nextMeta = Object.assign(META_DEFAULTS(), data.meta);
      nextMeta.settings = Object.assign({ showEventConfirm: true, customSounds: false, theme: 'light', mobileColumns: 3 }, nextMeta.settings);
      if (!nextMeta.roster.includes('luffy')) nextMeta.roster.push('luffy');
      const nextRun = data.run || null;
      if (nextRun) {
        if (nextRun.mode === 'nuzlocke') nextRun.team = nextRun.team.filter(f => f.hp > 0);
        nextRun.team.forEach(migrateFighter);
      }
      const snapshot = GameSaveStorage.payload(nextMeta, nextRun);
      // Do not replace the current game unless both validation and persistence succeed.
      localSave.write(snapshot);
      meta = nextMeta;
      run = nextRun;
      savedRun = JSON.parse(JSON.stringify(nextRun));
      loadedSave = snapshot;
      lastSavedAt = snapshot.date;
      saveReadError = false;
      saveWriteError = false;
      autoMode = false;
      clearTimeout(autoTimer);
      toast('📂 Partida cargada y guardada en este dispositivo');
      screenHome();
    } catch (e) {
      toast('❌ No se pudo cargar: archivo inválido o guardado local no disponible. Tu partida anterior se conserva.');
    }
  };
  reader.readAsText(file);
}
function validateGameSave(data) {
  for (const key of ['dex', 'recruited', 'roster', 'defeated']) {
    if (data.meta[key]?.some(id => !CHARS[id])) throw new Error('Personaje desconocido.');
  }
  const r = data.run;
  if (!r) return;
  if (!SAGAS[r.saga]?.islands[r.islandIdx] || r.team.some(f => !CHARS[f.id] || f.moves.some(id => !MOVES[id]))) throw new Error('Viaje incompatible.');
  if (r.map.rows.some(row => row.some(node => !NODE_TYPES[node.type]))) throw new Error('Mapa incompatible.');
}

// Nivel de cuenta: sube de forma exponencial con los PX de cuenta (se ganan a la par que la Fama)
const SAGA_LEVEL_CAPS = [7, 15, 20, 25, 30, 35, 40, 45, 50, 55, 100];

function getMaxAccountLevelCap() {
  if (typeof SAGAS === 'undefined' || !SAGAS.length) return 7;
  let highest = 0;
  for (let i = 0; i < SAGAS.length; i++) {
    if (typeof sagaUnlocked === 'function' && sagaUnlocked(i)) {
      highest = i;
    }
  }
  return SAGA_LEVEL_CAPS[highest] !== undefined ? SAGA_LEVEL_CAPS[highest] : 100;
}

function xpForAccLevel(lvl) {
  if (lvl <= 1) return 0;
  return Math.floor(100 * (Math.pow(1.115, lvl - 1) - 1) / 0.115);
}
function accountLevel() {
  const xp = meta.accXp || 0;
  let lvl = 1;
  while (xpForAccLevel(lvl + 1) <= xp) {
    lvl++;
    if (lvl >= 100) break;
  }
  const cap = getMaxAccountLevelCap();
  return Math.min(lvl, cap);
}
function accountNextAt() {
  const lvl = accountLevel();
  return xpForAccLevel(lvl + 1);
}
function gainFame(n) {
  meta.fame += n;
  meta.accXp = (meta.accXp || 0) + n;
  saveMeta();
}

// ---------- Estado de la partida ----------
let run = null; // partida actual (historia)
function saveRun() {
  if (run && run.mode === 'nuzlocke' && run.team) {
    run.team = run.team.filter(f => f && f.hp > 0);
  }
  return persistLocalSave(run);
}
function clearRun() {
  run = null;
  return persistLocalSave(null);
}
function loadRun() {
  run = null;
  try {
    if (loadedSave?.run) run = JSON.parse(JSON.stringify(loadedSave.run));
  } catch (e) { }
  if (run && run.mode === 'nuzlocke' && run.team) {
    run.team = run.team.filter(f => f && f.hp > 0);
  }
  if (run && run.team) run.team.forEach(migrateFighter);
}
function migrateFighter(f) {
  const current = CHARS[f.id];
  if (current && (f.moveRulesVersion || 0) < 2) {
    // El aprendizaje es automático: actualizar únicamente las fichas corregidas.
    // Conserva niveles, PS, EXP, fusiones, mejoras y todo el resto del JSON.
    if (current.generated || ['buggy','gin','coby','coby2'].includes(f.id)) {
      f.moves = current.learnset.filter(([level]) => level <= f.lvl).map(([,move]) => move).slice(-2);
      if (!f.moves.length) f.moves = [current.learnset[0][1]];
    }
    f.moveRulesVersion = 2;
  }
  if (f.spatk == null && CHARS[f.id]) {
    f.spatk = statAt(CHARS[f.id].base[3], f.lvl) + (f.atkBonus || 0);
    f.spdef = statAt(CHARS[f.id].base[4], f.lvl) + (f.defBonus || 0);
  }
  if (f.spatkBonus == null) { f.spatkBonus = f.atkBonus || 0; f.spdefBonus = f.defBonus || 0; }
  if (f.ultCharge == null) f.ultCharge = 0;
  if (f.moves && f.moves.length > 2) f.moves = f.moves.slice(-2);
  return f;
}
loadRun();

// ---------- Modelo de personaje ----------
function statAt(base, lvl) { return Math.floor(base * (1 + 0.085 * (lvl - 1))); }
function hpAt(base, lvl) { return Math.floor(base * (1 + 0.11 * (lvl - 1))) + lvl; }
function xpForLevel(lvl) { return Math.floor(lvl * lvl * 6); }

function xpBarHTML(f) {
  const maxed = f.lvl >= 99, goal = xpForLevel(f.lvl);
  const value = maxed ? goal : clamp(Number(f.xp) || 0, 0, goal);
  const label = maxed ? 'Nivel máximo' : `EXP ${value}/${goal} · siguiente nivel ${f.lvl + 1}`;
  return `<div class="xp-progress" data-level="${f.lvl}" title="${label}"><span class="xp-caption">${maxed ? 'NV. MÁX.' : 'EXP · NV. ' + f.lvl}</span><div class="xp-bar" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${value}"><i style="width:${value / goal * 100}%"></i></div></div>`;
}

function makeChar(id, lvl, isEnemy = false) {
  const c = CHARS[id];
  const moves = c.learnset.filter(([l]) => l <= lvl).map(([, m]) => m).slice(-2);
  if (!moves.length) moves.push(c.learnset[0][1]); // nunca sin movimientos
  let diffMult = 1.0;
  if (isEnemy && typeof run !== 'undefined' && run && run.diff > 1) {
    const dObj = DIFFICULTIES.find(d => d.id === run.diff);
    if (dObj) diffMult = dObj.mult;
  }
  const hpVal = Math.floor(hpAt(c.base[0], lvl) * diffMult);
  return {
    id, lvl,
    hp: hpVal, maxhp: hpVal,
    atk: Math.floor(statAt(c.base[1], lvl) * diffMult),
    def: Math.floor(statAt(c.base[2], lvl) * diffMult),
    spatk: Math.floor(statAt(c.base[3], lvl) * diffMult),
    spdef: Math.floor(statAt(c.base[4], lvl) * diffMult),
    spd: Math.floor(statAt(c.base[5], lvl) * diffMult),
    atkBonus: 0, defBonus: 0, spatkBonus: 0, spdefBonus: 0,
    xp: 0, moves, ultCharge: 0, moveRulesVersion: 2,
  };
}
// Aplica las mejoras permanentes del Barco (solo a personajes del jugador)
function applyUpgrades(f) {
  const u = meta.upgrades[baseFormOf(f.id)];
  if (!u) return f;
  f.hpBonus = (u.hp || 0) * 6;
  f.spdBonus = (u.spd || 0) * 2;
  f.maxhp += f.hpBonus;
  if (f.hp > 0) {
    f.hp = Math.min(f.maxhp, f.hp + f.hpBonus);
  }
  const atkAdd = (u.atk || 0) * 2;
  const defAdd = (u.def || 0) * 2;
  const spatkAdd = (u.spatk || 0) * 2;
  const spdefAdd = (u.spdef || 0) * 2;
  f.atkBonus += atkAdd; f.atk += atkAdd;
  f.defBonus += defAdd; f.def += defAdd;
  f.spatkBonus = (f.spatkBonus || 0) + spatkAdd; f.spatk += spatkAdd;
  f.spdefBonus = (f.spdefBonus || 0) + spdefAdd; f.spdef += spdefAdd;
  f.spd += f.spdBonus;
  return f;
}

const charData = f => CHARS[f.id];
const charName = f => CHARS[f.id].name;

function gainXP(f, amount, log) {
  f.xp += amount;
  const msgs = [];
  while (f.xp >= xpForLevel(f.lvl) && f.lvl < 99) {
    f.xp -= xpForLevel(f.lvl);
    f.lvl++;
    const c = CHARS[f.id];
    const oldMax = f.maxhp;
    f.maxhp = hpAt(c.base[0], f.lvl) + (f.hpBonus || 0);
    if (f.hp > 0) {
      f.hp = Math.min(f.maxhp, f.hp + (f.maxhp - oldMax));
    }
    f.atk = statAt(c.base[1], f.lvl) + f.atkBonus;
    f.def = statAt(c.base[2], f.lvl) + f.defBonus;
    f.spatk = statAt(c.base[3], f.lvl) + (f.spatkBonus || 0);
    f.spdef = statAt(c.base[4], f.lvl) + (f.spdefBonus || 0);
    f.spd = statAt(c.base[5], f.lvl) + (f.spdBonus || 0);
    msgs.push(`¡${c.name} sube al nivel ${f.lvl}!`);
    // nuevos movimientos (máximo 2 ataques regulares)
    for (const [l, m] of c.learnset) {
      if (l === f.lvl && !f.moves.includes(m)) {
        f.moves.push(m);
        if (f.moves.length > 2) f.moves.shift();
        msgs.push(`¡${c.name} aprende ${MOVES[m].name}!`);
      }
    }
    // transformación
    if (c.evo && f.lvl >= c.evo.lvl) {
      const to = c.evo.to;
      msgs.push(`✨ ¡${c.name} se transforma en ${CHARS[to].name}!`);
      f.id = to;
      const nc = CHARS[to];
      f.maxhp = hpAt(nc.base[0], f.lvl) + (f.hpBonus || 0);
      if (f.hp > 0) f.hp = f.maxhp;
      f.atk = statAt(nc.base[1], f.lvl) + f.atkBonus;
      f.def = statAt(nc.base[2], f.lvl) + f.defBonus;
      f.spatk = statAt(nc.base[3], f.lvl) + (f.spatkBonus || 0);
      f.spdef = statAt(nc.base[4], f.lvl) + (f.spdefBonus || 0);
      f.spd = statAt(nc.base[5], f.lvl) + (f.spdBonus || 0);
      const nm = nc.learnset.filter(([l]) => l <= f.lvl).map(([, m]) => m).slice(-2);
      for (const m of nm) if (!f.moves.includes(m)) { f.moves.push(m); if (f.moves.length > 2) f.moves.shift(); }
      registerDex(to);
    }
  }
  if (log) msgs.forEach(m => log(m));
  return msgs;
}

function registerDex(id) {
  if (!meta.dex.includes(id)) { meta.dex.push(id); saveMeta(); }
}
function registerRecruit(id) {
  registerDex(id);
  if (!meta.recruited.includes(id)) { meta.recruited.push(id); saveMeta(); }
}
// Desbloquea para futuras aventuras a todos los nakamas de la banda actual al superar un jefe
function unlockRoster(allowBosses = true) {
  const added = [];
  for (const f of run.team) {
    const b = baseFormOf(f.id);
    if (!meta.roster.includes(b)) {
      meta.roster.push(b);
      added.push(b);
    }
  }
  if (added.length) saveMeta();
  return added;
}

// ---------- Generación de mapa ----------
const NODE_TYPES = {
  wild: { emoji: '🏴‍☠️', label: 'Pirata salvaje' },
  marine: { emoji: '⚓', label: 'Combate Marine' },
  item: { emoji: '🎁', label: 'Objeto' },
  mystery: { emoji: '❓', label: 'Misterio' },
  shop: { emoji: '🏪', label: 'Tienda' },
  rest: { emoji: '⛺', label: 'Campamento' },
  special: { emoji: '🌟', label: 'Pirata especial' },
  boss: { emoji: '💀', label: 'Jefe' },
  crossover: { emoji: '🌀', label: 'Camino alternativo' },
};

function genMap(island) {
  const rows = island.rows;
  const map = { rows: [], edges: [] };
  let prevRow = null;
  for (let r = 0; r < rows; r++) {
    const isBoss = r === rows - 1;
    const count = isBoss ? 1 : rnd(2, 4);
    const row = [];
    for (let i = 0; i < count; i++) {
      let type;
      if (isBoss) type = 'boss';
      else if (r === 0) type = pick(['wild', 'wild', 'marine']);
      else {
        const roll = Math.random();
        if (roll < 0.36) type = 'wild';
        else if (roll < 0.55) type = 'marine';
        else if (roll < 0.67) type = 'mystery';
        else if (roll < 0.79) type = 'item';
        else if (roll < 0.89) type = 'rest';
        else if (roll < 0.95) type = 'shop';
        else type = 'special';
      }
      row.push({ r, i, type, done: false });
    }
    // garantiza una tienda y un campamento a mitad de isla
    if (r === Math.floor(rows / 2) && !row.some(n => n.type === 'shop')) row[0].type = 'shop';
    if (r === Math.floor(rows / 2) + 1 && !row.some(n => n.type === 'rest')) row[0].type = 'rest';
    map.rows.push(row);
    if (prevRow) {
      // conecta cada nodo de la fila anterior con 1-2 cercanos de esta
      for (let i = 0; i < prevRow.length; i++) {
        const t1 = Math.floor(i * row.length / prevRow.length);
        const t2 = Math.min(row.length - 1, t1 + (Math.random() < 0.5 ? 1 : 0));
        map.edges.push([r - 1, i, r, t1]);
        if (t2 !== t1) map.edges.push([r - 1, i, r, t2]);
      }
      // asegura que todo nodo de esta fila tenga entrada
      for (let j = 0; j < row.length; j++) {
        if (!map.edges.some(e => e[2] === r && e[3] === j)) {
          map.edges.push([r - 1, rnd(0, prevRow.length - 1), r, j]);
        }
      }
    }
    prevRow = row;
  }
  // Camino alternativo (crossover): en la última isla de la saga aparece un
  // nodo aparentemente sin salida, con una única conexión desde el jefe final.
  if (island.final) {
    const bossR = map.rows.length - 1;
    map.rows.push([{ r: bossR + 1, i: 0, type: 'crossover', done: false }]);
    map.edges.push([bossR, 0, bossR + 1, 0]);
  }
  return map;
}

function reachableNodes() {
  const map = run.map;
  if (run.pos === null) return map.rows[0].map((n, i) => [0, i]); // primera fila
  const [pr, pi] = run.pos;
  return map.edges.filter(e => e[0] === pr && e[1] === pi).map(e => [e[2], e[3]]);
}

// ---------- Música de fondo (Soundtracks) ----------
let currentTrack = null;
let bgmAudio = null;
let isMuted = false;
try { isMuted = localStorage.getItem('oplike_muted') === 'true'; } catch (e) { }

function playMusic(track) {
  if (currentTrack === track) return;
  currentTrack = track;
  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio.currentTime = 0;
  }
  if (!track) return;
  bgmAudio = new Audio(`soundtracks/${track}.mp3`);
  bgmAudio.loop = true;
  bgmAudio.muted = isMuted;
  bgmAudio.volume = 0.45;
  const playPromise = bgmAudio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      const unlock = () => {
        if (bgmAudio && currentTrack === track) bgmAudio.play().catch(() => { });
        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
        document.removeEventListener('touchstart', unlock);
      };
      document.addEventListener('click', unlock);
      document.addEventListener('keydown', unlock);
      document.addEventListener('touchstart', unlock);
    });
  }
}

function toggleMute() {
  isMuted = !isMuted;
  try { localStorage.setItem('oplike_muted', String(isMuted)); } catch (e) { }
  if (bgmAudio) bgmAudio.muted = isMuted;
  const btn = $('#btn-mute');
  if (btn) btn.textContent = isMuted ? '🔇 MÚSICA' : '🎵 MÚSICA';
  const chkBtn = $('#chk-music-toggle');
  if (chkBtn) {
    chkBtn.className = `btn small ${isMuted ? 'gray' : 'blue'}`;
    chkBtn.textContent = isMuted ? '🔇 MÚSICA: OFF' : '🎵 MÚSICA: ON';
  }
}

function cycleTopbarAuto() {
  if (!autoMode) {
    autoMode = true;
    autoSettings.speed = 'x1';
    toast('🤖 Modo Auto: ACTIVADO (x1)');
  } else if (autoSettings.speed === 'x1') {
    autoSettings.speed = 'x2';
    toast('⚡ Modo Auto: Velocidad x2');
  } else {
    autoMode = false;
    if (autoTimer) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    toast('⏹️ Modo Auto: PAUSADO');
  }
  if (typeof battle !== 'undefined' && battle && !battle.over) {
    if (autoMode) battle.speed = (autoSettings.speed === 'x1') ? 1 : 2;
    refreshControls();
    renderBattlePreserveLog();
  } else if (typeof run !== 'undefined' && run) {
    screenMap();
  } else {
    screenHome();
  }
}

// ---------- Render raíz ----------
function render(html) {
  applyDisplayPreferences();
  app.innerHTML = html;
  const btn = $('#btn-mute');
  if (btn) btn.onclick = toggleMute;
  const saveBtn = $('#btn-save');
  if (saveBtn) saveBtn.onclick = manualSave;
  const setBtn = $('#btn-settings');
  if (setBtn) setBtn.onclick = showSettingsModal;
  const autoBtn = $('#btn-topbar-auto');
  if (autoBtn) autoBtn.onclick = cycleTopbarAuto;
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function fighterTypes(f) {
  if (!f) return [];
  const base = (CHARS[f.id] && CHARS[f.id].types) ? CHARS[f.id].types : [];
  const extra = f.extraTypes || [];
  return [...new Set([...base, ...extra])];
}

function typeBadges(types) {
  if (!types || !Array.isArray(types)) return '';
  return `<div class="type-badges">${types.map(t =>
    TYPES[t] ? `<span class="type-badge" style="background:${TYPES[t].color}">${t.toUpperCase()}</span>` : ''
  ).join('')}</div>`;
}

function trackStat(key, qty = 1) {
  meta.stats = meta.stats || { kills: 0, items: 0 };
  meta.stats[key] = (meta.stats[key] || 0) + qty;
  saveMeta();
}

function trackItemCollected(qty = 1) {
  trackStat('items', qty);
}

function trackKills(qty = 1) {
  trackStat('kills', qty);
}

function berriesHTML(v) { return `฿${v.toLocaleString('es')}`; }

function topbar(showBerries = false, showAuto = showBerries) {
  const autoLabel = !autoMode ? '🤖 PAUSADO' : (autoSettings.speed === 'x1' ? '🤖 AUTO x1' : '🤖 AUTO x2');
  const autoBtnClass = !autoMode ? 'gray' : 'green';
  return `<div class="topbar">
    <div class="logo">ONE PIECE <span>ROGUE LIKE</span></div>
    ${showBerries && run ? `<div class="floating-berries"><div class="berries">${berriesHTML(run.berries)}</div></div>` : ''}
    <div class="floating-controls">
      <button class="btn small green" id="btn-save" title="Guardar partida en este dispositivo" aria-label="Guardar partida en este dispositivo">💾</button>
      <button class="btn small gray" id="btn-settings" title="Ajustes de juego">⚙️ AJUSTES</button>
      ${showAuto ? `<button class="btn small ${autoBtnClass}" id="btn-topbar-auto" title="Cambiar velocidad o activar/pausar modo auto">${autoLabel}</button>` : ''}
    </div>
  </div>`;
}

function applyDisplayPreferences() {
  document.documentElement?.setAttribute('data-theme', meta.settings?.theme === 'dark' ? 'dark' : 'light');
  document.documentElement?.setAttribute('data-mobile-columns', meta.settings?.mobileColumns === 2 ? '2' : '3');
}
function setDisplayPreference(key, value) {
  meta.settings ||= {};
  if (key === 'theme') meta.settings.theme = value === 'dark' ? 'dark' : 'light';
  else if (key === 'mobileColumns') meta.settings.mobileColumns = Number(value) === 2 ? 2 : 3;
  else return;
  applyDisplayPreferences();
  saveMeta();
}
function mobileColumnsControl() {
  return `<label class="mobile-columns-control">Columnas en móvil
    <select data-mobile-columns-control aria-label="Columnas de nakamas en móvil">
      <option value="2" ${meta.settings?.mobileColumns === 2 ? 'selected' : ''}>2 columnas</option>
      <option value="3" ${meta.settings?.mobileColumns !== 2 ? 'selected' : ''}>3 columnas</option>
    </select></label>`;
}
document.addEventListener('change', event => {
  if (!event.target.matches?.('[data-mobile-columns-control]')) return;
  setDisplayPreference('mobileColumns', event.target.value);
  document.querySelectorAll('[data-mobile-columns-control]').forEach(select => { select.value = String(meta.settings.mobileColumns); });
});

function showSettingsModal() {
  meta.settings = meta.settings || { showEventConfirm: true, customSounds: false };

  const existing = document.querySelector('#settings-modal-overlay');
  if (existing) existing.remove();

  const ov = document.createElement('div');
  ov.id = 'settings-modal-overlay';
  ov.className = 'overlay';

  const showConfirm = meta.settings.showEventConfirm !== false;
  const customSounds = !!meta.settings.customSounds;

  ov.innerHTML = `
    <div class="modal" style="max-width:440px;width:90%;">
      <h2 style="margin-top:0;color:var(--sea);font-size:14px;border-bottom:2px solid var(--gold);padding-bottom:6px;">⚙️ AJUSTES DE JUEGO</h2>
      <div class="display-settings">
        <label for="setting-theme">Aspecto del juego</label>
        <select id="setting-theme"><option value="light" ${meta.settings.theme !== 'dark' ? 'selected' : ''}>Claro · Egghead</option><option value="dark" ${meta.settings.theme === 'dark' ? 'selected' : ''}>Oscuro · Egghead</option></select>
        ${mobileColumnsControl()}
        <p>El aspecto y las columnas se guardan en este dispositivo.</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;margin:16px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.05);padding:10px;border-radius:6px;border:1px solid #ccc;">
          <div style="flex:1;padding-right:10px;">
            <div style="font-size:9.5px;font-weight:bold;color:var(--ink);">🎵 Música de Fondo</div>
            <div style="font-size:7.5px;color:#555;margin-top:2px;">Activar o silenciar la música ambiental y soundtracks de batalla.</div>
          </div>
          <button class="btn small ${isMuted ? 'gray' : 'blue'}" id="chk-music-toggle" style="min-width:100px;">
            ${isMuted ? '🔇 MÚSICA: OFF' : '🎵 MÚSICA: ON'}
          </button>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.05);padding:10px;border-radius:6px;border:1px solid #ccc;">
          <div style="flex:1;padding-right:10px;">
            <div style="font-size:9.5px;font-weight:bold;color:var(--ink);">📜 Confirmación de Eventos en Mapa</div>
            <div style="font-size:7.5px;color:#555;margin-top:2px;">Muestra una pantalla informativa antes de entrar a cada nodo con la opción de entrar o volver.</div>
          </div>
          <label style="cursor:pointer;">
            <input type="checkbox" id="chk-event-confirm" ${showConfirm ? 'checked' : ''} style="transform:scale(1.3);cursor:pointer;">
          </label>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.05);padding:10px;border-radius:6px;border:1px solid #ccc;">
          <div style="flex:1;padding-right:10px;">
            <div style="font-size:9.5px;font-weight:bold;color:var(--ink);">🔊 Sonidos Caseros <span style="font-size:7.5px;color:var(--red);font-weight:bold;">(No implementado)</span></div>
            <div style="font-size:7.5px;color:#555;margin-top:2px;">Efectos de sonido grabados para habilidades, ataques y eventos del juego.</div>
          </div>
          <label style="cursor:pointer;">
            <input type="checkbox" id="chk-custom-sounds" ${customSounds ? 'checked' : ''} style="transform:scale(1.3);cursor:pointer;">
          </label>
        </div>
      </div>
      <div style="text-align:right;margin-top:16px;">
        <button class="btn gold small" id="btn-save-settings">GUARDAR Y CERRAR</button>
      </div>
    </div>
  `;
  document.body.appendChild(ov);

  ov.querySelector('#setting-theme').onchange = e => setDisplayPreference('theme', e.target.value);

  ov.querySelector('#chk-music-toggle').onclick = () => {
    toggleMute();
  };

  ov.querySelector('#chk-event-confirm').onchange = e => {
    meta.settings.showEventConfirm = e.target.checked;
    saveMeta();
  };

  ov.querySelector('#chk-custom-sounds').onchange = e => {
    meta.settings.customSounds = e.target.checked;
    saveMeta();
    if (e.target.checked) {
      toast('🔊 Sonidos caseros activados (No implementado aún).');
    }
  };

  ov.querySelector('#btn-save-settings').onclick = () => ov.remove();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}

function showNodeConfirmModal(r, i) {
  const node = run.map.rows[r][i];
  const typeInfo = NODE_TYPES[node.type] || { emoji: '❓', label: 'Evento' };
  const island = SAGAS[run.saga].islands[run.islandIdx];

  let detailsText = '';
  switch (node.type) {
    case 'wild':
      detailsText = `Te enfrentarás a un pirata salvaje de esta zona. Tienes la oportunidad de combatirlo y reclutarlo para tu banda.<br>${cartelesBadgeHTML()}`;
      break;
    case 'marine':
      detailsText = 'Una patrulla de la Marina te ha cortado el paso. Enfréntate a ellos en combate táctico para obtener Berries y Log Poses.';
      break;
    case 'boss':
      const bossNames = island.boss.map(id => CHARS[id] ? CHARS[id].name : id).join(' y ');
      detailsText = `¡Combate contra el jefe definitivo de la isla: <b>${bossNames}</b>! Véncelo para conseguir el Emblema de la isla.`;
      break;
    case 'item':
      detailsText = 'Encontrarás un cofre de tesoro con un objeto útil para tu viaje (Carne, Carteles de Reclutamiento, Sake, etc.).';
      break;
    case 'mystery':
      detailsText = 'Un evento misterioso e impredecible. Puede resultar en una gran oportunidad, un tesoro o un desafío inesperado.';
      break;
    case 'shop':
      detailsText = 'Visita el Mercado Clandestino de la isla para comprar consumibles, reclutar nakamas o mejorar tu banda con Berries.';
      break;
    case 'rest':
      detailsText = 'Tu banda descansará en el campamento. Todos los nakamas conscientes recuperarán un 50% de sus PS máximos.';
      break;
    case 'special':
      detailsText = 'Combate especial contra un pirata de gran poder. Una batalla muy exigente pero con grandes recompensas.';
      break;
    case 'crossover':
      detailsText = 'Un portal dimensional te traslada a un evento alternativo fuera de la historia principal.';
      break;
    default:
      detailsText = 'Avanza hacia este nodo para descubrir qué aventuras te esperan.';
      break;
  }

  const existing = document.querySelector('#node-confirm-overlay');
  if (existing) existing.remove();

  const ov = document.createElement('div');
  ov.id = 'node-confirm-overlay';
  ov.className = 'overlay';

  ov.innerHTML = `
    <div class="modal" style="max-width:400px;width:90%;text-align:center;">
      <div style="font-size:36px;margin-bottom:6px;">${typeInfo.emoji}</div>
      <h2 style="margin:0 0 8px 0;color:var(--sea);font-size:14px;">${typeInfo.label.toUpperCase()}</h2>
      <div style="font-size:8.5px;color:#444;line-height:1.4;background:rgba(0,0,0,0.04);padding:10px;border-radius:6px;border:1px solid #ccc;margin-bottom:14px;">
        ${detailsText}
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button class="btn gray small" id="btn-node-back" style="flex:1;">🔴 VOLVER</button>
        <button class="btn green small" id="btn-node-enter" style="flex:1;font-weight:bold;">🟢 ENTRAR</button>
      </div>
    </div>
  `;
  document.body.appendChild(ov);

  ov.querySelector('#btn-node-enter').onclick = () => {
    ov.remove();
    enterNode(r, i);
  };
  ov.querySelector('#btn-node-back').onclick = () => ov.remove();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}

function makeListReorderable(container, itemSelector, onReorder) {
  const cont = typeof container === 'string' ? document.querySelector(container) : container;
  if (!cont) return;
  const items = Array.from(cont.querySelectorAll(itemSelector));
  if (!items.length) return;

  let draggedIdx = null;
  let touchStartElement = null;
  let touchStartY = 0;
  let touchStartX = 0;
  let isTouchDragging = false;

  items.forEach((item) => {
    const idx = parseInt(item.dataset.idx !== undefined ? item.dataset.idx : item.dataset.slot);
    item.setAttribute('draggable', 'true');

    item.ondragstart = e => {
      draggedIdx = idx;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', idx);
    };

    item.ondragend = () => {
      item.classList.remove('dragging');
      items.forEach(el => el.classList.remove('dragover'));
      draggedIdx = null;
    };

    item.ondragover = e => {
      e.preventDefault();
      item.classList.add('dragover');
    };

    item.ondragleave = () => {
      item.classList.remove('dragover');
    };

    item.ondrop = e => {
      e.preventDefault();
      item.classList.remove('dragover');
      const fromIdx = draggedIdx !== null ? draggedIdx : parseInt(e.dataTransfer.getData('text/plain'));
      if (!isNaN(fromIdx) && fromIdx !== idx) {
        onReorder(fromIdx, idx);
      }
    };

    item.ontouchstart = e => {
      const touch = e.touches[0];
      touchStartY = touch.clientY;
      touchStartX = touch.clientX;
      touchStartElement = item;
      draggedIdx = idx;
      isTouchDragging = false;
    };

    item.ontouchmove = e => {
      if (draggedIdx === null || !touchStartElement) return;
      const touch = e.touches[0];
      const dy = touch.clientY - touchStartY;
      const dx = touch.clientX - touchStartX;

      if (!isTouchDragging && (Math.abs(dy) > 6 || Math.abs(dx) > 6)) {
        isTouchDragging = true;
        touchStartElement.classList.add('dragging');
      }

      if (isTouchDragging) {
        if (e.cancelable) e.preventDefault();
        const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const hoverItem = elUnder ? elUnder.closest(itemSelector) : null;
        items.forEach(el => {
          if (el === hoverItem && el !== touchStartElement) {
            el.classList.add('dragover');
          } else {
            el.classList.remove('dragover');
          }
        });
      }
    };

    item.ontouchend = e => {
      if (draggedIdx !== null && isTouchDragging) {
        const touch = e.changedTouches[0];
        const elUnder = document.elementFromPoint(touch.clientX, touch.clientY);
        const dropItem = elUnder ? elUnder.closest(itemSelector) : null;
        if (dropItem) {
          const targetIdx = parseInt(dropItem.dataset.idx !== undefined ? dropItem.dataset.idx : dropItem.dataset.slot);
          if (!isNaN(targetIdx) && targetIdx !== draggedIdx) {
            onReorder(draggedIdx, targetIdx);
          }
        }
      }
      if (touchStartElement) touchStartElement.classList.remove('dragging');
      items.forEach(el => el.classList.remove('dragover'));
      touchStartElement = null;
      draggedIdx = null;
      isTouchDragging = false;
    };
  });
}

// ============ LOGROS / ACHIEVEMENTS ============
const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function totalWinsCount() {
  return Object.values(meta.wins || {}).reduce((a, b) => a + b, 0) +
    Object.values(meta.nuzWins || {}).reduce((a, b) => a + b, 0);
}

function countInDex(ids) {
  return ids.filter(id =>
    (meta.dex && meta.dex.includes(id)) ||
    (meta.recruited && meta.recruited.includes(id)) ||
    (meta.roster && meta.roster.includes(id))
  ).length;
}

function isNakamaUnlocked(id) {
  const base = baseFormOf(id);
  if (base === 'luffy') return true;
  return meta.roster && meta.roster.includes(base);
}

function bestSagaDexProgress() {
  let maxPct = 0;
  for (const s of SAGAS) {
    const sagaChars = Object.keys(CHARS).filter(id => CHARS[id].saga === s.id && !CHARS[id].boss);
    if (!sagaChars.length) continue;
    const inDex = sagaChars.filter(id =>
      (meta.dex && meta.dex.includes(id)) ||
      (meta.recruited && meta.recruited.includes(id)) ||
      (meta.roster && meta.roster.includes(id))
    ).length;
    const pct = Math.floor((inDex / sagaChars.length) * 100);
    if (pct > maxPct) maxPct = pct;
  }
  return maxPct;
}

const PROGRESSIVE_ACHIEVEMENTS = [
  {
    id: 'kills',
    title: 'Cazador de Piratas',
    emoji: '⚔️',
    desc: 'Derrota a enemigos en combate.',
    goals: [10, 25, 50, 100, 250, 500, 1000],
    fames: [50, 100, 150, 250, 400, 600, 1000],
    check: () => (meta.stats && meta.stats.kills) || 0,
    legacyIds: ['kills_10', 'kills_20', 'kills_40', 'kills_80', 'kills_160', 'kills_320', 'kills_640', 'kills_1000']
  },
  {
    id: 'islands',
    title: 'Navegante de Grand Line',
    emoji: '🗺️',
    desc: 'Recorre islas en tus travesías.',
    goals: [10, 25, 50, 100, 200, 500, 1000],
    fames: [50, 100, 150, 250, 400, 600, 1000],
    check: () => (meta.totalIslands || 0),
    legacyIds: ['isl_10', 'isl_50', 'isl_100']
  },
  {
    id: 'sagas',
    title: 'Conquistador de Sagas',
    emoji: '👑',
    desc: 'Supera sagas completas en cualquier modo.',
    goals: [1, 3, 5, 10, 20, 50],
    fames: [100, 200, 300, 600, 1000, 2000],
    check: () => totalWinsCount(),
    legacyIds: ['saga_1', 'saga_5', 'saga_10']
  },
  {
    id: 'items',
    title: 'Recolector de Tesoros',
    emoji: '🎒',
    desc: 'Consigue u obtén objetos para la bolsa.',
    goals: [10, 25, 50, 100, 250, 500, 1000],
    fames: [50, 100, 150, 250, 400, 600, 1000],
    check: () => (meta.stats && meta.stats.items) || 0,
    legacyIds: ['items_10', 'items_20', 'items_40', 'items_80', 'items_160', 'items_320', 'items_640', 'items_1000']
  },
  {
    id: 'dex',
    title: 'Avistador de la Dex',
    emoji: '👁️',
    desc: 'Descubre y recluta personajes en la Dex.',
    goals: [10, 25, 50, 100, 150, 200, 300],
    fames: [50, 100, 150, 250, 400, 600, 1000],
    check: () => (meta.dex ? meta.dex.length : 0),
    legacyIds: ['seen_10', 'seen_20', 'seen_40', 'seen_80', 'seen_160', 'seen_320', 'seen_640', 'seen_1000']
  },
  {
    id: 'mystery_visit',
    title: 'Explorador del Misterio',
    emoji: '❓',
    desc: 'Visita nodos de Evento Misterioso.',
    goals: [5, 15, 30, 60, 120, 250],
    fames: [50, 100, 150, 250, 400, 600],
    check: () => (meta.stats && meta.stats.mystery_visit) || 0,
  },
  {
    id: 'mystery_heal',
    title: 'Fuente de Vida',
    emoji: '♨️',
    desc: 'Recupera a tu banda en eventos misteriosos.',
    goals: [3, 10, 25, 50, 100],
    fames: [50, 100, 200, 350, 500],
    check: () => (meta.stats && meta.stats.mystery_heal) || 0,
  },
  {
    id: 'mystery_train',
    title: 'Entrenamiento Intenso',
    emoji: '💪',
    desc: 'Obtén mejoras de ataque en eventos misteriosos.',
    goals: [3, 10, 25, 50, 100],
    fames: [50, 100, 200, 350, 500],
    check: () => (meta.stats && meta.stats.mystery_train) || 0,
  },
  {
    id: 'shop_buy',
    title: 'Cliente VIP del Puerto',
    emoji: '🏪',
    desc: 'Compra objetos en las tiendas de la isla.',
    goals: [5, 15, 35, 75, 150, 300],
    fames: [50, 100, 180, 300, 500, 800],
    check: () => (meta.stats && meta.stats.shop_buy) || 0,
  },
  {
    id: 'rest_visit',
    title: 'Descanso del Pirata',
    emoji: '⛺',
    desc: 'Pasa por zonas de campamento a descansar.',
    goals: [5, 15, 35, 75, 150],
    fames: [50, 100, 180, 300, 500],
    check: () => (meta.stats && meta.stats.rest_visit) || 0,
  },
  {
    id: 'special_visit',
    title: 'Encuentros Especiales',
    emoji: '🌟',
    desc: 'Visita nodos de piratas especiales.',
    goals: [5, 15, 35, 75, 150],
    fames: [50, 100, 180, 300, 500],
    check: () => (meta.stats && meta.stats.special_visit) || 0,
  },
  {
    id: 'fruit_use',
    title: 'Poder de las Frutas',
    emoji: '🍈',
    desc: 'Consume Frutas del Diablo con tus nakamas.',
    goals: [1, 3, 5, 10, 25],
    fames: [100, 200, 350, 500, 1000],
    check: () => (meta.stats && meta.stats.fruit_use) || 0,
  },
  {
    id: 'nuzlocke_wins',
    title: 'Superviviente Nuzlocke',
    emoji: '☠️',
    desc: 'Supera sagas en Modo Nuzlocke.',
    goals: [1, 3, 5, 10, 20],
    fames: [300, 500, 800, 1200, 2000],
    check: () => Object.values(meta.nuzWins || {}).reduce((a, b) => a + b, 0),
    legacyIds: ['nuzlocke_win', 'nuzlocke_wins_5']
  },
  {
    id: 'all_nakama_wins',
    title: 'Espíritu Nakama',
    emoji: '🏴‍☠️',
    desc: 'Supera sagas con equipos 100% Nakama.',
    goals: [1, 3, 5, 10, 20],
    fames: [300, 500, 800, 1200, 2000],
    check: () => (meta.allNakamaWins || 0),
    legacyIds: ['all_nakama_win', 'all_nakama_wins_5']
  }
];

const STATIC_ACHIEVEMENTS = [
  { id: 'solo_sailor', title: 'Lobo de Mar Solitario', emoji: '🐺', desc: 'Zarpa y completa una saga con solo 1 personaje.', goal: 1, check: () => (meta.soloWins || 0), fame: 300, cat: 'desafios' },
  { id: 'straw_hats', title: 'Los 10 Sombrero de Paja', emoji: '🏴‍☠️', desc: 'Desbloquea o recluta a los 10 nakamas principales.', goal: 10, check: () => STRAW_HAT_MEMBERS.filter(id => isNakamaUnlocked(id)).length, fame: 250, cat: 'desafios' },
  { id: 'saga_full', title: 'Compendio de Saga', emoji: '📜', desc: 'Completa al 100% los personajes de 1 saga en la Dex.', goal: 100, check: () => bestSagaDexProgress(), fame: 200, cat: 'desafios' },
  { id: 'dex_full', title: 'Leyenda Viviente', emoji: '📖', desc: 'Consigue a todos los personajes del juego en la Dex.', goal: Object.keys(CHARS).length, check: () => (meta.dex ? meta.dex.length : 0), fame: 1000, cat: 'desafios' },
  { id: 'tri_naruto', title: 'Trío Shinobi', emoji: '🍥', desc: 'Registra a Naruto, Sasuke y Kakashi en la Dex.', goal: 3, check: () => countInDex(['naruto', 'sasuke', 'kakashi']), fame: 150, cat: 'desafios' },
  { id: 'tri_jjk', title: 'Trío Hechicero', emoji: '👹', desc: 'Registra a Itadori, Yuta y Gojo en la Dex.', goal: 3, check: () => countInDex(['itadori', 'yuta', 'gojo']), fame: 150, cat: 'desafios' },
  { id: 'tri_kimetsu', title: 'Trío Cazador', emoji: '🩸', desc: 'Registra a Tanjiro, Zenitsu e Inosuke en la Dex.', goal: 3, check: () => countInDex(['tanjiro', 'zenitsu', 'inosuke']), fame: 150, cat: 'desafios' },
  { id: 'tri_db', title: 'Trío Saiyan', emoji: '🐉', desc: 'Registra a Goku, Vegeta y Gohan en la Dex.', goal: 3, check: () => countInDex(['goku', 'vegeta', 'gohan']), fame: 150, cat: 'desafios' },
  { id: 'tri_opm', title: 'Trío Héroes OPM', emoji: '👊', desc: 'Registra a Genos, Garou y Tatsumaki en la Dex.', goal: 3, check: () => countInDex(['genos', 'garou', 'tatsumaki']), fame: 150, cat: 'desafios' },
];

const SAGA_DIFF_ACHIEVEMENTS = SAGA_DEFS.flatMap(s =>
  DIFFICULTIES.map(d => ({
    id: `saga_diff_${s.id}_${d.id}`,
    title: `${d.emoji} ${s.name}: ${d.name}`,
    emoji: d.emoji,
    desc: `Supera la saga ${s.name} en Dificultad ${d.name}.`,
    goal: 1,
    check: () => (meta.sagaDiffWins && meta.sagaDiffWins[s.id] && meta.sagaDiffWins[s.id][d.id]) ? 1 : 0,
    fame: 40 + d.id * 30,
    cat: 'sagas'
  }))
);

function getClaimedProgTier(p) {
  meta.claimedProg = meta.claimedProg || {};
  if (meta.claimedProg[p.id] !== undefined) {
    return meta.claimedProg[p.id];
  }
  let count = 0;
  if (p.legacyIds && meta.claimedAch) {
    for (const legId of p.legacyIds) {
      if (meta.claimedAch[legId]) count++;
    }
  }
  return count;
}

function getAchievementsInfo() {
  meta.claimedAch = meta.claimedAch || {};
  meta.claimedProg = meta.claimedProg || {};
  const visibleStaticList = STATIC_ACHIEVEMENTS.concat(SAGA_DIFF_ACHIEVEMENTS).filter(isVisibleAch);
  const completedStaticCount = visibleStaticList.filter(a => a.check() >= a.goal).length;
  const completedProgTiers = PROGRESSIVE_ACHIEVEMENTS.reduce((acc, p) => acc + getClaimedProgTier(p), 0);
  const totalCompleted = completedStaticCount + completedProgTiers;

  const totalStaticCount = visibleStaticList.length;
  const totalProgTiers = PROGRESSIVE_ACHIEVEMENTS.reduce((acc, p) => acc + p.goals.length, 0);
  const totalAchievements = totalStaticCount + totalProgTiers;

  const unclaimedStatic = visibleStaticList.some(ach => ach.check() >= ach.goal && !(meta.claimedAch && meta.claimedAch[ach.id]));
  const unclaimedProg = PROGRESSIVE_ACHIEVEMENTS.some(p => {
    const t = getClaimedProgTier(p);
    return t < p.goals.length && p.check() >= p.goals[t];
  });
  const hasUnclaimedAch = unclaimedStatic || unclaimedProg;

  return { totalCompleted, totalAchievements, hasUnclaimedAch };
}

function isVisibleAch(a) {
  if (a.id.startsWith('tri_') || a.isCrossover) {
    return a.check() >= a.goal;
  }
  return true;
}

let currentAchCategory = 'all';

function showAchievementsModal(savedScrollTop = 0, initialCategory = currentAchCategory) {
  meta.claimedAch = meta.claimedAch || {};
  meta.claimedProg = meta.claimedProg || {};
  currentAchCategory = initialCategory;

  const visibleStaticList = STATIC_ACHIEVEMENTS.concat(SAGA_DIFF_ACHIEVEMENTS).filter(isVisibleAch);
  const { totalCompleted, totalAchievements } = getAchievementsInfo();

  const renderProgCardHTML = p => {
    const tierIdx = getClaimedProgTier(p);
    const val = p.check();
    const totalTiers = p.goals.length;
    const isMax = tierIdx >= totalTiers;
    const currentGoal = isMax ? p.goals[totalTiers - 1] : p.goals[tierIdx];
    const currentFame = isMax ? p.fames[totalTiers - 1] : p.fames[tierIdx];
    const done = !isMax && val >= currentGoal;
    const pct = isMax ? 100 : Math.min(100, Math.floor((val / currentGoal) * 100));

    return `<div class="achieve-row ${isMax ? 'done' : ''}">
      <span class="emoji">${p.emoji}</span>
      <div class="info">
        <b>${p.title} ${isMax ? '(MÁXIMO)' : `Nivel ${tierIdx + 1}/${totalTiers}`}</b> — <span style="color:var(--accent);">⭐+${currentFame} Fama</span><br>
        <small style="color:#555;">${p.desc}</small>
        <div class="achieve-bar"><i style="width:${pct}%"></i></div>
        <div style="font-size:7.5px;color:#666;margin-top:3px;font-weight:bold;">
          ${isMax ? `Completado: ${val}/${currentGoal} (100%)` : `Progreso Nivel ${tierIdx + 1}: ${val}/${currentGoal} (${pct}%)`}
        </div>
      </div>
      ${isMax
        ? '<span style="font-size:8px;color:var(--green);font-weight:bold;">✓ MÁXIMO</span>'
        : done
          ? `<button class="btn small green" data-claim-prog="${p.id}">RECLAMAR ⭐${currentFame}</button>`
          : '<span style="font-size:8px;color:#888;">🔒 EN PROGRESO</span>'}
    </div>`;
  };

  const renderStaticCardHTML = a => {
    const val = a.check();
    const done = val >= a.goal;
    const claimed = !!meta.claimedAch[a.id];
    const pct = Math.min(100, Math.floor((val / a.goal) * 100));
    return `<div class="achieve-row ${claimed ? 'done' : ''}">
      <span class="emoji">${a.emoji}</span>
      <div class="info">
        <b>${a.title}</b> — <span style="color:var(--accent);">⭐+${a.fame} Fama</span><br>
        <small style="color:#555;">${a.desc}</small>
        <div class="achieve-bar"><i style="width:${pct}%"></i></div>
        <div style="font-size:7.5px;color:#666;margin-top:3px;font-weight:bold;">Progreso: ${val}/${a.goal} (${pct}%)</div>
      </div>
      ${claimed ? '<span style="font-size:8px;color:var(--green);font-weight:bold;">✓ RECLAMADO</span>'
        : done ? `<button class="btn small green" data-claim="${a.id}">RECLAMAR ⭐${a.fame}</button>`
          : '<span style="font-size:8px;color:#888;">🔒 EN PROGRESO</span>'}
    </div>`;
  };

  const getProgCardItem = p => {
    const tierIdx = getClaimedProgTier(p);
    const val = p.check();
    const totalTiers = p.goals.length;
    const isMax = tierIdx >= totalTiers;
    const currentGoal = isMax ? p.goals[totalTiers - 1] : p.goals[tierIdx];
    const canClaim = !isMax && val >= currentGoal;
    return { canClaim, html: renderProgCardHTML(p) };
  };

  const getStaticCardItem = a => {
    const val = a.check();
    const done = val >= a.goal;
    const claimed = !!meta.claimedAch[a.id];
    const canClaim = !claimed && done;
    return { canClaim, html: renderStaticCardHTML(a) };
  };

  const renderModalContent = () => {
    let items = [];
    if (currentAchCategory === 'all') {
      items = [
        ...PROGRESSIVE_ACHIEVEMENTS.map(getProgCardItem),
        ...visibleStaticList.map(getStaticCardItem)
      ];
    } else if (currentAchCategory === 'prog') {
      items = PROGRESSIVE_ACHIEVEMENTS.map(getProgCardItem);
    } else if (currentAchCategory === 'sagas') {
      items = visibleStaticList.filter(a => a.id.startsWith('saga_diff_')).map(getStaticCardItem);
    } else if (currentAchCategory === 'desafios') {
      items = visibleStaticList.filter(a => !a.id.startsWith('saga_diff_')).map(getStaticCardItem);
    }

    items.sort((a, b) => (b.canClaim ? 1 : 0) - (a.canClaim ? 1 : 0));
    let html = items.map(x => x.html).join('');

    if (!html) html = '<div style="font-size:9px;color:#888;text-align:center;padding:20px;">No hay logros en esta categoría.</div>';

    return `
      <h2>🏆 Logros de Pirata (${totalCompleted}/${totalAchievements})</h2>
      <p style="font-size:8px;text-align:center;margin-bottom:8px;color:#666;">
        Completa desafíos en tus aventuras para ganar ⭐ Fama adicional.
      </p>
      <label class="achievement-filter" for="ach-category">Tipo de logro
        <select id="ach-category">
          ${[['all', 'Todos'], ['prog', `🔄 Progresivos (${PROGRESSIVE_ACHIEVEMENTS.length})`], ['sagas', `📜 Sagas (${visibleStaticList.filter(a => a.id.startsWith('saga_diff_')).length})`], ['desafios', `🎯 Desafíos (${visibleStaticList.filter(a => !a.id.startsWith('saga_diff_')).length})`]].map(([value, label]) => `<option value="${value}" ${currentAchCategory === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </label>
      <div class="achieve-list-container" style="max-height:340px;overflow-y:auto;">
        ${html}
      </div>
      <div class="actions" style="margin-top:12px;"><button class="btn gray" id="ach-close">CERRAR</button></div>
    `;
  };

  const existingOverlay = document.querySelector('#achievements-overlay');
  if (existingOverlay) existingOverlay.remove();

  const ov = document.createElement('div');
  ov.id = 'achievements-overlay';
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" style="max-width:600px;">${renderModalContent()}</div>`;
  document.body.appendChild(ov);

  const container = ov.querySelector('.achieve-list-container');
  if (container && savedScrollTop) {
    container.scrollTop = savedScrollTop;
  }

  const syncFameUI = () => {
    const shipBtn = $('#btn-ship');
    if (shipBtn) shipBtn.innerHTML = `🏪 Tienda (⭐${meta.fame})`;
    const achBtn = $('#btn-achievements');
    const { totalCompleted, totalAchievements, hasUnclaimedAch } = getAchievementsInfo();

    if (achBtn) {
      achBtn.innerHTML = `
        <span>🏆 Logros${hasUnclaimedAch ? ' <span class="ach-badge-dot" style="background:#e74c3c;color:#fff;font-size:7px;border-radius:50%;padding:1px 4px;margin-left:2px;font-weight:bold;animation:pulse 1s infinite alternate;border:1px solid #fff;">!</span>' : ''}</span>
        <span style="font-size:8px;opacity:0.85;margin-top:2px;">(${totalCompleted}/${totalAchievements})</span>
      `;
    }
    const topAchBtn = $('#btn-top-ach');
    if (topAchBtn) {
      topAchBtn.innerHTML = `🏆${hasUnclaimedAch ? '🔴' : ''}`;
    }
  };

  const bindEvents = () => {
    const cont = ov.querySelector('.achieve-list-container');
    ov.querySelector('#ach-category').onchange = event => {
        currentAchCategory = event.target.value;
        ov.querySelector('.modal').innerHTML = renderModalContent();
        bindEvents();
    };

    ov.querySelectorAll('[data-claim]').forEach(btn => {
      btn.onclick = () => {
        const st = cont ? cont.scrollTop : 0;
        const id = btn.dataset.claim;
        const a = visibleStaticList.find(x => x.id === id);
        if (!a || meta.claimedAch[id] || a.check() < a.goal) return;
        meta.claimedAch[id] = true;
        gainFame(a.fame);
        saveMeta();
        syncFameUI();
        toast(`🏆 Logro completado: ¡+${a.fame} Fama!`);
        ov.querySelector('.modal').innerHTML = renderModalContent();
        bindEvents();
        if (cont) cont.scrollTop = st;
      };
    });

    ov.querySelectorAll('[data-claim-prog]').forEach(btn => {
      btn.onclick = () => {
        const st = cont ? cont.scrollTop : 0;
        const id = btn.dataset.claimProg;
        const p = PROGRESSIVE_ACHIEVEMENTS.find(x => x.id === id);
        if (!p) return;
        const tierIdx = getClaimedProgTier(p);
        if (tierIdx >= p.goals.length || p.check() < p.goals[tierIdx]) return;

        meta.claimedProg = meta.claimedProg || {};
        meta.claimedProg[id] = tierIdx + 1;
        gainFame(p.fames[tierIdx]);
        saveMeta();
        syncFameUI();
        toast(`🏆 Logro Nivel ${tierIdx + 1} completado: ¡+${p.fames[tierIdx]} Fama!`);
        ov.querySelector('.modal').innerHTML = renderModalContent();
        bindEvents();
        if (cont) cont.scrollTop = st;
      };
    });

    const closeBtn = ov.querySelector('#ach-close');
    if (closeBtn) closeBtn.onclick = () => { ov.remove(); syncFameUI(); };
  };

  bindEvents();
  ov.onclick = e => { if (e.target === ov) { ov.remove(); syncFameUI(); } };
}

// ============ LOG POSE GACHA CARTELES ============
let logPoseBlockedSagaIds = [];

function showLogPoseGachaModal() {
  meta.logPoses = meta.logPoses || 0;
  meta.starPity = meta.starPity || 0;
  const unlockedSagas = SAGAS.filter((s, i) => sagaUnlocked(i));

  logPoseBlockedSagaIds = logPoseBlockedSagaIds.filter(id => unlockedSagas.some(s => s.id === id));

  const renderModalContent = () => {
    const baseCost = 1000;
    const blockCost = logPoseBlockedSagaIds.length * 200;
    const totalCost = baseCost + blockCost;
    const canAfford = meta.logPoses >= totalCost;

    const sagaItemsHTML = unlockedSagas.map(s => {
      const isBlocked = logPoseBlockedSagaIds.includes(s.id);
      return `<div class="saga-block-pill ${isBlocked ? 'blocked' : 'active'}" data-saga="${s.id}" style="cursor:pointer;padding:6px 8px;border-radius:6px;border:1px solid ${isBlocked ? '#e74c3c' : '#2ecc71'};background:${isBlocked ? 'rgba(231,76,60,0.15)' : 'rgba(46,204,113,0.15)'};font-size:8.5px;display:flex;align-items:center;justify-content:space-between;gap:6px;">
        <span>📜 <b>${s.name}</b></span>
        <span style="font-weight:bold;color:${isBlocked ? '#e74c3c' : '#2ecc71'};">${isBlocked ? '🔒 BLOQUEADA (+200)' : '✓ ACTIVA'}</span>
      </div>`;
    }).join('');

    return `
      <h2>🎰 Mercado de Carteles</h2>
      <p style="font-size:8.5px;text-align:center;margin-bottom:6px;line-height:1.8;">
        Gasta tus Log Poses para destapar carteles de SE BUSCA de tus sagas desbloqueadas.<br>
        ¡Pueden tocarte reclutas de 1⭐ hasta 5⭐ legendarios!
      </p>
      <div style="font-size:10px;text-align:center;margin-bottom:6px;color:var(--gold);font-weight:bold;background:rgba(255,215,0,0.1);padding:6px;border-radius:6px;border:1px solid var(--gold);">
        🧭 Saldo: <b>${meta.logPoses} Log Poses</b>
      </div>
      <div style="font-size:9.5px;text-align:center;margin-bottom:10px;color:#f39c12;background:rgba(243,156,18,0.12);padding:6px 10px;border-radius:6px;border:1px solid rgba(243,156,18,0.4);display:flex;align-items:center;justify-content:center;gap:6px;">
        <span>⭐ Estrellas acumuladas (Pity): <b>${meta.starPity || 0} / 1000</b></span>
        ${(meta.starPity || 0) >= 1000 ? '<span style="color:#2ecc71;font-weight:bold;">¡LEGENDARIO ASEGURADO!</span>' : ''}
      </div>
      <div style="font-size:8.5px;margin-bottom:6px;font-weight:bold;color:#aaa;">
        🛡️ Bloquear sagas para que no salgan en los carteles (+200 🧭 cada una):
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));gap:6px;max-height:160px;overflow-y:auto;margin-bottom:10px;padding:4px;background:rgba(0,0,0,0.2);border-radius:6px;">
        ${sagaItemsHTML}
      </div>
      <div style="font-size:9px;text-align:center;margin-bottom:12px;color:#fff;background:rgba(255,255,255,0.05);padding:6px;border-radius:6px;">
        <b>Coste de la tirada:</b> <span style="color:var(--gold);font-weight:bold;">🧭 ${totalCost} Log Poses</span>
        <small style="display:block;color:#888;font-size:7.5px;">(Base 1000 🧭 ${logPoseBlockedSagaIds.length ? ` + ${blockCost} 🧭 por ${logPoseBlockedSagaIds.length} saga(s) bloqueada(s)` : ''})</small>
      </div>
      <div class="actions" style="flex-direction:column;gap:6px;">
        <button class="btn red" id="lp-start-gacha" ${canAfford ? '' : 'disabled'}>
          🎰 JUGAR CARTELES — 🧭 ${totalCost} Log Poses
        </button>
        <button class="btn gray" id="lp-close-modal">CERRAR</button>
      </div>
    `;
  };

  const existingOverlay = document.querySelector('#logpose-gacha-overlay');
  if (existingOverlay) existingOverlay.remove();

  const ov = document.createElement('div');
  ov.id = 'logpose-gacha-overlay';
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" style="max-width:500px;">${renderModalContent()}</div>`;
  document.body.appendChild(ov);

  const bindEvents = () => {
    ov.querySelectorAll('[data-saga]').forEach(el => {
      el.onclick = () => {
        const sId = el.dataset.saga;
        if (logPoseBlockedSagaIds.includes(sId)) {
          logPoseBlockedSagaIds = logPoseBlockedSagaIds.filter(id => id !== sId);
        } else {
          if (unlockedSagas.length - logPoseBlockedSagaIds.length <= 1) {
            toast('⚠️ Debes mantener al menos 1 saga activa.');
            return;
          }
          logPoseBlockedSagaIds.push(sId);
        }
        ov.querySelector('.modal').innerHTML = renderModalContent();
        bindEvents();
      };
    });

    const startBtn = ov.querySelector('#lp-start-gacha');
    if (startBtn) {
      startBtn.onclick = () => {
        const baseCost = 1000;
        const totalCost = baseCost + (logPoseBlockedSagaIds.length * 200);
        if (meta.logPoses < totalCost) return;
        meta.logPoses -= totalCost;
        saveMeta();
        ov.remove();
        const activeSagas = unlockedSagas.filter(s => !logPoseBlockedSagaIds.includes(s.id));
        startLogPoseGacha(activeSagas);
      };
    }

    const closeBtn = ov.querySelector('#lp-close-modal');
    if (closeBtn) closeBtn.onclick = () => ov.remove();
  };

  bindEvents();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}

function startLogPoseGacha(activeSagas) {
  meta.starPity = meta.starPity || 0;
  const weights = [41.5, 30, 21, 7, 0.5];
  let roll = Math.random() * 100, stopIdx = 4;
  if (meta.starPity >= 1000) {
    stopIdx = 4; // Pity activado: legendario asegurado (5⭐)
  } else {
    for (let i = 0; i < 5; i++) {
      roll -= weights[i];
      if (roll <= 0) { stopIdx = i; break; }
    }
  }

  const activeSagaIds = activeSagas.map(s => s.id);
  const activePirates = activeSagaIds.flatMap(sId => sagaBasePirateIds(sId));
  const targetRarity = stopIdx + 1;
  let pool = activePirates.filter(id => CHARS[id] && CHARS[id].rareza === targetRarity);

  if (!pool.length) {
    for (let d = 1; d <= 4; d++) {
      for (const r of [targetRarity - d, targetRarity + d]) {
        if (r >= 1 && r <= 5) {
          const fallback = activePirates.filter(id => CHARS[id] && CHARS[id].rareza === r);
          if (fallback.length) { pool = fallback; break; }
        }
      }
      if (pool.length) break;
    }
  }
  if (!pool.length) pool = activePirates.length ? activePirates : Object.keys(CHARS);

  const prizeId = pick(pool);

  if (stopIdx === 4 || (CHARS[prizeId] && CHARS[prizeId].rareza === 5)) {
    meta.starPity = 0;
  } else {
    meta.starPity += (stopIdx + 1);
  }
  saveMeta();

  let current = 0;

  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>🎰 Carteles de SE BUSCA (Log Pose)</h2>
    <p style="font-size:8px;text-align:center;margin-bottom:6px;">Destapa los carteles en orden. ¡En uno de ellos está tu nuevo recluta!</p>
    <div style="font-size:9px;text-align:center;margin-bottom:10px;color:#f39c12;">
      ⭐ Estrellas acumuladas (Pity): <b>${meta.starPity} / 1000</b>
    </div>
    <div class="poster-row">
      ${[0, 1, 2, 3, 4].map(i => `
        <div class="poster" data-p="${i}">
          <div class="poster-stars">${'⭐'.repeat(i + 1)}</div>
          <div class="poster-face" id="pf-${i}">📜<br><span>SE BUSCA</span></div>
        </div>`).join('')}
    </div>
  </div>`;
  document.body.appendChild(ov);

  const update = () => {
    ov.querySelectorAll('.poster').forEach((el, i) => {
      el.classList.toggle('next', i === current);
      el.onclick = i === current ? () => flip(i) : null;
    });
  };

  const flip = i => {
    const face = ov.querySelector(`#pf-${i}`);
    const el = ov.querySelector(`[data-p="${i}"]`);
    if (i === stopIdx) {
      const c = CHARS[prizeId];
      face.innerHTML = `${charIcon(prizeId, 28)}<br><span>${c.name}</span>`;
      el.classList.add('hit'); el.classList.remove('next');
      registerRecruit(prizeId);
      const b = baseFormOf(prizeId);
      if (!meta.roster.includes(b)) { meta.roster.push(b); saveMeta(); }
      ov.querySelectorAll('.poster').forEach(p => { p.onclick = null; });
      setTimeout(() => {
        ov.remove();
        modalInfo('🎉 ¡Nuevo personaje reclutado!', `<div class="reward-list"><span style="font-size:34px;">${charIcon(prizeId, 44)}</span><br><b>${c.name}</b> ${'⭐'.repeat(c.rareza)}<br><small style="color:var(--gold);">${c.types.join(' / ')}</small><br><br><span style="font-size:9px;color:var(--green);">¡Añadido a tu Dex e Inventario de Tripulación!</span></div>`, () => screenHome());
      }, 1400);
    } else {
      face.innerHTML = `💨<br><span>VACÍO</span>`;
      el.classList.add('empty');
      current++;
      update();
    }
  };
  update();
}

// ============ PANTALLA: HOME ============
function screenHome() {
  playMusic('menu');
  const accLvl = accountLevel();
  const runnerUnlocked = accLvl >= 30;
  const towerUnlocked = accLvl >= 20;
  const challengeUnlocked = accLvl >= 50;
  const { totalCompleted: completedAch, totalAchievements: totalAchCount, hasUnclaimedAch } = getAchievementsInfo();
  render(`
    ${topbar(false)}
    <div class="subtitle">AVENTURA ROGUELIKE · EGGHEAD EDITION</div>
    <div class="modes">
      <div class="mode-card" id="mode-story">
        <div class="mode-art story"></div>
        <div class="mode-title">Historia</div>
        <div class="mode-btn">${run ? 'CONTINUAR VIAJE' : 'ZARPAR'}</div>
      </div>
      <div class="mode-card ${towerUnlocked ? '' : 'locked'}" id="mode-tower">
        <div class="mode-art tower"></div>
        <div class="mode-title">Torre Marine</div>
        <div class="mode-btn">${towerUnlocked ? 'ENTRAR' : '🔒 NV. CUENTA 20'}</div>
      </div>
      <div class="mode-card ${challengeUnlocked ? '' : 'locked'}" id="mode-challenge">
        <div class="mode-art challenge"></div>
        <div class="mode-title">Desafíos</div>
        <div class="mode-btn">${challengeUnlocked ? 'ENTRAR' : '🔒 NV. CUENTA 50'}</div>
      </div>
    </div>
    <button class="runner-menu-button" id="btn-runner" ${runnerUnlocked ? '' : 'disabled'}><img src="sprites/luffy.png" alt=""><span><strong>⚡ LUFFY RUN</strong><small>${runnerUnlocked ? 'Doble salto · 25 fama cada 1.000 m' : '🔒 Se desbloquea al nivel 30 de cuenta'}</small></span></button>
    <div class="home-main-buttons">
      <button class="btn blue small" id="btn-dex">
        <span>📖 Dex</span>
        <span style="font-size:8px;opacity:0.85;margin-top:2px;">(${meta.dex.length}/${Object.keys(CHARS).length})</span>
      </button>
      <button class="btn purple small" id="btn-inventory">
        <span>🎒 Inventario</span>
        <span style="font-size:8px;opacity:0.85;margin-top:2px;">(${(meta.roster || []).length})</span>
      </button>
      <button class="btn gold small" id="btn-ship">
        <span>🏪 Tienda</span>
        <span style="font-size:8px;opacity:0.85;margin-top:2px;">(⭐${meta.fame})</span>
      </button>
      <button class="btn gold small" id="btn-achievements">
        <span style="position:relative;">🏆 Logros${hasUnclaimedAch ? ' <span class="ach-badge-dot" style="background:#e74c3c;color:#fff;font-size:7px;border-radius:50%;padding:1px 4px;margin-left:2px;font-weight:bold;animation:pulse 1s infinite alternate;border:1px solid #fff;">!</span>' : ''}</span>
        <span style="font-size:8px;opacity:0.85;margin-top:2px;">(${completedAch}/${totalAchCount})</span>
      </button>
    </div>
    <div style="text-align:center;margin-top:8px;">
      <button class="btn red small" id="btn-logpose-gacha" style="padding:7px 16px;font-size:9.5px;font-weight:bold;width:100%;max-width:280px;box-shadow:0 2px 6px rgba(231,76,60,0.4);">
        🎰 TIRADA DE CARTELES (🧭 ${meta.logPoses || 0})
      </button>
    </div>
    <div style="text-align:center;margin-top:8px;">
      <button class="btn gray small" id="btn-guide" style="padding:6px 14px;font-size:9px;">📊 Tipos y Sinergias</button>
    </div>
    <div style="text-align:center;margin-top:14px;display:flex;flex-direction:column;gap:6px;align-items:center;">
      <div class="home-account-status">
        🏴‍☠️ Pirata · Nivel ${accountLevel()} (${meta.accXp || 0}/${accountNextAt()} PX)
      </div>
      <div id="local-save-status" role="status" class="home-save-status">${saveStatusText()}</div>
      ${meta.towerRecord ? `<div style="color:var(--gold);text-shadow:1px 1px 2px #000;font-size:9.5px;font-weight:bold;">🗼 Récord Torre Marine: ${meta.towerRecord} Pisos</div>` : ''}

    </div>
    <div style="text-align:center;margin-top:10px;display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap;">
      <button class="btn small green" id="btn-export">📥 EXPORTAR JSON</button>
      <button class="btn small gold" id="btn-import">📂 IMPORTAR JSON</button>
      <input type="file" id="file-import" accept=".json,application/json" style="display:none;">
    </div>
    <div class="footer-note">
      Réplica del juego fan <a href="https://one-piece-rogue-like-vercel.vercel.app/" target="_blank" rel="noopener noreferrer">GrandLineLike</a>. Sin ánimo de lucro.<br>No afiliado con Eiichiro Oda, Shueisha ni Toei Animation.<br>
      One Piece y sus personajes son propiedad de sus respectivos dueños.
    </div>
  `);
  $('#mode-story').onclick = () => run ? screenMap() : screenSagas();
  if (towerUnlocked) $('#mode-tower').onclick = () => screenTowerIntro();
  if (challengeUnlocked) $('#mode-challenge').onclick = () => screenChallenges();
  $('#btn-runner').onclick = async () => {
    if (accountLevel() < 30) return toast('🔒 Luffy Run se desbloquea al nivel 30 de cuenta.');
    const btn = $('#btn-runner');
    btn.disabled = true;
    try {
      const { openRunner } = await import('./runner/ui.mjs');
      playMusic('combat');
      await openRunner({
        best: meta.runnerBest || 0,
        onFame: amount => gainFame(amount),
        onScore: score => {
          if (score > (meta.runnerBest || 0)) { meta.runnerBest = score; saveMeta(); }
        },
        onExit: () => { screenHome(); $('#btn-runner')?.focus(); },
      });
    } catch (e) {
      playMusic('menu');
      toast('No se pudo abrir el minijuego. Inténtalo de nuevo.');
      btn.disabled = false;
    }
  };
  $('#btn-dex').onclick = screenDex;
  const invBtn = $('#btn-inventory');
  if (invBtn) invBtn.onclick = () => showInventoryModal();
  $('#btn-ship').onclick = screenShip;
  $('#btn-achievements').onclick = showAchievementsModal;
  $('#btn-logpose-gacha').onclick = showLogPoseGachaModal;
  $('#btn-guide').onclick = () => showTypeChartModal(run ? run.team : null);
  $('#btn-export').onclick = exportSave;
  $('#btn-import').onclick = () => $('#file-import').click();
  $('#file-import').onchange = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    modalConfirm('📂 ¿Cargar esta partida?',
      'El progreso actual de este dispositivo se sustituirá<br>por el del archivo. ¿Continuar?',
      () => importSaveFile(file),
      () => { e.target.value = ''; });
  };

}

// ============ PANTALLA: SAGAS ============
// Cada saga se desbloquea al conquistar la anterior en dificultad 3 (Capitán) o superior
const sagaMaxDiffCleared = sagaId => {
  const wins = (meta.sagaDiffWins && meta.sagaDiffWins[sagaId]) || {};
  const diffs = Object.keys(wins).filter(k => wins[k]).map(Number);
  return diffs.length ? Math.max(...diffs) : 0;
};

const sagaUnlocked = i => {
  if (i === 0) return true;
  const prevSaga = SAGAS[i - 1];
  return sagaMaxDiffCleared(prevSaga.id) >= 3;
};

// Desbloqueo secuencial de dificultades por saga:
// Dificultad 1 (Grumete) siempre disponible. Para Dificultad N (N > 1), se requiere haber superado la N-1 en esa misma saga.
const sagaDiffUnlocked = (sagaId, diffId) => {
  if (diffId <= 1) return true;
  const wins = (meta.sagaDiffWins && meta.sagaDiffWins[sagaId]) || {};
  return !!wins[diffId - 1];
};

// ============ MODAL: TABLA DE PROBABILIDADES POR SAGA ============
let currentProbSagaIdx = 0;
let currentProbTab = 'wild';

function showSagaProbabilitiesModal(initialSagaIdx = 0) {
  const dm = $('#diff-dropdown-menu'); if (dm) dm.classList.add('hidden');
  currentProbSagaIdx = initialSagaIdx;
  if (!currentProbTab) currentProbTab = 'wild';

  const renderModalContent = () => {
    const isAll = currentProbSagaIdx === -1;
    const s = !isAll ? SAGAS[currentProbSagaIdx] : null;

    // 1. Wild Pool
    let wildPool = [];
    if (isAll) {
      const allIds = SAGAS.flatMap(sg => (sg.islands && sg.islands[0] && sg.islands[0].pool) || []);
      wildPool = [...new Set(allIds)];
    } else if (s) {
      wildPool = (s.islands && s.islands[0] && s.islands[0].pool) || [];
    }
    const wildPct = wildPool.length ? (100 / wildPool.length) : 0;

    // 2. Bosses (por isla)
    let islandBosses = [];
    if (isAll) {
      SAGAS.forEach(sg => {
        sg.islands.forEach(isl => {
          islandBosses.push({
            name: `${sg.name} — ${isl.name}`,
            bosses: (isl.boss || []).filter(b => CHARS[b])
          });
        });
      });
    } else if (s) {
      islandBosses = s.islands.map(isl => ({
        name: isl.name,
        bosses: (isl.boss || []).filter(b => CHARS[b])
      }));
    }

    // 3. Mercado Clandestino (Carteles SE BUSCA)
    const weights = [41.5, 30, 21, 7, 0.5];
    const totalWeight = 100;
    const gachaTiers = [1, 2, 3, 4, 5].map(r => {
      let pool = [];
      if (isAll) {
        pool = Object.keys(CHARS).filter(id => CHARS[id].rareza === r && !CHARS[id].boss && !EVOLVED_FORMS.has(id));
      } else if (s) {
        pool = sagaPoolByRareza(s.id, r);
      }
      const pct = (weights[r - 1] / totalWeight) * 100;
      const each = pool.length ? (pct / pool.length) : 0;
      return { rareza: r, pct, pool, each };
    });

    let tabHTML = '';
    if (currentProbTab === 'wild') {
      const leg5 = wildPool.filter(id => CHARS[id] && CHARS[id].rareza === 5);
      const others = wildPool.filter(id => !CHARS[id] || CHARS[id].rareza !== 5);
      const rows = wildPool.map(id => {
        const c = CHARS[id];
        const isLeg = c ? c.rareza === 5 : false;
        let pct = 0;
        if (isLeg) {
          pct = leg5.length ? (0.5 / leg5.length) : 0;
        } else {
          pct = others.length ? (99.5 / others.length) : 0;
        }
        return `<tr>
          <td style="white-space:nowrap;">${charIcon(id, 20)} <b>${c ? c.name : id}</b></td>
          <td>${'⭐'.repeat(c ? c.rareza : 1)}</td>
          <td>${typeBadges(c ? c.types : [])}</td>
          <td><b>${pct.toFixed(2)}%</b> ${isLeg ? '<br><small style="color:var(--red);font-weight:bold;">⚔️ Solo combate (+6 Nv)</small>' : ''}</td>
        </tr>`;
      }).join('');
      tabHTML = `
        <div style="font-size:8px;line-height:1.7;margin-bottom:8px;color:#555;">
          Aparición en nodos de piratas salvajes 🏴‍☠️ y marines ⚓ durante el viaje.<br>
          <b>${wildPool.length}</b> personajes en el pool (${wildPct.toFixed(2)}% por slot de enemigo).
        </div>
        <div style="max-height:280px;overflow-y:auto;border:1px solid var(--ink);">
          <table class="chart-table">
            <thead><tr><th>Personaje</th><th>Rareza</th><th>Tipos</th><th>Prob. Slot</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4" style="text-align:center;">Sin datos</td></tr>'}</tbody>
          </table>
        </div>`;
    } else if (currentProbTab === 'boss') {
      const rows = islandBosses.map(ib => {
        const bossesHTML = ib.bosses.map(id => {
          const c = CHARS[id];
          return `${charIcon(id, 20)} <b>${c.name}</b> ${'⭐'.repeat(c.rareza)}`;
        }).join('<br>');
        return `<tr>
          <td><b>${ib.name}</b></td>
          <td>${bossesHTML || 'Sin jefe'}</td>
          <td><b>100%</b> <small style="color:#666;">(Nodo 💀)</small></td>
        </tr>`;
      }).join('');
      tabHTML = `
        <div style="font-size:8px;line-height:1.7;margin-bottom:8px;color:#555;">
          Capitanes y villanos que aparecen de forma garantizada al final de cada isla.
        </div>
        <div style="max-height:280px;overflow-y:auto;border:1px solid var(--ink);">
          <table class="chart-table">
            <thead><tr><th>Isla / Saga</th><th>Jefe(s)</th><th>Probabilidad</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    } else if (currentProbTab === 'items') {
      tabHTML = `
        <div style="font-size:8px;line-height:1.7;margin-bottom:8px;color:#555;">
          Probabilidades de obtención de objetos al abrir un cofre en nodos de Objeto 🎁.
        </div>
        <div style="max-height:280px;overflow-y:auto;border:1px solid var(--ink);">
          <table class="chart-table">
            <thead><tr><th>Objeto</th><th>Efecto / Descripción</th><th>Prob. Caída</th></tr></thead>
            <tbody>
              <tr>
                <td><b>🍈 Fruta del Diablo</b></td>
                <td>Otorga un nuevo Tag elemental a 2 nakamas activos.</td>
                <td><b style="color:var(--gold);">1.00%</b> <small>(Muy Raro)</small></td>
              </tr>
              <tr>
                <td><b>🍖 Carne</b></td>
                <td>Recupera 50 PS a un nakama consciente.</td>
                <td><b>24.75%</b></td>
              </tr>
              <tr>
                <td><b>📜 Cartel de Reclutamiento</b></td>
                <td>Permite intentar seducir o tentar piratas salvajes.</td>
                <td><b>24.75%</b></td>
              </tr>
              <tr>
                <td><b>🥩 Carne Real</b></td>
                <td>Recupera 100 PS a un nakama consciente.</td>
                <td><b>12.38%</b></td>
              </tr>
              <tr>
                <td><b>🏅 Cartel Dorado</b></td>
                <td>Aumenta la suerte de reclutar piratas de alta rareza.</td>
                <td><b>12.38%</b></td>
              </tr>
              <tr>
                <td><b>🍶 Sake de Hermandad</b></td>
                <td>Recupera PS a toda la banda.</td>
                <td><b>12.38%</b></td>
              </tr>
              <tr>
                <td><b>🥪 Bocadillo</b></td>
                <td>Recupera 25 PS a un nakama consciente.</td>
                <td><b>12.38%</b></td>
              </tr>
            </tbody>
          </table>
        </div>`;
    } else if (currentProbTab === 'events') {
      tabHTML = `
        <div style="font-size:8px;line-height:1.7;margin-bottom:8px;color:#555;">
          Probabilidades de eventos aleatorios al entrar en nodos de Misterio ❓.
        </div>
        <div style="max-height:280px;overflow-y:auto;border:1px solid var(--ink);">
          <table class="chart-table">
            <thead><tr><th>Evento</th><th>Efecto de la sala</th><th>Prob. Evento</th></tr></thead>
            <tbody>
              <tr>
                <td><b>🍈 Fruta del Diablo Silvestre</b></td>
                <td>Encuentras una Fruta del Diablo lista para usar.</td>
                <td><b style="color:var(--gold);">2.00%</b> <small>(Muy Raro)</small></td>
              </tr>
              <tr>
                <td><b>💰 Cofre Enterrado</b></td>
                <td>Obtienes Berries (150-400 por nivel de isla).</td>
                <td><b>14.00%</b></td>
              </tr>
              <tr>
                <td><b>🎁 Regalo de Aldeano</b></td>
                <td>Recibes un objeto aleatorio.</td>
                <td><b>14.00%</b></td>
              </tr>
              <tr>
                <td><b>⚔️ Emboscada Pirata</b></td>
                <td>Combate inmediato contra un pirata salvaje.</td>
                <td><b>14.00%</b></td>
              </tr>
              <tr>
                <td><b>♨️ Aguas Termales</b></td>
                <td>Todo el equipo consciente recupera el 100% de PS.</td>
                <td><b>14.00%</b></td>
              </tr>
              <tr>
                <td><b>🥋 Entrenamiento Maestro</b></td>
                <td>El nakama activo gana +2 ATQ permanente.</td>
                <td><b>14.00%</b></td>
              </tr>
              <tr>
                <td><b>🕸️ Trampa de Red</b></td>
                <td>El nakama activo sufre 10 PS de daño.</td>
                <td><b>14.00%</b></td>
              </tr>
              <tr>
                <td><b>🏴‍☠️ Pirata Errante</b></td>
                <td>Un pirata errante se une a tu banda.</td>
                <td><b>14.00%</b></td>
              </tr>
            </tbody>
          </table>
        </div>`;
    } else if (currentProbTab === 'gacha') {
      const rows = gachaTiers.map(t => {
        const poolHTML = t.pool.map(id => `${CHARS[id].name} <span style="color:#888;">(${t.each.toFixed(2)}%)</span>`).join(' · ');
        return `<tr>
          <td style="white-space:nowrap;">${'⭐'.repeat(t.rareza)}</td>
          <td><b>${t.pct.toFixed(1)}%</b></td>
          <td style="font-size:7px;line-height:1.9;">${poolHTML}</td>
        </tr>`;
      }).join('');
      tabHTML = `
        <div style="font-size:8px;line-height:1.7;margin-bottom:8px;color:#555;">
          Probabilidades de los 5 Carteles SE BUSCA en el Mercado Clandestino 🌟.
        </div>
        <div style="max-height:280px;overflow-y:auto;border:1px solid var(--ink);">
          <table class="chart-table">
            <thead><tr><th>Cartel / Rareza</th><th>Prob. Cartel</th><th>Personajes posibles (prob. ind.)</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    return `
      <h2>📊 Probabilidades: ${isAll ? 'TODAS LAS SAGAS' : s.name}</h2>
      <div style="display:flex;justify-content:center;margin-bottom:10px;">
        <select id="spm-saga-sel" style="font-family:inherit;font-size:9px;padding:6px 10px;border:2px solid var(--ink);background:#fff;">
          <option value="-1" ${currentProbSagaIdx === -1 ? 'selected' : ''}>🌐 TODAS LAS SAGAS (Compendio Global)</option>
          ${SAGAS.map((sg, i) => `<option value="${i}" ${i === currentProbSagaIdx ? 'selected' : ''}>${sg.sub}: ${sg.name}</option>`).join('')}
        </select>
      </div>
      <div class="tabs" style="margin-bottom:10px;flex-wrap:wrap;gap:4px;">
        <div class="tab ${currentProbTab === 'wild' ? 'active' : ''}" id="spm-tab-wild" style="font-size:8px;padding:4px 6px;">🏴‍☠️ SALVAJES</div>
        <div class="tab ${currentProbTab === 'boss' ? 'active' : ''}" id="spm-tab-boss" style="font-size:8px;padding:4px 6px;">💀 JEFES</div>
        <div class="tab ${currentProbTab === 'items' ? 'active' : ''}" id="spm-tab-items" style="font-size:8px;padding:4px 6px;">🎁 OBJETOS</div>
        <div class="tab ${currentProbTab === 'events' ? 'active' : ''}" id="spm-tab-events" style="font-size:8px;padding:4px 6px;">❓ MISTERIO</div>
        <div class="tab ${currentProbTab === 'gacha' ? 'active' : ''}" id="spm-tab-gacha" style="font-size:8px;padding:4px 6px;">🎰 MERCADO</div>
      </div>
      ${tabHTML}
      <div class="actions" style="margin-top:12px;"><button class="btn gray" id="spm-close">CERRAR</button></div>
    `;
  };

  const existingOverlay = document.querySelector('#saga-prob-overlay');
  if (existingOverlay) existingOverlay.remove();

  const ov = document.createElement('div');
  ov.id = 'saga-prob-overlay';
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" style="max-width:620px;">${renderModalContent()}</div>`;
  document.body.appendChild(ov);

  const bindEvents = () => {
    const sel = ov.querySelector('#spm-saga-sel');
    if (sel) sel.onchange = e => {
      currentProbSagaIdx = parseInt(e.target.value, 10);
      ov.querySelector('.modal').innerHTML = renderModalContent();
      bindEvents();
    };
    ['wild', 'boss', 'items', 'events', 'gacha'].forEach(tabKey => {
      const tabEl = ov.querySelector(`#spm-tab-${tabKey}`);
      if (tabEl) tabEl.onclick = () => {
        currentProbTab = tabKey;
        ov.querySelector('.modal').innerHTML = renderModalContent();
        bindEvents();
      };
    });
    const cbtn = ov.querySelector('#spm-close');
    if (cbtn) cbtn.onclick = () => ov.remove();
  };

  bindEvents();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}

function showSagaInfoModal(sagaIdx = 0) {
  const dm = $('#diff-dropdown-menu'); if (dm) dm.classList.add('hidden');
  const s = SAGAS[sagaIdx];
  if (!s) return;

  const existingOverlay = document.querySelector('#saga-info-overlay');
  if (existingOverlay) existingOverlay.remove();

  const islandsHTML = s.islands.map((isl, idx) => {
    const bossesHTML = (isl.boss || []).map((bId, bIdx) => {
      const c = CHARS[bId];
      const bLvl = (isl.bossLvl && isl.bossLvl[bIdx]) ? isl.bossLvl[bIdx] : '?';
      if (!c) return `<span>💀 ${bId} (Nv. ${bLvl})</span>`;
      return `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,0.04);padding:4px 8px;border-radius:4px;border:1px solid #ddd;margin:2px;">
        ${charIcon(bId, 22)}
        <span><b>${c.name}</b> <small style="color:var(--red);font-weight:bold;">Nv. ${bLvl}</small></span>
      </div>`;
    }).join(' ');

    return `
      <div style="background:#fff;border:1px solid var(--ink);border-radius:6px;padding:8px 12px;margin-bottom:8px;text-align:left;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-weight:bold;font-size:10px;color:var(--gold-dark,#b8860b);">🏝️ Isla ${idx + 1}: ${isl.name}</span>
          <span style="font-size:8px;background:var(--sky,#e0f7fa);padding:2px 6px;border-radius:4px;border:1px solid #90caf9;">Rango Nivel: Nv. ${isl.lvl ? isl.lvl[0] + ' - ' + isl.lvl[1] : '?'}</span>
        </div>
        <div style="font-size:8px;color:#555;margin-top:6px;display:flex;flex-wrap:wrap;align-items:center;gap:4px;">
          <b>Jefes:</b> ${bossesHTML || 'Sin jefes'}
        </div>
      </div>
    `;
  }).join('');

  const ov = document.createElement('div');
  ov.id = 'saga-info-overlay';
  ov.className = 'overlay';
  ov.innerHTML = `
    <div class="modal" style="max-width:520px;max-height:85vh;display:flex;flex-direction:column;">
      <h2 style="margin-bottom:4px;">ℹ️ Información: ${s.name}</h2>
      <p style="font-size:9px;color:#666;margin-bottom:12px;">Niveles de esbirros y bosses de cada isla de esta saga.</p>
      <div style="overflow-y:auto;flex:1;padding-right:4px;">
        ${islandsHTML}
      </div>
      <div class="actions" style="margin-top:12px;text-align:center;">
        <button class="btn gray" id="sim-close">CERRAR</button>
      </div>
    </div>
  `;
  document.body.appendChild(ov);

  ov.querySelector('#sim-close').onclick = () => ov.remove();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}

let storyMode = 'classic';

function screenSagas() {
  playMusic('menu');

  const curDiffObj = DIFFICULTIES.find(d => d.id === selectedDiff) || DIFFICULTIES[0];

  render(`
    ${topbar(false)}
    <button class="btn gray small back-btn" id="btn-back">← VOLVER</button>
    <div class="panel" style="margin-bottom:10px;">
      <h2>Historia — El Mundo de One Piece</h2>
      <p>Elige tu modo, la dificultad y selecciona una saga para zarpar.</p>
      <div style="margin-top:8px;text-align:right;">
        <button class="btn small blue" id="btn-saga-probs-all" style="font-size:8px;">📊 PROBABILIDADES DE SAGAS</button>
      </div>
    </div>

    <div class="diff-picker-bar">
      <div class="tabs" style="margin-bottom:0;flex:1;max-width:320px;">
        <div class="tab ${storyMode === 'classic' ? 'active' : ''}" id="tab-classic">CLÁSICO</div>
        <div class="tab ${storyMode === 'nuzlocke' ? 'active' : ''}" id="tab-nuz">NUZLOCKE</div>
      </div>
      <div class="diff-dropdown-container" id="diff-dropdown-container">
        <button class="btn gold small diff-dropdown-trigger" id="btn-diff-trigger">
          🎯 DIFICULTAD: ${curDiffObj.emoji} ${curDiffObj.name.toUpperCase()} ▾
        </button>
        <div class="diff-dropdown-menu hidden" id="diff-dropdown-menu">
          <div class="diff-dropdown-header">🎯 SELECCIONA DIFICULTAD DE LA AVENTURA</div>
          ${DIFFICULTIES.map(d => `
            <div class="diff-dropdown-item ${selectedDiff === d.id ? 'active' : ''}" data-diff="${d.id}">
              <div class="diff-item-head">
                <span>${d.emoji} <b>${d.name}</b></span>
                <span style="font-size:8px;color:var(--gold);">x${d.mult.toFixed(2)}</span>
              </div>
              <div class="diff-item-desc">${d.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="saga-list-container">
      ${SAGAS.map((s, idx) => {
    const diffWinsMap = (meta.sagaDiffWins && meta.sagaDiffWins[s.id]) || {};
    const diffWins = Object.keys(diffWinsMap).length;
    const isSelectedCleared = !!diffWinsMap[selectedDiff];
    const isSagaUnlocked = sagaUnlocked(idx);
    const isDiffUnlocked = sagaDiffUnlocked(s.id, selectedDiff);
    const curDiffName = curDiffObj.name;
    const prevDiffObj = DIFFICULTIES.find(d => d.id === selectedDiff - 1);

    return `
        <div class="saga-row ${isSagaUnlocked && isDiffUnlocked ? '' : 'locked'} ${isSelectedCleared ? 'diff-cleared' : ''}" data-saga="${idx}">
          <div class="saga-art" style="background:${s.img ? `url('${s.img}') center/cover no-repeat` : s.color || '#777'};">
            <div class="saga-art-overlay">
              <div class="saga-art-title">${isSagaUnlocked ? '' : '🔒 '}${s.name}</div>
              <div class="saga-art-sub">${s.sub}</div>
            </div>
          </div>
          <div class="saga-stats">
            ${!isSagaUnlocked ? `
              <div class="saga-lock-banner">
                🔒 SAGA BLOQUEADA<br>
                <span style="font-weight:normal;font-size:9px;color:#ffeaad;">
                  Debes completar Dificultad <b>⚔️ Capitán</b> en <b>${SAGAS[idx - 1] ? SAGAS[idx - 1].name : ''}</b>
                </span>
              </div>` : `
              <div class="saga-stats-top">
                <div class="saga-tag-header">
                  ${isSelectedCleared
        ? `<span class="diff-cleared-tag">⭐ ${curDiffName} SUPERADA</span>`
        : isDiffUnlocked
          ? `<span class="diff-pending-tag">🎯 ${curDiffName} PENDIENTE</span>`
          : `<span class="diff-locked-tag">🔒 ${curDiffName} BLOQUEADA</span>`}
                </div>
                <div class="saga-stat-line"><span>Victorias Clásico</span> <b>${meta.wins[s.id] || 0}</b></div>
                <div class="saga-stat-line"><span>Victorias Nuzlocke</span> <b>${meta.nuzWins[s.id] || 0}</b></div>
                <div class="saga-stat-line"><span>Dificultades Superadas</span> <b>${diffWins}/5 ⭐</b></div>
                ${!isDiffUnlocked && prevDiffObj ? `
                  <div class="saga-req-box">
                    ⚠️ Requisito: Supera esta saga en Dificultad <b>${prevDiffObj.emoji} ${prevDiffObj.name}</b> primero.
                  </div>
                ` : ''}
              </div>
              <div class="saga-stats-bottom">
                <div class="saga-diff-badges">
                  ${DIFFICULTIES.map(d => {
            const beaten = !!diffWinsMap[d.id];
            const unlocked = sagaDiffUnlocked(s.id, d.id);
            return `<span class="saga-diff-badge ${beaten ? 'beaten' : ''} ${!unlocked ? 'locked-badge' : ''}" title="${d.name}: ${beaten ? 'Superada ✓' : unlocked ? 'Disponible' : 'Bloqueada'}">
                      ${d.emoji}${beaten ? '✓' : !unlocked ? '🔒' : ''}
                    </span>`;
          }).join('')}
                </div>
                <div class="saga-stats-btn-wrap">
                  <button class="btn small gray btn-saga-probs" data-saga="${idx}">📊 PROBABILIDADES</button>
                  <button class="btn small blue btn-saga-info" data-saga-info="${idx}" title="Información de Jefes y Niveles">ℹ️</button>
                </div>
              </div>
            `}
          </div>
        </div>
      `}).join('')}
    </div>
    <div class="footer-note">Más sagas en camino. ¡Mientras tanto, prueba la Torre Marine!</div>
  `);

  $('#btn-back').onclick = () => { screenHome(); };
  $('#tab-classic').onclick = () => { storyMode = 'classic'; screenSagas(); };
  $('#tab-nuz').onclick = () => { storyMode = 'nuzlocke'; screenSagas(); };

  const diffTrigger = $('#btn-diff-trigger');
  const diffMenu = $('#diff-dropdown-menu');
  if (diffTrigger && diffMenu) {
    diffTrigger.onclick = e => {
      e.stopPropagation();
      diffMenu.classList.toggle('hidden');
    };
    document.onclick = e => {
      if (!diffMenu.classList.contains('hidden') && !e.target.closest('#diff-dropdown-container')) {
        diffMenu.classList.add('hidden');
      }
    };
  }

  const allProbsBtn = $('#btn-saga-probs-all');
  if (allProbsBtn) allProbsBtn.onclick = () => showSagaProbabilitiesModal(-1);

  document.querySelectorAll('.diff-dropdown-item').forEach(item => {
    item.onclick = e => {
      e.stopPropagation();
      selectedDiff = +item.dataset.diff;
      screenSagas();
    };
  });

  document.querySelectorAll('[data-saga-info]').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      showSagaInfoModal(+btn.dataset.sagaInfo);
    };
  });

  document.querySelectorAll('.saga-row').forEach(el => {
    const idx = +el.dataset.saga;
    const s = SAGAS[idx];
    el.onclick = () => {
      if (!sagaUnlocked(idx)) {
        toast(`🔒 Debes completar Dificultad Capitán en ${SAGAS[idx - 1].name}.`);
        return;
      }
      if (!sagaDiffUnlocked(s.id, selectedDiff)) {
        const prevD = DIFFICULTIES.find(d => d.id === selectedDiff - 1);
        const curD = DIFFICULTIES.find(d => d.id === selectedDiff);
        toast(`🔒 Debes superar ${s.name} en Dificultad ${prevD ? prevD.name : ''} primero.`);
        return;
      }
      screenStarter(idx);
    };
  });

  document.querySelectorAll('.btn-saga-probs').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      showSagaProbabilitiesModal(+btn.dataset.saga);
    };
  });
}

// ============ LISTAS DE PERSONAJES: FILTRO, ORDEN Y CUADRÍCULA 3x3 ============
// La Dex y la selección de nakamas comparten esta vista: cuadrícula de
// 3 columnas x 3 filas (9 cartas visibles a la vez) con paginación por
// botones ◀ ▶ o deslizando (swipe) en pantallas táctiles.
const GRID_PAGE = 9;

function charControlsHTML(st, opts = {}) {
  const sagaSel = opts.sagas ? `<select id="cf-saga" title="Filtrar por saga">
      <option value="">Todas las sagas</option>
      ${opts.sagas.map(s => `<option value="${s.id}" ${st.saga === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
    </select>` : '';
  return `<div class="char-controls">
    <input id="cf-q" placeholder="🔎 Buscar nombre..." value="${(st.q || '').replace(/"/g, '&quot;')}">
    ${sagaSel}
    <select id="cf-type" title="Filtrar por tipo">
      <option value="">Todos los tipos</option>
      ${Object.keys(TYPES).map(t => `<option value="${t}" ${st.type === t ? 'selected' : ''}>${TYPES[t].emoji} ${t}</option>`).join('')}
    </select>
    <select id="cf-rarity" title="Filtrar por rareza">
      <option value="0">Toda rareza</option>
      ${[1, 2, 3, 4, 5].map(r => `<option value="${r}" ${+st.rarity === r ? 'selected' : ''}>${'⭐'.repeat(r)}</option>`).join('')}
    </select>
    <select id="cf-sort" title="Ordenar">
      <option value="default" ${st.sort === 'default' ? 'selected' : ''}>Orden original</option>
      <option value="name" ${st.sort === 'name' ? 'selected' : ''}>Nombre A-Z</option>
      <option value="rarezaDesc" ${st.sort === 'rarezaDesc' ? 'selected' : ''}>Rareza ⭐ mayor</option>
      <option value="rarezaAsc" ${st.sort === 'rarezaAsc' ? 'selected' : ''}>Rareza ⭐ menor</option>
      <option value="statTotalDesc" ${st.sort === 'statTotalDesc' ? 'selected' : ''}>Stats Totales ▼</option>
      <option value="hpDesc" ${st.sort === 'hpDesc' ? 'selected' : ''}>PS base ▼</option>
      <option value="atkDesc" ${st.sort === 'atkDesc' ? 'selected' : ''}>ATQ base ▼</option>
      <option value="defDesc" ${st.sort === 'defDesc' ? 'selected' : ''}>DEF base ▼</option>
      <option value="spatkDesc" ${st.sort === 'spatkDesc' ? 'selected' : ''}>E.ATQ base ▼</option>
      <option value="spdefDesc" ${st.sort === 'spdefDesc' ? 'selected' : ''}>E.DEF base ▼</option>
      <option value="spdDesc" ${st.sort === 'spdDesc' ? 'selected' : ''}>VEL base ▼</option>
    </select>
  </div>`;
}

function bindCharControls(st, onChange) {
  const q = $('#cf-q');
  if (q) q.oninput = () => { st.q = q.value; st.page = 0; onChange(); };
  [['#cf-saga', 'saga'], ['#cf-type', 'type'], ['#cf-rarity', 'rarity'], ['#cf-sort', 'sort']].forEach(([sel, prop]) => {
    const el = $(sel);
    if (el) el.onchange = () => { st[prop] = el.value; st.page = 0; onChange(); };
  });
}

// Filtra (nombre, saga, tipo, rareza) y ordena la lista de personajes
function filterSortChars(ids, st) {
  const q = (st.q || '').trim().toLowerCase();
  const out = ids.filter(id => {
    const c = CHARS[id];
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (st.saga && c.saga !== st.saga) return false;
    if (st.type && !c.types.includes(st.type)) return false;
    if (+st.rarity && c.rareza !== +st.rarity) return false;
    return true;
  });
  const byName = (a, b) => CHARS[a].name.localeCompare(CHARS[b].name);
  const baseStatSum = id => CHARS[id].base.reduce((a, b) => a + b, 0);
  if (st.sort === 'name') out.sort(byName);
  else if (st.sort === 'rarezaAsc') out.sort((a, b) => CHARS[a].rareza - CHARS[b].rareza || byName(a, b));
  else if (st.sort === 'rarezaDesc') out.sort((a, b) => CHARS[b].rareza - CHARS[a].rareza || byName(a, b));
  else if (st.sort === 'statTotalDesc') out.sort((a, b) => baseStatSum(b) - baseStatSum(a) || byName(a, b));
  else if (st.sort === 'hpDesc') out.sort((a, b) => CHARS[b].base[0] - CHARS[a].base[0] || byName(a, b));
  else if (st.sort === 'atkDesc') out.sort((a, b) => CHARS[b].base[1] - CHARS[a].base[1] || byName(a, b));
  else if (st.sort === 'defDesc') out.sort((a, b) => CHARS[b].base[2] - CHARS[a].base[2] || byName(a, b));
  else if (st.sort === 'spatkDesc') out.sort((a, b) => CHARS[b].base[3] - CHARS[a].base[3] || byName(a, b));
  else if (st.sort === 'spdefDesc') out.sort((a, b) => CHARS[b].base[4] - CHARS[a].base[4] || byName(a, b));
  else if (st.sort === 'spdDesc') out.sort((a, b) => CHARS[b].base[5] - CHARS[a].base[5] || byName(a, b));
  return out;
}

// Pinta una página de la cuadrícula 3x3 dentro de `el` y conecta la
// paginación (botones y swipe). `bindFn` reengancha los clics de las cartas.
function renderCharGrid(el, ids, st, cardFn, bindFn) {
  if (!el) return;
  const pages = Math.max(1, Math.ceil(ids.length / GRID_PAGE));
  st.page = clamp(st.page || 0, 0, pages - 1);
  const slice = ids.slice(st.page * GRID_PAGE, (st.page + 1) * GRID_PAGE);
  el.innerHTML = `
    <div class="grid-nav">
      <button class="btn small gray" id="gp-prev" ${st.page === 0 ? 'disabled' : ''}>◀</button>
      <span>Página ${st.page + 1}/${pages} · ${ids.length} personajes</span>
      <button class="btn small gray" id="gp-next" ${st.page >= pages - 1 ? 'disabled' : ''}>▶</button>
    </div>
    ${mobileColumnsControl()}
    <div class="grid9" id="grid9">
      ${slice.map(cardFn).join('') || '<div class="grid-empty">Sin resultados con estos filtros.</div>'}
    </div>
    <div style="text-align:center;font-size:7px;color:#888;">Desliza la cuadrícula o usa ◀ ▶ para pasar de página</div>`;
  const redraw = () => renderCharGrid(el, ids, st, cardFn, bindFn);
  el.querySelector('#gp-prev').onclick = () => { if (st.page > 0) { st.page--; redraw(); } };
  el.querySelector('#gp-next').onclick = () => { if (st.page < pages - 1) { st.page++; redraw(); } };
  // swipe táctil entre páginas
  const grid = el.querySelector('#grid9');
  let x0 = null;
  grid.ontouchstart = e => { x0 = e.touches[0].clientX; };
  grid.ontouchend = e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (dx < -40 && st.page < pages - 1) { st.page++; redraw(); }
    else if (dx > 40 && st.page > 0) { st.page--; redraw(); }
  };
  bindFn && bindFn(el);
}

// ============ MODAL: INVENTARIO DE NAKAMAS ============
let invViewState = { q: '', type: '', rarity: 0 };

function showInventoryModal(opts = {}) {
  const onSelect = opts.onSelect || null;
  const currentTeam = opts.currentTeam || [];
  const title = opts.title || '🎒 INVENTARIO DE NAKAMAS';

  const rosterChars = (meta.roster || []).filter(id => CHARS[id]);
  const allUnlocked = [...new Set(['luffy', ...rosterChars])].filter(id => CHARS[id] && isNakamaUnlocked(id));

  invViewState = { q: '', type: '', rarity: 0 };

  const renderModalContent = () => {
    let ids = filterSortChars(allUnlocked, invViewState);
    const cap = maxStartLvlCap();

    const cardsHTML = ids.map(id => {
      const c = CHARS[id];
      const inTeam = currentTeam.includes(id);
      const startLvl = startLvlOf(id);
      const cost = logPoseUpgradeCost(startLvl);
      const isMax = startLvl >= cap;
      const canAfford = (meta.logPoses || 0) >= cost;

      return `
        <div class="dex-card sel-card ${inTeam ? 'picked' : ''}" data-id="${id}" style="position:relative;background:var(--paper);border:2px solid var(--ink);padding:8px 6px;text-align:center;cursor:pointer;">
          ${inTeam ? '<div class="veteran-tag" style="background:var(--green);font-size:7px;">EN EQUIPO</div>' : ''}
          <div class="emoji">${charIcon(id, 34)}</div>
          <div style="font-size:8.5px;margin:3px 0;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name}</div>
          <div class="char-lvl" style="font-size:7.5px;">Nv. ${startLvl} · ${'⭐'.repeat(c.rareza)}</div>
          <div class="type-badges" style="margin:3px 0;justify-content:center;">${typeBadges(c.types)}</div>
          <div style="display:flex;flex-direction:column;gap:3px;margin-top:4px;">
            ${isMax ? `
              <span style="font-size:7px;color:var(--green);font-weight:bold;background:rgba(0,0,0,0.06);padding:2px;border-radius:3px;">🔒 Nv. Máx (${cap})</span>
            ` : `
              <button class="btn small gold btn-upg-inv" data-id="${id}" ${canAfford ? '' : 'disabled'} style="font-size:7px;padding:3px 4px;" title="Cuesta ${cost} Log Poses">
                ⬆️ Nv ${startLvl + 1} (${cost} 🧭)
              </button>
            `}
            <div style="display:flex;gap:3px;justify-content:center;">
              ${onSelect ? `<button class="btn small green btn-pick-inv" data-id="${id}" style="font-size:7px;padding:3px 6px;flex:1;">${inTeam ? 'SELECCIONADO' : 'ELEGIR'}</button>` : ''}
              <button class="btn small gray btn-info-inv" data-id="${id}" style="font-size:7px;padding:3px 6px;">ℹ️ FICHA</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
        <h2 style="margin:0;font-size:12px;color:var(--sea);">${title}</h2>
        <div id="inv-logpose-info" style="font-size:9.5px;font-weight:bold;color:var(--gold);background:var(--ink);padding:3px 8px;border-radius:4px;border:1px solid var(--gold);cursor:pointer;" title="Toca para saber más sobre los Log Poses">
          🧭 Log Poses: ${meta.logPoses || 0} ℹ️
        </div>
        <button class="btn gray small" id="inv-close-x" style="padding:2px 6px;font-size:9px;">✕</button>
      </div>
      <div style="font-size:8px;color:#555;margin-bottom:8px;">
        Nakamas disponibles: <b>${allUnlocked.length}</b> ${onSelect ? '· Toca un personaje para elegirlo para tu equipo' : ''}
      </div>
      <div class="char-controls" style="margin-bottom:10px;gap:4px;">
        <input id="inv-q" placeholder="🔎 Buscar por nombre..." value="${(invViewState.q || '').replace(/"/g, '&quot;')}" style="font-size:8px;padding:5px;">
        <select id="inv-type" style="font-size:8px;padding:5px;">
          <option value="">Todos los tipos</option>
          ${Object.keys(TYPES).map(t => `<option value="${t}" ${invViewState.type === t ? 'selected' : ''}>${TYPES[t].emoji} ${t}</option>`).join('')}
        </select>
        <select id="inv-rarity" style="font-size:8px;padding:5px;">
          <option value="0">Toda rareza</option>
          ${[1, 2, 3, 4, 5].map(r => `<option value="${r}" ${+invViewState.rarity === r ? 'selected' : ''}>${'⭐'.repeat(r)}</option>`).join('')}
        </select>
      </div>
      ${mobileColumnsControl()}
      <div id="inv-cards-grid" style="max-height:360px;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill, minmax(110px, 1fr));gap:8px;padding:4px;border:1px solid #ccc;background:rgba(0,0,0,0.05);">
        ${cardsHTML || '<div style="grid-column:1/-1;text-align:center;font-size:9px;color:#888;padding:20px;">Sin nakamas que coincidan.</div>'}
      </div>
      <div class="actions" style="margin-top:10px;text-align:right;">
        <button class="btn gray small" id="inv-close-btn">CERRAR</button>
      </div>
    `;
  };

  const existing = document.querySelector('#inventory-modal-overlay');
  if (existing) existing.remove();

  const ov = document.createElement('div');
  ov.id = 'inventory-modal-overlay';
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" style="max-width:640px;width:95%;">${renderModalContent()}</div>`;
  document.body.appendChild(ov);

  const refreshModalContent = () => {
    const grid = ov.querySelector('#inv-cards-grid');
    const gridScrollTop = grid ? grid.scrollTop : 0;
    const modal = ov.querySelector('.modal');
    const modalScrollTop = modal ? modal.scrollTop : 0;

    modal.innerHTML = renderModalContent();
    bindEvents();

    const newGrid = ov.querySelector('#inv-cards-grid');
    if (newGrid) newGrid.scrollTop = gridScrollTop;
    const newModal = ov.querySelector('.modal');
    if (newModal) newModal.scrollTop = modalScrollTop;
  };

  const bindEvents = () => {
    const logPoseBtn = ov.querySelector('#inv-logpose-info');
    if (logPoseBtn) {
      logPoseBtn.onclick = () => {
        modalInfo(
          '🧭 Log Poses de Navegación',
          `<div style="font-size:8.5px;line-height:1.5;color:#333;text-align:left;padding:4px;">
            Los <b>Log Poses 🧭</b> son brujulas de navegación de Grand Line que obtienes al derrotar enemigos durante tu travesía en el modo Historia.<br><br>
            • <b>¿Para qué sirven?</b> Se consumen para entrenar y <b>subir de nivel base permanente</b> a tus nakamas desde este inventario.<br>
            • <b>Recompensas en combate:</b> Obtienes de 1 a 3 Log Poses por enemigo vencido (y más en combates de jefes).<br>
            • <b>Coste incremental:</b> Cuanto mayor sea el nivel de un nakama, más Log Poses necesitarás para subirlo al siguiente nivel (hasta el límite de tu saga actual).
          </div>`
        );
      };
    }

    const qInput = ov.querySelector('#inv-q');
    if (qInput) qInput.oninput = e => {
      invViewState.q = e.target.value;
      refreshModalContent();
      const newQ = ov.querySelector('#inv-q');
      if (newQ) { newQ.focus(); newQ.selectionStart = newQ.selectionEnd = newQ.value.length; }
    };

    const typeSel = ov.querySelector('#inv-type');
    if (typeSel) typeSel.onchange = e => {
      invViewState.type = e.target.value;
      refreshModalContent();
    };

    const raritySel = ov.querySelector('#inv-rarity');
    if (raritySel) raritySel.onchange = e => {
      invViewState.rarity = +e.target.value;
      refreshModalContent();
    };

    ov.querySelectorAll('.btn-upg-inv').forEach(btn => {
      btn.onclick = e => {
        e.stopPropagation();
        if (upgradeCharLvl(btn.dataset.id)) {
          refreshModalContent();
        }
      };
    });

    ov.querySelectorAll('.dex-card').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('.btn-upg-inv') || e.target.closest('.btn-info-inv')) return;
        const id = card.dataset.id;
        if (onSelect) {
          ov.remove();
          onSelect(id);
        } else {
          showCharModal(id);
        }
      };
    });

    ov.querySelectorAll('.btn-info-inv').forEach(btn => {
      btn.onclick = e => {
        e.stopPropagation();
        showCharModal(btn.dataset.id);
      };
    });

    const closeBtn = ov.querySelector('#inv-close-btn');
    if (closeBtn) closeBtn.onclick = () => ov.remove();

    const closeX = ov.querySelector('#inv-close-x');
    if (closeX) closeX.onclick = () => ov.remove();
  };

  bindEvents();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}

// ============ PANTALLA: INICIAL ============
const starterView = { q: '', saga: '', type: '', rarity: 0, sort: 'default', page: 0 };

function selCardHTML(id, veteran, picked, unlocked) {
  const c = CHARS[id];
  return `<div class="dex-card sel-card ${picked ? 'picked' : ''} ${unlocked ? '' : 'locked'}" data-id="${id}">
    ${!unlocked ? '<div class="veteran-tag" style="background:#666;">🔒 BLOQUEADO</div>' : veteran ? '<div class="veteran-tag">🏅 VETERANO</div>' : (c.nakama ? '<div class="veteran-tag" style="background:var(--sea);">🏴‍☠️ NAKAMA</div>' : '')}
    <div class="emoji">${charIcon(id, 36)}</div>
    <div style="font-size:9px;margin:3px 0;">${c.name}</div>
    <div class="char-lvl">${unlocked ? `Nv. ${startLvlOf(id)}${startLvlOf(id) > 5 ? ' 🔥' : ''} · ` : ''}${'⭐'.repeat(c.rareza)}</div>
    ${typeBadges(c.types)}
    <button class="btn small gray info-btn" data-info="${id}">ℹ️ FICHA</button>
  </div>`;
}

function starterSlotsCount() {
  const count = Math.max(1, meta.global.starterSlots || (meta.global.doblestarter ? 2 : 1));
  return Math.min(6, count);
}

let currentStarterUpdateFn = null;

function screenStarter(sagaIdx) {
  playMusic('menu');
  const saga = SAGAS[sagaIdx];
  const maxSlots = starterSlotsCount();
  let picked = [];

  meta.teamPresets = meta.teamPresets || { 1: [], 2: [], 3: [] };

  const renderSlotsGrid = () => {
    let slotsHTML = '';
    const cap = maxStartLvlCap();
    for (let i = 0; i < maxSlots; i++) {
      const id = picked[i];
      if (id && CHARS[id]) {
        const c = CHARS[id];
        const startLvl = startLvlOf(id);
        const cost = logPoseUpgradeCost(startLvl);
        const isMax = startLvl >= cap;
        const canAfford = (meta.logPoses || 0) >= cost;

        slotsHTML += `
          <div class="starter-slot-card occupied" data-slot="${i}">
            <div class="starter-slot-badge">HUECO ${i + 1}</div>
            <div style="margin-top:14px;" class="emoji">${charIcon(id, 40)}</div>
            <div style="font-size:10px;font-weight:bold;margin:3px 0;">${c.name}</div>
            <div class="char-lvl" style="font-size:8px;">Nv. ${startLvl} · ${'⭐'.repeat(c.rareza)}</div>
            <div class="type-badges" style="margin:3px 0;justify-content:center;">${typeBadges(c.types)}</div>
            <div style="margin:4px 0;width:100%;">
              ${isMax ? `
                <span style="font-size:7.5px;color:var(--green);font-weight:bold;background:rgba(0,0,0,0.06);padding:2px 6px;border-radius:3px;display:inline-block;">🔒 Nv. Máx (${cap})</span>
              ` : `
                <button class="btn small gold btn-upg-slot" data-id="${id}" ${canAfford ? '' : 'disabled'} style="font-size:7.5px;padding:3px 6px;width:100%;" title="Cuesta ${cost} Log Poses">
                  ⬆️ Subir Nv (${cost} 🧭)
                </button>
              `}
            </div>
            <div style="display:flex;gap:3px;margin-top:2px;width:100%;justify-content:center;">
              <button class="btn small blue btn-swap-slot" data-slot="${i}" style="font-size:7.5px;padding:3px 5px;flex:1;">🔄 Cambiar</button>
              <button class="btn small gray btn-info-slot" data-id="${id}" style="font-size:7.5px;padding:3px 5px;">ℹ️</button>
              <button class="btn small red btn-remove-slot" data-slot="${i}" style="font-size:7.5px;padding:3px 5px;">✕</button>
            </div>
          </div>
        `;
      } else {
        slotsHTML += `
          <div class="starter-slot-card empty-slot" data-slot="${i}">
            <div class="starter-slot-badge">HUECO ${i + 1}</div>
            <div style="font-size:28px;margin-bottom:4px;">➕</div>
            <div style="font-size:9.5px;font-weight:bold;color:var(--sea);">Añadir Nakama</div>
            <div style="font-size:7.5px;color:#666;margin-top:2px;">Toca para elegir</div>
          </div>
        `;
      }
    }
    return `<div class="starter-team-grid">${slotsHTML}</div>`;
  };

  const renderPresetsBar = () => {
    return `
      <div class="preset-bar" style="display:flex;flex-direction:column;gap:6px;align-items:center;margin:12px 0;background:rgba(0,0,0,0.25);padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);">
        <span style="font-size:9px;font-weight:bold;color:var(--gold);">💾 EQUIPOS PREDEFINIDOS</span>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;width:100%;">
          ${[1, 2, 3].map(slot => {
      const p = meta.teamPresets[slot] || [];
      return `
              <div class="preset-slot-box" style="display:flex;align-items:center;gap:4px;background:rgba(0,0,0,0.4);padding:4px 8px;border-radius:4px;border:1px solid #555;">
                <span style="font-size:8.5px;color:var(--gold);font-weight:bold;">P${slot}:</span>
                <button class="btn small gray btn-load-preset" data-slot="${slot}" style="font-size:7.5px;padding:3px 6px;">
                  📂 Cargar ${p.length ? `(${p.length})` : '(vacío)'}
                </button>
                <button class="btn small blue btn-save-preset" data-slot="${slot}" style="font-size:7.5px;padding:3px 6px;" title="Guardar selección actual en Preset ${slot}">
                  💾 Guardar
                </button>
              </div>`;
    }).join('')}
        </div>
      </div>`;
  };

  render(`
    ${topbar(false)}
    <button class="btn gray small back-btn" id="btn-back">← VOLVER</button>
    <div class="subtitle" style="font-size:14px;">Aventura en ${saga.name}</div>
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
        <h2 id="starter-team-heading" style="margin:0;">🏴‍☠️ Configuración de la Banda (${picked.length}/${maxSlots})</h2>
        <div id="starter-logpose-info" style="font-size:9.5px;font-weight:bold;color:var(--gold);background:var(--ink);padding:4px 8px;border-radius:4px;border:1px solid var(--gold);cursor:pointer;" title="Toca para saber más sobre los Log Poses">
          🧭 Log Poses: ${meta.logPoses || 0} ℹ️
        </div>
      </div>
      <p style="font-size:8.5px;color:#555;margin-bottom:12px;">Toca un personaje para cambiarlo, sube su nivel con 🧭 Log Poses o pulsa un hueco vacío para abrir el inventario.</p>
      
      <div id="starter-slots-container"></div>
      ${renderPresetsBar()}

      <div style="text-align:center;margin-top:16px;">
        <button class="btn green" id="btn-zarpar" style="font-size:11px;padding:10px 20px;">
          ⚔️ ZARPAR CON TU BANDA (${picked.length}/${maxSlots})
        </button>
      </div>
    </div>
  `);

  $('#btn-back').onclick = screenSagas;

  const openInventoryPicker = (slotIdx) => {
    showInventoryModal({
      title: `Añadir / Sustituir Nakama (Hueco ${slotIdx + 1})`,
      currentTeam: picked,
      onSelect: (newId) => {
        const existingIdx = picked.indexOf(newId);
        if (existingIdx >= 0 && existingIdx !== slotIdx) {
          const temp = picked[slotIdx];
          picked[slotIdx] = newId;
          if (temp) picked[existingIdx] = temp;
          else picked.splice(existingIdx, 1);
        } else {
          picked[slotIdx] = newId;
        }
        update();
      }
    });
  };

  const bindEvents = () => {
    const logPoseBtn = $('#starter-logpose-info');
    if (logPoseBtn) {
      logPoseBtn.onclick = () => {
        modalInfo(
          '🧭 Log Poses de Navegación',
          `<div style="font-size:8.5px;line-height:1.5;color:#333;text-align:left;padding:4px;">
            Los <b>Log Poses 🧭</b> son brújulas de navegación de Grand Line que obtienes al derrotar enemigos durante tu travesía.<br><br>
            • <b>¿Para qué sirven?</b> Se consumen para entrenar y <b>subir el nivel base permanente</b> de tus nakamas.<br>
            • <b>Subida directa:</b> Puedes pulsar el botón <b>⬆️ Subir Nv</b> en cada hueco de personaje o abrir el inventario.<br>
            • <b>Coste incremental:</b> Cuanto mayor sea el nivel de un nakama, más Log Poses necesitarás para subirlo al siguiente nivel (hasta el límite de tu saga actual: Nv. ${maxStartLvlCap()}).
          </div>`
        );
      };
    }

    const slotsContainer = $('#starter-slots-container');
    if (slotsContainer) {
      makeListReorderable(slotsContainer, '.starter-slot-card.occupied', (from, to) => {
        const temp = picked[from];
        picked[from] = picked[to];
        picked[to] = temp;
        update();
      });

      slotsContainer.querySelectorAll('.starter-slot-card.empty-slot').forEach(card => {
        card.onclick = () => openInventoryPicker(+card.dataset.slot);
      });
      slotsContainer.querySelectorAll('.btn-upg-slot').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          if (upgradeCharLvl(btn.dataset.id)) {
            update();
          }
        };
      });
      slotsContainer.querySelectorAll('.btn-swap-slot').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          openInventoryPicker(+btn.dataset.slot);
        };
      });
      slotsContainer.querySelectorAll('.starter-slot-card.occupied').forEach(card => {
        card.onclick = (e) => {
          if (e.target.closest('button')) return;
          openInventoryPicker(+card.dataset.slot);
        };
      });
      slotsContainer.querySelectorAll('.btn-info-slot').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          showCharModal(btn.dataset.id);
        };
      });
      slotsContainer.querySelectorAll('.btn-remove-slot').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const slotIdx = +btn.dataset.slot;
          picked.splice(slotIdx, 1);
          update();
        };
      });
    }

    document.querySelectorAll('.btn-load-preset').forEach(btn => {
      btn.onclick = () => {
        const slot = +btn.dataset.slot;
        const p = meta.teamPresets[slot] || [];
        const valid = p.filter(id => CHARS[id] && isNakamaUnlocked(id));
        if (valid.length) {
          picked = valid.slice(0, maxSlots);
          toast(`📂 Equipo Preset ${slot} cargado (${picked.length} miembro/s)`);
          update();
        } else {
          toast(`⚠️ Preset ${slot} está vacío o no contiene nakamas disponibles.`);
        }
      };
    });

    document.querySelectorAll('.btn-save-preset').forEach(btn => {
      btn.onclick = () => {
        const slot = +btn.dataset.slot;
        const cleanPicked = picked.filter(Boolean);
        if (!cleanPicked.length) {
          toast('⚠️ Selecciona al menos 1 personaje antes de guardar.');
          return;
        }
        meta.teamPresets[slot] = [...cleanPicked];
        saveMeta();
        toast(`💾 Equipo guardado en Preset ${slot}`);
        update();
      };
    });

    const zarparBtn = $('#btn-zarpar');
    if (zarparBtn) {
      const cleanPicked = picked.filter(Boolean);
      zarparBtn.disabled = cleanPicked.length < 1;
      zarparBtn.textContent = `⚔️ ZARPAR CON TU BANDA (${cleanPicked.length}/${maxSlots})`;
      zarparBtn.onclick = () => {
        if (cleanPicked.length >= 1) startRun(sagaIdx, cleanPicked);
      };
    }
  };

  const update = () => {
    const heading = $('#starter-team-heading');
    if (heading) heading.textContent = `🏴‍☠️ Configuración de la Banda (${picked.filter(Boolean).length}/${maxSlots})`;
    const slotsContainer = $('#starter-slots-container');
    if (slotsContainer) slotsContainer.innerHTML = renderSlotsGrid();
    const presetBarCont = document.querySelector('.preset-bar');
    if (presetBarCont) presetBarCont.outerHTML = renderPresetsBar();
    const lpCont = $('#starter-logpose-info');
    if (lpCont) lpCont.innerHTML = `🧭 Log Poses: ${meta.logPoses || 0} ℹ️`;
    bindEvents();
  };
  currentStarterUpdateFn = update;

  update();
}

// Límite de nivel inicial según la máxima saga accesible:
// 5 (East Blue), 8 (Alabasta), 14 (Skypiea), 17 (Water 7), 20 (Thriller Bark), 23...
function maxStartLvlCap() {
  let highestSaga = 0;
  for (let i = 0; i < SAGAS.length; i++) {
    if (sagaUnlocked(i)) highestSaga = i;
  }
  return Math.max(10, SAGAS[highestSaga] ? SAGAS[highestSaga].islands[0].lvl[0] : 10);
}

function logPoseUpgradeCost(currentLvl) {
  const diff = Math.max(0, currentLvl - 5);
  return Math.floor(3 * Math.pow(1.5, diff) + diff * 2 + 3);
}

function startLvlOf(id) {
  const base = baseFormOf(id);
  const purchased = (meta.charUpgrades || {})[base] || 0;
  const rawLvl = 5 + purchased;
  const cap = maxStartLvlCap();
  return Math.min(rawLvl, cap);
}

function upgradeCharLvl(id) {
  const base = baseFormOf(id);
  meta.charUpgrades = meta.charUpgrades || {};
  meta.logPoses = meta.logPoses || 0;
  const curLvl = startLvlOf(id);
  const cap = maxStartLvlCap();
  if (curLvl >= cap) {
    toast(`🔒 ${CHARS[id].name} ya alcanza el nivel máximo permitido para tus sagas (${cap}).`);
    return false;
  }
  const cost = logPoseUpgradeCost(curLvl);
  if (meta.logPoses < cost) {
    toast(`⚠️ Te faltan Log Poses. Requiere ${cost} 🧭 (tienes ${meta.logPoses} 🧭).`);
    return false;
  }
  meta.logPoses -= cost;
  meta.charUpgrades[base] = (meta.charUpgrades[base] || 0) + 1;
  saveMeta();
  toast(`✨ ¡${CHARS[id].name} sube al Nivel ${startLvlOf(id)}! (${cost} 🧭 consumidos)`);
  return true;
}

function startRun(sagaIdx, starterIds) {
  const saga = SAGAS[sagaIdx];
  const items = {
    cartel: 3 + (meta.global.cartelesplus2 ? 4 : meta.global.cartelesplus ? 2 : 0),
  };
  if (meta.global.food_sake3) {
    items.sake = 3;
  } else if (meta.global.food_sake2) {
    items.sake = 2;
  } else if (meta.global.food_sake1) {
    items.sake = 1;
  } else if (meta.global.food_carnereal3) {
    items.carnereal = 3;
  } else if (meta.global.food_carnereal2) {
    items.carnereal = 2;
  } else if (meta.global.food_carnereal1 || meta.global.carnerealplus || meta.global.platosanjiplus) {
    items.carnereal = 1;
  } else if (meta.global.carneplus2 || meta.global.carneplus3) {
    items.carne = 3;
  } else if (meta.global.carneplus) {
    items.carne = 2;
  } else {
    items.carne = 1;
  }
  const berries = 300 + (meta.global.berriesplus3 ? 700 : meta.global.berriesplus2 ? 400 : meta.global.berriesplus ? 200 : 0);

  run = {
    saga: sagaIdx, mode: storyMode, diff: selectedDiff || 1,
    islandIdx: 0,
    team: starterIds.map(id => applyUpgrades(makeChar(id, startLvlOf(id)))),
    items,
    berries,
    badges: [],
    map: genMap(saga.islands[0]),
    pos: null,
    sagaRerollUsed: false,
    nuzCaught: {}, // isla -> ya reclutado
  };
  starterIds.forEach(registerRecruit);
  saveRun();
  screenMap();
}

// ============ PANTALLA: MAPA ============
function screenMap(activePageIdx = 0) {
  playMusic('menu');
  if (run && run.mode === 'nuzlocke' && run.team) {
    run.team = run.team.filter(f => f && f.hp > 0);
  }
  const saga = SAGAS[run.saga];
  const island = saga.islands[run.islandIdx];
  const reach = reachableNodes();
  const rows = run.map.rows;

  let nodesHTML = '', edgesHTML = '', landscapeEdgesHTML = '';
  const posOf = (r, i) => {
    const row = rows[r];
    const x = (i + 1) / (row.length + 1) * 100;
    const y = 100 - (r / Math.max(1, rows.length - 1)) * 100;
    return [x, y];
  };
  for (const e of run.map.edges) {
    const [x1, y1] = posOf(e[0], e[1]);
    const [x2, y2] = posOf(e[2], e[3]);
    edgesHTML += `<line x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%" stroke="#2b2b2b" stroke-width="2" stroke-dasharray="4 5" opacity="0.5"/>`;
    landscapeEdgesHTML += `<line x1="${100-y1}%" y1="${x1}%" x2="${100-y2}%" y2="${x2}%"/>`;
  }
  rows.forEach((row, r) => row.forEach((n, i) => {
    const [x, y] = posOf(r, i);
    const isReach = reach.some(([rr, ii]) => rr === r && ii === i);
    const isCur = run.pos && run.pos[0] === r && run.pos[1] === i;
    nodesHTML += `<button type="button" class="map-node ${n.done ? 'done' : ''} ${isReach ? 'reachable' : ''} ${isCur ? 'current' : ''}"
      style="--map-x:${x}%;--map-y:${y}%;--map-forward:${100-y}%" data-r="${r}" data-i="${i}" title="${NODE_TYPES[n.type].label}" aria-label="${NODE_TYPES[n.type].label}, etapa ${r+1}${isCur ? ", posición actual" : ''}" ${isReach ? '' : 'disabled'}>${NODE_TYPES[n.type].emoji}</button>`;
  }));

  const canReroll = run.islandIdx === 0 && run.pos === null && !run.sagaRerollUsed;

  render(`
    ${topbar(true)}
    <div class="map-wrap">
      <div class="map-carousel" id="island-carousel">
        <!-- PÁGINA 1: MAPA (ANCHO Y ALTO COMPLETO) -->
        <div class="carousel-page" id="page-map">
          <div class="map-board" style="--scene:url('${SAGAS[run.saga]?.img}');--map-rows:${rows.length}">
            <div class="map-heading"><div class="map-title">📍 SAGA: <b>${saga.name}</b> · Isla ${run.islandIdx + 1}/${saga.islands.length}: <b>${island.name}</b> (${run.mode === 'nuzlocke' ? 'NUZLOCKE' : 'CLÁSICO'})</div>
            <div class="map-tools">
              <button class="btn gold small" id="btn-map-reroll" aria-label="Regenerar mapa" title="Regenerar mapa una vez por saga" ${canReroll ? '' : 'disabled'} style="font-size:8.5px;padding:4px 8px;box-shadow:0 2px 5px rgba(0,0,0,0.5);font-weight:bold;">
                ↻ ${canReroll ? 1 : 0}
              </button>
            </div></div>
            <div class="map-route">
              <svg class="map-svg map-portrait" aria-hidden="true">${edgesHTML}</svg>
              <svg class="map-svg map-landscape" aria-hidden="true">${landscapeEdgesHTML}</svg>
              ${nodesHTML}
            </div>
          </div>
        </div>

        <!-- PÁGINA 2: EQUIPO (ANCHO COMPLETO) -->
        <div class="carousel-page" id="page-team">
          <div class="panel">
            <h3>EQUIPO DE NAKAMAS ${run.mode === 'nuzlocke' ? '☠️' : ''}</h3>
            <div class="team-slots-list">
              ${run.team.map((f, idx) => {
                const c = CHARS[f.id] || {};
                const rarityTag = c.rareza ? `<span style="color:var(--gold);font-size:7.5px;margin-left:3px;" title="Rareza ${c.rareza} estrellas">${'⭐'.repeat(c.rareza)}</span>` : '';
                const fusionTag = f.stars ? `<span style="color:#ff6b6b;font-weight:bold;font-size:8px;margin-left:3px;" title="Fusión +${f.stars}">[+${f.stars}⭐]</span>` : '';
                return `
                  <div class="team-slot ${f.hp <= 0 ? 'dead' : ''}" data-idx="${idx}" draggable="true">
                    <span class="drag-handle">≡</span>
                    <span class="emoji">${charIcon(f.id, 36)}</span>
                    <div class="info">${idx + 1}. <b>${charName(f)}</b> ${rarityTag}${fusionTag}<br>Nv${f.lvl}
                      ${typeBadges(fighterTypes(f))}
                      <div class="hp-mini"><i style="width:${f.hp / f.maxhp * 100}%"></i></div>${xpBarHTML(f)}
                    </div>
                    ${run.team.length > 1 ? `<span class="btn-dismiss-slot" data-dismiss-idx="${idx}" title="Expulsar de la banda" style="color:#e74c3c;font-size:11px;cursor:pointer;padding:2px 4px;margin-left:auto;opacity:0.75;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.75">🗑️</span>` : ''}
                  </div>`;
              }).join('')}
            </div>
            <div style="font-size:7.5px;color:#666;margin-top:8px;">¡El orden importa! Combaten de arriba a abajo. Arrastra (o toca ≡ y luego el destino) para reordenar · toca para ver la ficha.</div>
            <h3 style="margin-top:12px;">SINERGIAS DE TRIPULACIÓN <button class="btn small gray" id="btn-syn-info" style="font-size:7px;padding:2px 6px;">ℹ️ VER TODAS</button>
              <button class="btn small gray" id="btn-chart-info" style="font-size:7px;padding:2px 6px;">📊 TIPOS</button></h3>
            <div class="syn-chips">${synChipsHTML(run.team)}</div>
          </div>
        </div>

        <!-- PÁGINA 3: MOCHILA Y EMBLEMAS (ANCHO COMPLETO) -->
        <div class="carousel-page" id="page-bag">
          <div class="panel">
            <h3>🎒 MOCHILA DE OBJETOS</h3>
            ${Object.entries(run.items).filter(([, n]) => n > 0).map(([id, n]) =>
              `<div class="item-row" data-item="${id}"><span>${ITEMS[id].emoji}</span> ${ITEMS[id].name} ×${n}</div>`
            ).join('') || '<div style="font-size:8px;color:#888;">Bolsa vacía</div>'}
            <h3 style="margin-top:14px;">🏅 EMBLEMAS DE LA SAGA</h3>
            <div class="badge-grid">
              ${saga.islands.map((isl, i) =>
                `<div class="badge-slot ${run.badges.includes(i) ? '' : 'empty'}" title="${isl.name}">${run.badges.includes(i) ? '🏅' : '·'}</div>`
              ).join('')}
            </div>
            <h3 style="margin-top:14px;">🤖 MODO AUTOMÁTICO</h3>
            ${autoMode ? `
              <div class="auto-mode-box" style="margin-top:6px;background:rgba(217,83,79,0.15);padding:8px;border-radius:6px;border:1px solid var(--red);text-align:center;">
                <button class="btn red small" id="btn-stop-auto" style="width:100%;font-size:9px;font-weight:bold;padding:6px 8px;">
                  🛑 PARAR MODO AUTO
                </button>
                <button class="btn gray small" id="btn-config-auto" style="width:100%;font-size:7.5px;margin-top:4px;padding:3px 6px;">
                  ⚙️ Opciones del Auto
                </button>
              </div>
            ` : `
              <div class="auto-mode-box" style="margin-top:6px;background:rgba(0,0,0,0.35);padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.15);text-align:center;">
                <button class="btn gold small" id="btn-toggle-auto" style="width:100%;font-size:8.5px;font-weight:bold;padding:5px 8px;">
                  🤖 MODO AUTO
                </button>
                <div style="font-size:7px;color:#aaa;margin-top:4px;">Toca para activar u opciones</div>
              </div>
            `}
            <div style="display:flex;gap:8px;margin-top:14px;">
              <button class="btn red small" id="btn-abandon" style="flex:1;">ABANDONAR</button>
              <button class="btn gray small" id="btn-home" style="flex:1;">MENÚ PRINCIPAL</button>
            </div>
          </div>
        </div>
      </div>

      <!-- BOTONES DE NAVEGACIÓN INFERIORES -->
      <div class="map-nav-tabs">
        <button type="button" class="tab active" id="tab-page-map" data-page="0">📍 MAPA</button>
        <button type="button" class="tab" id="tab-page-team" data-page="1">👥 EQUIPO (${run.team.length})</button>
        <button type="button" class="tab" id="tab-page-bag" data-page="2">🎒 MOCHILA</button>
      </div>
    </div>
  `);

  // --- Lógica del carrusel y pestañas superiores ---
  const carousel = $('#island-carousel');
  const tabs = document.querySelectorAll('.map-nav-tabs .tab');

  tabs.forEach(tab => {
    tab.onclick = () => {
      const pageIdx = parseInt(tab.dataset.page, 10);
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (carousel) {
        const pageWidth = carousel.clientWidth;
        carousel.scrollTo({ left: pageIdx * pageWidth, behavior: 'smooth' });
      }
    };
  });

  if (carousel) {
    let scrollTimeout = null;
    carousel.onscroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const pageWidth = carousel.clientWidth;
        if (!pageWidth) return;
        const pageIdx = Math.round(carousel.scrollLeft / pageWidth);
        tabs.forEach((t, i) => {
          if (i === pageIdx) t.classList.add('active');
          else t.classList.remove('active');
        });
      }, 50);
    };

    if (activePageIdx > 0) {
      carousel.style.scrollBehavior = 'auto';
      const applyPage = () => {
        const pageWidth = carousel.clientWidth;
        if (pageWidth > 0) {
          carousel.scrollLeft = activePageIdx * pageWidth;
          tabs.forEach((t, i) => {
            if (i === activePageIdx) t.classList.add('active');
            else t.classList.remove('active');
          });
        }
      };
      applyPage();
      requestAnimationFrame(() => {
        applyPage();
        setTimeout(() => {
          if (carousel) carousel.style.scrollBehavior = 'smooth';
        }, 50);
      });
    }
  }

  const mapRerollBtn = $('#btn-map-reroll');
  if (mapRerollBtn && canReroll) {
    mapRerollBtn.onclick = () => {
      run.sagaRerollUsed = true;
      run.map = genMap(island);
      run.pos = null;
      saveRun();
      toast('🎲 ¡Mapa de la saga regenerado!');
      screenMap();
    };
  }

  document.querySelectorAll('.map-node.reachable').forEach(el => {
    el.onclick = () => {
      const r = +el.dataset.r;
      const i = +el.dataset.i;
      const showConfirm = meta.settings ? meta.settings.showEventConfirm !== false : true;
      if (showConfirm) {
        showNodeConfirmModal(r, i);
      } else {
        enterNode(r, i);
      }
    };
  });

  let pickedIdx = null;

  const renderTeamSlotItemHTML = (f, idx) => {
    const c = CHARS[f.id] || {};
    const rarityTag = c.rareza ? `<span style="color:var(--gold);font-size:7.5px;margin-left:3px;" title="Rareza ${c.rareza} estrellas">${'⭐'.repeat(c.rareza)}</span>` : '';
    const fusionTag = f.stars ? `<span style="color:#ff6b6b;font-weight:bold;font-size:8px;margin-left:3px;" title="Fusión +${f.stars}">[+${f.stars}⭐]</span>` : '';
    return `
      <div class="team-slot ${f.hp <= 0 ? 'dead' : ''}" data-idx="${idx}" draggable="true">
        <span class="drag-handle">≡</span>
        <span class="emoji">${charIcon(f.id, 36)}</span>
        <div class="info">${idx + 1}. <b>${charName(f)}</b> ${rarityTag}${fusionTag}<br>Nv${f.lvl}
          ${typeBadges(fighterTypes(f))}
          <div class="hp-mini"><i style="width:${f.hp / f.maxhp * 100}%"></i></div>${xpBarHTML(f)}
        </div>
        ${run.team.length > 1 ? `<span class="btn-dismiss-slot" data-dismiss-idx="${idx}" title="Expulsar de la banda" style="color:#e74c3c;font-size:11px;cursor:pointer;padding:2px 4px;margin-left:auto;opacity:0.75;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.75">🗑️</span>` : ''}
      </div>`;
  };

  const bindTeamSlots = () => {
    pickedIdx = null;
    makeListReorderable('.team-slots-list', '.team-slot', (from, to) => {
      moveSlot(from, to);
    });

    document.querySelectorAll('.team-slot').forEach(el => {
      const idx = +el.dataset.idx;
      const dismissBtn = el.querySelector('[data-dismiss-idx]');
      if (dismissBtn) {
        dismissBtn.onclick = e => {
          e.stopPropagation();
          if (!run || !run.team) return;
          if (run.team.length <= 1) {
            toast('⚠️ Debes mantener al menos 1 nakama en tu banda.');
            return;
          }
          const f = run.team[idx];
          if (!f) return;
          const cName = charName(f);
          modalConfirm('🗑️ Expulsar de la banda',
            `¿Estás seguro de que quieres expulsar a <b>${cName}</b> de tu tripulación?<br><small style="color:#aaa;">Esta acción no se puede deshacer en esta partida.</small>`,
            () => {
              run.team.splice(idx, 1);
              updateTeamInPlace();
              toast(`👋 ${cName} ha abandonado la banda.`);
            }
          );
        };
      }
      const handle = el.querySelector('.drag-handle');
      if (handle) handle.onclick = e => {
        e.stopPropagation();
        if (pickedIdx === null) {
          pickedIdx = idx;
          el.classList.add('dragging');
        } else if (pickedIdx === idx) {
          pickedIdx = null;
          el.classList.remove('dragging');
        } else {
          moveSlot(pickedIdx, idx);
        }
      };
      el.onclick = (e) => {
        if (e.target.closest('.drag-handle') || e.target.closest('[data-dismiss-idx]')) return;
        if (pickedIdx !== null) {
          if (pickedIdx !== idx) moveSlot(pickedIdx, idx);
          else {
            pickedIdx = null;
            el.classList.remove('dragging');
          }
          return;
        }
        showCharModal(run.team[idx]);
      };
    });
  };

  const updateTeamInPlace = () => {
    saveRun();
    const listEl = document.querySelector('.team-slots-list');
    if (listEl) {
      listEl.innerHTML = run.team.map(renderTeamSlotItemHTML).join('');
      bindTeamSlots();
    }
    const synEl = document.querySelector('#page-team .syn-chips');
    if (synEl) synEl.innerHTML = synChipsHTML(run.team);
    const tabTeamEl = document.querySelector('#tab-page-team');
    if (tabTeamEl) tabTeamEl.textContent = `👥 EQUIPO (${run.team.length})`;
  };

  const moveSlot = (from, to) => {
    const [f] = run.team.splice(from, 1);
    run.team.splice(to, 0, f);
    updateTeamInPlace();
  };

  bindTeamSlots();
  document.querySelectorAll('.item-row').forEach(el => {
    el.onclick = () => useItemFromMap(el.dataset.item);
  });
  $('#btn-home').onclick = screenHome;
  $('#btn-abandon').onclick = () => {
    modalConfirm('🏳️ ¿Abandonar el viaje?',
      'Se perderá todo el progreso de esta aventura.<br>La Fama, los veteranos y la Dex se conservan.',
      () => { clearRun(); screenHome(); });
  };
  $('#btn-syn-info').onclick = () => showSynergyModal(run.team);
  $('#btn-chart-info').onclick = () => showTypeChartModal(run.team);

  const stopAutoBtn = $('#btn-stop-auto');
  if (stopAutoBtn) stopAutoBtn.onclick = stopAutoMode;
  const configAutoBtn = $('#btn-config-auto');
  if (configAutoBtn) configAutoBtn.onclick = showAutoSettingsModal;
  const toggleAutoBtn = $('#btn-toggle-auto');
  if (toggleAutoBtn) toggleAutoBtn.onclick = showAutoSettingsModal;

  if (autoMode && run) {
    runAutoItems();
    if (reach.length > 0) {
      const target = pickAutoNode(reach);
      if (target) {
        const [r, i] = target;
        scheduleAutoStep(() => {
          if (autoMode && run) enterNode(r, i);
        }, 750);
      }
    }
  }
}

function showItemTargetModal(item, title, renderRow, onSelect) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
    <div class="modal">
      <h2>${item.emoji} ${title}</h2>
      <p style="font-size:9px;text-align:center;margin-bottom:10px;color:#aaa;">
        ${item.desc}<br>Selecciona a qué nakama de tu equipo dárselo:
      </p>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto;margin-bottom:12px;">
        ${run.team.map((f, idx) => renderRow(f, idx)).join('')}
      </div>
      <div class="actions">
        <button class="btn gray" id="btn-cancel-item-target">CANCELAR</button>
      </div>
    </div>
  `;
  document.body.appendChild(ov);
  const cancelBtn = ov.querySelector('#btn-cancel-item-target');
  if (cancelBtn) cancelBtn.onclick = () => ov.remove();
  ov.querySelectorAll('.item-target-row.clickable').forEach(el => {
    el.onclick = () => {
      const idx = parseInt(el.dataset.idx, 10);
      const target = run.team[idx];
      ov.remove();
      onSelect(target);
    };
  });
}

function useItemFromMap(id) {
  const item = ITEMS[id];
  if (!item) return;

  if (item.kind === 'ball') {
    return toast(`📜 ${item.name}: Se usa automáticamente al intentar reclutar piratas.`);
  }

  if (item.kind === 'fruta') {
    const activeTeam = run.team.filter(x => x.hp > 0);
    if (!activeTeam.length) return toast('No tienes nakamas conscientes para consumir la fruta.');
    const maxSelect = Math.min(2, activeTeam.length);
    let selectedIndices = [];

    const ov = document.createElement('div');
    ov.className = 'overlay';

    const renderFruitModal = () => {
      ov.innerHTML = `<div class="modal">
        <h2>🍈 ¡Poder de la Fruta del Diablo!</h2>
        <p style="font-size:9px;text-align:center;margin-bottom:10px;">
          Selecciona a los <b>${maxSelect}</b> nakamas que consumirán la Fruta del Diablo para despertar un nuevo Tag elemental.
        </p>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;margin-bottom:12px;">
          ${activeTeam.map((f, idx) => {
        const isSel = selectedIndices.includes(idx);
        const fTypes = fighterTypes(f);
        return `<div class="shop-item fruit-select-item" data-idx="${idx}" style="cursor:pointer;background:${isSel ? 'rgba(255,215,0,0.18)' : 'rgba(0,0,0,0.2)'};border:${isSel ? '2px solid var(--gold)' : '1px solid #555'};border-radius:6px;padding:6px 10px;">
              <span class="emoji">${charIcon(f.id, 24)}</span>
              <div class="info">
                <b>${charName(f)}</b> <small>(Nv.${f.lvl})</small><br>
                ${typeBadges(fTypes)}
    ${isLive ? xpBarHTML(f) : ''}
              </div>
              <div style="font-size:16px;">${isSel ? '✅' : '⚪'}</div>
            </div>`;
      }).join('')}
        </div>
        <div style="text-align:center;font-size:9px;color:var(--gold);margin-bottom:10px;">
          Seleccionados: ${selectedIndices.length} / ${maxSelect}
        </div>
        <div class="actions">
          <button class="btn green" id="btn-confirm-fruit" ${selectedIndices.length === maxSelect ? '' : 'disabled'}>
            ✨ OTORGAR PODER (${selectedIndices.length}/${maxSelect})
          </button>
          <button class="btn gray" id="btn-cancel-fruit">CANCELAR</button>
        </div>
      </div>`;

      ov.querySelectorAll('.fruit-select-item').forEach(el => {
        el.onclick = () => {
          const idx = parseInt(el.dataset.idx, 10);
          if (selectedIndices.includes(idx)) {
            selectedIndices = selectedIndices.filter(i => i !== idx);
          } else {
            if (selectedIndices.length < maxSelect) {
              selectedIndices.push(idx);
            } else if (maxSelect === 1) {
              selectedIndices = [idx];
            }
          }
          renderFruitModal();
        };
      });

      const confirmBtn = ov.querySelector('#btn-confirm-fruit');
      if (confirmBtn) {
        confirmBtn.onclick = () => {
          if (selectedIndices.length !== maxSelect) return;
          ov.remove();
          const chosen = selectedIndices.map(i => activeTeam[i]);
          const allPossibleTypes = Object.keys(TYPES);
          const grantedLog = [];
          chosen.forEach(f => {
            f.extraTypes = f.extraTypes || [];
            const current = fighterTypes(f);
            const available = allPossibleTypes.filter(t => !current.includes(t));
            if (available.length > 0) {
              const newTag = pick(available);
              f.extraTypes.push(newTag);
              grantedLog.push(`<b>${charName(f)}</b> despierta el tag ${TYPES[newTag].emoji} <b>${newTag}</b>`);
            }
          });
          run.items[id]--;
          trackItemCollected(1);
          trackStat('fruit_use', 1);
          saveRun();
          if (grantedLog.length) {
            screenMap(2);
          }
        };
      }

      const cancelBtn = ov.querySelector('#btn-cancel-fruit');
      if (cancelBtn) {
        cancelBtn.onclick = () => { ov.remove(); };
      }
    };

    document.body.appendChild(ov);
    renderFruitModal();
    return;
  }

  if (item.kind === 'heal') {
    const hasDamaged = run.team.some(f => f.hp > 0 && f.hp < f.maxhp);
    if (!hasDamaged) {
      return toast('Ningún nakama consciente necesita curación.');
    }
    showItemTargetModal(item, `Usar ${item.name}`, (f, idx) => {
      const isDead = f.hp <= 0;
      const isFull = f.hp >= f.maxhp;
      const canUse = !isDead && !isFull;
      return `
        <div class="shop-item item-target-row ${canUse ? 'clickable' : ''}" data-idx="${idx}"
          style="cursor:${canUse ? 'pointer' : 'not-allowed'};opacity:${canUse ? 1 : 0.55};background:rgba(0,0,0,0.2);border:1px solid #555;border-radius:6px;padding:6px 10px;display:flex;align-items:center;gap:10px;">
          <span class="emoji">${charIcon(f.id, 28)}</span>
          <div class="info" style="flex:1;">
            <b>${charName(f)}</b> <small>(Nv.${f.lvl})</small><br>
            <small>${isDead ? '☠️ Derrotado (Usa Sake)' : isFull ? '💚 PS al máximo' : `PS: ${f.hp}/${f.maxhp}`}</small>
            <div class="hp-mini" style="margin-top:3px;"><i style="width:${Math.max(0, f.hp / f.maxhp * 100)}%"></i></div>
          </div>
          <div style="font-size:16px;">${canUse ? '👉' : '🔒'}</div>
        </div>
      `;
    }, (target) => {
      const val = item.val === 9999 ? target.maxhp : item.val;
      const restored = Math.min(target.maxhp - target.hp, val);
      target.hp = Math.min(target.maxhp, target.hp + val);
      run.items[id]--;
      trackItemCollected(1);
      trackStat('item_use', 1);
      saveRun();
      toast(`💚 ¡${charName(target)} recupera ${restored} PS!`);
      screenMap(2);
    });
    return;
  }

  if (item.kind === 'revive') {
    const hasDead = run.team.some(f => f.hp <= 0);
    if (!hasDead) {
      return toast('No hay nakamas derrotados para revivir.');
    }
    showItemTargetModal(item, `Usar ${item.name}`, (f, idx) => {
      const isDead = f.hp <= 0;
      return `
        <div class="shop-item item-target-row ${isDead ? 'clickable' : ''}" data-idx="${idx}"
          style="cursor:${isDead ? 'pointer' : 'not-allowed'};opacity:${isDead ? 1 : 0.55};background:rgba(0,0,0,0.2);border:1px solid #555;border-radius:6px;padding:6px 10px;display:flex;align-items:center;gap:10px;">
          <span class="emoji">${charIcon(f.id, 28)}</span>
          <div class="info" style="flex:1;">
            <b>${charName(f)}</b> <small>(Nv.${f.lvl})</small><br>
            <small>${isDead ? '☠️ Derrotado (Toca para revivir)' : '💚 Consciente'}</small>
          </div>
          <div style="font-size:16px;">${isDead ? '✨' : '🔒'}</div>
        </div>
      `;
    }, (target) => {
      target.hp = Math.floor(target.maxhp * (item.val || 0.5));
      run.items[id]--;
      trackItemCollected(1);
      trackStat('item_use', 1);
      saveRun();
      toast(`✨ ¡${charName(target)} ha sido revivido con ${target.hp} PS!`);
      screenMap(2);
    });
    return;
  }

  if (item.kind === 'boost') {
    const isAtk = id === 'proteina';
    showItemTargetModal(item, `Usar ${item.name}`, (f, idx) => {
      return `
        <div class="shop-item item-target-row clickable" data-idx="${idx}"
          style="cursor:pointer;background:rgba(0,0,0,0.2);border:1px solid #555;border-radius:6px;padding:6px 10px;display:flex;align-items:center;gap:10px;">
          <span class="emoji">${charIcon(f.id, 28)}</span>
          <div class="info" style="flex:1;">
            <b>${charName(f)}</b> <small>(Nv.${f.lvl})</small><br>
            <small>${isAtk ? `ATQ actual: ${f.atk} (+2 ATQ)` : `DEF actual: ${f.def} (+2 DEF)`}</small>
          </div>
          <div style="font-size:16px;">⚡</div>
        </div>
      `;
    }, (target) => {
      if (isAtk) {
        target.atkBonus = (target.atkBonus || 0) + 2;
        target.atk += 2;
      } else {
        target.defBonus = (target.defBonus || 0) + 2;
        target.def += 2;
      }
      run.items[id]--;
      trackItemCollected(1);
      trackStat('item_use', 1);
      saveRun();
      toast(`⚡ ¡${charName(target)} ha ganado +2 ${isAtk ? 'ATQ' : 'DEF'} permanentemente!`);
      screenMap(2);
    });
    return;
  }

  toast('No se puede usar este objeto ahora.');
}

function pickWildEnemy(pool) {
  if (!pool || !pool.length) return null;
  const leg5 = pool.filter(id => CHARS[id] && CHARS[id].rareza === 5);
  const others = pool.filter(id => !CHARS[id] || CHARS[id].rareza !== 5);
  if (leg5.length > 0 && others.length > 0) {
    if (Math.random() < 0.005) {
      return pick(leg5);
    }
    return pick(others);
  }
  return pick(pool);
}

// ============ ENTRAR EN NODO ============
function enterNode(r, i) {
  const node = run.map.rows[r][i];
  run.pos = [r, i];
  node.done = true;
  saveRun();
  const saga = SAGAS[run.saga];
  const island = saga.islands[run.islandIdx];

  switch (node.type) {
    case 'wild': {
      const id = pickWildEnemy(island.pool);
      let lvl = rnd(island.lvl[0], island.lvl[1]);
      if (CHARS[id] && CHARS[id].rareza === 5) lvl += 6;
      wildEncounter(makeChar(id, lvl, true));
      break;
    }
    case 'marine': {
      const n = Math.random() < 0.45 ? 3 : 2;
      const enemies = [];
      for (let k = 0; k < n; k++) {
        const id = pickWildEnemy(island.pool);
        let lvl = rnd(island.lvl[0], island.lvl[1] + 1);
        if (CHARS[id] && CHARS[id].rareza === 5) lvl += 6;
        enemies.push(makeChar(id, lvl, true));
      }
      startBattle(enemies, { wild: false, reward: rnd(120, 260) * (run.islandIdx + 1) });
      break;
    }
    case 'boss': {
      const enemies = island.boss.map((id, k) => makeChar(id, island.bossLvl[k]));
      startBattle(enemies, { wild: false, boss: true, reward: 400 * (run.islandIdx + 1) });
      break;
    }
    case 'item': {
      let id;
      if (Math.random() < 0.01) {
        id = 'fruta_diablo';
      } else {
        const commonLoot = ['carne', 'carne', 'carnereal', 'cartel', 'cartel', 'carteldorado', 'sake', 'bocadillo'];
        id = pick(commonLoot);
      }
      run.items[id] = (run.items[id] || 0) + 1;
      trackItemCollected(1);
      saveRun();
      modalInfo('🎁 ¡Objeto encontrado!', `<div class="reward-list">${ITEMS[id].emoji} <b>${ITEMS[id].name}</b><br><small>${ITEMS[id].desc}</small></div>`, screenMap);
      break;
    }
    case 'mystery': trackStat('mystery_visit', 1); doMystery(island); break;
    case 'special': trackStat('special_visit', 1); doSpecialPirate(island); break;
    case 'crossover': doCrossoverEvent(island); break;
    case 'shop': screenShop(); break;
    case 'rest': {
      trackStat('rest_visit', 1);
      run.team.forEach(f => { if (f.hp > 0) f.hp = Math.min(f.maxhp, f.hp + Math.floor(f.maxhp * 0.5)); });
      saveRun();
      modalInfo('⛺ Campamento', `<div class="reward-list">Tu banda descansa junto al fuego.<br>Los nakamas conscientes recuperan el 50% de sus PS. 🔥</div>`, screenMap);
      break;
    }
  }
}

function doMystery(island) {
  let ev;
  if (Math.random() < 0.02) {
    ev = MYSTERY_EVENTS.find(e => e.kind === 'fruta') || MYSTERY_EVENTS[7];
  } else {
    const commonEvents = MYSTERY_EVENTS.filter(e => e.kind !== 'fruta');
    ev = pick(commonEvents);
  }
  switch (ev.kind) {
    case 'berries': {
      const n = rnd(ev.min, ev.max) * (run.islandIdx + 1);
      run.berries += n; saveRun();
      modalInfo('❓ Misterio', `<div class="reward-list">${ev.text.replace('{n}', n)}</div>`, screenMap);
      break;
    }
    case 'item': {
      const id = pick(['carne', 'cartel', 'carnereal', 'carteldorado']);
      run.items[id] = (run.items[id] || 0) + 1; saveRun();
      modalInfo('❓ Misterio', `<div class="reward-list">${ev.text}<br><br>${ITEMS[id].emoji} <b>${ITEMS[id].name}</b></div>`, screenMap);
      break;
    }
    case 'battle': {
      modalInfo('❓ ¡Emboscada!', `<div class="reward-list">${ev.text}</div>`, () => {
        const id = pickWildEnemy(island.pool);
        let lvl = rnd(island.lvl[0] + 1, island.lvl[1] + 2);
        if (CHARS[id] && CHARS[id].rareza === 5) lvl += 6;
        startBattle([makeChar(id, lvl, true)], { wild: true });
      });
      break;
    }
    case 'healall': {
      trackStat('mystery_heal', 1);
      run.team.forEach(f => { if (f.hp > 0) f.hp = f.maxhp; });
      saveRun();
      modalInfo('❓ Misterio', `<div class="reward-list">${ev.text} ♨️</div>`, screenMap);
      break;
    }
    case 'boost': {
      trackStat('mystery_train', 1);
      const f = run.team[0];
      f.atkBonus += 2; f.atk += 2; saveRun();
      modalInfo('❓ Misterio', `<div class="reward-list">${ev.text}<br>(${charName(f)})</div>`, screenMap);
      break;
    }
    case 'damage': {
      const f = run.team[0];
      f.hp = Math.max(1, f.hp - ev.val); saveRun();
      modalInfo('❓ Misterio', `<div class="reward-list">${ev.text}<br>(${charName(f)})</div>`, screenMap);
      break;
    }
    case 'recruit': {
      if (run.mode === 'nuzlocke' && run.nuzCaught[run.islandIdx]) {
        run.berries += 200; saveRun();
        modalInfo('❓ Misterio', `<div class="reward-list">Un pirata quería unirse, pero la regla Nuzlocke lo impide.<br>Te deja 200 Berries de regalo.</div>`, screenMap);
      } else {
        const id = pickWildEnemy(island.pool);
        const recLvl = Math.max(1, Math.floor(island.lvl[0] * 0.85));
        const f = applyUpgrades(makeChar(id, recLvl));
        addToTeam(f, ok => {
          if (ok) {
            if (run.mode === 'nuzlocke') run.nuzCaught[run.islandIdx] = true;
            registerRecruit(id); saveRun();
            modalInfo('❓ ¡Nuevo nakama!', `<div class="reward-list">${ev.text}<br><br><span style="font-size:30px">${charIcon(id, 40)}</span><br><b>${CHARS[id].name}</b> Nv${f.lvl}</div>`, screenMap);
          } else {
            run.berries += 100; saveRun();
            modalInfo('❓ Misterio', `<div class="reward-list">Dejas marchar al pirata. Te regala 100 Berries por la molestia.</div>`, screenMap);
          }
        });
      }
      break;
    }
    case 'fruta': {
      run.items['fruta_diablo'] = (run.items['fruta_diablo'] || 0) + 1;
      trackItemCollected(1);
      saveRun();
      modalInfo('❓ Misterio', `<div class="reward-list">${ev.text}<br><br>${ITEMS['fruta_diablo'].emoji} <b>${ITEMS['fruta_diablo'].name}</b> añadida a tu bolsa.</div>`, screenMap);
      break;
    }
  }
}

// ============ ENCUENTRO SALVAJE ============
function wildRecruitPrice(c) { return c.rareza * 150 * (run.islandIdx + 1); }

function cartelesBadgeHTML() {
  if (!run || !run.items) return '';
  const c1 = run.items.cartel || 0;
  const c2 = run.items.carteldorado || 0;
  const c3 = run.items.cartelbuster || 0;
  return `<div style="font-size:10.5px;background:rgba(255,215,0,0.16);padding:6px 10px;border-radius:6px;border:1px solid var(--gold);margin:8px 0;color:#222;text-align:center;"><b>📜 Carteles en tu bolsa:</b> 📜 ×${c1} Recluta ${c2 ? `· 🏅 ×${c2} Dorado` : ''} ${c3 ? `· 📯 ×${c3} Buster` : ''}</div>`;
}

function wildEncounter(wild) {
  const c = charData(wild);
  const isLegendary = c.rareza === 5;
  const price = wildRecruitPrice(c);
  const nuzBlock = run.mode === 'nuzlocke' && run.nuzCaught[run.islandIdx];
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>🏴‍☠️ ¡Pirata salvaje!</h2>
    <div class="special-card">
      <div class="big-emoji">${charIcon(wild.id, 56)}</div>
      <div class="char-name">${c.name} <small>Nv${wild.lvl}</small></div>
      <div class="special-stars">${'⭐'.repeat(c.rareza)}</div>
      ${typeBadges(c.types)}
    </div>
    ${cartelesBadgeHTML()}
    ${isLegendary ? '<div class="special-fail" style="color:var(--gold);border-color:var(--gold);background:#fffbe8;">👑 ¡PIRATA LEGENDARIO (5⭐)!<br>Inmune al reclutamiento salvaje. ¡Únicamente puedes combatirlo!</div>' : nuzBlock ? '<div class="special-fail">Regla Nuzlocke: ya reclutaste en esta isla (solo puedes combatir).</div>' : ''}
    <div class="actions" style="flex-direction:column;align-items:stretch;">
      <button class="btn red" id="we-fight">⚔️ COMBATIR — gana XP para la banda</button>
      ${!isLegendary ? `
        <button class="btn green" id="we-pay" ${nuzBlock || run.berries < price ? 'disabled' : ''}>💋 SEDUCIR — ${berriesHTML(price)}</button>
        <button class="btn gold" id="we-chains" ${nuzBlock ? 'disabled' : ''}>⛓️ TENTAR A LA SUERTE — las 3 cadenas</button>
      ` : ''}
    </div>
  </div>`;
  document.body.appendChild(ov);
  if (autoMode) {
    scheduleAutoStep(() => {
      if (!document.body.contains(ov)) return;
      if (!isLegendary && autoSettings.wildAction === 'recruit') {
        const payBtn = ov.querySelector('#we-pay');
        if (payBtn && !payBtn.disabled) { payBtn.click(); return; }
      } else if (!isLegendary && autoSettings.wildAction === 'chains') {
        const chainBtn = ov.querySelector('#we-chains');
        if (chainBtn && !chainBtn.disabled) { chainBtn.click(); return; }
      }
      const fightBtn = ov.querySelector('#we-fight');
      if (fightBtn) fightBtn.click();
    }, 700);
  }
  const recruit = () => {
    if (isLegendary) return;
    const recLvl = Math.max(1, Math.floor(wild.lvl * 0.85));
    const f = applyUpgrades(makeChar(wild.id, recLvl));
    addToTeam(f, ok => {
      if (ok) {
        if (run.mode === 'nuzlocke') run.nuzCaught[run.islandIdx] = true;
        registerRecruit(f.id);
        saveRun();
        modalInfo('🎉 ¡Nuevo nakama!', `<div class="reward-list"><span style="font-size:34px;">${charIcon(f.id, 44)}</span><br><b>${c.name}</b> Nv${f.lvl} se une a tu banda.</div>`, screenMap);
      } else {
        modalInfo('🌊 Se marcha', '<div class="reward-list">Dejas marchar al pirata con un saludo.</div>', screenMap);
      }
    });
  };
  ov.querySelector('#we-fight').onclick = () => { ov.remove(); startBattle([wild], { wild: true }); };
  const payBtn = ov.querySelector('#we-pay');
  if (payBtn && !nuzBlock && run.berries >= price) payBtn.onclick = () => {
    run.berries -= price;
    saveRun();
    ov.remove();
    recruit();
  };
  const chainsBtn = ov.querySelector('#we-chains');
  if (chainsBtn && !nuzBlock) chainsBtn.onclick = () => { ov.remove(); renderChains(wild, recruit); };
}

// Las 3 cadenas: 50% de romperse cada una. Cada cadena puede romperse gastando
// un cartel o arriesgándote a tocarla. Los carteles rompen cadenas seguro:
// Cartel de Recluta = 1 cadena, Dorado = 2, Buster Call = las 3.
// Si las 3 cadenas se rompen, reclutas al pirata directamente.
function renderChains(wild, onRecruit) {
  const c = charData(wild);
  let current = 0;
  const ov = document.createElement('div');
  ov.className = 'overlay';
  const ballBtns = () => ['cartel', 'carteldorado', 'cartelbuster']
    .filter(b => (run.items[b] || 0) > 0)
    .map(b => `<button class="btn small gold" data-chainball="${b}">${ITEMS[b].emoji} ${ITEMS[b].name} ×${run.items[b]}</button>`)
    .join('');
  ov.innerHTML = `<div class="modal">
    <h2>⛓️ Las 3 cadenas de ${c.name}</h2>
    <p style="font-size:8px;text-align:center;margin-bottom:10px;">Golpea las cadenas en orden: cada una tiene un 50% de romperse.<br>
    ¡Si rompes las tres, el pirata se une a tu banda!<br>
    Si una aguanta, podrás pagar <b>3 Carteles de Recluta</b>... o pelear contra él enfurecido.<br>
    Tus carteles rompen cadenas garantizado (📜 una, 🏅 dos, 📯 las tres).</p>
    <div class="poster-row">
      ${[0, 1, 2].map(i => `
        <div class="poster chain" data-c="${i}">
          <div class="poster-face" id="cf-${i}">⛓️<br><span>CADENA ${i + 1}</span></div>
        </div>`).join('')}
    </div>
    <div class="actions" id="chain-balls" style="flex-wrap:wrap;">${ballBtns()}</div>
  </div>`;
  document.body.appendChild(ov);

  const breakChain = i => {
    const face = ov.querySelector(`#cf-${i}`);
    const el = ov.querySelector(`[data-c="${i}"]`);
    face.innerHTML = '💥<br><span>¡ROTA!</span>';
    el.classList.add('hit');
    el.classList.remove('next');
  };
  const win = () => {
    ov.querySelectorAll('.poster').forEach(p => { p.onclick = null; });
    setTimeout(() => { ov.remove(); onRecruit(); }, 1000);
  };
  const fail = i => {
    const face = ov.querySelector(`#cf-${i}`);
    ov.querySelector(`[data-c="${i}"]`).classList.add('empty');
    face.innerHTML = '⛓️<br><span>AGUANTA</span>';
    ov.querySelectorAll('.poster').forEach(p => { p.onclick = null; });
    setTimeout(() => {
      ov.remove();
      chainsFail(wild, onRecruit);
    }, 1000);
  };
  const advance = n => { // rompe n cadenas garantizadas
    while (n > 0 && current < 3) { breakChain(current); current++; n--; }
    if (current >= 3) win(); else update();
  };
  const hit = i => {
    if (Math.random() < 0.5) {
      breakChain(i);
      current++;
      if (current >= 3) win(); else update();
    } else {
      fail(i);
    }
  };
  const update = () => {
    ov.querySelectorAll('.poster').forEach((el, i) => {
      el.classList.toggle('next', i === current);
      el.onclick = i === current ? () => hit(i) : null;
    });
    const ballsEl = ov.querySelector('#chain-balls');
    ballsEl.innerHTML = ballBtns();
    ballsEl.querySelectorAll('[data-chainball]').forEach(btn => {
      btn.onclick = () => {
        const b = btn.dataset.chainball;
        if (!(run.items[b] > 0)) return;
        run.items[b]--;
        saveRun();
        advance(b === 'cartel' ? 1 : b === 'carteldorado' ? 2 : 3);
      };
    });
  };
  update();
}

// Una cadena ha resistido: puedes pagar 3 Carteles de Recluta para que el
// pirata se una igualmente, o luchar contra él potenciado (+30% a sus stats)
// a cambio de más XP (+50%).
function chainsFail(wild, onRecruit) {
  const c = charData(wild);
  const have = run.items.cartel || 0;
  const can = have >= 3;
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>⛓️ ¡La cadena aguanta!</h2>
    <div class="special-card">
      <div class="big-emoji">${charIcon(wild.id, 56)}</div>
      <div class="char-name">${c.name} <small>Nv${wild.lvl}</small></div>
    </div>
    <p style="font-size:9px;text-align:center;line-height:1.9;margin-bottom:10px;">
      "¿Creíais que sería tan fácil?"<br><br>
      Entrégale <b>3 Carteles de Recluta</b> 📜 y se unirá de todas formas...<br>
      o lucha contra él <b>enfurecido</b> (+30% a sus stats) a cambio de <b>+50% de XP</b>.<br><br>
      Tienes 📜 ×${have}.</p>
    ${can ? '' : '<div class="special-fail">No tienes suficientes Carteles de Recluta...</div>'}
    <div class="actions" style="flex-direction:column;align-items:stretch;">
      <button class="btn green" id="cd-pay" ${can ? '' : 'disabled'}>📜 PAGAR 3 CARTELES — se une</button>
      <button class="btn red" id="cd-fight">⚔️ LUCHAR — enemigo potenciado, +50% XP</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  if (can) ov.querySelector('#cd-pay').onclick = () => {
    run.items.cartel -= 3;
    saveRun();
    ov.remove();
    onRecruit();
  };
  ov.querySelector('#cd-fight').onclick = () => {
    ov.remove();
    ['atk', 'def', 'spatk', 'spdef'].forEach(k => { wild[k] = Math.floor(wild[k] * 1.3); });
    modalInfo('⚔️ ¡Furia desatada!', `<div class="reward-list">${c.emoji} ¡${c.name} rompe sus cadenas y se abalanza sobre vosotros con más fuerza que nunca!</div>`,
      () => startBattle([wild], { wild: true, xpMult: 1.5 }));
  };
}

// ============ RECLUTAR Y FUSIÓN DE PERSONAJES ============
// Si el personaje ya está en la banda, se fusionan: gana 1 estrella y +5% de stats.
function addToTeam(f, done) {
  const existing = run.team.find(m => baseFormOf(m.id) === baseFormOf(f.id));
  if (existing) {
    existing.stars = (existing.stars || 0) + 1;
    const oldLvl = existing.lvl;
    const newLvl = Math.max(existing.lvl, f.lvl);
    if (newLvl > oldLvl) {
      existing.lvl = newLvl;
      existing.xp = f.xp || 0;
      const c = CHARS[existing.id];
      if (c) {
        existing.maxhp = hpAt(c.base[0], existing.lvl);
        existing.atk = statAt(c.base[1], existing.lvl);
        existing.def = statAt(c.base[2], existing.lvl);
        existing.spatk = statAt(c.base[3], existing.lvl);
        existing.spdef = statAt(c.base[4], existing.lvl);
        existing.spd = statAt(c.base[5], existing.lvl);
        const updatedMoves = c.learnset.filter(([l]) => l <= existing.lvl).map(([, m]) => m).slice(-2);
        if (updatedMoves.length) existing.moves = updatedMoves;
        if (c.evo && existing.lvl >= c.evo.lvl) {
          existing.id = c.evo.to;
        }
        applyUpgrades(existing);
      }
    }
    const boostHP = Math.max(1, Math.floor(existing.maxhp * 0.05));
    existing.maxhp += boostHP;
    existing.hp = existing.maxhp; // Restaura la vida por completo al fusionarse
    existing.atk = Math.floor(existing.atk * 1.05);
    existing.def = Math.floor(existing.def * 1.05);
    existing.spatk = Math.floor(existing.spatk * 1.05);
    existing.spdef = Math.floor(existing.spdef * 1.05);
    existing.spd = Math.floor(existing.spd * 1.05);

    saveRun();
    toast(`⭐ ¡FUSIÓN Y CURACIÓN! ${charData(existing).emoji} ${charName(existing)} alcanza ⭐${existing.stars} estrella(s) (Nv${existing.lvl}) y recupera todos sus PS.`);
    done && done(true);
    return;
  }
  if (run.team.length < 6) {
    run.team.push(f);
    saveRun();
    done && done(true);
    return;
  }
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>👥 ¡Banda llena!</h2>
    <p style="font-size:9px;text-align:center;margin-bottom:10px;">
      ${charData(f).emoji} <b>${charName(f)}</b> Nv${f.lvl} quiere unirse.<br>Elige a quién despedir para hacerle sitio.</p>
    <div class="pick-grid">
      ${run.team.map((m, i) => {
        const mc = CHARS[m.id] || {};
        const rTag = mc.rareza ? `<span style="color:var(--gold);font-size:7.5px;">${'⭐'.repeat(mc.rareza)}</span>` : '';
        const fTag = m.stars ? `<span style="color:#ff6b6b;font-size:7.5px;font-weight:bold;">[+${m.stars}⭐]</span>` : '';
        return `
          <div class="pick-row" data-out="${i}">
            <span class="emoji">${charIcon(m.id, 34)}</span>
            <div class="info"><b>${charName(m)}</b> ${rTag} ${fTag} Nv${m.lvl}<br>${m.hp}/${m.maxhp} PS</div>
            <span style="font-size:8px;color:var(--red);">DESPEDIR</span>
          </div>`;
      }).join('')}
    </div>
    <div class="actions"><button class="btn gray" id="swap-cancel">NO RECLUTAR</button></div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll('[data-out]').forEach(el => {
    el.onclick = () => {
      const [out] = run.team.splice(+el.dataset.out, 1);
      run.team.push(f);
      saveRun();
      toast(`${charData(out).emoji} ${charName(out)} se despide de la banda...`);
      ov.remove();
      done && done(true);
    };
  });
  ov.querySelector('#swap-cancel').onclick = () => { ov.remove(); done && done(false); };
}

// ============ FICHA DE PERSONAJE ============
// Muestra las características reales del personaje en la saga (nivel, fusiones y barco).
function showCharModal(fOrId) {
  const isLive = typeof fOrId === 'object';
  const f = isLive ? migrateFighter(fOrId) : applyUpgrades(makeChar(fOrId, startLvlOf(fOrId)));
  const c = CHARS[f.id];
  const lore = (typeof LORE !== 'undefined' && LORE) ? (LORE[f.id] || LORE[baseFormOf(f.id)] || {}) : {};
  const pInfo = passiveInfo(f);
  const ultMv = getUltimateMove(f);

  const stats = [
    ['PS', f.maxhp, 45, f.hpBonus || 0],
    ['ATQ', f.atk, 20, f.atkBonus || 0],
    ['DEF', f.def, 20, f.defBonus || 0],
    ['E.ATQ', f.spatk, 20, f.spatkBonus || 0],
    ['E.DEF', f.spdef, 20, f.spdefBonus || 0],
    ['VEL', f.spd, 20, f.spdBonus || 0],
  ];
  const fTypes = fighterTypes(f);
  const isFru = fTypes.includes('Fruta'), isHak = fTypes.includes('Haki');
  const known = f.moves;
  const future = c.learnset.filter(([l, m]) => l > f.lvl && !known.includes(m));
  const rarityTag = c.rareza ? `<span style="color:var(--gold);font-size:14px;margin-left:6px;" title="Rareza: ${c.rareza} estrellas">${'⭐'.repeat(c.rareza)}</span>` : '';
  const fusionTag = f.stars ? `<span style="color:#ff6b6b;font-size:11px;font-weight:bold;margin-left:6px;">[+${f.stars}⭐ Fusión]</span>` : '';
  const hasUpgrades = (f.hpBonus || 0) + (f.atkBonus || 0) + (f.defBonus || 0) + (f.spatkBonus || 0) + (f.spdefBonus || 0) + (f.spdBonus || 0) > 0;

  const cap = maxStartLvlCap();
  const upgCost = logPoseUpgradeCost(f.lvl);
  const canAffordUpg = (meta.logPoses || 0) >= upgCost;
  const isMaxLvl = f.lvl >= cap;

  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal char-sheet">
    <h2><span style="font-size:26px;vertical-align:middle;">${charIcon(f.id, 34)}</span> ${c.name}${rarityTag}${fusionTag} <small>Nv.${f.lvl}</small></h2>
    <div class="char-sheet-hero" style="text-align:center;padding:12px;margin:8px 0 12px;background:radial-gradient(ellipse at center, rgba(232, 200, 50, 0.22) 0%, rgba(0,0,0,0.35) 75%);border:2px solid var(--gold);border-radius:8px;position:relative;">
      <div class="char-sheet-sprite" data-character="${f.id}" style="display:inline-block;filter:drop-shadow(3px 5px 8px rgba(0,0,0,0.6));">
        ${charIcon(f.id, 90)}
      </div>
      <div class="platform" style="width:120px;height:24px;margin:-10px auto 0;background:radial-gradient(ellipse at center, #7ec850 0%, #4aa557 70%, transparent 72%);border-radius:50%;box-shadow:inset 0 0 0 2px rgba(217, 131, 46, 0.35);"></div>
      <div style="margin-top:6px;font-size:9px;color:var(--gold);"><b>Rareza:</b> ${'⭐'.repeat(c.rareza || 1)} (${c.rareza || 1} Estrellas)</div>
    </div>
    ${typeBadges(fTypes)}
    ${isLive ? xpBarHTML(f) : ''}
    ${f.stars ? `<div class="sheet-line" style="color:var(--gold);background:rgba(255,215,0,0.1);padding:4px 8px;border-radius:4px;"><b>⭐ Fusión ${f.stars} Estrellas</b> — +${f.stars * 5}% a todas las características en esta partida</div>` : ''}
    ${isLive ? `<div class="sheet-line" style="color:var(--gold);font-weight:bold;">📍 Características reales en combate (Nivel, Fusiones y Barco)</div>` : `<div class="sheet-line" style="color:var(--gold);font-weight:bold;">📍 Nivel base e incentivos del barco actuales${hasUpgrades ? ' (incluye mejoras del barco)' : ''}</div>`}
    ${!isLive ? `
      <div style="margin:6px 0;text-align:center;background:rgba(0,0,0,0.04);padding:8px;border-radius:6px;border:1px solid #ddd;">
        <div style="font-size:8px;color:#555;margin-bottom:4px;">
          Nivel base actual: <b>Nv. ${f.lvl}</b> ${isMaxLvl ? `(Máx. ${cap})` : `· Siguiente nivel cuesta <b>${upgCost} 🧭 Log Poses</b> (Tienes ${meta.logPoses || 0} 🧭)`}
        </div>
        ${isMaxLvl ? `
          <span style="font-size:8px;color:var(--green);font-weight:bold;">🔒 Nivel máximo alcanzado para tus sagas</span>
        ` : `
          <button class="btn small gold" id="sheet-upg-btn" ${canAffordUpg ? '' : 'disabled'} style="font-size:8.5px;padding:4px 10px;">
            ⬆️ Subir a Nivel ${f.lvl + 1} (${upgCost} 🧭)
          </button>
        `}
      </div>
    ` : ''}
    ${isFru || isHak ? `<div class="sheet-line">
      ${isFru ? '<b>🍈 Tag FRUTA</b> — recibe la mitad de daño de atacantes sin HAKI. ' : ''}
      ${isHak ? '<b>👁️ Tag HAKI</b> — sus ataques anulan la defensa pasiva de los usuarios FRUTA.' : ''}
    </div>` : ''}
    ${c.nakama ? '<div class="sheet-line" style="color:var(--sea);"><b>🏴‍☠️ Nakama de la banda</b> — activa Espíritu de Tripulación</div>' : ''}
    ${lore.clase ? `<div class="sheet-line"><b>Clase:</b> ${lore.clase}</div>` : ''}
    ${lore.faccion ? `<div class="sheet-line"><b>Facción:</b> ${lore.faccion}</div>` : ''}
    <div class="sheet-stats">
      ${stats.map(([label, val, max, bonus]) => `
        <div class="sheet-stat"><label>${label}</label>
          <div class="stat-bar"><i style="width:${clamp(val / (max * (1 + 0.085 * (f.lvl - 1)) * (1 + (f.stars || 0) * 0.05)) * 100, 4, 100)}%"></i></div>
          <span><b>${val}</b>${bonus ? `<small style="color:var(--gold);font-size:7.5px;margin-left:2px;">(+${bonus})</small>` : ''}</span>
        </div>`).join('')}
    </div>
    <div class="sheet-line" style="text-align:center;color:#777;">
      EVA ${Math.round(BASE_EVA * 100)}% · CRIT ${Math.round(BASE_CRIT * 100)}% (x${BASE_CRIT_DMG}) — mejorables con sinergias
    </div>
    <div class="sheet-section"><b>⚔️ Movimientos Ataque</b>
      ${known.map(m => {
    const mv = MOVES[m];
    if (!mv) return '';
    const cat = mv.power === 0 ? '' : isPhysType(mv.type) ? ' · FÍS' : ' · ESP';
    return `<div class="sheet-move"><span class="type-badge" style="background:${TYPES[mv.type]?.color || '#888'}">${mv.type.toUpperCase()}</span>
              ${mv.name} <small>${mv.power ? mv.power + ' PWR · ' + Math.round((mv.acc || 0.9) * 100) + '%' + cat : 'APOYO'}</small></div>`;
  }).join('')}
      ${future.map(([l, m]) => `<div class="sheet-move future">🔒 Nv${l} — ${MOVES[m] ? MOVES[m].name : m}</div>`).join('')}
    </div>
    ${pInfo ? `<div class="sheet-section"><b>✨ Pasiva — ${pInfo.label}</b><p>${pInfo.desc}</p></div>` : ''}
    ${ultMv ? `<div class="sheet-section"><b>💥 Habilidad Definitiva — ${ultMv.name}</b><p>${ultMv.type ? `<span class="type-badge" style="background:${TYPES[ultMv.type]?.color || '#888'}">${ultMv.type.toUpperCase()}</span> ` : ''}${ultMv.power ? ultMv.power + ' PWR · ' + Math.round((ultMv.acc || 0.9) * 100) + '% precisión' : 'MOVIMIENTO DEFINITIVO'}</p></div>` : ''}
    ${c.evo ? `<div class="sheet-section"><b>🔄 Transformación</b><p>Al nivel ${c.evo.lvl} se convierte en ${CHARS[c.evo.to] ? CHARS[c.evo.to].name : c.evo.to}.</p></div>` : ''}
    <p class="sheet-desc">${c.desc}</p>
    <div class="actions" style="flex-direction:column;gap:6px;">
      ${isLive && (!battle || battle.over) && run && run.team && run.team.includes(f) ? `<button class="btn red small" id="sheet-dismiss-btn" style="width:100%;">🗑️ EXPULSAR DE LA BANDA</button>` : ''}
      <button class="btn gray" id="sheet-close" style="width:100%;">CERRAR</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const dismissBtn = ov.querySelector('#sheet-dismiss-btn');
  if (dismissBtn) {
    dismissBtn.onclick = () => {
      if (!run || !run.team || (battle && !battle.over)) return;
      if (run.team.length <= 1) {
        toast('⚠️ Debes mantener al menos 1 nakama en tu banda.');
        return;
      }
      modalConfirm('🗑️ Expulsar de la banda',
        `¿Estás seguro de que quieres expulsar a <b>${c.name}</b> de tu tripulación?<br><small style="color:#aaa;">Esta acción no se puede deshacer en esta partida.</small>`,
        () => {
          const idx = run.team.findIndex(m => m === f);
          if (idx !== -1) {
            run.team.splice(idx, 1);
            saveRun();
            ov.remove();
            toast(`👋 ${c.name} ha abandonado la banda.`);
            screenMap();
          }
        }
      );
    };
  }
  ov.querySelector('#sheet-close').onclick = () => ov.remove();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}

// ============ EVENTO: PIRATA ESPECIAL ============
// Dos opciones: contratar a cualquier pirata del catálogo pagando su caché,
// o jugar a los 5 carteles de SE BUSCA: se destapan en orden y el número
// de cartel donde aparece el pirata marca su rareza (1º = 1⭐ ... 5º = 5⭐).
// El primer cartel es el más probable; cada uno siguiente lo es menos.
// Formas base por id de saga
const sagaBasePirateIds = sagaId => Object.keys(CHARS).filter(id => !BASE_OF[id] && CHARS[id].saga === sagaId);

// Cartel de rareza r en una saga determinada; si no hay, la más cercana
const sagaPoolByRareza = (sagaId, r) => {
  const ids = sagaBasePirateIds(sagaId);
  for (let d = 0; d <= 4; d++) {
    for (const rr of [r - d, r + d]) {
      const pool = ids.filter(id => CHARS[id].rareza === rr);
      if (pool.length) return pool;
    }
  }
  return ids;
};

// Solo formas base de la saga actual en partida (evita conseguir personajes rotos de otras sagas)
const basePirateIds = () => sagaBasePirateIds(SAGAS[run.saga].id);
// Cartel de rareza r en la saga actual
const poolByRareza = r => sagaPoolByRareza(SAGAS[run.saga].id, r);
const hirePrice = c => c.rareza * c.rareza * 250; // precio elevado por elegir a dedo

function specialBlockedReason() {
  if (run.mode === 'nuzlocke' && run.nuzCaught[run.islandIdx]) return 'Regla Nuzlocke: ya reclutaste en esta isla.';
  return null;
}

function specialJoin(id, lvl) {
  const recLvl = Math.max(1, Math.floor(lvl * 0.85));
  const f = applyUpgrades(makeChar(id, recLvl));
  addToTeam(f, ok => {
    if (ok) {
      if (run.mode === 'nuzlocke') run.nuzCaught[run.islandIdx] = true;
      registerRecruit(id);
      saveRun();
      modalInfo('🎉 ¡Nuevo nakama!', `<div class="reward-list"><span style="font-size:34px;">${charIcon(id, 44)}</span><br><b>${CHARS[id].name}</b> Nv${recLvl} se une a tu banda.</div>`, screenMap);
    } else {
      modalInfo('🌊 Trato deshecho', '<div class="reward-list">Dejas marchar al recluta. Lo pagado no se devuelve: negocios son negocios.</div>', screenMap);
    }
  });
}

function doSpecialPirate(island) {
  meta.starPity = meta.starPity || 0;
  const lvl = island.lvl[1] + 2;
  const gachaPrice = 300 * (run.islandIdx + 1);
  const blocked = specialBlockedReason();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>🌟 Mercado clandestino</h2>
    <p style="font-size:9px;line-height:1.9;text-align:center;">Un contacto de los bajos fondos te ofrece reclutas (Nv${lvl}).<br><br>
    <b>🎯 Elegir:</b> cualquier pirata del catálogo (hasta 4⭐), pagando su caché completo.<br>
    <b>🎰 Carteles:</b> 5 carteles de SE BUSCA boca abajo. Destápalos en orden:
    el 1º es el más probable (recluta de 1⭐)... y el 5º, el premio gordo (5⭐).</p>
    ${cartelesBadgeHTML()}
    <div style="font-size:9.5px;text-align:center;margin-top:6px;margin-bottom:6px;color:#f39c12;background:rgba(243,156,18,0.12);padding:6px 10px;border-radius:6px;border:1px solid rgba(243,156,18,0.4);display:flex;align-items:center;justify-content:center;gap:6px;">
      <span>⭐ Estrellas acumuladas (Pity): <b>${meta.starPity || 0} / 1000</b></span>
      ${(meta.starPity || 0) >= 1000 ? '<span style="color:#2ecc71;font-weight:bold;">¡LEGENDARIO ASEGURADO!</span>' : ''}
    </div>
    ${blocked ? `<div class="special-fail">${blocked}</div>` : ''}
    <div class="actions" style="flex-direction:column;align-items:stretch;">
      <button class="btn blue" id="sp-choose" ${blocked ? 'disabled' : ''}>🎯 ELEGIR PIRATA — catálogo</button>
      <button class="btn gold" id="sp-gacha" ${blocked || run.berries < gachaPrice ? 'disabled' : ''}>🎰 JUGAR CARTELES — ${berriesHTML(gachaPrice)}</button>
      <button class="btn gray" id="sp-rates">📊 TABLA DE PROBABILIDADES</button>
      <button class="btn gray" id="sp-leave">🌊 MARCHARSE</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  if (autoMode) {
    scheduleAutoStep(() => {
      const btn = ov.querySelector('#sp-leave');
      if (btn && document.body.contains(ov)) btn.click();
    }, 700);
  }
  ov.querySelector('#sp-rates').onclick = showDropRatesModal;
  ov.querySelector('#sp-leave').onclick = () => { ov.remove(); screenMap(); };
  if (!blocked) {
    ov.querySelector('#sp-choose').onclick = () => { ov.remove(); renderSpecialCatalog(lvl); };
    if (run.berries >= gachaPrice) {
      ov.querySelector('#sp-gacha').onclick = () => {
        run.berries -= gachaPrice; saveRun();
        ov.remove(); renderSpecialGacha(lvl);
      };
    }
  }
}

function renderSpecialCatalog(lvl) {
  // solo puedes contratar a quienes ya venciste en el modo historia
  const ids = basePirateIds()
    .filter(id => meta.defeated.includes(id))
    .sort((a, b) => CHARS[a].rareza - CHARS[b].rareza || CHARS[a].name.localeCompare(CHARS[b].name));
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>🎯 Catálogo de reclutas (Nv${lvl})</h2>
    <div style="text-align:center;font-size:9px;margin-bottom:8px;color:var(--accent);">${berriesHTML(run.berries)} disponibles</div>
    <p style="font-size:8px;text-align:center;color:#777;margin-bottom:8px;">Solo aparecen piratas de esta saga a los que ya hayas vencido en combate.</p>
    ${ids.length ? '' : '<p style="font-size:9px;text-align:center;color:#888;padding:10px;">Aún no has vencido a nadie de esta saga.<br>¡Derrota rivales y vuelve!</p>'}
    <div class="pick-grid">
      ${ids.map(id => {
    const c = CHARS[id];
    const price = hirePrice(c);
    const can = run.berries >= price;
    return `<div class="pick-row" style="cursor:default;">
          <span class="emoji">${charIcon(id, 22)}</span>
          <div class="info"><b>${c.name}</b> ${'⭐'.repeat(c.rareza)}<br><small>${c.types.join(' / ')}</small></div>
          <button class="btn small ${can ? 'green' : 'gray'}" data-hire="${id}" ${can ? '' : 'disabled'}>${berriesHTML(price)}</button>
        </div>`;
  }).join('')}
    </div>
    <div class="actions"><button class="btn gray" id="cat-back">← VOLVER</button></div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#cat-back').onclick = () => {
    ov.remove();
    doSpecialPirate(SAGAS[run.saga].islands[run.islandIdx]);
  };
  ov.querySelectorAll('[data-hire]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.hire;
      const price = hirePrice(CHARS[id]);
      if (run.berries < price) return;
      run.berries -= price;
      ov.remove();
      specialJoin(id, lvl);
    };
  });
}

function revealSpecialRecruit(ov, prizeId, lvl) {
  let completed = false;
  const complete = () => {
    if (completed || !ov.isConnected) return;
    completed = true;
    ov.remove();
    specialJoin(prizeId, lvl);
  };
  try {
    if (typeof MarketReveal !== 'undefined') {
      MarketReveal.show({host:ov, name:CHARS[prizeId].name, rarity:CHARS[prizeId].rareza,
        portraitHTML:charIcon(prizeId, 140), onComplete:complete});
      return;
    }
  } catch (_) { /* A cosmetic failure must not prevent recruitment. */ }
  setTimeout(complete, 1400);
}

function renderSpecialGacha(lvl) {
  meta.starPity = meta.starPity || 0;
  // pesos: 1⭐ -> 41.5%, 2⭐ -> 30%, 3⭐ -> 21%, 4⭐ -> 7%, 5⭐ (legendarios) -> 0.5%
  const weights = [41.5, 30, 21, 7, 0.5];
  let roll = Math.random() * 100, stopIdx = 4;
  if (meta.starPity >= 1000) {
    stopIdx = 4; // Pity activado: legendario asegurado (5⭐)
  } else {
    for (let i = 0; i < 5; i++) { roll -= weights[i]; if (roll <= 0) { stopIdx = i; break; } }
  }
  const prizeId = pick(poolByRareza(stopIdx + 1)) || pick(basePirateIds());

  if (stopIdx === 4 || (CHARS[prizeId] && CHARS[prizeId].rareza === 5)) {
    meta.starPity = 0;
  } else {
    meta.starPity += (stopIdx + 1);
  }
  saveMeta();

  let current = 0;
  const ov = document.createElement('div');
  ov.className = 'overlay market-cartels';
  ov.innerHTML = `<div class="modal">
    <h2>🎰 Los 5 carteles de SE BUSCA</h2>
    <p style="font-size:8px;text-align:center;margin-bottom:6px;">Destapa los carteles en orden. ¡En uno de ellos está tu recluta!</p>
    <div style="font-size:9px;text-align:center;margin-bottom:10px;color:#f39c12;">
      ⭐ Estrellas acumuladas (Pity): <b>${meta.starPity} / 1000</b>
    </div>
    <div class="poster-row">
      ${[0, 1, 2, 3, 4].map(i => `
        <button type="button" class="poster" data-p="${i}" aria-label="Destapar cartel de ${i + 1} estrellas" disabled>
          <div class="poster-stars">${'⭐'.repeat(i + 1)}</div>
          <div class="poster-face" id="pf-${i}">📜<br><span>SE BUSCA</span></div>
        </button>`).join('')}
    </div>
  </div>`;
  document.body.appendChild(ov);
  const update = () => {
    ov.querySelectorAll('.poster').forEach((el, i) => {
      el.classList.toggle('next', i === current);
      el.disabled = i !== current;
      el.onclick = i === current ? () => flip(i) : null;
    });
  };
  const flip = i => {
    const face = ov.querySelector(`#pf-${i}`);
    const el = ov.querySelector(`[data-p="${i}"]`);
    if (i === stopIdx) {
      const c = CHARS[prizeId];
      face.innerHTML = `${charIcon(prizeId, 28)}<br><span>${c.name}</span>`;
      el.classList.add('hit'); el.classList.remove('next');
      registerDex(prizeId);
      ov.querySelectorAll('.poster').forEach(p => { p.onclick = null; p.disabled = true; });
      revealSpecialRecruit(ov, prizeId, lvl);
    } else {
      face.innerHTML = `💨<br><span>VACÍO</span>`;
      el.classList.add('empty');
      current++;
      update();
      ov.querySelector(`[data-p="${current}"]`)?.focus({preventScroll:true});
    }
  };
  update();
  ov.querySelector('[data-p="0"]')?.focus({preventScroll:true});
}

// Tabla de probabilidades (drop rates) del gacha de carteles SE BUSCA:
// probabilidad de cada cartel/rareza y de cada personaje dentro de su rareza.
function showDropRatesModal() {
  const weights = [41.5, 30, 21, 7, 0.5];
  const total = 100;
  const rows = [1, 2, 3, 4, 5].map(r => {
    const pool = poolByRareza(r);
    const pct = weights[r - 1] / total * 100;
    const each = pct / Math.max(1, pool.length);
    return `<tr>
      <td style="white-space:nowrap;">${'⭐'.repeat(r)}</td>
      <td><b>${pct.toFixed(1)}%</b></td>
      <td style="font-size:7px;line-height:1.9;">${pool.map(id => `${CHARS[id].name} <span style="color:#888;">(${each.toFixed(2)}%)</span>`).join(' · ')}</td>
    </tr>`;
  }).join('');
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" style="max-width:560px;">
    <h2>📊 Probabilidades de los carteles</h2>
    <p style="font-size:8px;text-align:center;margin-bottom:10px;line-height:1.9;">
      Los carteles se destapan en orden: el cartel donde aparece el recluta marca su rareza.<br>
      Si esta saga no tiene piratas de una rareza, el cartel usa la rareza más cercana.</p>
    <div style="overflow-x:auto;">
      <table class="chart-table">
        <tr><th>Cartel</th><th>Prob.</th><th>Personajes posibles (prob. individual)</th></tr>
        ${rows}
      </table>
    </div>
    <div class="actions"><button class="btn gray" id="dr-close">CERRAR</button></div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#dr-close').onclick = () => ov.remove();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}

function modalInfo(title, html, onClose) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal"><h2>${title}</h2>${html}
    <div class="actions"><button class="btn green" id="modal-ok">CONTINUAR</button></div></div>`;
  document.body.appendChild(ov);
  ov.querySelector('#modal-ok').onclick = () => { ov.remove(); onClose && onClose(); };
  if (autoMode) {
    scheduleAutoStep(() => {
      if (document.body.contains(ov)) {
        ov.remove();
        onClose && onClose();
      }
    }, 700);
  }
}

// Confirmación gráfica (sustituye a los confirm() del navegador)
function modalConfirm(title, html, onYes, onNo) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal"><h2>${title}</h2>
    <div style="font-size:9px;text-align:center;line-height:1.9;">${html}</div>
    <div class="actions">
      <button class="btn red" id="mc-yes">SÍ</button>
      <button class="btn gray" id="mc-no">NO</button>
    </div></div>`;
  document.body.appendChild(ov);
  ov.querySelector('#mc-yes').onclick = () => { ov.remove(); onYes && onYes(); };
  ov.querySelector('#mc-no').onclick = () => { ov.remove(); onNo && onNo(); };
}

// ============ TIENDA ============
function screenShop() {
  playMusic('menu');
  const stock = ['carne', 'carnereal', 'bocadillo', 'sake', 'cartel', 'carteldorado', 'cartelbuster', 'hierro'];
  const inventorySummary = Object.entries((run && run.items) || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => `${ITEMS[id] ? ITEMS[id].emoji : ''} ×${n}`)
    .join(' · ');

  const sellItems = Object.entries((run && run.items) || {})
    .filter(([id, n]) => n > 0 && ITEMS[id]);

  const sellItemsHTML = sellItems.length ? sellItems.map(([id, n]) => {
    const it = ITEMS[id];
    const sellPrice = Math.floor(it.price * 0.75);
    return `<div class="shop-item" style="border-color:rgba(46,204,113,0.3);background:rgba(46,204,113,0.05);">
      <span class="emoji">${it.emoji}</span>
      <div class="info">
        <b>${it.name}</b> <span style="font-size:8.5px;color:#aaa;">(Tienes: ${n})</span> — Venta (75%): <span class="price" style="color:#2ecc71;font-weight:bold;">+${berriesHTML(sellPrice)}</span><br>
        <small style="color:#888;">${it.desc} · Valor original: ${it.price} 💰</small>
      </div>
      <button class="btn small green" data-sell="${id}">VENDER (+${sellPrice} 💰)</button>
    </div>`;
  }).join('') : '<div style="font-size:8.5px;color:#888;text-align:center;padding:8px;background:rgba(0,0,0,0.15);border-radius:6px;margin-bottom:10px;">Tu bolsa está vacía. No tienes objetos para vender.</div>';

  render(`
    ${topbar(true, false)}
    <div class="panel">
      <h2>🏪 Tienda del puerto</h2>
      <p style="font-size:9px;margin-bottom:6px;">"¡Bienvenido! Todo pirata necesita provisiones o vender botín sobrante."</p>
      <div style="font-size:9.5px;background:rgba(255,215,0,0.12);padding:6px 10px;border-radius:6px;border:1px solid var(--gold);margin-bottom:10px;text-align:center;">
        <b>🎒 Tu Bolsa:</b> ${inventorySummary || 'Vacía'}
      </div>

      <h3 style="margin-top:10px;margin-bottom:6px;font-size:11px;color:var(--gold);">🛒 COMPRAR PROVISIONES</h3>
      ${stock.map(id => {
    const it = ITEMS[id];
    const owned = (run && run.items && run.items[id]) || 0;
    return `<div class="shop-item">
          <span class="emoji">${it.emoji}</span>
          <div class="info">
            <b>${it.name}</b> <span style="font-size:8.5px;color:var(--gold);font-weight:bold;margin-left:4px;">(Tienes: ${owned})</span> — <span class="price">${berriesHTML(it.price)}</span><br>
            <small>${it.desc}</small>
          </div>
          <button class="btn small ${run.berries >= it.price ? 'green' : 'gray'}" data-buy="${id}" ${run.berries >= it.price ? '' : 'disabled'}>COMPRAR</button>
        </div>`;
  }).join('')}

      <h3 style="margin-top:14px;margin-bottom:6px;font-size:11px;color:#2ecc71;">💰 VENDER OBJETOS DE TU BOLSA (75% del valor)</h3>
      ${sellItemsHTML}

      <div class="actions" style="margin-top:14px;text-align:center;">
        <button class="btn blue" id="btn-leave">SEGUIR VIAJE →</button>
      </div>
    </div>
  `);
  document.querySelectorAll('[data-buy]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.buy;
      if (run.berries < ITEMS[id].price) return;
      run.berries -= ITEMS[id].price;
      run.items[id] = (run.items[id] || 0) + 1;
      trackItemCollected(1);
      trackStat('shop_buy', 1);
      saveRun();
      toast(`Comprado: ${ITEMS[id].name} ${ITEMS[id].emoji}`);
      screenShop();
    };
  });
  document.querySelectorAll('[data-sell]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.sell;
      if (!run || !run.items || !run.items[id] || run.items[id] <= 0) return;
      const it = ITEMS[id];
      const sellPrice = Math.floor(it.price * 0.75);
      run.items[id] -= 1;
      if (run.items[id] <= 0) delete run.items[id];
      run.berries += sellPrice;
      saveRun();
      toast(`💰 Vendido: ${it.name} ${it.emoji} por +${sellPrice} Berries`);
      screenShop();
    };
  });
  $('#btn-leave').onclick = screenMap;
  if (autoMode) {
    scheduleAutoStep(() => {
      if (!autoMode || !run) return;
      const targets = autoSettings.shopItems || [
        { id: 'carne', qty: 3 },
        { id: 'sake', qty: 2 },
        { id: 'cartel', qty: 2 }
      ];
      let boughtAny = false;

      for (const t of targets) {
        if (!t || !t.id || t.id === 'none' || t.qty <= 0) continue;
        const currentQty = (run.items && run.items[t.id]) || 0;
        if (currentQty < t.qty) {
          const itemPrice = ITEMS[t.id] ? ITEMS[t.id].price : 999999;
          if (run.berries >= itemPrice) {
            const buyBtn = document.querySelector(`[data-buy="${t.id}"]`);
            if (buyBtn && !buyBtn.disabled) {
              buyBtn.click();
              boughtAny = true;
              break;
            }
          }
        }
      }

      if (!boughtAny) {
        const leaveBtn = $('#btn-leave');
        if (leaveBtn) leaveBtn.click();
      }
    }, 750);
  }
}

// ============ BATALLA AUTOMÁTICA ============
// El combate se resuelve solo: lucha toda la banda en el orden establecido,
// eligiendo siempre el mejor movimiento según los tipos. El jugador solo
// interviene con objetos, carteles de recluta, velocidad o huida.
let battle = null;
let autoSpeed = 1; // recordado entre combates

// ---------- Clímax de combate (anti combates eternos) ----------
// A partir de la ronda CLIMAX_ROUND el daño de ambos bandos sube un 10%
// acumulativo por ronda y toda curación pierde un 20% de eficacia por ronda
// (hasta anularse). Garantiza que ningún combate pueda durar para siempre.
const CLIMAX_ROUND = 10;
function climaxDmgMult() {
  return battle ? 1 + 0.10 * Math.max(0, (battle.round || 1) - CLIMAX_ROUND) : 1;
}
function healScaleNow() {
  return battle ? clamp(1 - 0.20 * Math.max(0, (battle.round || 1) - CLIMAX_ROUND), 0, 1) : 1;
}

const activeP = () => battle.pTeam.includes(battle.curP) && battle.curP.hp > 0
  ? battle.curP : battle.pTeam.find(f => f.hp > 0);
const activeE = () => battle.eTeam.find(f => f.hp > 0);

// ---------- Motor de pasivas (compendio) ----------
const isP = (f, id) => f.id === id || baseFormOf(f.id) === id;
const teamOf = f => (battle && battle.pTeam.includes(f)) ? battle.pTeam : (battle ? battle.eTeam : []);

// Una única ficha por pasiva: los modificadores de esta tabla se consumen en el motor.
// Las capacidades sin regla jugable no se anuncian como efectos activos.
const PASSIVES = {
  luffy: { name:'Espíritu de Goma', desc:'+15% de ataque con menos del 50% de PS. Inmune al Rayo.' },
  zoro: { name:'Camino del Ashura', desc:'Hasta +25 puntos de crítico según los PS perdidos.' },
  nami: { name:'Lectura Meteorológica', desc:'+10 puntos de evasión a los aliados vivos.' },
  usopp: { name:'Disparo Preparado', desc:'+30% de velocidad en la primera ronda.', openingSpeed:1.3 },
  sanji: { name:'Tenacidad del Cocinero', desc:'Reduce un 15% todo el daño de ataques recibido.' },
  chopper: { name:'Médico de la Banda', desc:'Recupera un 3% de sus PS por ronda; el Clímax reduce la curación.', regen:.03 },
  robin: { name:'Ojos en Todas Partes', desc:'+10 puntos de probabilidad de crítico.', critical:.10 },
  franky: { name:'Armadura Frontal', desc:'Los ataques recibidos no pueden ser críticos.' },
  brook: { name:'Segunda Vida', desc:'Revive una vez por viaje con el 20% de PS. No revive aliados en Nuzlocke.' },
  buggy: { name:'Bara Bara no Mi', desc:'Inmune a ataques de Corte. Las bombas y los golpes sí le afectan.' },
  marco: { name:'Llamas del Fénix', desc:'Cura al aliado activo un 6% de sus PS por ronda; el Clímax reduce la curación.' },
  arlong: { name:'Orgullo Gyojin', desc:'+15% de daño físico y de Agua.', physical:1.15, types:{Agua:1.15} },
  crocodile: { name:'Cuerpo de Arena', desc:'Reduce un 15% el daño recibido, excepto Agua.', dryReduction:.85 },
  enel: { name:'Mantra', desc:'+15% de daño de Rayo. Esquiva el primer ataque del combate.', types:{Rayo:1.15}, dodge:1 },
  lucci: { name:'Depredador', desc:'+15% de daño físico.', physical:1.15 },
  moria: { name:'Robo de Sombras', desc:'Drena un 3% de los PS del rival activo por ronda. El Clímax reduce la curación.', drain:.03 },
  jinbe: { name:'Karate Gyojin', desc:'+15% de defensa y de daño de Agua.', defense:1.15, types:{Agua:1.15} },
  hancock: { name:'Petrificación Parcial', desc:'Al golpear reduce la velocidad rival un 15% durante la siguiente ronda.', slow:true },
  magellan: { name:'Veneno Corrosivo', desc:'+25% de daño de Veneno.', types:{Veneno:1.25} },
  sengoku: { name:'Gran Buda', desc:'+20% de defensa física y especial.', defense:1.20 },
  newgate: { name:'El Hombre más Fuerte', desc:'+25% de ataque con menos del 50% de PS.' },
  roger: { name:'Voluntad del Rey Pirata', desc:'+20% de daño de ataques de los aliados vivos.' },
  shanks: { name:'Haki del Conquistador', desc:'Reduce un 15% el ataque del bando rival mientras viva.' },
  teach: { name:'Vórtice Oscuro', desc:'+25% de daño contra usuarios de Fruta.' },
  garp: { name:'Puño de Hierro', desc:'Los ataques físicos ignoran un 30% de la defensa rival.' },
  akainu: { name:'Magma Hirviente', desc:'+20% de daño de Fuego.' },
  kizaru: { name:'Velocidad Destello', desc:'+30% de velocidad.', speed:1.30 },
  aokiji: { name:'Era de Hielo', desc:'Al golpear reduce la velocidad rival un 15% durante la siguiente ronda.', slow:true },
  dragon: { name:'Viento del Destino', desc:'+15 puntos de evasión a los aliados vivos. Interpretación para el juego.' },
  mihawk: { name:'Ojo de Halcón', desc:'+15 puntos de probabilidad de crítico.' },
  oden: { name:'Espadachín de Wano', desc:'+10 puntos de crítico y +0,20 al multiplicador de daño crítico.' },
  smoker: { name:'Cuerpo de Humo', desc:'+20 puntos de evasión.' },
  doflamingo: { name:'Titiritero', desc:'+15% de daño especial.', special:1.15 },
  katakuri: { name:'Futuro Inalterable', desc:'Esquiva los dos primeros ataques del combate.', dodge:2 },
  bigmom: { name:'Soul Pocus', desc:'Drena un 4% de los PS del rival activo por ronda. El Clímax reduce la curación.', drain:.04 },
  kaido: { name:'Piel de Dragón', desc:'+20% de defensa y -15% de daño recibido de ataques.' },
  yamato: { name:'Espejo Divino', desc:'+15% de ataque y defensa.', attack:1.15, defense:1.15 },
  king: { name:'Llama Lunaria', desc:'Reduce un 15% el daño recibido de ataques.', reduction:.85 },
  queen: { name:'Virus de Plaga', desc:'+20% de daño de Veneno.', types:{Veneno:1.20} },
  kid: { name:'Magnetismo', desc:'+15% de daño físico.', physical:1.15 },
  law: { name:'Room Cirujano', desc:'+15% de daño especial.', special:1.15 },
  sabo: { name:'Garra del Dragón', desc:'+15% de daño de Fuego.', types:{Fuego:1.15} },
  cavendish: { name:'Hakuba', desc:'+25% de velocidad con menos del 50% de PS.', lowSpeed:1.25 },
  kyros: { name:'Gladiador Invicto', desc:'+15% de daño físico.', physical:1.15 },
  fujitora: { name:'Gravedad Pesada', desc:'Reduce un 20% la velocidad del rival activo.', foeSpeed:.80 },
  ryokugyu: { name:'Regeneración Forestal', desc:'Cura al aliado activo un 5% de PS por ronda; el Clímax reduce la curación.' },
  garling: { name:'Juicio Celestial', desc:'+20% de daño físico.', physical:1.20 },
  saturn: { name:'Regeneración Abisal', desc:'Recupera un 5% de sus PS por ronda; el Clímax reduce la curación.', regen:.05 },
  mars: { name:'Vuelo Bestial', desc:'+20% de velocidad.', speed:1.20 },
  warcury: { name:'Coraza Bestial', desc:'+25% de defensa física y especial.', defense:1.25 },
  nusjuro: { name:'Corte Gélido', desc:'+20% de daño de Corte e Hielo.', types:{Corte:1.20,Hielo:1.20} },
  jupeter: { name:'Devorador Terrestre', desc:'+20% de defensa física y especial.', defense:1.20 },
  im: { name:'Sombra del Trono', desc:'+25% de daño de Oscuridad y Haki. Interpretación para el juego.', types:{Oscuridad:1.25,Haki:1.25} },
  xebec: { name:'Furia Salvaje', desc:'+25% de ataque.', attack:1.25 },
  naruto: { name:'Modo Senjutsu', desc:'+15% de daño de Viento y de velocidad.', types:{Viento:1.15}, speed:1.15 },
  sasuke: { name:'Sharingan', desc:'+15 puntos de crítico y +15% de daño de Rayo.', critical:.15, types:{Rayo:1.15} },
  kakashi: { name:'Ninja Copia', desc:'+15 puntos de evasión y +15% de velocidad.', evasion:.15, speed:1.15 },
  itadori: { name:'Puño Divergente', desc:'+15% de daño físico.', physical:1.15 },
  yuta: { name:'Energía Maldita', desc:'+15% de daño especial.', special:1.15 },
  gojo: { name:'Infinito', desc:'Esquiva el primer ataque del combate.', dodge:1 },
  tanjiro: { name:'Danza del Dios del Fuego', desc:'+15% de daño de Fuego y Agua.', types:{Fuego:1.15,Agua:1.15} },
  zenitsu: { name:'Respiración del Rayo', desc:'+30% de velocidad y +15 puntos de crítico.', speed:1.30, critical:.15 },
  inosuke: { name:'Asalto de la Bestia', desc:'+15% de daño físico.', physical:1.15 },
  nezuko: { name:'Sangre Ardiente', desc:'+15% de daño de Fuego y -10% de daño recibido.', types:{Fuego:1.15}, reduction:.9 },
  goku: { name:'Super Saiyan', desc:'+20% de ataque con menos del 70% de PS.', lowAttack:1.20, threshold:.70 },
  vegeta: { name:'Orgullo Saiyan', desc:'+15% de ataque y +10 puntos de crítico.', attack:1.15, critical:.10 },
  gohan: { name:'Ira Desatada', desc:'+20% de ataque tras recibir un golpe en combate.', hitAttack:1.20 },
  genos: { name:'Incineración', desc:'+20% de daño de Fuego y Rayo.', types:{Fuego:1.20,Rayo:1.20} },
  garou: { name:'Cazador de Héroes', desc:'+15% de ataque y +10 puntos de evasión.', attack:1.15, evasion:.10 },
  tatsumaki: { name:'Telequinesis', desc:'+20% de daño especial.', special:1.20 },
  orochimaru: { name:'Sustitución de Serpiente', desc:'Recupera un 5% de sus PS por ronda; el Clímax reduce la curación.', regen:.05 },
  madara: { name:'Susanoo Definitivo', desc:'+25% de defensa física y especial.', defense:1.25 },
  sukuna: { name:'Corte Desmantelar', desc:'+20% de daño de Corte.' },
  kibutsuji: { name:'Biokinesis Demoniaca', desc:'Cura al aliado activo un 5% de PS por ronda; el Clímax reduce la curación.' },
  gokuui: { name:'Doctrina del Egoísta', desc:'+25 puntos de evasión y +20% de velocidad.', evasion:.25, speed:1.20 },
  jiren: { name:'Fuerza Absoluta', desc:'+25% de ataque y defensa.', attack:1.25, defense:1.25 },
  cell: { name:'Células Perfectas', desc:'Recupera un 5% de sus PS por ronda; el Clímax reduce la curación.', regen:.05 },
  frieza: { name:'Emperador del Universo', desc:'+20% de daño contra rivales con menos del 50% de PS.' },
  zenosama: { name:'Borrado Divino', desc:'+25% de daño de ataques.' },
  saitama: { name:'Entrenamiento Serio', desc:'+35% de daño físico y +0,50 al multiplicador de daño crítico.' },
};
const passiveRule = f => PASSIVES[f.id] || PASSIVES[baseFormOf(f.id)] || {};
function passiveInfo(f) {
  const rule = passiveRule(f);
  if (!rule.name) return null;
  let active = f.hp > 0;
  let extra = '';
  if (rule.dodge) {
    const inCombat = battle && !battle.over && [...battle.pTeam,...battle.eTeam].includes(f);
    const left = inCombat ? (f.dodgeLeft || 0) : rule.dodge;
    active = active && left > 0; extra = ` (${left} esquivas)`;
  }
  if (rule.lowAttack) active = active && f.hp < f.maxhp * rule.threshold;
  if (rule.lowSpeed || isP(f,'newgate')) active = active && f.hp < f.maxhp * .5;
  if (rule.hitAttack) active = active && !!f.st?.receivedHit;
  return {label:rule.name + extra, desc:rule.desc, active, implemented:true};
}

// ---------- Sinergias de equipo (rediseño) ----------
// 2+ nakamas vivos del mismo tipo = sinergia I; el equipo entero = sinergia II.
const SYNERGIES = {
  Corte: {
    name: 'Precisión Quirúrgica',
    d1: '+15% de Daño Crítico (CRIT_DMG) a todo el equipo',
    d2: '+35% de Daño Crítico y +10% de Probabilidad Crítica'
  },
  Golpe: {
    name: 'Fuerza Bruta',
    d1: '+12% de daño a movimientos de ATQ físico',
    d2: '+25% de daño físico y los ataques rompen un 15% de la DEF rival'
  },
  Disparo: {
    name: 'Ojo Crítico',
    d1: '+10% de Probabilidad Crítica (CRIT_CHANCE)',
    d2: '+20% de Probabilidad Crítica y los críticos ignoran la evasión rival'
  },
  Fuego: {
    name: 'Combustión',
    d1: '+12% de daño a movimientos de Fuego',
    d2: '+25% de daño de Fuego; al asestar un crítico inflige Quemadura (3% PS por turno)'
  },
  Hielo: {
    name: 'Control / Ralentización',
    d1: '+10% de daño de Hielo',
    d2: '+20% de daño de Hielo y los ataques reducen la VEL del enemigo un 15% durante 1 turno'
  },
  Veneno: {
    name: 'Corrosión',
    d1: '+10% de daño de movimientos de Veneno',
    d2: 'Todos los ataques tienen un 25% de probabilidad de envenenar; los envenenados pierden un 20% de ESP_DEF'
  },
  Oscuridad: {
    name: 'Vórtice',
    d1: '+10% de daño contra objetivos con el tag FRUTA',
    d2: '+25% de daño contra objetivos FRUTA y anula las pasivas de curación rivales'
  },
  Agua: {
    name: 'Flujo Vital',
    d1: 'El luchador activo recupera 4% PS al final de cada ronda',
    d2: 'Recupera 8% PS por ronda y todo el equipo gana +15% de ESP_DEF'
  },
  Rayo: {
    name: 'Aceleración y Reflejos',
    d1: '+20% de VEL',
    d2: '+40% de VEL y el primer ataque del combate es un crítico garantizado'
  },
  Viento: {
    name: 'Ligereza',
    d1: '+8% de EVA (Evasión)',
    d2: '+18% de EVA; esquivar un golpe aumenta la velocidad un 20% durante la ronda siguiente'
  },
  Tierra: {
    name: 'Baluarte',
    d1: '+15% de DEF física',
    d2: '+30% de DEF física y resistencia a críticos (los críticos enemigos hacen daño normal)'
  },
  Fruta: {
    name: 'Despertar Paramecia/Zoan/Logia',
    d1: '+12% al daño de ESP_ATQ',
    d2: '+25% al daño de ESP_ATQ y +15% a ESP_DEF'
  },
  Haki: {
    name: 'Voluntad Inquebrantable',
    d1: 'Otorga el tag HAKI a todo el equipo y +8% de daño general',
    d2: '+18% de daño general, +10% de CRIT_CHANCE y anula la evasión (EVA) del enemigo'
  },
  Nakama: {
    name: 'Espíritu de Tripulación',
    d1: '+10% al ataque, defensas y velocidad si ningún miembro comparte tipo primario',
    d2: 'Un aliado que caiga a 0 PS sobrevive con 1 PS una vez por viaje'
  },
};
const synEmoji = t => t === 'Nakama' ? '🏴‍☠️' : TYPES[t].emoji;
const isNakamaChar = f => !!(charData(f).nakama || (CHARS[baseFormOf(f.id)] && CHARS[baseFormOf(f.id)].nakama));

function synergyTier(team, type) {
  const alive = team.filter(f => f.hp > 0);
  if (alive.length < 2) return 0;
  const cnt = type === 'Nakama'
    ? alive.filter(isNakamaChar).length
    : alive.filter(f => charData(f).types.includes(type)).length;
  if (cnt === alive.length) return 2;
  if (cnt >= 2) return 1;
  return 0;
}
function teamSynergies(team) {
  return Object.keys(SYNERGIES).map(t => ({ t, tier: synergyTier(team, t) })).filter(x => x.tier > 0);
}
function synChipsHTML(team) {
  const list = teamSynergies(team);
  if (!list.length) return '<span class="syn-none">sin sinergias</span>';
  return list.map(({ t, tier }) =>
    `<span class="syn-chip t${tier}" title="${SYNERGIES[t].name}: ${tier === 2 ? SYNERGIES[t].d2 : SYNERGIES[t].d1}">${synEmoji(t)} ${t} ${tier === 2 ? 'Ⅱ' : 'Ⅰ'}</span>`
  ).join('');
}

// ---------- Tags de naturaleza ----------
const hasFruta = f => fighterTypes(f).includes('Fruta');
// HAKI: tipo propio o concedido por la sinergia Haki del equipo (nivel I+)
const hasHaki = f => fighterTypes(f).includes('Haki') || (f.moves || []).some(id => MOVES[id]?.type === 'Haki') ||
  (battle && synergyTier(teamOf(f), 'Haki') >= 1);
// Nakama I: +10% a todas las estadísticas si ningún miembro comparte tipo primario
function nakamaStatMult(team) {
  if (synergyTier(team, 'Nakama') < 1) return 1;
  const prim = team.filter(f => f.hp > 0).map(f => charData(f).types[0]);
  return new Set(prim).size === prim.length ? 1.1 : 1;
}

// Modal informativo con todas las sinergias y el estado del equipo actual
function showSynergyModal(team) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" style="display:flex;flex-direction:column;max-height:85vh;max-width:580px;position:relative;overflow:hidden;padding-bottom:0;">
    <h2 style="flex-shrink:0;">🧩 Sinergias de equipo</h2>
    <p style="font-size:8px;text-align:center;margin-bottom:10px;flex-shrink:0;">2+ nakamas vivos que comparten tipo activan la Sinergia I;
    si el equipo entero lo comparte, la Sinergia II.</p>
    <div style="overflow-y:auto;flex:1;padding-right:4px;margin-bottom:6px;">
      ${Object.keys(SYNERGIES).map(t => {
    const tier = team ? synergyTier(team, t) : 0;
    const s = SYNERGIES[t];
    return `<div class="sheet-section" style="${tier ? 'background:#fff8e0;' : ''}">
            <b>${synEmoji(t)} ${t} — ${s.name} ${tier ? `<span style="color:var(--accent);">— ACTIVA ${tier === 2 ? 'Ⅱ' : 'Ⅰ'}</span>` : ''}</b>
            <p>Ⅰ: ${s.d1}<br>Ⅱ: ${s.d2}</p>
          </div>`;
  }).join('')}
    </div>
    <div class="actions" style="background:var(--paper);padding:10px 18px;margin-left:-18px;margin-right:-18px;border-top:2px solid var(--ink);box-shadow:0 -4px 12px rgba(0,0,0,0.18);z-index:20;display:flex;gap:10px;justify-content:center;flex-shrink:0;">
      <button class="btn blue" id="syn-chart">📊 TABLA DE DEBILIDADES</button>
      <button class="btn gray" id="syn-close">✖️ CERRAR</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#syn-close').onclick = () => ov.remove();
  ov.querySelector('#syn-chart').onclick = () => { ov.remove(); showTypeChartModal(team); };
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}

// Modal con la tabla de debilidades, efectos especiales y reglas de tags
function showTypeChartModal(team) {
  const rows = Object.keys(CHART).map(atk => {
    const strong = Object.entries(CHART[atk]).filter(([, m]) => m > 1).map(([t]) => `${TYPES[t].emoji} ${t}`).join(', ');
    const weak = Object.entries(CHART[atk]).filter(([, m]) => m < 1).map(([t]) => `${TYPES[t].emoji} ${t}`).join(', ');
    const note = CHART_NOTES[atk];
    return `<tr>
      <td><span class="type-badge" style="background:${TYPES[atk].color}">${TYPES[atk].emoji} ${atk.toUpperCase()}</span></td>
      <td style="color:var(--green);">${strong || '—'}</td>
      <td style="color:var(--red);">${weak || '—'}</td>
      <td style="font-size:7px;color:#666;">${note || ''}</td>
    </tr>`;
  }).join('');
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" style="display:flex;flex-direction:column;max-height:85vh;max-width:560px;position:relative;overflow:hidden;padding-bottom:0;">
    <h2 style="flex-shrink:0;">📊 Tabla de debilidades</h2>
    <div style="overflow-y:auto;flex:1;padding-right:4px;margin-bottom:6px;">
      <div style="overflow-x:auto;">
        <table class="chart-table">
          <tr><th>Atacante</th><th>+25% fuerte contra</th><th>-25% débil contra</th><th>Efecto especial</th></tr>
          ${rows}
        </table>
      </div>
      <div class="sheet-section" style="margin-top:10px;">
        <b>🍈👁️ Tags de Naturaleza</b>
        <p><b>FRUTA</b>: usuario de Fruta del Diablo · <b>HAKI</b>: capaz de imbuir Haki.<br><br>
        ⚖️ <b>Regla de equilibrio del juego (simplificación de la serie):</b> si el atacante NO tiene HAKI y el defensor tiene el tag FRUTA,
        el daño se reduce un <b>50%</b>. Si el atacante tiene HAKI (propio o por la sinergia Haki Ⅰ+),
        esta reducción se anula por completo.</p>
      </div>
      <div class="sheet-section">
        <b>📐 Categorías de daño</b>
        <p>⚔️👊🎯 Corte, Golpe y Disparo usan <b>ATQ</b> contra <b>DEF</b>.<br>
        El resto de tipos (elementales, Oscuridad, Haki y Fruta) usan <b>ESP_ATQ</b> contra <b>ESP_DEF</b>.<br>
        Base de todos: <b>EVA</b> ${Math.round(BASE_EVA * 100)}% · <b>CRIT</b> ${Math.round(BASE_CRIT * 100)}% (x${BASE_CRIT_DMG} de daño).</p>
      </div>
      <div class="sheet-section">
        <b>⚔️ Clímax de combate</b>
        <p>A partir de la ronda ${CLIMAX_ROUND} el daño de ambos bandos aumenta un <b>+10% acumulativo
        por ronda</b> y todas las curaciones (movimientos de apoyo y pasivas) pierden un <b>20% de eficacia
        por ronda</b> hasta anularse. Desde la ronda 30 ambos activos sufren desgaste creciente, incluso si esquivan. Si ambos bandos caen a la vez, pierdes el combate.</p>
      </div>
    </div>
    <div class="actions" style="background:var(--paper);padding:10px 18px;margin-left:-18px;margin-right:-18px;border-top:2px solid var(--ink);box-shadow:0 -4px 12px rgba(0,0,0,0.18);z-index:20;display:flex;gap:10px;justify-content:center;flex-shrink:0;">
      <button class="btn blue" id="tc-syn">🧩 SINERGIAS</button>
      <button class="btn gray" id="tc-close">✖️ CERRAR</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#tc-close').onclick = () => ov.remove();
  const synBtn = ov.querySelector('#tc-syn');
  if (synBtn) synBtn.onclick = () => { ov.remove(); showSynergyModal(team); };
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}

const CROSSOVER_ULTIMATES = {
  naruto: { name: 'Rasengan Shuriken', type: 'Viento', power: 140, acc: 0.9 },
  sasuke: { name: 'Kirin', type: 'Rayo', power: 140, acc: 0.9 },
  kakashi: { name: 'Raikiri', type: 'Rayo', power: 135, acc: 0.95 },
  itadori: { name: 'Kokusen (Destello Negro)', type: 'Golpe', power: 145, acc: 0.85 },
  yuta: { name: 'Amor Puro (Rika)', type: 'Corte', power: 140, acc: 0.9 },
  gojo: { name: 'Vacío Inconmensurable', type: 'Oscuridad', power: 150, acc: 0.85 },
  tanjiro: { name: 'Danza del Dios del Fuego', type: 'Fuego', power: 140, acc: 0.9 },
  zenitsu: { name: 'Respiración del Rayo: 7ª Postura', type: 'Rayo', power: 145, acc: 0.9 },
  inosuke: { name: 'Colmillo Desgarrador', type: 'Corte', power: 135, acc: 0.9 },
  nezuko: { name: 'Explosión de Sangre', type: 'Fuego', power: 135, acc: 0.9 },
  goku: { name: 'Kamehameha x10', type: 'Golpe', power: 145, acc: 0.85 },
  vegeta: { name: 'Final Flash', type: 'Rayo', power: 145, acc: 0.85 },
  gohan: { name: 'Kamehameha Padre e Hijo', type: 'Golpe', power: 150, acc: 0.85 },
  gokuui: { name: 'Doctrina Suprema', type: 'Haki', power: 160, acc: 0.9 },
  jiren: { name: 'Impacto de Poder', type: 'Golpe', power: 155, acc: 0.85 },
  cell: { name: 'Kamehameha Solar', type: 'Rayo', power: 150, acc: 0.85 },
  frieza: { name: 'Supernova', type: 'Oscuridad', power: 150, acc: 0.85 },
  zenosama: { name: 'Borrado Divino', type: 'Oscuridad', power: 180, acc: 0.95 },
  saitama: { name: 'Puñetazo Serio', type: 'Golpe', power: 200, acc: 0.95 },
  genos: { name: 'Cañón de Incineración', type: 'Fuego', power: 140, acc: 0.85 },
  garou: { name: 'Puño de Liberación del Agua', type: 'Golpe', power: 145, acc: 0.85 },
  tatsumaki: { name: 'Meteoro Psíquico', type: 'Viento', power: 145, acc: 0.85 },
  madara: { name: 'Tengai Shinsei', type: 'Tierra', power: 155, acc: 0.85 },
  orochimaru: { name: 'Técnica de la Serpiente de 8 Cabezas', type: 'Veneno', power: 140, acc: 0.9 },
  sukuna: { name: 'Expansión de Dominio: Santuario Malévolo', type: 'Corte', power: 160, acc: 0.9 },
  kibutsuji: { name: 'Látigos de Sangre Demoniaca', type: 'Veneno', power: 155, acc: 0.9 },
};

function getUltimateMove(f) {
  if (!f) return MOVES.punetazo;
  const base = baseFormOf(f.id);

  if (CROSSOVER_ULTIMATES[f.id]) return CROSSOVER_ULTIMATES[f.id];
  if (CROSSOVER_ULTIMATES[base]) return CROSSOVER_ULTIMATES[base];

  const c = CHARS[f.id] || CHARS[base];
  if (!c) return MOVES.punetazo;

  if (isP(f,'luffy')) return f.lvl >= 38 ? MOVES.kingkonggun : f.lvl >= 20 ? MOVES.jetgatling : MOVES.gatlinggoma;
  if (c.ultimate && MOVES[c.ultimate]) return MOVES[c.ultimate];
  if (c.learnset && c.learnset.length >= 3) {
    const highMove = c.learnset[c.learnset.length - 1][1];
    if (MOVES[highMove]) return MOVES[highMove];
  }

  const ownMoves = c.learnset.map(([,id]) => MOVES[id]).filter(m => m && m.power > 0);
  return ownMoves.sort((a,b) => b.power * b.acc - a.power * a.acc)[0] || MOVES.punetazo;
}

function useUltimate(f) {
  const b = battle;
  if (!b || b.over || !f || f.hp <= 0) return;
  const enemy = b.curE;
  if (!enemy || enemy.hp <= 0) return;
  if (f.lvl < 20) return toast(`🔒 Ultimate de ${charName(f)} desbloqueable a Nv20.`);
  if ((f.ultCharge || 0) < 100) return toast(`⚡ Ultimate de ${charName(f)} al ${Math.floor(f.ultCharge || 0)}% (golpea para cargar).`);

  f.ultCharge = 0;
  const ultMv = getUltimateMove(f);
  log(`💥 <b>¡DEFINITIVA DE ${charName(f).toUpperCase()}!</b> Desata <b>${ultMv.name}</b> 💥`);
  attackWith(f, enemy, ultMv, 'enemy');
  refreshHPCards();
}

function startBattle(enemies, opts) {
  playMusic('combat');
  const team = opts.tower ? tower.team : run.team;
  if (!team.some(f => f.hp > 0)) return opts.tower ? towerGameOver() : gameOver();
  if (autoMode) {
    autoSpeed = (autoSettings.speed === 'x1') ? 1 : 2;
  }
  battle = {
    pTeam: team, eTeam: enemies,
    items: opts.tower ? tower.items : run.items,
    opts, speed: autoSpeed, over: false, waiting: false,
    tower: !!opts.tower,
    timer: null,
    round: 1,
    switchUsed: false,
  };
  enemies.forEach(e => registerDex(e.id));
  // reinicia pasivas y estados por-combate
  [...battle.pTeam, ...battle.eTeam].forEach(f => {
    migrateFighter(f);
    f.dodgeLeft = passiveRule(f).dodge || 0;
    f.st = {}; // estados: burn (quemadura), poison (veneno), slow (ralentizado), gust (viento a favor)
  });
  battle.firstHit = { p: true, e: true }; // para Rayo Ⅱ: primer ataque crítico garantizado
  battle.curP = activeP();
  battle.curE = activeE();
  const e0 = enemies[0];
  const intro = opts.intro ||
    (opts.wild ? `¡Un ${charName(e0)} salvaje aparece!` :
      opts.boss ? `¡¡${charName(e0)} te cierra el paso!!` :
        `¡${charName(e0)} y sus secuaces quieren pelea!`);
  renderBattle([intro]);
  scheduleRound(900);
}

function hpBarClass(f) {
  const p = f.hp / f.maxhp;
  return p < 0.25 ? 'crit' : p < 0.5 ? 'low' : '';
}

// Iconos de estados alterados y tags de naturaleza
const stIcons = f => !f.st ? '' : [
  f.st.burn ? '🔥' : '', f.st.poison ? '☠️' : '',
  f.st.slow ? '🐌' : '', f.st.gust ? '💨' : '',
].join('');
const tagIcons = f => {
  const t = [];
  if (hasFruta(f)) t.push('<span title="Tag FRUTA: recibe -50% de daño de atacantes sin HAKI">🍈</span>');
  if (hasHaki(f)) t.push('<span title="Tag HAKI: sus golpes anulan la defensa pasiva de FRUTA">👁️</span>');
  return t.join('');
};

function fighterCardHTML(f, side, idx, active) {
  const c = charData(f);
  const ps = passiveInfo(f);
  const rarityTag = c.rareza ? `<span style="color:var(--gold);font-size:7.5px;" title="Rareza ${c.rareza} estrellas">${'⭐'.repeat(c.rareza)}</span>` : '';
  const fusionTag = f.stars ? `<span style="color:#ff6b6b;font-weight:bold;font-size:7.5px;" title="Fusión +${f.stars}">[+${f.stars}⭐]</span>` : '';
  const isUltUnlocked = f.lvl >= 20;
  const isUltReady = isUltUnlocked && (f.ultCharge || 0) >= 100;
  const ultPct = isUltUnlocked ? clamp(f.ultCharge || 0, 0, 100) : 0;

  const ultBarHTML = side === 'p' ? `
    <div class="ult-bar-wrap ${isUltUnlocked ? '' : 'locked'}" title="${isUltUnlocked ? 'Ultimate (' + Math.floor(ultPct) + '%)' : 'Desbloquea Ultimate a Nv20'}">
      ${isUltUnlocked ? `<div class="ult-bar" style="width:${ultPct}%"></div>` : '<div class="ult-bar-text">🔒 ULTI A NV20</div>'}
    </div>` : '';

  return `<div class="fcard ${f.hp <= 0 ? 'ko' : ''} ${f === active ? 'active' : ''} ${isUltReady ? 'ult-ready' : ''}" id="fc-${side}-${idx}">
    <div class="fcard-title">${c.name} ${rarityTag} ${fusionTag} Nv${f.lvl} <span class="fcard-tags">${tagIcons(f)}</span><span class="fcard-st">${stIcons(f)}</span></div>
    <div class="fcard-hp">
      <div class="hp-bar"><i class="${hpBarClass(f)}" style="width:${clamp(f.hp / f.maxhp * 100, 0, 100)}%"></i></div>
      <div class="hp-nums">${f.hp}/${f.maxhp}</div>
    </div>
    <div class="fcard-meters">${side === 'p' ? xpBarHTML(f) : ''}${ultBarHTML}</div>
    <div class="fcard-stats-mini" style="font-size:7.5px;color:#eee;text-align:center;margin:2px 0;background:rgba(0,0,0,0.3);padding:2px 4px;border-radius:3px;">
      ⚔️ ATQ ${f.atk} · 🛡️ DEF ${f.def} · ⚡ VEL ${f.spd}
    </div>
    <div class="fcard-sprite" data-character="${f.id}">
      <span class="sprite ${side === 'e' ? 'flip' : ''}">${charIcon(f.id, 64)}</span>
      <div class="platform"></div>
    </div>
    ${ps ? `<div class="fcard-passive ${ps.active ? 'on' : ''}" title="${ps.desc}">✨ ${ps.label}</div>` : ''}
  </div>`;
}

function showBattleCrew() {
  const b = battle;
  if (!b || b.over) return;
  const wasWaiting = b.waiting;
  pauseBattle();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal battle-crew-modal"><h2>👥 Bandas en combate</h2>
    ${[['Tu banda',b.pTeam,b.curP],['Enemigos',b.eTeam,b.curE]].map(([label,team,active],side)=>`
      <h3>${label}</h3>${team.map((f,index)=>`<button class="battle-crew-row" data-crew-side="${side}" data-crew-index="${index}">
        ${charIcon(f.id,36)}<span><b>${charName(f)}</b> · Nv${f.lvl}<small>${f.hp}/${f.maxhp} PS · ${f.hp <= 0 ? 'Fuera de combate' : f === active ? 'Activo' : 'En reserva'}</small></span><span>ℹ️</span>
      </button>`).join('')}`).join('')}
    <div class="actions"><button class="btn green" data-close-crew>VOLVER AL COMBATE</button></div></div>`;
  document.body.appendChild(ov);
  let closed = false;
  const close = () => { if (closed) return; closed = true; ov.remove(); if (battle === b && !b.over && !wasWaiting) resumeBattle(); };
  ov.querySelector('[data-close-crew]').onclick = close;
  ov.querySelectorAll('[data-crew-index]').forEach(button => {
    button.onclick = () => showCharModal((button.dataset.crewSide === '0' ? b.pTeam : b.eTeam)[Number(button.dataset.crewIndex)]);
  });
  ov.onclick = event => { if (event.target === ov) close(); };
}

function controlsHTML() {
  const b = battle;
  let html = '';
  for (const id of ['carne', 'carnereal', 'bocadillo', 'sake']) {
    if (b.items[id] > 0) html += `<button class="btn small blue" data-ctl="item" data-arg="${id}" title="${ITEMS[id].name}">${ITEMS[id].emoji} ×${b.items[id]}</button>`;
  }
  html += `<button class="btn small gray battle-crew-button" data-ctl="crew">👥 BANDAS</button>`;
  html += `<button class="btn small gray" data-ctl="speed" title="Atajo: barra espaciadora">⏩ VELOCIDAD x${b.speed}</button>`;
  html += `<button class="btn small gray" data-ctl="info">🧩 SINERGIAS Y TIPOS</button>`;
  if (b.opts.wild && !b.tower) html += `<button class="btn small red" data-ctl="run">🏃 HUIR</button>`;
  if (b.tower) html += `<button class="btn small red" data-ctl="quit">🏳️ RENDIRSE</button>`;
  return html;
}

function switchBattleFighter(index) {
  const b = battle;
  const next = b?.pTeam[index];
  if (!b || b.over || b.waiting || b.switchUsed || !next || next.hp <= 0 ||
      next === b.curP || b.curP?.hp <= 0 || b.curE?.hp <= 0) return false;
  b.switchUsed = true;
  const previous = b.curP;
  b.curP = next;
  log(`🔄 ${charName(previous)} se retira. ¡Adelante, ${charName(next)}! Relevo utilizado.`);
  renderBattlePreserveLog();
  return true;
}

function reservesHTML() {
  const b = battle;
  return `<div class="battle-reserve-heading">🏴‍☠️ TU TRIPULACIÓN <span>${b.switchUsed ? 'Relevo usado · 0/1' : 'Toca una reserva · 1 relevo disponible'}</span></div>
    <div class="battle-reserve-list">${b.pTeam.map((f, index) => {
      const active = f === b.curP;
      const disabled = active || f.hp <= 0 || b.switchUsed || b.over || b.waiting || b.curP?.hp <= 0 || b.curE?.hp <= 0;
      return `<button class="battle-reserve ${active ? 'is-active' : ''} ${f.hp <= 0 ? 'is-ko' : ''}" data-reserve="${index}" ${disabled ? 'disabled' : ''} aria-label="${active ? 'Activo' : 'Relevar con'} ${charName(f)}, ${f.hp}/${f.maxhp} PS">
        ${charIcon(f.id, 80)}<b>${charName(f)}</b>
        <span class="hp-bar"><i class="${hpBarClass(f)}" style="width:${clamp(f.hp / f.maxhp * 100, 0, 100)}%"></i></span>
        <small>${f.hp}/${f.maxhp} PS · ${f.hp <= 0 ? 'KO' : active ? 'Activo' : 'Reserva'}</small>
      </button>`;
    }).join('')}</div>`;
}

function refreshReserves() {
  const el = $('#battle-reserves');
  if (!el) return;
  el.innerHTML = reservesHTML();
  el.querySelectorAll('[data-reserve]').forEach(button => {
    button.onclick = () => switchBattleFighter(Number(button.dataset.reserve));
  });
}

function renderBattle(logLines) {
  const b = battle;
  const eHead = b.opts.wild ? '🌊' : b.opts.boss ? '💀' : '⚓';
  render(`
    ${topbar(!b.tower)}
    <div class="battle-layout">
      <div class="battle-main">
        <div class="battle-cols" style="--scene:url('${b.tower ? '/art/scenes/marineford.webp' : (SAGAS[run?.saga || 0]?.img || '/art/scenes/eastblue.webp')}')">
          <div class="battle-side" id="side-p">
            <div class="side-head"><div class="trainer">🏴‍☠️</div>TU BANDA
              <div class="syn-chips" id="syn-p">${synChipsHTML(b.pTeam)}</div>
            </div>
            ${b.pTeam.map((f, i) => fighterCardHTML(f, 'p', i, b.curP)).join('')}
          </div>
          <div class="battle-side" id="side-e">
            <div class="side-head"><div class="trainer">${eHead}</div>${b.opts.wild ? 'SALVAJE' : 'ENEMIGO'}
              <div class="syn-chips" id="syn-e">${synChipsHTML(b.eTeam)}</div>
            </div>
            ${b.eTeam.map((f, i) => fighterCardHTML(f, 'e', i, b.curE)).join('')}
          </div>
        </div>
        <div class="battle-reserves" id="battle-reserves"></div>
        <div class="battle-log" id="battle-log">${logLines.map(l => `<div>${l}</div>`).join('')}</div>
      </div>
      <div class="battle-sidebar" id="battle-controls">${controlsHTML()}</div>
    </div>
  `);
  bindControls();
  refreshReserves();
  // En combate: las cartas enemigas muestran su ficha; las cartas aliadas activan la Ultimate si está lista
  [['p', b.pTeam], ['e', b.eTeam]].forEach(([side, team]) => {
    team.forEach((f, i) => {
      const card = $(`#fc-${side}-${i}`);
      if (card) {
        card.onclick = () => {
          if (side === 'e') {
            showCharModal(f);
          } else {
            if (f === b.curP) {
              if (f.lvl >= 20 && (f.ultCharge || 0) >= 100) {
                useUltimate(f);
              } else if (f.lvl < 20) {
                toast(`🔒 Ultimate de ${charName(f)} desbloqueable a Nv20.`);
              } else {
                toast(`⚡ Ultimate de ${charName(f)} al ${Math.floor(f.ultCharge || 0)}% (golpea para cargar).`);
              }
            } else {
              toast(`⚡ Solo el nakama activo (${charName(b.curP)}) puede lanzar su Ultimate.`);
            }
          }
        };
      }
    });
  });
  keepActiveFightersVisible();
}

function renderBattlePreserveLog() {
  const logEl = $('#battle-log');
  const lines = logEl ? [...logEl.children].map(c => c.innerHTML) : [];
  renderBattle(lines);
}

function refreshControls() {
  const el = $('#battle-controls');
  if (el) { el.innerHTML = controlsHTML(); bindControls(); }
}

function log(msg) {
  const el = $('#battle-log');
  if (!el) return;
  const d = document.createElement('div');
  d.innerHTML = msg;
  el.appendChild(d);
  while (el.children.length > 5) el.removeChild(el.firstChild);
}

function keepActiveFightersVisible() {
  for (const id of ['side-p','side-e']) {
    const side = document.getElementById(id);
    const active = side?.querySelector('.fcard.active');
    if (!active?.getBoundingClientRect || side.scrollHeight <= side.clientHeight) continue;
    const cardBox = active.getBoundingClientRect(), sideBox = side.getBoundingClientRect();
    if (cardBox.top < sideBox.top) side.scrollTop += cardBox.top - sideBox.top - 8;
    else if (cardBox.bottom > sideBox.bottom) side.scrollTop += cardBox.bottom - sideBox.bottom + 8;
  }
}

function refreshHPCards() {
  if (!battle) return;
  [['p', battle.pTeam, battle.curP], ['e', battle.eTeam, battle.curE]].forEach(([side, team, active]) => {
    team.forEach((f, i) => {
      const card = $(`#fc-${side}-${i}`);
      if (!card) return;
      const bar = card.querySelector('.hp-bar i');
      bar.style.width = clamp(f.hp / f.maxhp * 100, 0, 100) + '%';
      bar.className = hpBarClass(f);
      card.querySelector('.hp-nums').textContent = `${f.hp}/${f.maxhp}`;
      card.classList.toggle('ko', f.hp <= 0);
      card.classList.toggle('active', f === active);
      const isUltUnlocked = f.lvl >= 20;
      const isUltReady = isUltUnlocked && (f.ultCharge || 0) >= 100;
      card.classList.toggle('ult-ready', isUltReady);
      const ultBar = card.querySelector('.ult-bar');
      if (ultBar) ultBar.style.width = clamp(f.ultCharge || 0, 0, 100) + '%';
      const xpEl = card.querySelector('.xp-progress');
      if (xpEl) xpEl.outerHTML = xpBarHTML(f);
      const stEl = card.querySelector('.fcard-st');
      if (stEl) stEl.textContent = stIcons(f);
      const pEl = card.querySelector('.fcard-passive');
      if (pEl && passiveInfo(f)) {
        const ps = passiveInfo(f);
        pEl.textContent = `✨ ${ps.label}`;
        pEl.classList.toggle('on', ps.active);
      }
    });
  });
  const sp = $('#syn-p'); if (sp) sp.innerHTML = synChipsHTML(battle.pTeam);
  const se = $('#syn-e'); if (se) se.innerHTML = synChipsHTML(battle.eTeam);
  refreshReserves();
  keepActiveFightersVisible();
}

// Elige automáticamente el mejor movimiento según potencia, precisión, tipos y categoría
function chooseMove(att, dfd) {
  let best = null, bestScore = 0;
  for (const m of att.moves) {
    const mv = MOVES[m];
    if (!mv) continue;
    if (mv.power === 0) {
      if (mv.effect === 'heal40' && att.hp < att.maxhp * .45 && healScaleNow() > 0 &&
          (battle?.round || 1) >= (att.st?.supportReady || 0)) return mv;
      if (['atkup','defup'].includes(mv.effect) && !att.st?.[mv.effect] && (battle?.round || 1) === 1) return mv;
      continue;
    }
    // Mismo cálculo que el ataque real, sin consumir números aleatorios.
    const score = calcDamage(att, dfd, mv, false, 0.925).dmg * mv.acc;
    if (score > bestScore) { bestScore = score; best = mv; }
  }
  // Un espadachín puede recurrir a un golpe básico contra Bara Bara.
  // También rescata partidas antiguas con dos ataques inmunes o de apoyo.
  return best || (isP(att,'sanji') ? MOVES.patada : MOVES.punetazo);
}

// ---------- Críticos y evasión ----------
function critChanceFor(att) {
  let c = BASE_CRIT + (passiveRule(att).critical || 0);
  // Pasiva Zoro: crítico creciente con el PS faltante
  if (isP(att, 'zoro')) c += 0.25 * (1 - att.hp / Math.max(1, att.maxhp));
  if (isP(att, 'mihawk')) c += 0.15;
  if (isP(att, 'oden')) c += 0.10;
  const team = teamOf(att);
  if (synergyTier(team, 'Corte') === 2) c += 0.10;
  const tD = synergyTier(team, 'Disparo');
  if (tD) c += tD === 2 ? 0.20 : 0.10;
  if (synergyTier(team, 'Haki') === 2) c += 0.10;
  return Math.min(.75, c);
}
function critDmgFor(att) {
  let m = BASE_CRIT_DMG;
  if (isP(att, 'oden')) m += 0.20;
  if (isP(att, 'saitama')) m += 0.50;
  const tC = synergyTier(teamOf(att), 'Corte');
  if (tC) m += tC === 2 ? 0.35 : 0.15;
  return m;
}
function evaChanceFor(dfd) {
  let e = BASE_EVA + (passiveRule(dfd).evasion || 0);
  // Pasiva Nami: +10% de evasión de equipo
  if (teamOf(dfd).some(x => x.hp > 0 && isP(x, 'nami'))) e += 0.10;
  if (teamOf(dfd).some(x => x.hp > 0 && isP(x, 'dragon'))) e += 0.15;
  if (isP(dfd, 'smoker')) e += 0.20;
  const tV = synergyTier(teamOf(dfd), 'Viento');
  if (tV) e += tV === 2 ? 0.18 : 0.08;
  return Math.min(.60, e);
}

function calcDamage(att, dfd, mv, crit, variance) {
  const phys = isPhysType(mv.type);
  let eff = typeMult(mv.type, fighterTypes(dfd));
  // Pasiva Buggy: inmune al daño de espadas
  if (isP(dfd, 'buggy') && mv.type === 'Corte') eff = 0;
  if (isP(dfd, 'luffy') && mv.type === 'Rayo') eff = 0;
  const atkTeam = teamOf(att), defTeam = teamOf(dfd);
  // Categoría: físico usa ATQ vs DEF; especial usa ESP_ATQ vs ESP_DEF
  let atkStat = (phys ? att.atk : att.spatk) * nakamaStatMult(atkTeam);
  let defStat = (phys ? dfd.def : dfd.spdef) * nakamaStatMult(defTeam);
  const ar = passiveRule(att), dr = passiveRule(dfd);
  atkStat *= ar.attack || 1;
  defStat *= dr.defense || 1;
  if (ar.lowAttack && att.hp < att.maxhp * ar.threshold) atkStat *= ar.lowAttack;
  if (ar.hitAttack && att.st?.receivedHit) atkStat *= ar.hitAttack;
  if (att.st?.atkup) atkStat *= 1.20;
  if (dfd.st?.defup) defStat *= 1.20;
  // Pasiva Luffy: +15% ATQ por debajo del 50% de PS
  if (isP(att, 'luffy') && att.hp < att.maxhp * 0.5) atkStat *= 1.15;
  if (isP(att, 'newgate') && att.hp < att.maxhp * 0.5) atkStat *= 1.25;
  if (isP(att, 'garp') && phys) defStat *= 0.70;
  if (isP(dfd, 'kaido')) defStat *= 1.20;
  if (teamOf(dfd).some(x => x.hp > 0 && isP(x, 'shanks'))) atkStat *= 0.85;
  if (isP(att, 'frieza') && dfd.hp < dfd.maxhp * 0.5) atkStat *= 1.20;
  // Veneno: daño neutral que ignora el 20% de la defensa
  if (mv.type === 'Veneno') defStat *= 0.8;
  // Golpe Ⅱ: los ataques físicos rompen un 15% de la DEF rival
  if (phys && synergyTier(atkTeam, 'Golpe') === 2) defStat *= 0.85;
  // Tierra: +15/+30% de DEF física
  const tT = synergyTier(defTeam, 'Tierra');
  if (phys && tT) defStat *= tT === 2 ? 1.30 : 1.15;
  // Agua Ⅱ y Fruta Ⅱ: +15% de ESP_DEF
  if (!phys && synergyTier(defTeam, 'Agua') === 2) defStat *= 1.15;
  if (!phys && synergyTier(defTeam, 'Fruta') === 2) defStat *= 1.15;
  // Estado Veneno: el envenenado pierde un 20% de ESP_DEF
  if (!phys && dfd.st && dfd.st.poison) defStat *= 0.8;
  // Efectos de daño por tag FRUTA
  if (mv.type === 'Agua' && hasFruta(dfd)) eff *= 1.5;
  if (mv.type === 'Oscuridad' && hasFruta(dfd)) eff *= 1.35;

  const base = ((2 * att.lvl / 5 + 2) * mv.power * atkStat / Math.max(1, defStat)) / 50 + 2;
  const r = variance ?? (0.85 + Math.random() * 0.15);
  let dmg = base * eff * r;
  dmg *= (phys ? ar.physical : ar.special) || 1;
  dmg *= ar.types?.[mv.type] || 1;
  dmg *= dr.reduction || 1;
  if (dr.dryReduction && mv.type !== 'Agua') dmg *= dr.dryReduction;
  if (crit) dmg *= critDmgFor(att);
  // Sinergias de daño del atacante
  const tGolpe = synergyTier(atkTeam, 'Golpe');
  if (phys && tGolpe) dmg *= tGolpe === 2 ? 1.25 : 1.12;
  const tFuego = synergyTier(atkTeam, 'Fuego');
  if (mv.type === 'Fuego' && tFuego) dmg *= tFuego === 2 ? 1.25 : 1.12;
  const tHielo = synergyTier(atkTeam, 'Hielo');
  if (mv.type === 'Hielo' && tHielo) dmg *= tHielo === 2 ? 1.20 : 1.10;
  if (mv.type === 'Veneno' && synergyTier(atkTeam, 'Veneno')) dmg *= 1.10;
  const tOsc = synergyTier(atkTeam, 'Oscuridad');
  if (tOsc && hasFruta(dfd)) dmg *= tOsc === 2 ? 1.25 : 1.10;
  const tFru = synergyTier(atkTeam, 'Fruta');
  if (!phys && tFru) dmg *= tFru === 2 ? 1.25 : 1.12;
  const tHaki = synergyTier(atkTeam, 'Haki');
  if (tHaki) dmg *= tHaki === 2 ? 1.18 : 1.08;
  // Pasivas de daño de 5 estrellas
  if (teamOf(att).some(x => x.hp > 0 && isP(x, 'roger'))) dmg *= 1.20;
  if (isP(dfd, 'kaido')) dmg *= 0.85;
  if (isP(att, 'teach') && hasFruta(dfd)) dmg *= 1.25;
  if (isP(att, 'akainu') && mv.type === 'Fuego') dmg *= 1.20;
  if (isP(att, 'saitama') && phys) dmg *= 1.35;
  if (isP(att, 'sukuna') && mv.type === 'Corte') dmg *= 1.20;
  if (isP(att, 'zenosama')) dmg *= 1.25;
  // Pasiva Sanji: reduce el daño recibido un 15%
  if (isP(dfd, 'sanji')) dmg *= 0.85;
  // Regla núcleo de tags: sin HAKI contra un usuario FRUTA, -50% de daño
  let frutaGuard = false;
  if (hasFruta(dfd) && !hasHaki(att)) { dmg *= FRUTA_NOHAKI_MULT; frutaGuard = true; }
  // Clímax de combate: el daño escala en rondas avanzadas
  dmg *= climaxDmgMult();
  dmg = Math.max(1, Math.floor(dmg));
  if (eff === 0) dmg = 0;
  return { dmg, eff, frutaGuard };
}

function popDamage(who, text, color) {
  // localiza la carta activa del lado golpeado
  const side = who === 'enemy' ? 'e' : 'p';
  const team = side === 'e' ? battle.eTeam : battle.pTeam;
  const active = side === 'e' ? battle.curE : battle.curP;
  const idx = team.indexOf(active);
  const card = $(`#fc-${side}-${idx}`);
  const sprite = card && card.querySelector('.fcard-sprite');
  if (!sprite) return;
  const rect = sprite.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'dmg-pop';
  p.style.left = (rect.left + rect.width / 2 - 10) + 'px';
  p.style.top = (rect.top - 10) + 'px';
  p.style.position = 'fixed';
  if (color) p.style.color = color;
  p.textContent = text;
  document.body.appendChild(p);
  sprite.classList.add('shake');
  setTimeout(() => { p.remove(); sprite.classList.remove('shake'); }, 800);
}

function attackWith(att, dfd, mv, targetSide) {
  if (!mv) return; // guardia: sin movimiento válido, se salta el ataque
  const attName = charName(att);
  if (mv.power === 0 && mv.effect) {
    att.st ||= {};
    if (mv.effect === 'heal40') {
      if ((battle.round || 1) < (att.st.supportReady || 0)) return;
      att.st.supportReady = (battle.round || 1) + 3;
      const heal = Math.min(att.maxhp - att.hp, Math.floor(40 * healScaleNow()));
      if (heal > 0) {
        att.hp = Math.min(att.maxhp, att.hp + heal);
        log(`${attName} usa ${mv.name} y recupera ${heal} PS.`);
      } else {
        log(`${attName} usa ${mv.name}... ¡pero el Clímax de combate anula la curación! ⚔️`);
      }
    }
    if (['atkup','defup'].includes(mv.effect)) {
      att.st[mv.effect] = true;
      log(`${attName} usa ${mv.name}: +20% de ${mv.effect === 'atkup' ? 'ataque' : 'defensa'} hasta el final del combate (no acumulable).`);
    }
    refreshHPCards();
    return;
  }
  // Pasiva Katakuri: esquiva los 2 primeros ataques del combate
  if ((dfd.dodgeLeft || 0) > 0) {
    dfd.dodgeLeft--;
    log(`${charName(dfd)} esquiva el ataque. ✨ (${passiveRule(dfd).name})`);
    refreshHPCards();
    return;
  }
  // Precisión del movimiento
  if (Math.random() > mv.acc) {
    log(`${attName} usa ${mv.name}... ¡pero falla!`);
    return;
  }
  const b = battle;
  const sideKey = b.pTeam.includes(att) ? 'p' : 'e';
  // Crítico (se decide antes de la esquiva: Disparo Ⅱ hace los críticos imparables)
  let crit = Math.random() < critChanceFor(att);
  if (synergyTier(teamOf(att), 'Rayo') === 2 && b.firstHit[sideKey]) crit = true; // Rayo Ⅱ
  b.firstHit[sideKey] = false;
  if (isP(dfd, 'franky')) crit = false; // Armadura Frontal
  if (crit && synergyTier(teamOf(dfd), 'Tierra') === 2) { crit = false; log(`⛰️ ¡Baluarte! El crítico rebota en la defensa de ${charName(dfd)}.`); }
  // Esquiva (EVA)
  let eva = evaChanceFor(dfd);
  if (synergyTier(teamOf(att), 'Haki') === 2) eva = 0; // Haki Ⅱ anula la EVA rival
  if (crit && synergyTier(teamOf(att), 'Disparo') === 2) eva = 0; // Disparo Ⅱ
  if (Math.random() < eva) {
    log(`¡${charName(dfd)} esquiva ${mv.name}! 💨`);
    if (synergyTier(teamOf(dfd), 'Viento') === 2) {
      dfd.st.gust = 2;
      log(`💨 ¡Ligereza! ${charName(dfd)} gana +20% de VEL.`);
    }
    return;
  }
  const { dmg, eff, frutaGuard } = calcDamage(att, dfd, mv, crit);
  if (eff === 0) {
    log(`${attName} usa <b>${mv.name}</b>... ¡pero no le afecta! ✨`);
    return;
  }
  dfd.hp = Math.max(0, dfd.hp - dmg);
  dfd.st ||= {};
  if (dmg > 0) dfd.st.receivedHit = true;
  if (passiveRule(att).slow) dfd.st.slow = 2;
  // Recarga de Ultimate al golpear al enemigo (para personajes de nivel base >= 20)
  if (att && att.lvl >= 20 && b.pTeam.includes(att)) {
    att.ultCharge = Math.min(100, (att.ultCharge || 0) + 34);
  }
  let txt = `${attName} usa <b>${mv.name}</b>. `;
  if (crit) txt += '¡Golpe crítico! ';
  if (eff > 1) txt += '¡Es súper eficaz! ';
  else if (eff < 1) txt += 'No es muy eficaz... ';
  if (frutaGuard) txt += '🍈 La Fruta amortigua el golpe. ';
  log(txt + `(-${dmg} PS)`);
  popDamage(targetSide, `-${dmg}`, crit || eff > 1 ? '#c43a2f' : eff < 1 ? '#888' : undefined);
  // Efectos al golpear
  const atkTeam = teamOf(att), defTeam = teamOf(dfd);
  // Fuego Ⅱ: los críticos infligen Quemadura (3% PS por turno)
  if (crit && synergyTier(atkTeam, 'Fuego') === 2 && !dfd.st.burn) {
    dfd.st.burn = 3;
    log(`🔥 ¡${charName(dfd)} sufre una Quemadura!`);
  }
  // Hielo Ⅱ: los ataques ralentizan (-15% VEL, 1 turno)
  if (synergyTier(atkTeam, 'Hielo') === 2) dfd.st.slow = 2;
  // Veneno Ⅱ: 25% de probabilidad de envenenar con cualquier ataque
  if (synergyTier(atkTeam, 'Veneno') === 2 && !dfd.st.poison && Math.random() < 0.25) {
    dfd.st.poison = true;
    log(`☠️ ¡${charName(dfd)} ha sido envenenado!`);
  }
  // Viento: propaga el 20% del daño al siguiente enemigo en la fila
  if (mv.type === 'Viento' && dmg > 0) {
    const next = defTeam.find(x => x !== dfd && x.hp > 0);
    if (next) {
      const splash = Math.max(1, Math.floor(dmg * 0.2));
      next.hp = Math.max(0, next.hp - splash);
      log(`💨 La ráfaga alcanza también a ${charName(next)} (-${splash} PS).`);
    }
  }
  refreshHPCards();
}

function scheduleRound(delay) {
  if (!battle || battle.over) return;
  clearTimeout(battle.timer);
  battle.timer = setTimeout(runRound, (delay == null ? 1200 : delay) / battle.speed);
}

function effectiveSpeed(f) {
  const rule = passiveRule(f);
  let speed = f.spd * nakamaStatMult(teamOf(f)) * (rule.speed || 1);
  const tier = synergyTier(teamOf(f), 'Rayo');
  if (tier) speed *= tier === 2 ? 1.40 : 1.20;
  if (f.st?.slow) speed *= .85;
  if (f.st?.gust) speed *= 1.20;
  if (rule.lowSpeed && f.hp < f.maxhp * .5) speed *= rule.lowSpeed;
  if (rule.openingSpeed && battle.round === 1) speed *= rule.openingSpeed;
  const foe = battle.pTeam.includes(f) ? battle.curE : battle.curP;
  if (foe?.hp > 0) speed *= passiveRule(foe).foeSpeed || 1;
  return speed;
}

function runRound() {
  const b = battle;
  if (!b || b.over || b.waiting) return;
  if (autoMode) runAutoItems();
  const p = b.curP, e = b.curE;
  if (!p || !e || p.hp <= 0 || e.hp <= 0) return afterRound();

  // Modo auto: tira la Ultimate automáticamente si está cargada
  if (autoMode && p.lvl >= 20 && (p.ultCharge || 0) >= 100) {
    useUltimate(p);
  }

  const pSpd = effectiveSpeed(p), eSpd = effectiveSpeed(e);
  const order = pSpd >= eSpd
    ? [[p, e, 'enemy'], [e, p, 'player']]
    : [[e, p, 'player'], [p, e, 'enemy']];
  let i = 0;
  const step = () => {
    if (battle !== b || b.over) return;
    if (battle.waiting) { battle.pendingStep = step; return; }
    if (i < order.length) {
      const side = order[i++][2];
      // Preserve this round's turn order; a manual relay changes its actors, not its number of attacks.
      const att = side === 'enemy' ? b.curP : b.curE;
      const dfd = side === 'enemy' ? b.curE : b.curP;
      if (att.hp > 0 && dfd.hp > 0) attackWith(att, dfd, chooseMove(att, dfd), side);
      setTimeout(step, 900 / battle.speed);
    } else {
      afterRound();
    }
  };
  step();
}

function afterRound() {
  const b = battle;
  if (!b || b.over) return;
  // Daño residual de estados y expiración de contadores
  for (const f of [b.curP, b.curE]) {
    if (!f || !f.st) continue;
    if (f.hp > 0 && f.st.burn) {
      const d = Math.max(1, Math.floor(f.maxhp * 0.03));
      f.hp = Math.max(0, f.hp - d);
      log(`🔥 ${charName(f)} sufre quemaduras (-${d} PS).`);
      if (--f.st.burn <= 0) delete f.st.burn;
    }
    if (f.hp > 0 && f.st.poison) {
      const d = Math.max(1, Math.floor(f.maxhp * 0.04));
      f.hp = Math.max(0, f.hp - d);
      log(`☠️ ${charName(f)} sufre el veneno (-${d} PS).`);
    }
    if (f.st.slow && --f.st.slow <= 0) delete f.st.slow;
    if (f.st.gust && --f.st.gust <= 0) delete f.st.gust;
  }
  // Resolución simultánea: nadie revive por drenaje ni ataca tras caer.
  const actors = [b.curP, b.curE];
  const hpDelta = actors.map((act, i) => {
    if (!act || act.hp <= 0) return 0;
    const team = teamOf(act), foe = actors[1-i];
    if (!foe || foe.hp <= 0) return 0;
    const drain = Math.min(foe.hp, Math.floor(foe.maxhp * (passiveRule(act).drain || 0)));
    let heal = passiveRule(act).regen || 0;
    if (team.some(x => x.hp > 0 && isP(x,'marco'))) heal += .06;
    if (team.some(x => x.hp > 0 && isP(x,'kibutsuji'))) heal += .05;
    if (team.some(x => x.hp > 0 && isP(x,'ryokugyu'))) heal += .05;
    const water = synergyTier(team,'Agua');
    if (water) heal += water === 2 ? .08 : .04;
    const blocked = synergyTier(teamOf(foe),'Oscuridad') === 2;
    return {drain, heal:blocked ? 0 : Math.floor((heal * act.maxhp + drain) * healScaleNow())};
  });
  actors.forEach((act,i) => {
    if (!act || act.hp <= 0) return;
    act.hp = Math.max(0, Math.min(act.maxhp, act.hp + (hpDelta[i].heal || 0)) - (hpDelta[1-i].drain || 0));
    // Límite independiente de precisión, inmunidades y azar: desgaste de ambos activos.
    if (b.round >= 30 && act.hp > 0) {
      const fatigue = Math.max(1, Math.ceil(act.maxhp * Math.min(.5, .05 * (b.round - 29))));
      act.hp = Math.max(0, act.hp - fatigue);
      log(`⚔️ Desgaste: ${charName(act)} pierde ${fatigue} PS.`);
    }
  });
  const checkRevive = f => {
    if (!f || f.hp > 0) return;
    const isPlayer = b.pTeam.includes(f) || (run && run.team && run.team.includes(f));
    if (isPlayer && run && run.mode === 'nuzlocke' && !b.tower) return; // En Nuzlocke los aliados no sobreviven ni reviven
    if (isP(f, 'brook') && !f.reviveUsed) {
      f.reviveUsed = true;
      f.hp = Math.max(1, Math.floor(f.maxhp * 0.2));
      log(`✨ ¡Segunda Vida! ${charName(f)} se niega a morir. ¡Yohohoho!`);
      return;
    }
    const guardTeam = teamOf(f).map(ally => ally === f ? {...ally, hp:1} : ally);
    if (synergyTier(guardTeam, 'Nakama') === 2) {
      const used = isPlayer
        ? (b.tower ? tower && tower.nakamaGuardUsed : run && run.nakamaGuardUsed)
        : b.eGuardUsed;
      if (!used) {
        if (isPlayer) { if (b.tower && tower) tower.nakamaGuardUsed = true; else if (run) { run.nakamaGuardUsed = true; saveRun(); } }
        else b.eGuardUsed = true;
        f.hp = 1;
        log(`🏴‍☠️ ¡Espíritu de Tripulación! ${charName(f)} resiste con 1 PS.`);
      }
    }
  };
  [...b.pTeam, ...b.eTeam].forEach(checkRevive);
  const deadE = b.curE.hp <= 0, deadP = b.curP.hp <= 0;
  let changed = false;

  b.rewarded ||= new Set();
  for (const defeated of b.eTeam.filter(f => f.hp <= 0 && !b.rewarded.has(f))) {
    b.rewarded.add(defeated);
    meta.stats ||= {kills:0,items:0};
    meta.stats.kills = (meta.stats.kills || 0) + 1;
    saveMeta();
    log(`¡${charName(defeated)} cae derrotado!`);
    // registro de vencidos en historia (habilita comprarlos en el mercado clandestino)
    if (run && !b.tower && !meta.defeated.includes(defeated.id)) {
      meta.defeated.push(defeated.id);
      saveMeta();
    }
    // Recompensa de Log Poses al derrotar enemigos en historia
    if (run && !b.tower) {
      const sagaIdx = run.saga || 0;
      const isBossEnemy = !!charData(defeated).boss || b.opts.boss;
      const logPosesWon = isBossEnemy ? (sagaIdx + 3) : (sagaIdx + 1);
      meta.logPoses = (meta.logPoses || 0) + logPosesWon;
      saveMeta();
      log(`🧭 ¡Consigues ${logPosesWon} Log Pose! (Total: ${meta.logPoses})`);
    }
    const xp = Math.floor(defeated.lvl * 14 * (charData(defeated).boss ? 1.6 : 1) * (b.opts.xpMult || 1));
    log(`¡Toda la banda gana ${xp} EXP!`);
    b.pTeam.forEach(f => { if (f.hp > 0) gainXP(f, xp, log); });
    changed = true;
  }
  if (run && run.mode === 'nuzlocke' && !b.tower) {
    for (let i = run.team.length - 1; i >= 0; i--) {
      if (run.team[i].hp <= 0) {
        const deadF = run.team[i];
        log(`☠️ ${charName(deadF)} ha caído en combate y abandona la banda para siempre...`);
        run.team.splice(i, 1);
        changed = true;
      }
    }
    saveRun();
  } else if (deadP) {
    log(`¡${charName(b.curP)} está debilitado!`);
    changed = true;
  }

  const ne = activeE(), np = activeP();
  if (!ne && np) {
    b.over = true;
    return setTimeout(() => endBattle(true), 1300 / b.speed);
  }
  if (!np) {
    b.over = true;
    return setTimeout(() => b.tower ? towerGameOver() : gameOver(), 1300 / b.speed);
  }
  if (deadE && ne !== b.curE) { registerDex(ne.id); log(`¡${charName(ne)} entra en combate!`); }
  if (deadP && np !== b.curP) log(`¡Adelante, ${charName(np)}!`);
  b.curE = ne; b.curP = np;
  // Avance de ronda y aviso del Clímax de combate
  b.round = (b.round || 1) + 1;
  if (b.round === CLIMAX_ROUND + 1) {
    log('⚔️ <b>¡Clímax de combate!</b> El daño aumenta cada ronda y las curaciones flaquean.');
  } else if (b.round > CLIMAX_ROUND + 1) {
    const pct = Math.round((climaxDmgMult() - 1) * 100);
    const hs = Math.round(healScaleNow() * 100);
    log(`⚔️ Clímax: +${pct}% de daño · curaciones al ${hs}%.`);
  }
  if (changed) renderBattlePreserveLog();
  else refreshHPCards();
  scheduleRound(changed ? 1800 : 1400);
}

// --- Intervenciones del jugador durante el combate automático ---
function bindControls() {
  document.querySelectorAll('[data-ctl]').forEach(btn => {
    btn.onclick = () => {
      const b = battle;
      if (!b || b.over) return;
      const kind = btn.dataset.ctl, arg = btn.dataset.arg;
      if (kind === 'crew') { showBattleCrew(); return; }
      if (kind === 'speed') {
        cycleBattleSpeed();
        return;
      }
      if (kind === 'info') {
        // consulta informativa: no pausa el combate automático
        showSynergyModal(b.pTeam);
        return;
      }
      if (kind === 'quit') {
        modalConfirm('🏳️ ¿Rendirse en la torre?',
          'Terminarás tu ascenso en el piso actual.<br>Conservas la Fama ganada por los pisos superados.',
          () => { if (battle) { battle.over = true; clearTimeout(battle.timer); } towerGameOver(); });
        return;
      }
      if (b.waiting) return;
      if (kind === 'item') {
        useBattleItem(arg);
      } else if (kind === 'run') {
        pauseBattle();
        tryFlee();
      }
    };
  });
}

function cycleBattleSpeed() {
  const b = battle;
  if (!b || b.over) return;
  b.speed = { 1: 2, 2: 4, 4: 1 }[b.speed] || 1;
  autoSpeed = b.speed;
  refreshControls();
}

// Atajo de teclado: la barra espaciadora cambia el multiplicador de velocidad en combate
document.addEventListener('keydown', e => {
  if (e.code !== 'Space' && e.key !== ' ') return;
  const t = e.target;
  if (t && (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(t.tagName) || t.isContentEditable)) return;
  if (!battle || battle.over) return;
  e.preventDefault(); // evita el scroll de página y "pulsar" el botón enfocado
  cycleBattleSpeed();
});

function pauseBattle() {
  battle.waiting = true;
  clearTimeout(battle.timer);
}

function resumeBattle(delay) {
  const b = battle;
  if (!b || b.over) return;
  b.waiting = false;
  refreshControls();
  if (b.pendingStep) { const s = b.pendingStep; b.pendingStep = null; setTimeout(s, 500 / b.speed); }
  else scheduleRound(delay == null ? 900 : delay);
}

function useBattleItem(id) {
  const item = ITEMS[id];
  const b = battle;
  if (item.kind === 'heal') {
    const f = b.curP;
    if (f.hp >= f.maxhp) return toast('PS al máximo.');
    b.items[id]--;
    f.hp = Math.min(f.maxhp, f.hp + item.val);
    log(`Usas ${item.name}. ${charName(f)} recupera PS. ${item.emoji}`);
    refreshHPCards();
  } else if (item.kind === 'revive') {
    if (run && run.mode === 'nuzlocke' && !b.tower) return toast('En Nuzlocke no hay resurrecciones.');
    const f = b.pTeam.find(x => x.hp <= 0);
    if (!f) return toast('Nadie está debilitado.');
    b.items[id]--;
    f.hp = Math.floor(f.maxhp * item.val);
    log(`¡${charName(f)} vuelve a la lucha! 🍶`);
  }
  refreshControls();
}

function tryFlee() {
  if (Math.random() < 0.7) {
    log('¡Escapas del combate!');
    battle.over = true;
    setTimeout(() => endBattle(false, true), 900);
  } else {
    log('¡No consigues escapar!');
    resumeBattle();
  }
}

function endBattle(victory, fled, recruited) {
  if (battle && battle.tower) { battle = null; return endTowerBattle(victory); }
  const opts = battle ? battle.opts : {};
  battle = null;
  if (run && run.mode === 'nuzlocke') {
    run.team = run.team.filter(f => f && f.hp > 0);
  }
  const notes = [];
  if (victory) {
    // cada enfrentamiento ganado sube 1 nivel completo a toda la banda viva
    run.team.forEach(f => { if (f.hp > 0) gainXP(f, Math.max(0, xpForLevel(f.lvl) - f.xp)); });
    notes.push('⬆️ +1 nivel a la banda');
  }
  if (victory && opts.reward) {
    run.berries += opts.reward;
    notes.push(`+${berriesHTML(opts.reward)}`);
  } else if (victory && opts.wild && !recruited) {
    const b = rnd(40, 110) * (run.islandIdx + 1);
    run.berries += b;
    notes.push(`+${berriesHTML(b)}`);
  }
  if (notes.length) toast(notes.join(' · '));
  if (victory && opts.crossover) {
    gainFame(30);
    saveRun();
    return crossoverReward(opts.crossover);
  }
  if (victory && opts.boss) {
    run.badges.push(run.islandIdx);
    const newVets = unlockRoster(true);
    if (newVets.length > 0) {
      toast(`🎉 ¡${newVets.map(id => CHARS[id] ? CHARS[id].name : id).join(', ')} desbloqueado/s para tu plantilla permanente!`);
    }
    gainFame(20);
    const saga = SAGAS[run.saga];
    // Al vencer al jefe de la isla (en modo Clásico), toda la banda (incluyendo caídos) se recupera al 100% de PS
    run.team.forEach(f => { f.hp = f.maxhp; });
    if (run.islandIdx >= saga.islands.length - 1) {
      saveRun();
      const diffLevel = (run && run.diff) || 1;
      if (diffLevel === 5) {
        return offerCrossoverPath(newVets);
      }
      return sagaComplete();
    }
    run.islandIdx++;
    run.map = genMap(saga.islands[run.islandIdx]);
    run.pos = null;
    saveRun();
    modalInfo('🏅 ¡Emblema conseguido!',
      `<div class="reward-list">¡Has conquistado la isla!<br>+20 ⭐ Fama<br><br>Rumbo a <b>${saga.islands[run.islandIdx].name}</b> 🧭<br>Tu equipo se recupera durante la travesía.${newVets.length ? `<br><br><small>🏅 Veteranos desbloqueados para futuras aventuras:<br>${newVets.map(id => `${charIcon(id, 16)} ${CHARS[id].name}`).join(' · ')}</small>` : ''
      }</div>`,
      screenMap);
    return;
  }
  saveRun();
  screenMap();
}

// ============ EVENTO: CROSSOVER DE ANIME (SOLO REY PIRATA) ============
// Tras el combate del jefe final en Dificultad Rey Pirata se abre un camino alternativo
// con un rival reforzado (+50% Daño y Defensa). Al vencerlo, eliges 1 de 3 personajes de 4⭐
// (o un Boss de 5⭐ si ya tienes todos los de 4⭐).
function offerCrossoverPath(newVets) {
  const rows = run.map.rows;
  const last = rows[rows.length - 1];
  if (!(last && last[0] && last[0].type === 'crossover')) {
    const bossR = rows.length - 1;
    rows.push([{ r: bossR + 1, i: 0, type: 'crossover', done: false }]);
    run.map.edges.push([bossR, 0, bossR + 1, 0]);
    saveRun();
  }
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>🏅 ¡Último emblema conseguido!</h2>
    <p style="font-size:9px;text-align:center;line-height:1.9;margin-bottom:10px;">
      Has vencido al último capitán de la saga. +20 ⭐ Fama<br>
      ${newVets && newVets.length ? `<small>🏅 Veteranos desbloqueados: ${newVets.map(id => CHARS[id].name).join(' · ')}</small><br>` : ''}
      <br>Pero al recoger el emblema en Dificultad Rey Pirata, el aire vibra... Un <b>camino alternativo</b> 🌀
      aparece donde antes no había salida.<br><br>
      Puedes explorarlo (te espera un rival de otro mundo, <b>mucho más fuerte (+50% stats)</b>...
      ¡y una recompensa Crossover!) o zarpar y conquistar la saga sin arriesgarte.</p>
    <div class="actions" style="flex-direction:column;align-items:stretch;">
      <button class="btn gold" id="cx-explore">🌀 EXPLORAR EL CAMINO</button>
      <button class="btn green" id="cx-finish">🏴‍☠️ CONQUISTAR LA SAGA</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  if (autoMode) {
    scheduleAutoStep(() => {
      const btn = ov.querySelector('#cx-explore');
      if (btn && document.body.contains(ov)) btn.click();
    }, 700);
  }
  ov.querySelector('#cx-explore').onclick = () => { ov.remove(); screenMap(); };
  ov.querySelector('#cx-finish').onclick = () => { ov.remove(); sagaComplete(); };
}

function doCrossoverEvent(island) {
  const keys = Object.keys(CROSSOVER_SERIES);
  let uncompleted = keys.filter(k => CROSSOVER_SERIES[k].rewards.some(id => !meta.recruited.includes(id) && !meta.roster.includes(id)));
  if (!uncompleted.length) uncompleted = keys;
  const key = pick(uncompleted);
  const s = CROSSOVER_SERIES[key];
  // el aire dimensional reconforta: la banda consciente recupera un 50% de PS
  run.team.forEach(f => { if (f.hp > 0) f.hp = Math.min(f.maxhp, f.hp + Math.floor(f.maxhp * 0.5)); });
  saveRun();
  const lvl = island.bossLvl[island.bossLvl.length - 1] + 1;
  const bossId = pick(s.bosses);
  const escorts = s.bosses.filter(id => id !== bossId)
    .sort(() => Math.random() - 0.5)
    .slice(0, rnd(0, 2));
  const enemies = escorts.map(id => makeChar(id, Math.max(5, lvl - 2)));
  const boss = makeChar(bossId, lvl);
  // el jefe del crossover recibe +50% en Daño y Defensa
  ['atk', 'def', 'spatk', 'spdef'].forEach(k => { boss[k] = Math.floor(boss[k] * (1 + CROSSOVER_BOOST)); });
  enemies.push(boss);
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>🌀 Grieta dimensional</h2>
    <div class="special-card">
      <div class="big-emoji">${CHARS[bossId].emoji}</div>
      <div class="char-name">${CHARS[bossId].name} <small>Nv${lvl}</small></div>
      <div class="special-stars">${s.emoji} ${s.name}</div>
    </div>
    <p style="font-size:9px;text-align:center;line-height:1.9;margin-bottom:10px;">
      El camino sin salida era una grieta entre mundos:<br>
      ¡personajes de <b>${s.name}</b> ${s.emoji} han cruzado a este mar!<br><br>
      Su líder llega reforzado: <b>+${Math.round(CROSSOVER_BOOST * 100)}% de Daño y Defensa</b>.<br>
      Si lo derrotas, podrás reclutar a <b>1 héroe de 4⭐</b> (o Boss 5⭐ si los tienes todos).<br>
      <small>(Tu banda ha recuperado un 50% de PS con el aire dimensional.)</small></p>
    <div class="actions" style="flex-direction:column;align-items:stretch;">
      <button class="btn red" id="cx-fight">⚔️ ACEPTAR EL DUELO</button>
      <button class="btn gray" id="cx-leave">🌊 RETIRARSE Y CONQUISTAR LA SAGA</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  if (autoMode) {
    scheduleAutoStep(() => {
      const btn = ov.querySelector('#cx-fight');
      if (btn && document.body.contains(ov)) btn.click();
    }, 700);
  }
  ov.querySelector('#cx-fight').onclick = () => {
    ov.remove();
    startBattle(enemies, {
      wild: false, crossover: key,
      intro: `🌀 ¡${CHARS[bossId].name} bloquea el camino entre mundos!`,
    });
  };
  ov.querySelector('#cx-leave').onclick = () => { ov.remove(); sagaComplete(); };
}

// Recompensa del crossover: pantalla para elegir 1 de 3 personajes (4⭐ o 5⭐ Boss si tiene todos de 4⭐)
function crossoverReward(key) {
  const s = CROSSOVER_SERIES[key];
  const island = SAGAS[run.saga].islands[run.islandIdx];
  const lvl = island.bossLvl[island.bossLvl.length - 1];

  const c4Series = s.rewards.filter(id => CHARS[id] && CHARS[id].rareza === 4);
  let pending4 = c4Series.filter(id => !meta.roster.includes(id));

  if (!pending4.length) {
    const c4All = Object.keys(CHARS).filter(id => CHARS[id].saga === 'crossover' && CHARS[id].rareza === 4);
    pending4 = c4All.filter(id => !meta.roster.includes(id));
  }

  let pool = [];
  let isBossReward = false;

  if (pending4.length > 0) {
    const shuffled = [...pending4].sort(() => Math.random() - 0.5);
    pool = shuffled.slice(0, Math.min(3, shuffled.length));
  } else {
    isBossReward = true;
    const c5Series = s.bosses.filter(id => CHARS[id] && (CHARS[id].rareza === 5 || CHARS[id].boss));
    let pending5 = c5Series.filter(id => !meta.roster.includes(id));
    if (!pending5.length) {
      const c5All = Object.keys(CHARS).filter(id => CHARS[id].saga === 'crossover' && (CHARS[id].rareza === 5 || CHARS[id].boss));
      pending5 = c5All.filter(id => !meta.roster.includes(id));
    }
    if (!pending5.length) pending5 = s.bosses;
    const shuffled = [...pending5].sort(() => Math.random() - 0.5);
    pool = shuffled.slice(0, Math.min(3, shuffled.length));
  }

  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>🎁 RECOMPENSA DE CROSSOVER ${isBossReward ? '(5⭐ BOSS)' : '(4⭐)'}</h2>
    <p style="font-size:9px;text-align:center;line-height:1.9;margin-bottom:10px;">
      ${isBossReward
      ? `🔥 ¡Victoria en el duelo de <b>${s.name}</b>! Ya tienes todos los personajes de 4⭐.<br>Elige a 1 <b>Boss Crossover de 5⭐</b> (+30 ⭐ Fama):`
      : `🌀 ¡Victoria en el duelo de <b>${s.name}</b> ${s.emoji}!<br>Elige a 1 personaje Crossover (4⭐) para tu banda (+30 ⭐ Fama):`}
    </p>
    <div class="pick-grid">
      ${pool.map(id => {
        const c = CHARS[id];
        return `<div class="pick-row" data-pick="${id}">
          <span class="emoji">${c.emoji}</span>
          <div class="info"><b>${c.name}</b> ${'⭐'.repeat(c.rareza)} · Nv${lvl}<br><small style="color:var(--accent);">${c.types.join(' / ')}</small></div>
          <span style="font-size:8px;color:var(--green);font-weight:bold;">RECLUTAR</span>
        </div>`;
      }).join('')}
    </div>
  </div>`;
  document.body.appendChild(ov);
  if (autoMode) {
    scheduleAutoStep(() => {
      const picks = ov.querySelectorAll('[data-pick]');
      if (picks.length && document.body.contains(ov)) {
        const p = pick([...picks]);
        p.click();
      }
    }, 700);
  }

  ov.querySelectorAll('[data-pick]').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.pick;
      ov.remove();
      if (!meta.roster.includes(id)) meta.roster.push(id);
      if (!meta.recruited.includes(id)) meta.recruited.push(id);
      if (!meta.dex.includes(id)) meta.dex.push(id);
      saveMeta();
      const recLvl = Math.max(1, Math.floor(lvl * 0.85));
      const f = applyUpgrades(makeChar(id, recLvl));
      addToTeam(f, ok => {
        if (ok) {
          modalInfo('🎉 ¡Nuevo nakama legendario!',
            `<div class="reward-list"><span style="font-size:34px;">${CHARS[id].emoji}</span><br><b>${CHARS[id].name}</b> (${CHARS[id].rareza}⭐) Nv${recLvl} se une a tu banda<br>y queda desbloqueado como veterano.</div>`,
            sagaComplete);
        } else {
          modalInfo('🌊 Se desvanece',
            '<div class="reward-list">El héroe regresa a su mundo con un saludo...</div>',
            sagaComplete);
        }
      });
    };
  });
}

function sagaComplete() {
  autoMode = false;
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  playMusic('menu');
  const saga = SAGAS[run.saga];
  const diffLevel = (run && run.diff) || 1;
  const dObj = DIFFICULTIES.find(d => d.id === diffLevel) || DIFFICULTIES[0];

  if (run.mode === 'nuzlocke') meta.nuzWins[saga.id] = (meta.nuzWins[saga.id] || 0) + 1;
  else meta.wins[saga.id] = (meta.wins[saga.id] || 0) + 1;

  if ((run.team && run.team.length === 1) || run.isSolo) {
    meta.soloWins = (meta.soloWins || 0) + 1;
  }

  const isAllNakamas = run.team && run.team.length > 0 && run.team.every(f => {
    const c = CHARS[f.id];
    return c && (c.nakama || STRAW_HAT_MEMBERS.includes(f.id));
  });
  if (isAllNakamas) {
    meta.allNakamaWins = (meta.allNakamaWins || 0) + 1;
  }

  meta.sagaDiffWins = meta.sagaDiffWins || {};
  meta.sagaDiffWins[saga.id] = meta.sagaDiffWins[saga.id] || {};

  const isFirstDiffWin = !meta.sagaDiffWins[saga.id][diffLevel];
  meta.sagaDiffWins[saga.id][diffLevel] = true;

  const baseFame = 500;
  let fameWon = 0;
  let rewardMessage = '';

  if (isFirstDiffWin) {
    fameWon = Math.round(baseFame * dObj.mult);
    rewardMessage = `<div style="color:var(--green);font-size:9px;margin-top:6px;">🎉 ¡Primera victoria en Dificultad ${dObj.emoji} ${dObj.name}! Recompensa completa: +${fameWon} ⭐ Fama</div>`;
  } else {
    fameWon = Math.round(baseFame * dObj.mult * 0.2);
    rewardMessage = `<div style="color:var(--accent);font-size:8px;margin-top:6px;">⚠️ Ya habías conquistado esta saga en Dificultad ${dObj.name}. Recompensa reducida: +${fameWon} ⭐ Fama.<br>¡Cambia a otra dificultad para ganar la recompensa completa!</div>`;
  }

  gainFame(fameWon);

  // Guarda la banda completa (incluyendo legendarios/jefes) en meta.roster
  const addedLegendaries = unlockRoster(true);
  saveMeta();

  const team = run.team;
  clearRun();
  render(`
    ${topbar(false)}
    <div class="panel" style="text-align:center;">
      <h2>🏴‍☠️ ¡SAGA CONQUISTADA!</h2>
      <p style="margin:14px 0;">¡Has derrotado a todos los capitanes del ${saga.name} en Dificultad <b>${dObj.emoji} ${dObj.name}</b>!<br>
      Tu banda ya es leyenda en este mar.<br><br>
      <span style="font-size:30px;">${team.map(f => charIcon(f.id, 38)).join(' ')}</span><br><br>
      ${team.map(f => `${charName(f)}${f.stars ? ` ⭐${f.stars}` : ''} Nv${f.lvl}`).join(' · ')}<br><br>
      ${rewardMessage}</p>
      <p style="font-size:9px;color:#666;margin-bottom:14px;">Tus nakamas ${addedLegendaries.length ? '(¡incluyendo legendarios!) ' : ''}quedan disponibles como veteranos para próximas aventuras.<br></p>
      <button class="btn green" id="btn-fin">VOLVER AL PUERTO</button>
    </div>
  `);
  $('#btn-fin').onclick = screenHome;
}

function gameOver() {
  autoMode = false;
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  playMusic('dead');
  battle = null;
  const wasNuz = run && run.mode === 'nuzlocke';
  const consuelo = run ? run.badges.length * 10 : 0;
  if (consuelo) gainFame(consuelo);
  clearRun();
  render(`
    ${topbar(false)}
    <div class="panel" style="text-align:center;">
      <h2>☠️ FIN DEL VIAJE</h2>
      <p style="margin:14px 0;">Toda tu banda ha sido derrotada.<br>
      ${wasNuz ? 'Las reglas Nuzlocke no perdonan...' : 'El mar es implacable, pero siempre puedes volver a zarpar.'}
      ${consuelo ? `<br><br>Tu hazaña no se olvida: +${consuelo} ⭐ Fama` : ''}</p>
      <button class="btn red" id="btn-fin">VOLVER AL PUERTO</button>
    </div>
  `);
  $('#btn-fin').onclick = screenHome;
}

// ============ TORRE MARINE ============
let tower = null;
function screenTowerIntro() {
  playMusic('menu');
  // Solo puedes llevar nakamas desbloqueados: iniciales básicos + tus veteranos
  const pool = [...new Set([...SAGAS[0].starters, ...meta.roster])].filter(id => CHARS[id]);
  const picked = [];
  const start50 = !!(meta.global && meta.global.tower_start50);
  const startFloor = start50 ? 50 : 1;
  const startLvl = start50 ? 65 : 15;
  render(`
    ${topbar(false)}
    <button class="btn gray small back-btn" id="btn-back">← VOLVER</button>
    <div class="panel">
      <h2>🗼 Torre Marine ${start50 ? '<span style="color:var(--gold);font-size:12px;">(Piso 50)</span>' : ''}</h2>
      <p>Combates automáticos infinitos contra oleadas cada vez más fuertes.
      Elige a <b>3 nakamas desbloqueados</b> (salen a Nv.${startLvl}, con sus mejoras del Barco)
      y recibe 3 Platos de Sanji. ${start50 ? '<b>¡Inicias tu ascenso directamente en el Piso 50!</b>' : '¿Hasta qué piso llegarás?'}</p>
      <p style="margin-top:10px;">Récord actual: <b>${meta.towerRecord}</b> pisos</p>
      <div class="pick-grid" style="margin-top:12px;">
        ${pool.map(id => {
    const c = CHARS[id];
    return `<div class="pick-row" data-tower="${id}">
            <span class="emoji">${charIcon(id, 22)}</span>
            <div class="info"><b>${c.name}</b> ${'⭐'.repeat(c.rareza)}<br><small>${c.types.join(' / ')}</small></div>
            <span class="tower-check" style="font-size:12px;"></span>
          </div>`;
  }).join('')}
      </div>
      <div class="actions" style="text-align:center;margin-top:14px;">
        <button class="btn blue" id="btn-start" disabled>ELIGE 3 NAKAMAS (0/3)</button>
      </div>
    </div>
  `);
  $('#btn-back').onclick = screenHome;
  const startBtn = $('#btn-start');
  document.querySelectorAll('[data-tower]').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.tower;
      const i = picked.indexOf(id);
      if (i >= 0) picked.splice(i, 1);
      else if (picked.length < 3) picked.push(id);
      document.querySelectorAll('[data-tower]').forEach(r => {
        r.querySelector('.tower-check').textContent = picked.includes(r.dataset.tower) ? '✅' : '';
      });
      startBtn.disabled = picked.length !== 3;
      startBtn.textContent = picked.length === 3 ? '¡SUBIR A LA TORRE!' : `ELIGE 3 NAKAMAS (${picked.length}/3)`;
    };
  });
  startBtn.onclick = () => {
    if (picked.length !== 3) return;
    tower = { floor: startFloor, team: picked.map(id => applyUpgrades(makeChar(id, startLvl))), items: { bocadillo: 3, sake: 1 } };
    towerNextBattle();
  };
}

function towerNextBattle() {
  // sin formas evolucionadas ni personajes del crossover (solo salen en su evento)
  const pool = Object.keys(CHARS).filter(id => !BASE_OF[id] && CHARS[id].saga !== 'crossover');
  const lvl = 13 + tower.floor * 2;
  const isBossFloor = tower.floor % 5 === 0;
  const bossIds = Object.keys(CHARS).filter(id => CHARS[id].boss && CHARS[id].saga !== 'crossover');
  const id = isBossFloor ? pick(bossIds) : pick(pool);
  const enemy = makeChar(id, lvl + (isBossFloor ? 2 : 0));
  startBattle([enemy], {
    wild: false, tower: true,
    intro: `🗼 Piso ${tower.floor} — ¡${CHARS[id].name} te desafía!`,
  });
}

function endTowerBattle(victory) {
  if (!victory) return towerGameOver();
  tower.team.forEach(f => {
    if (f.hp > 0) {
      gainXP(f, Math.max(0, xpForLevel(f.lvl) - f.xp)); // +1 nivel por piso
      gainXP(f, 30 + tower.floor * 6);
      f.hp = Math.min(f.maxhp, f.hp + Math.floor(f.maxhp * 0.3));
    }
  });
  tower.floor++;
  if (tower.floor % 3 === 0) tower.items.bocadillo = (tower.items.bocadillo || 0) + 1;
  towerNextBattle();
}

function towerGameOver() {
  playMusic('dead');
  battle = null;
  const floors = tower ? tower.floor - 1 : 0;
  if (floors > meta.towerRecord) meta.towerRecord = floors;
  const fameWon = floors * 5;
  gainFame(fameWon);
  render(`
    ${topbar(false)}
    <div class="panel" style="text-align:center;">
      <h2>🗼 Expulsado de la torre</h2>
      <p style="margin:14px 0;">Llegaste al piso <b>${floors}</b>.<br>
      ${floors >= meta.towerRecord && floors > 0 ? '🎉 ¡Nuevo récord!' : `Récord: ${meta.towerRecord}`}
      ${fameWon ? `<br><br>+${fameWon} ⭐ Fama` : ''}</p>
      <button class="btn blue" id="btn-fin">VOLVER AL PUERTO</button>
    </div>
  `);
  tower = null;
  $('#btn-fin').onclick = screenHome;
}

// ============ TIENDA GLOBAL (mejoras + añadidos macro) ============
// Añadidos macro: se compran con Fama y se desbloquean por nivel de cuenta.
const GLOBAL_ITEMS = {
  berriesplus: { name: 'Fondo de expedición I', emoji: '💰', desc: '+200 Berries al zarpar en cada aventura.', cost: 250, lvl: 2, chain: 'berries', tier: 1 },
  berriesplus2: { name: 'Fondo de expedición II', emoji: '💰', desc: '+400 Berries al zarpar.', cost: 600, lvl: 6, req: 'berriesplus', chain: 'berries', tier: 2 },
  berriesplus3: { name: 'Fondo de expedición III', emoji: '💰', desc: '+700 Berries al zarpar.', cost: 1200, lvl: 10, req: 'berriesplus2', chain: 'berries', tier: 3 },
  cartelesplus: { name: 'Imprenta de carteles I', emoji: '📜', desc: '+2 Carteles de Recluta al zarpar.', cost: 300, lvl: 3, chain: 'carteles', tier: 1 },
  cartelesplus2: { name: 'Imprenta de carteles II', emoji: '📜', desc: '+4 Carteles de Recluta al zarpar.', cost: 700, lvl: 7, req: 'cartelesplus', chain: 'carteles', tier: 2 },
  carneplus: { name: 'Suministro de Carne (2 Carnes)', emoji: '🍖', desc: 'Comienza la aventura con 2 Carnes 🍖 al zarpar.', cost: 200, lvl: 2, chain: 'food', tier: 1 },
  carneplus2: { name: 'Suministro de Carne (3 Carnes)', emoji: '🍖', desc: 'Comienza la aventura con 3 Carnes 🍖 al zarpar.', cost: 400, lvl: 4, req: 'carneplus', chain: 'food', tier: 2 },
  food_carnereal1: { name: 'Banquete de Carne Real I (1 Carne Real)', emoji: '🍗', desc: 'Comienza la aventura con 1 Carne Real 🍗 al zarpar.', cost: 650, lvl: 6, req: 'carneplus2', chain: 'food', tier: 3 },
  food_carnereal2: { name: 'Banquete de Carne Real II (2 Carnes Reales)', emoji: '🍗', desc: 'Comienza la aventura con 2 Carnes Reales 🍗 al zarpar.', cost: 950, lvl: 8, req: 'food_carnereal1', chain: 'food', tier: 4 },
  food_carnereal3: { name: 'Banquete de Carne Real III (3 Carnes Reales)', emoji: '🍗', desc: 'Comienza la aventura con 3 Carnes Reales 🍗 al zarpar.', cost: 1300, lvl: 10, req: 'food_carnereal2', chain: 'food', tier: 5 },
  food_sake1: { name: 'Sake de Binks I (1 Sake)', emoji: '🍶', desc: 'Comienza la aventura con 1 Sake de Binks 🍶 al zarpar.', cost: 1800, lvl: 12, req: 'food_carnereal3', chain: 'food', tier: 6 },
  food_sake2: { name: 'Sake de Binks II (2 Sakes)', emoji: '🍶', desc: 'Comienza la aventura con 2 Sakes de Binks 🍶 al zarpar.', cost: 2400, lvl: 14, req: 'food_sake1', chain: 'food', tier: 7 },
  food_sake3: { name: 'Sake de Binks III (3 Sakes)', emoji: '🍶', desc: 'Comienza la aventura con 3 Sakes de Binks 🍶 al zarpar.', cost: 3200, lvl: 16, req: 'food_sake2', chain: 'food', tier: 8 },
  tower_start50: { name: 'Comienzo Épico en Torre Marine', emoji: '🗼', desc: 'Comienza tus ascensos en la Torre Marine directamente en el Piso 50 (luchadores a Nv.65).', cost: 2000, lvl: 80 },
};

function nextStarterSlotItem() {
  const current = starterSlotsCount();
  if (current >= 6) {
    return {
      id: 'starter_slot_max',
      maxed: true,
      name: 'Tamaño Máximo Alcanzado (6 Nakamas)',
      emoji: '👥',
      desc: 'Has alcanzado el límite máximo de 6 nakamas iniciales (tamaño completo de la banda).',
      cost: 0,
      lvl: 0,
    };
  }
  const nextN = current + 1;
  const cost = 600 * Math.pow(2, nextN - 2);
  const lvlReq = 5 + (nextN - 2) * 3;
  const names = ['', '', 'Dúo inicial (2 casillas)', 'Trío inicial (3 casillas)', 'Cuarteto inicial (4 casillas)', 'Quinteto inicial (5 casillas)', 'Sexteto inicial (6 casillas)'];
  return {
    id: `starter_slot_${nextN}`,
    nextN,
    name: names[nextN] || `Casilla inicial ${nextN}`,
    emoji: '👥',
    desc: `Zarpa con ${nextN} nakamas iniciales a la vez en el modo historia.`,
    cost,
    lvl: lvlReq,
  };
}

function maxUpgLvl() {
  let tier = meta.global.veteranLimitTier || 0;
  if (!meta.global.veteranLimitTier) {
    if (meta.global.shipcap3) tier = 3;
    else if (meta.global.shipcap2) tier = 2;
    else if (meta.global.shipcap1) tier = 1;
  }
  return 10 + tier * 5;
}

function nextCapitaniaItem() {
  const curMax = maxUpgLvl();
  const nextMax = curMax + 5;
  const tier = (curMax - 10) / 5;
  const cost = Math.floor(600 * Math.pow(1.7, tier));
  const lvlReq = 4 + tier * 2;
  return {
    id: `stat_limit_${nextMax}`,
    curMax,
    nextMax,
    name: `Límite de Stats de Veteranos (+5 Nv)`,
    emoji: '⚓',
    desc: `Aumenta el límite máximo de entrenamiento de stats en el barco de Nv.${curMax} a Nv.${nextMax}.`,
    cost,
    lvl: lvlReq,
  };
}

const UPG_STATS = [
  ['hp', 'PS', '+6 PS máx.'],
  ['atk', 'ATQ', '+2 ATQ'],
  ['def', 'DEF', '+2 DEF'],
  ['spatk', 'E.ATQ', '+2 E.ATQ'],
  ['spdef', 'E.DEF', '+2 E.DEF'],
  ['spd', 'VEL', '+2 VEL'],
];
let shipBuyLock = 0;
let shipSearchQ = '';
let shipExpanded = {};
let shipSagaExpanded = {};
function groupUpgradeRoster(ids) {
  const groups = [...SAGAS.map(s => ({id:s.id,name:s.name})), {id:'crossover',name:'CROSSOVER'}, {id:'other',name:'OTROS'}];
  const known = new Set(groups.map(g => g.id));
  return groups.map(g => ({...g,ids:ids.filter(id => {
    const saga = CHARS[id]?.saga;
    return (known.has(saga) ? saga : 'other') === g.id;
  })})).filter(g => g.ids.length);
}

function upgCost(lvl) { return (Math.floor(lvl / 2) + 1) * 30; }

function charTotalUpgSpent(id) {
  const u = meta.upgrades[id] || {};
  let total = 0;
  for (const [st] of UPG_STATS) {
    const lvl = u[st] || 0;
    for (let i = 0; i < lvl; i++) {
      total += upgCost(i);
    }
  }
  return total;
}

function showSellStatsConfirmModal(id, spent, refund, onConfirm) {
  const c = CHARS[id];
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" style="max-width:420px;text-align:center;">
    <h2 style="color:var(--red);margin-bottom:8px;">⚠️ Vender Mejoras de ${c.name}</h2>
    <div style="font-size:9.5px;line-height:1.7;color:#333;margin:12px 0;background:rgba(0,0,0,0.04);padding:12px;border-radius:6px;border:1px solid #ddd;">
      Has invertido un total de <b style="color:var(--gold);">⭐${spent} Fama</b> en los atributos de <b>${c.name}</b>.<br><br>
      Si vendes sus mejoras de golpe:<br>
      • <b>Todos sus stats volverán a Nv.0.</b><br>
      • Recibirás únicamente la mitad del coste gastado (50%):<br>
      <span style="font-size:16px;color:var(--green);font-weight:bold;display:block;margin-top:6px;">+⭐${refund} Fama</span>
    </div>
    <div class="actions" style="margin-top:14px;display:flex;gap:10px;justify-content:center;">
      <button class="btn gray" id="sell-cancel">CANCELAR</button>
      <button class="btn red" id="sell-confirm">💰 VENDER TODO (⭐+${refund})</button>
    </div>
  </div>`;
  document.body.appendChild(ov);

  ov.querySelector('#sell-cancel').onclick = () => ov.remove();
  ov.querySelector('#sell-confirm').onclick = () => {
    ov.remove();
    onConfirm();
  };
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}

function screenShip() {
  playMusic('menu');
  const roster = meta.roster.filter(id => CHARS[id]);
  const accLvl = accountLevel();
  const maxLvl = maxUpgLvl();
  const nextSlot = nextStarterSlotItem();
  const nextCap = nextCapitaniaItem();

  const availableGlobals = [];
  const chains = {};

  Object.entries(GLOBAL_ITEMS).forEach(([id, it]) => {
    if (it.chain) {
      chains[it.chain] = chains[it.chain] || [];
      chains[it.chain].push([id, it]);
    } else {
      if (!it.req || meta.global[it.req]) {
        availableGlobals.push([id, it]);
      }
    }
  });

  Object.values(chains).forEach(itemList => {
    itemList.sort((a, b) => (a[1].tier || 0) - (b[1].tier || 0));
    const nextUnbought = itemList.find(([id]) => !meta.global[id]);
    if (nextUnbought) {
      availableGlobals.push(nextUnbought);
    } else {
      const last = itemList[itemList.length - 1];
      availableGlobals.push(last);
    }
  });

  const q = (shipSearchQ || '').trim().toLowerCase();
  const filteredRoster = roster.filter(id => {
    if (!q) return true;
    return CHARS[id].name.toLowerCase().includes(q);
  });

  render(`
    ${topbar(false)}
    <button class="btn gray small back-btn" id="btn-back">← VOLVER</button>
    <div class="panel">
      <h2>🏪 Tienda</h2>
      <p style="font-size:9px;line-height:1.9;">Gasta ⭐ Fama en mejoras permanentes.
      La Fama se gana con emblemas (+20), sagas (+100 / +150 en Nuzlocke), pisos de la Torre (+5), Luffy Run (+25 cada 1.000 m)
      e incluso derrotas honrosas — y cada punto también da PX de cuenta.</p>
      <div style="text-align:center;font-size:12px;margin:12px 0;color:var(--accent);">
        ⭐ ${meta.fame} Fama · 👤 Cuenta Nv${accLvl} (${meta.accXp || 0}/${accountNextAt()} PX)
      </div>

      <h2 style="font-size:11px;">👥 Casillas de Nakamas Iniciales</h2>
      <div class="global-upg-row ${nextSlot.maxed ? 'owned' : accLvl < nextSlot.lvl ? 'locked' : ''}">
        <span class="upg-emoji">${nextSlot.emoji}</span>
        <div class="upg-details">
          <div class="upg-head">
            <b class="upg-name">${nextSlot.name}</b>
            ${nextSlot.maxed ? '' : `<span class="price">⭐${nextSlot.cost}</span>`}
          </div>
          <div class="upg-desc">${nextSlot.desc} (Actualmente: ${starterSlotsCount()}/6 casillas)</div>
        </div>
        <div class="upg-action">
          ${nextSlot.maxed ? `<span class="upg-badge bought">✓ MÁXIMO (6/6)</span>`
      : accLvl < nextSlot.lvl ? `<span class="upg-badge locked">🔒 Cuenta Nv${nextSlot.lvl}</span>`
        : `<button class="btn small ${meta.fame >= nextSlot.cost ? 'green' : 'gray'}" id="btn-buy-starter-slot" ${meta.fame >= nextSlot.cost ? '' : 'disabled'}>COMPRAR</button>`}
        </div>
      </div>

      <h2 style="font-size:11px;margin-top:14px;">⚓ Límite de Entrenamiento de Veteranos</h2>
      <div class="global-upg-row ${accLvl < nextCap.lvl ? 'locked' : ''}">
        <span class="upg-emoji">${nextCap.emoji}</span>
        <div class="upg-details">
          <div class="upg-head">
            <b class="upg-name">${nextCap.name}</b>
            <span class="price">⭐${nextCap.cost}</span>
          </div>
          <div class="upg-desc">${nextCap.desc} (Límite actual: Nv.${nextCap.curMax})</div>
        </div>
        <div class="upg-action">
          ${accLvl < nextCap.lvl ? `<span class="upg-badge locked">🔒 Cuenta Nv${nextCap.lvl}</span>`
      : `<button class="btn small ${meta.fame >= nextCap.cost ? 'green' : 'gray'}" id="btn-buy-capitania" ${meta.fame >= nextCap.cost ? '' : 'disabled'}>COMPRAR (+5 NV)</button>`}
        </div>
      </div>

      <h2 style="font-size:11px;margin-top:14px;">🌍 Añadidos globales</h2>
      <div class="global-upg-grid">
        ${availableGlobals.map(([id, it]) => {
        const owned = !!meta.global[id];
        const locked = accLvl < it.lvl;
        const can = !owned && !locked && meta.fame >= it.cost;
        return `<div class="global-upg-row ${owned ? 'owned' : locked ? 'locked' : ''}">
            <span class="upg-emoji">${it.emoji}</span>
            <div class="upg-details">
              <div class="upg-head">
                <b class="upg-name">${it.name}</b>
                ${owned ? '' : `<span class="price">⭐${it.cost}</span>`}
              </div>
              <div class="upg-desc">${it.desc}</div>
            </div>
            <div class="upg-action">
              ${owned ? '<span class="upg-badge bought">✓ COMPRADO</span>'
            : locked ? `<span class="upg-badge locked">🔒 Cuenta Nv${it.lvl}</span>`
              : `<button class="btn small ${can ? 'green' : 'gray'}" data-global="${id}" ${can ? '' : 'disabled'}>COMPRAR</button>`}
            </div>
          </div>`;
      }).join('')}
      </div>

      <h2 style="font-size:11px;margin-top:16px;">⚓ Mi Barco — Entrenamiento de veteranos</h2>
      <div style="margin:8px 0;">
        <input id="ship-search-q" placeholder="🔎 Buscar veterano por nombre..." value="${(shipSearchQ || '').replace(/"/g, '&quot;')}" style="width:100%;padding:8px;border:2px solid var(--ink);font-family:inherit;font-size:9px;background:#fff;">
      </div>
      <div id="ship-roster-list"></div>
    </div>
  `);

  const renderRosterUI = () => {
    const q = (shipSearchQ || '').trim().toLowerCase();
    const filteredRoster = roster.filter(id => {
      if (!q) return true;
      return CHARS[id].name.toLowerCase().includes(q);
    });
    const container = $('#ship-roster-list');
    if (!container) return;

    const cardHTML = id => {
      const c = CHARS[id];
      const u = meta.upgrades[id] || {};
      const isExpanded = !!shipExpanded[id];
      const totalStats = UPG_STATS.reduce((acc, [st]) => acc + (u[st] || 0), 0);
      const totalSpent = charTotalUpgSpent(id);
      const refund = Math.floor(totalSpent * 0.5);
      return `<div class="ship-card-acc">
        <div class="ship-card-header" data-toggle-ship="${id}">
          <span class="emoji">${charIcon(id, 28)}</span>
          <div style="flex:1;">
            <b>${c.name}</b> ${typeBadges(c.types)}<br>
            <small style="color:#666;font-size:7px;">Stats mejorados: <b>${totalStats}</b> (Límite: Nv${maxLvl})</small>
          </div>
          <button class="btn small gray">${isExpanded ? '▲ CERRAR' : '▼ MEJORAR'}</button>
        </div>
        ${isExpanded ? `
          <div class="ship-card-body">
            <div class="ship-upgs" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(110px, 1fr));gap:8px;">
              ${UPG_STATS.map(([stat, label, desc]) => {
        const lvl = u[stat] || 0;
        const cost = upgCost(lvl);
        const maxed = lvl >= maxLvl;
        const can = !maxed && meta.fame >= cost;
        return `<div class="upg">
                  <span class="upg-label">${label} ${lvl}/${maxLvl}</span>
                  <button class="btn small ${can ? 'green' : 'gray'}" data-up="${id}" data-stat="${stat}"
                    title="${desc}" ${can ? '' : 'disabled'}>${maxed ? 'MÁX' : `⭐${cost}`}</button>
                </div>`;
      }).join('')}
            </div>
            ${totalSpent > 0 ? `
              <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #ccc;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
                <span style="font-size:8px;color:#666;">
                  Inversión: <b style="color:var(--gold);">⭐${totalSpent}</b> · Recibes al vender (50%): <b style="color:var(--green);">⭐${refund}</b>
                </span>
                <button class="btn small red btn-sell-stats" data-sell-stats="${id}" style="font-size:8px;padding:4px 10px;">
                  💰 VENDER MEJORAS (⭐+${refund})
                </button>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>`;
    };
    const groups = groupUpgradeRoster(filteredRoster);
    container.innerHTML = groups.length ? groups.map((group, index) => `
      <details class="ship-saga" data-upgrade-saga="${group.id}" ${(q || shipSagaExpanded[group.id] === true || (shipSagaExpanded[group.id] === undefined && index === 0)) ? 'open' : ''}>
        <summary><span>${group.name}</span><span>${group.ids.length} ${group.ids.length === 1 ? 'nakama' : 'nakamas'}</span></summary>
        <div class="ship-saga-list">${group.ids.map(cardHTML).join('')}</div>
      </details>`).join('') : '<p>No se han encontrado veteranos con ese nombre.</p>';
    container.querySelectorAll('[data-upgrade-saga]').forEach(section => {
      section.ontoggle = () => { shipSagaExpanded[section.dataset.upgradeSaga] = section.open; };
    });

    container.querySelectorAll('[data-toggle-ship]').forEach(hdr => {
      hdr.onclick = () => {
        const id = hdr.dataset.toggleShip;
        shipExpanded[id] = !shipExpanded[id];
        renderRosterUI();
      };
    });

    container.querySelectorAll('[data-up]').forEach(btn => {
      btn.onclick = () => {
        if (Date.now() - shipBuyLock < 300) return;
        shipBuyLock = Date.now();
        const id = btn.dataset.up;
        const stat = btn.dataset.stat;
        const u = meta.upgrades[id] = meta.upgrades[id] || {};
        const lvl = u[stat] || 0;
        if (lvl >= maxLvl) return;
        const cost = upgCost(lvl);
        if (meta.fame < cost) return;
        meta.fame -= cost;
        u[stat] = lvl + 1;
        saveMeta();
        toast(`✨ ${CHARS[id].name}: ${stat.toUpperCase()} sube a Nv.${u[stat]}`);
        screenShip();
      };
    });

    container.querySelectorAll('[data-sell-stats]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.sellStats;
        const c = CHARS[id];
        const spent = charTotalUpgSpent(id);
        const refund = Math.floor(spent * 0.5);
        if (!spent || refund <= 0) return;

        showSellStatsConfirmModal(id, spent, refund, () => {
          meta.fame += refund;
          delete meta.upgrades[id];
          saveMeta();
          toast(`💰 Has recibido ⭐${refund} Fama al vender las mejoras de ${c.name}.`);
          screenShip();
        });
      };
    });
  };

  renderRosterUI();

  $('#btn-back').onclick = screenHome;
  const searchInput = $('#ship-search-q');
  if (searchInput) searchInput.oninput = e => { shipSearchQ = e.target.value; renderRosterUI(); };

  const buySlotBtn = $('#btn-buy-starter-slot');
  if (buySlotBtn) {
    buySlotBtn.onclick = () => {
      if (Date.now() - shipBuyLock < 300) return;
      shipBuyLock = Date.now();
      if (nextSlot.maxed) {
        toast('⚠️ Ya has alcanzado el máximo de 6 nakamas iniciales (tamaño completo del equipo).');
        return;
      }
      if (accLvl < nextSlot.lvl || meta.fame < nextSlot.cost) return;
      meta.fame -= nextSlot.cost;
      meta.global.starterSlots = Math.min(6, starterSlotsCount() + 1);
      meta.global.doblestarter = true;
      saveMeta();
      toast(`👥 ¡${nextSlot.name} desbloqueado!`);
      screenShip();
    };
  }

  const buyCapBtn = $('#btn-buy-capitania');
  if (buyCapBtn) {
    buyCapBtn.onclick = () => {
      if (Date.now() - shipBuyLock < 300) return;
      shipBuyLock = Date.now();
      if (accLvl < nextCap.lvl || meta.fame < nextCap.cost) return;
      meta.fame -= nextCap.cost;
      meta.global.veteranLimitTier = ((maxUpgLvl() - 10) / 5) + 1;
      saveMeta();
      toast(`⚓ ¡Límite de entrenamiento ampliado a Nv.${maxUpgLvl()}!`);
      screenShip();
    };
  }

  document.querySelectorAll('[data-global]').forEach(btn => {
    btn.onclick = () => {
      if (Date.now() - shipBuyLock < 300) return;
      shipBuyLock = Date.now();
      const id = btn.dataset.global;
      const it = GLOBAL_ITEMS[id];
      if (meta.global[id] || accountLevel() < it.lvl || meta.fame < it.cost) return;
      meta.fame -= it.cost;
      meta.global[id] = true;
      saveMeta();
      toast(`${it.emoji} ¡${it.name} desbloqueado!`);
      screenShip();
    };
  });

  document.querySelectorAll('[data-toggle-ship]').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.toggleShip;
      shipExpanded[id] = !shipExpanded[id];
      screenShip();
    };
  });

  document.querySelectorAll('[data-up]').forEach(btn => {
    btn.onclick = () => {
      if (Date.now() - shipBuyLock < 300) return;
      shipBuyLock = Date.now();
      const id = btn.dataset.up, stat = btn.dataset.stat;
      const u = meta.upgrades[id] = meta.upgrades[id] || {};
      const lvl = u[stat] || 0;
      const cost = upgCost(lvl);
      if (lvl >= maxLvl || meta.fame < cost) return;
      meta.fame -= cost;
      u[stat] = lvl + 1;
      saveMeta();
      toast(`${CHARS[id].name}: ${stat.toUpperCase()} mejorado ⭐`);
      screenShip();
    };
  });
}

// ============ DEX PIRATA ============
const dexView = { q: '', saga: '', type: '', rarity: 0, sort: 'default', page: 0 };

function dexCardHTML(id) {
  const c = CHARS[id];
  const seen = meta.dex.includes(id);
  const got = meta.recruited.includes(id);
  const vet = meta.roster.includes(id);
  return `<div class="dex-card ${seen ? 'seen' : 'unknown'}" data-id="${id}">
    <div class="emoji">${seen ? charIcon(id, 46) : '❔'}</div>
    <div>${c.name}</div>
    <div style="font-size:7px;">${'⭐'.repeat(c.rareza)}</div>
    ${vet ? '<div style="color:var(--accent)">🏅 veterano</div>' : got ? '<div style="color:var(--green)">✓ nakama</div>' : (seen ? '<div style="color:#999">visto</div>' : '<div style="color:#aaa">sin avistar</div>')}
  </div>`;
}

function screenDex() {
  playMusic('menu');
  const all = Object.keys(CHARS);
  const sagaOpts = [...SAGAS.map(s => ({ id: s.id, name: s.name })), { id: 'crossover', name: 'CROSSOVER' }];
  render(`
    ${topbar(false)}
    <button class="btn gray small back-btn" id="btn-back">← VOLVER</button>
    <div class="panel">
      <h2>📖 Dex Pirata — ${meta.dex.length}/${all.length} avistados, ${meta.recruited.length} reclutados</h2>
      ${charControlsHTML(dexView, { sagas: sagaOpts })}
      <div id="char-grid"></div>
      <div style="font-size:8px;color:#888;margin-top:10px;text-align:center;">Toca un personaje avistado para ver su ficha completa. Los no avistados solo muestran su nombre.</div>
    </div>
  `);
  $('#btn-back').onclick = screenHome;
  // Orden original: agrupado por saga, respetando el orden de definición
  const sagaOrder = {};
  SAGAS.forEach((s, i) => { sagaOrder[s.id] = i; });
  sagaOrder.crossover = SAGAS.length;
  const update = () => {
    let ids = filterSortChars(all, dexView);
    if (dexView.sort === 'default') {
      ids = ids.map((id, i) => [id, i])
        .sort((a, b) => (sagaOrder[CHARS[a[0]].saga] ?? 99) - (sagaOrder[CHARS[b[0]].saga] ?? 99) || a[1] - b[1])
        .map(([id]) => id);
    }
    renderCharGrid($('#char-grid'), ids, dexView, dexCardHTML, el => {
      el.querySelectorAll('.dex-card.seen').forEach(card => {
        card.onclick = () => showCharModal(card.dataset.id);
      });
    });
  };
  bindCharControls(dexView, update);
  update();
}

// ============ OBJETOS RELIQUIA DE PASIVAS (DESAFÍOS NV50) ============
const RELICS = {
  sombrero_paja: { id: 'sombrero_paja', name: 'Sombrero de Paja', emoji: '👒', desc: '+20% PS Máximos para todo el equipo' },
  espada_shusui: { id: 'espada_shusui', name: 'Espada Shusui', emoji: '⚔️', desc: '+25% ATQ Físico y +15% Crítico' },
  fruta_despertada: { id: 'fruta_despertada', name: 'Esencia Despertada', emoji: '✨', desc: '+25% ESP.ATQ y +15% Evasión' },
  capa_marina: { id: 'capa_marina', name: 'Capa de Almirante', emoji: '🧥', desc: '+25% DEF y +25% ESP.DEF' },
  botella_sake: { id: 'botella_sake', name: 'Sake de la Hermandad', emoji: '🍶', desc: '+20% VEL y curación continua' },
  dial_impacto: { id: 'dial_impacto', name: 'Dial Impacto', emoji: '💥', desc: '+40% Daño Crítico' },
  mera_mera_core: { id: 'mera_mera_core', name: 'Núcleo Mera Mera', emoji: '🔥', desc: '+30% ATQ y quemadura en ataques' },
  gura_gura_core: { id: 'gura_gura_core', name: 'Núcleo Gura Gura', emoji: '🌊', desc: 'Ataques ignoran 30% defensa enemiga' },
};

function screenChallenges() {
  playMusic('menu');
  if (accountLevel() < 50) {
    toast('🔒 El modo Desafíos requiere Nivel de Cuenta 50.');
    return screenHome();
  }

  meta.relics = meta.relics || [];
  const bossOptions = ['kaido', 'luffy5', 'shanks', 'newgate', 'sakazuki', 'im'];
  const bossIds = bossOptions.filter(id => CHARS[id]);

  render(`
    ${topbar(false)}
    <button class="btn gray small back-btn" id="btn-back">← VOLVER</button>
    <div class="subtitle">☠️ MODO DESAFÍOS (NV. CUENTA ${accountLevel()})</div>
    <div class="panel">
      <h2>🏆 Desafíos de Leyendas 5 Estrellas</h2>
      <p style="font-size:9px;color:#eee;margin-bottom:12px;">
        Enfréntate a los guerreros más poderosos del mundo. Cada rival de 5 estrellas cuenta con 3 pasivas potenciadas por Objetos Reliquia.<br>
        <b>¡Si ganas, podrás escoger 1 de sus 3 Objetos Reliquia para tu colección permanente!</b>
      </p>

      <div style="font-size:9px;color:var(--gold);margin-bottom:12px;background:rgba(0,0,0,0.3);padding:8px;border-radius:4px;border:1px solid var(--gold);">
        🎒 <b>TUS RELIQUIAS ADQUIRIDAS (${meta.relics.length}/${Object.keys(RELICS).length}):</b><br>
        ${meta.relics.length ? meta.relics.map(id => {
    const r = RELICS[id];
    return r ? `<span style="background:rgba(255,215,0,0.2);padding:3px 6px;border-radius:4px;margin:3px;display:inline-block;">${r.emoji} <b>${r.name}</b>: <small style="color:#ddd;">${r.desc}</small></span>` : '';
  }).join('') : '<span style="color:#aaa;">Ninguna reliquia obtenida todavía. ¡Completa un desafío para ganar la primera!</span>'}
      </div>

      <div class="pick-grid">
        ${bossIds.map(id => {
    const c = CHARS[id];
    return `
            <div class="pick-row" style="padding:10px;">
              <span class="emoji">${charIcon(id, 36)}</span>
              <div class="info">
                <b style="font-size:11px;">${c.name} ⭐⭐⭐⭐⭐</b><br>
                <span style="color:var(--gold);font-size:8px;">Jefe Leyenda Nv75 con 3 Pasivas Reliquia</span>
              </div>
              <button class="btn red small btn-challenge-boss" data-id="${id}">⚔️ DESAFIAR</button>
            </div>
          `;
  }).join('')}
      </div>
    </div>
  `);

  $('#btn-back').onclick = screenHome;
  document.querySelectorAll('.btn-challenge-boss').forEach(btn => {
    btn.onclick = () => startBossChallenge(btn.dataset.id);
  });
}

function startBossChallenge(bossId) {
  const relicKeys = Object.keys(RELICS);
  const shuffled = [...relicKeys].sort(() => 0.5 - Math.random());
  const chosenRelics = shuffled.slice(0, 3);

  const boss = makeChar(bossId, 75, true);
  boss.stars = 5;
  ['maxhp', 'hp', 'atk', 'def', 'spatk', 'spdef', 'spd'].forEach(k => {
    boss[k] = Math.floor(boss[k] * 1.35);
  });

  const pTeam = (run && run.team && run.team.length)
    ? run.team
    : STRAW_HAT_MEMBERS.slice(0, 6).map(id => applyUpgrades(makeChar(id, 65)));

  startBattle([boss], {
    wild: false,
    tower: true,
    onWin: () => showRelicRewardModal(chosenRelics)
  });
}

function showRelicRewardModal(relicIds) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal" style="max-width:480px;">
    <h2>🏆 ¡DESAFÍO COMPLETADO!</h2>
    <p style="font-size:9px;text-align:center;margin-bottom:12px;">
      ¡Has derrotado al Jefe de 5 Estrellas!<br>Elige <b>1 Objeto Reliquia</b> para añadir a tus pasivas permanentes:
    </p>
    <div class="pick-grid">
      ${relicIds.map(id => {
    const r = RELICS[id];
    return `
          <div class="pick-row btn-pick-relic" data-id="${id}" style="cursor:pointer;padding:8px;">
            <span class="emoji" style="font-size:24px;">${r.emoji}</span>
            <div class="info">
              <b>${r.name}</b><br>
              <small style="color:#ddd;">${r.desc}</small>
            </div>
            <button class="btn gold small">ELEGIR</button>
          </div>
        `;
  }).join('')}
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll('.btn-pick-relic').forEach(el => {
    el.onclick = () => {
      const relId = el.dataset.id;
      meta.relics = meta.relics || [];
      if (!meta.relics.includes(relId)) {
        meta.relics.push(relId);
        saveMeta();
      }
      toast(`🎒 ¡Objeto Reliquia ${RELICS[relId].name} obtenido!`);
      ov.remove();
      screenChallenges();
    };
  });
}

// ============ INICIO ============
try {
  if (loadedSave) validateGameSave(loadedSave);
} catch (e) {
  saveReadError = true;
  loadedSave = null;
  savedRun = null;
  run = null;
  loadMeta();
}
screenHome();
if (saveReadError) toast('⚠️ No se pudo leer la partida local. La copia anterior se ha conservado; puedes importar un JSON.');
