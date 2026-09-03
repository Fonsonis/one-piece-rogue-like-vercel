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
// Coloca cada PNG en la carpeta sprites/ con el nombre <id>.png y añade el id aquí.
const SPRITES = ['luffy', 'zoro', 'nami', 'usopp', 'usopp2', 'sanji', 'arlong', 'bandido', 'marineraso'];
function spriteOf(id) {
  if (SPRITES.includes(id)) return id;
  const b = baseFormOf(id); // las evoluciones reutilizan el sprite de su forma base
  return SPRITES.includes(b) ? b : null;
}
// Icono de personaje: sprite PNG si existe, emoji si no
function charIcon(id, px = 26) {
  const s = spriteOf(id);
  // si el PNG no está (aún), vuelve al emoji en vez de mostrar una imagen rota
  return s ? `<img class="pix" src="sprites/${s}.png" style="height:${px}px" alt="${CHARS[id].name}" onerror="this.replaceWith('${CHARS[id].emoji}')">`
    : CHARS[id].emoji;
}

// ---------- Cuenta de jugador (login opcional; se guarda en el servidor) ----------
// El progreso de cada usuario vive en su propia clave local y en players/<user>.json.
// El invitado tiene la suya propia: cerrar sesión nunca mezcla progresos.
let session = null;
try { session = JSON.parse(localStorage.getItem('oplike_session')); } catch (e) {}
const storeKey = base => session ? `${base}_${session.user}` : base;

// ---------- Dificultades de la aventura ----------
const DIFFICULTIES = [
  { id: 1, name: 'Grumete', emoji: '⚓', mult: 1.0, desc: 'Normal (rivales 100% atributos)' },
  { id: 2, name: 'Pirata', emoji: '🏴‍☠️', mult: 1.15, desc: 'Desafiante (rivales +15% atributos)' },
  { id: 3, name: 'Capitán', emoji: '⚔️', mult: 1.30, desc: 'Difícil (rivales +30% atributos)' },
  { id: 4, name: 'Supernova', emoji: '⚡', mult: 1.50, desc: 'Muy Difícil (rivales +50% atributos)' },
  { id: 5, name: 'Rey Pirata', emoji: '👑', mult: 1.75, desc: 'Extremo (rivales +75% atributos)' },
];
let selectedDiff = 1;

// ---------- Meta persistente ----------
const META_DEFAULTS = () => ({
  wins: {}, nuzWins: {}, dex: [], recruited: [], roster: [], towerRecord: 0,
  fame: 0, upgrades: {}, accXp: 0, global: {}, defeated: [],
  sagaClears: {}, // id base -> nº de sagas conquistadas con ese nakama en la banda
  sagaDiffWins: {}, // sagaId -> { diffLevel: true }
});
let meta = META_DEFAULTS();
function loadMeta() {
  meta = META_DEFAULTS();
  try {
    const m = localStorage.getItem(storeKey('oplike_meta'));
    if (m) meta = Object.assign(meta, JSON.parse(m));
  } catch (e) {}
}
loadMeta();

let syncTimer = null;
function scheduleSync() {
  if (!session) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    fetch('/api/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: session.user, pass: session.pass, meta, run }),
    }).catch(() => {});
  }, 1200);
}
function saveMeta() {
  try { localStorage.setItem(storeKey('oplike_meta'), JSON.stringify(meta)); } catch (e) {}
  scheduleSync();
}

async function apiCall(route, payload) {
  let res;
  try {
    res = await fetch('/api/' + route, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new Error('Sin conexión con el servidor de cuentas. Tu progreso se guarda igualmente en este dispositivo.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // En despliegues estáticos (p. ej. Vercel sin backend) la API no existe
    if (!data) throw new Error('Esta versión online no tiene servidor de cuentas. Juega como invitado: tu progreso se guarda en este dispositivo.');
    throw new Error(data.error || 'Error de servidor');
  }
  return data || {};
}

// ---------- Guardado local en archivo ----------
function exportSave() {
  const payload = {
    game: 'grandlinelike', version: 1,
    date: new Date().toISOString(),
    user: session ? session.user : 'invitado',
    meta, run,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const stamp = payload.date.slice(0, 10);
  a.download = `grandlinelike_${payload.user}_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  toast('💾 Partida guardada en tu dispositivo');
}

function importSaveFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || data.game !== 'grandlinelike' || typeof data.meta !== 'object') {
        throw new Error('formato');
      }
      meta = Object.assign(META_DEFAULTS(), data.meta);
      run = data.run || null;
      if (run && run.team) run.team.forEach(migrateFighter);
      saveMeta();
      if (run) saveRun(); else clearRun();
      toast(`📂 Partida de ${data.user || 'pirata'} cargada`);
      screenHome();
    } catch (e) {
      toast('❌ Ese archivo no es un guardado válido de GrandLineLike');
    }
  };
  reader.readAsText(file);
}

// Nivel de cuenta: sube con los PX de cuenta (se ganan a la par que la Fama)
function accountLevel() { return 1 + Math.floor((meta.accXp || 0) / 150); }
function accountNextAt() { return accountLevel() * 150; }
function gainFame(n) {
  meta.fame += n;
  meta.accXp = (meta.accXp || 0) + n;
  saveMeta();
}

// ---------- Estado de la partida ----------
let run = null; // partida actual (historia)
function saveRun() {
  try { localStorage.setItem(storeKey('oplike_run'), JSON.stringify(run)); } catch (e) {}
  scheduleSync();
}
function clearRun() {
  run = null;
  try { localStorage.removeItem(storeKey('oplike_run')); } catch (e) {}
  scheduleSync();
}
function loadRun() {
  run = null;
  try {
    const r = localStorage.getItem(storeKey('oplike_run'));
    if (r) run = JSON.parse(r);
  } catch (e) {}
  // migración: partidas anteriores a los stats ESP_ATQ/ESP_DEF
  if (run && run.team) run.team.forEach(migrateFighter);
}
function migrateFighter(f) {
  if (f.spatk == null && CHARS[f.id]) {
    f.spatk = statAt(CHARS[f.id].base[3], f.lvl) + (f.atkBonus || 0);
    f.spdef = statAt(CHARS[f.id].base[4], f.lvl) + (f.defBonus || 0);
  }
  // partidas anteriores a las mejoras E.ATQ/E.DEF: el ATQ/DEF del Barco potenciaba ambas vertientes
  if (f.spatkBonus == null) { f.spatkBonus = f.atkBonus || 0; f.spdefBonus = f.defBonus || 0; }
  return f;
}
loadRun();

// ---------- Modelo de personaje ----------
function statAt(base, lvl) { return Math.floor(base * (1 + 0.085 * (lvl - 1))); }
function hpAt(base, lvl) { return Math.floor(base * (1 + 0.11 * (lvl - 1))) + lvl; }
function xpForLevel(lvl) { return Math.floor(lvl * lvl * 6); }

function makeChar(id, lvl, isEnemy = false) {
  const c = CHARS[id];
  const moves = c.learnset.filter(([l]) => l <= lvl).map(([, m]) => m).slice(-4);
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
    xp: 0, moves,
  };
}
// Aplica las mejoras permanentes del Barco (solo a personajes del jugador)
function applyUpgrades(f) {
  const u = meta.upgrades[baseFormOf(f.id)];
  if (!u) return f;
  f.hpBonus = (u.hp || 0) * 3;
  f.spdBonus = (u.spd || 0);
  f.maxhp += f.hpBonus;
  f.hp = Math.min(f.maxhp, f.hp + f.hpBonus);
  f.atkBonus += u.atk || 0; f.atk += u.atk || 0;
  f.defBonus += u.def || 0; f.def += u.def || 0;
  f.spatkBonus = (f.spatkBonus || 0) + (u.spatk || 0); f.spatk += u.spatk || 0;
  f.spdefBonus = (f.spdefBonus || 0) + (u.spdef || 0); f.spdef += u.spdef || 0;
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
    f.hp = Math.min(f.maxhp, f.hp + (f.maxhp - oldMax));
    f.atk = statAt(c.base[1], f.lvl) + f.atkBonus;
    f.def = statAt(c.base[2], f.lvl) + f.defBonus;
    f.spatk = statAt(c.base[3], f.lvl) + (f.spatkBonus || 0);
    f.spdef = statAt(c.base[4], f.lvl) + (f.spdefBonus || 0);
    f.spd = statAt(c.base[5], f.lvl) + (f.spdBonus || 0);
    msgs.push(`¡${c.name} sube al nivel ${f.lvl}!`);
    // nuevos movimientos
    for (const [l, m] of c.learnset) {
      if (l === f.lvl && !f.moves.includes(m)) {
        f.moves.push(m);
        if (f.moves.length > 4) f.moves.shift();
        msgs.push(`¡${c.name} aprende ${MOVES[m].name}!`);
      }
    }
    // transformación
    if (c.evo && f.lvl >= c.evo.lvl) {
      const to = c.evo.to;
      msgs.push(`✨ ¡${c.name} se transforma en ${CHARS[to].name}!`);
      f.id = to;
      const nc = CHARS[to];
      f.maxhp = hpAt(nc.base[0], f.lvl) + (f.hpBonus || 0); f.hp = f.maxhp;
      f.atk = statAt(nc.base[1], f.lvl) + f.atkBonus;
      f.def = statAt(nc.base[2], f.lvl) + f.defBonus;
      f.spatk = statAt(nc.base[3], f.lvl) + (f.spatkBonus || 0);
      f.spdef = statAt(nc.base[4], f.lvl) + (f.spdefBonus || 0);
      f.spd = statAt(nc.base[5], f.lvl) + (f.spdBonus || 0);
      const nm = nc.learnset.filter(([l]) => l <= f.lvl).map(([, m]) => m).slice(-4);
      for (const m of nm) if (!f.moves.includes(m)) { f.moves.push(m); if (f.moves.length > 4) f.moves.shift(); }
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
// Desbloquea para futuras aventuras a todos los nakamas de la banda actual
function unlockRoster(allowBosses = false) {
  const added = [];
  for (const f of run.team) {
    const b = baseFormOf(f.id);
    if ((allowBosses || !CHARS[b].boss) && !meta.roster.includes(b)) {
      meta.roster.push(b);
      added.push(b);
    }
  }
  if (added.length) saveMeta();
  return added;
}

// ---------- Generación de mapa ----------
const NODE_TYPES = {
  wild:    { emoji: '🏴‍☠️', label: 'Pirata salvaje' },
  marine:  { emoji: '⚓', label: 'Combate Marine' },
  item:    { emoji: '🎁', label: 'Objeto' },
  mystery: { emoji: '❓', label: 'Misterio' },
  shop:    { emoji: '🏪', label: 'Tienda' },
  rest:    { emoji: '⛺', label: 'Campamento' },
  special: { emoji: '🌟', label: 'Pirata especial' },
  boss:    { emoji: '💀', label: 'Jefe' },
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
try { isMuted = localStorage.getItem('oplike_muted') === 'true'; } catch (e) {}

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
        if (bgmAudio && currentTrack === track) bgmAudio.play().catch(() => {});
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
  try { localStorage.setItem('oplike_muted', String(isMuted)); } catch (e) {}
  if (bgmAudio) bgmAudio.muted = isMuted;
  const btn = $('#btn-mute');
  if (btn) btn.textContent = isMuted ? '🔇' : '🎵';
}

// ---------- Render raíz ----------
function render(html) {
  app.innerHTML = html;
  const btn = $('#btn-mute');
  if (btn) btn.onclick = toggleMute;
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function typeBadges(types) {
  return `<div class="type-badges">${types.map(t =>
    `<span class="type-badge" style="background:${TYPES[t].color}">${t.toUpperCase()}</span>`).join('')}</div>`;
}

function berriesHTML(v) { return `฿${v.toLocaleString('es')}`; }

function topbar(showBerries) {
  return `<div class="topbar">
    <div class="logo">GRAND<span>LINE</span>LIKE</div>
    <div style="display:flex;align-items:center;gap:10px;">
      ${showBerries && run ? `<div class="berries">${berriesHTML(run.berries)}</div>` : ''}
      <button class="btn small gray" id="btn-mute" style="padding:6px 8px;font-size:12px;" title="Activar/Silenciar música">${isMuted ? '🔇' : '🎵'}</button>
    </div>
  </div>`;
}

// ============ LOGIN / REGISTRO ============
function showLoginModal() {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>👤 Cuenta de pirata</h2>
    <p style="font-size:8px;text-align:center;margin-bottom:10px;line-height:1.8;">
      Inicia sesión o regístrate para guardar tu progreso en el servidor.<br>
      Si te registras ahora, tu progreso de invitado se conserva.</p>
    <input class="auth-input" id="lg-user" placeholder="Nombre de pirata (3-20)" maxlength="20" autocomplete="username">
    <input class="auth-input" id="lg-pass" type="password" placeholder="Contraseña" autocomplete="current-password">
    <div class="special-fail hidden" id="lg-error"></div>
    <div class="actions">
      <button class="btn green" id="lg-login">ENTRAR</button>
      <button class="btn blue" id="lg-register">REGISTRARSE</button>
      <button class="btn gray" id="lg-cancel">CANCELAR</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const showErr = msg => {
    const e = ov.querySelector('#lg-error');
    e.textContent = msg;
    e.classList.remove('hidden');
  };
  const creds = () => ({
    user: ov.querySelector('#lg-user').value.trim(),
    pass: ov.querySelector('#lg-pass').value,
  });
  const finish = (user, pass, serverMeta, serverRun, msg) => {
    session = { user, pass };
    try { localStorage.setItem('oplike_session', JSON.stringify(session)); } catch (e) {}
    // el progreso del usuario sustituye en memoria al del invitado (que queda intacto en su clave)
    meta = Object.assign(META_DEFAULTS(), serverMeta || {});
    run = serverRun || null;
    saveMeta();
    if (run) saveRun(); else clearRun();
    ov.remove();
    toast(msg);
    screenHome();
  };
  ov.querySelector('#lg-login').onclick = async () => {
    const { user, pass } = creds();
    try {
      const data = await apiCall('login', { user, pass });
      finish(user, pass, data.meta, data.run, `⚓ ¡Bienvenido de vuelta, ${user}!`);
    } catch (e) { showErr(e.message); }
  };
  ov.querySelector('#lg-register').onclick = async () => {
    const { user, pass } = creds();
    try {
      // el registro hereda el progreso actual del invitado como punto de partida
      await apiCall('register', { user, pass, meta, run });
      finish(user, pass, meta, run, `🏴‍☠️ ¡Cuenta creada! Bienvenido, ${user}.`);
    } catch (e) { showErr(e.message); }
  };
  ov.querySelector('#lg-cancel').onclick = () => ov.remove();
}

// ============ PANTALLA: HOME ============
function screenHome() {
  playMusic('menu');
  const totalWins = Object.values(meta.wins).reduce((a, b) => a + b, 0) +
    Object.values(meta.nuzWins).reduce((a, b) => a + b, 0);
  render(`
    ${topbar(false)}
    <div class="subtitle">ONE PIECE ROGUELIKE | v1.1</div>
    <div class="modes">
      <div class="mode-card" id="mode-story">
        <div class="mode-art story">🏝️</div>
        <div class="mode-title">Historia</div>
        <div class="mode-btn">${run ? 'CONTINUAR VIAJE' : 'ZARPAR'}</div>
      </div>
      <div class="mode-card ${totalWins ? '' : 'locked'}" id="mode-tower">
        <div class="mode-art tower">🗼</div>
        <div class="mode-title">Torre Marine</div>
        <div class="mode-btn">${totalWins ? 'ENTRAR' : '🔒 GANA UNA SAGA'}</div>
      </div>
      <div class="mode-card locked">
        <div class="mode-art challenge">☠️</div>
        <div class="mode-title">Desafíos</div>
        <div class="mode-btn">🔒 PRÓXIMAMENTE</div>
      </div>
    </div>
    <div style="text-align:center;margin-top:18px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;align-items:center;">
      <button class="btn blue" id="btn-dex">📖 Dex Pirata (${meta.dex.length}/${Object.keys(CHARS).length})</button>
      <button class="btn gold" id="btn-ship">🏪 Tienda — ⭐${meta.fame}</button>
      <button class="btn gray" id="btn-guide">📊 Tipos y Sinergias</button>
      ${meta.towerRecord ? `<span style="color:#fff;text-shadow:1px 1px 0 #000;font-size:9px;">Récord Torre: ${meta.towerRecord}</span>` : ''}
    </div>
    <div style="text-align:center;margin-top:12px;display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap;">
      <span style="color:#fff;text-shadow:1px 1px 0 #000;font-size:9px;">
        ${session ? `👤 ${session.user}` : '👤 Invitado'} · Cuenta Nv${accountLevel()} (${meta.accXp || 0}/${accountNextAt()} PX)
      </span>
      ${session
        ? '<button class="btn small gray" id="btn-logout">CERRAR SESIÓN</button>'
        : '<button class="btn small blue" id="btn-login">INICIAR SESIÓN / REGISTRO</button>'}
    </div>
    <div style="text-align:center;margin-top:10px;display:flex;gap:10px;justify-content:center;align-items:center;flex-wrap:wrap;">
      <button class="btn small green" id="btn-export">💾 GUARDAR EN ARCHIVO</button>
      <button class="btn small gold" id="btn-import">📂 CARGAR ARCHIVO</button>
      <input type="file" id="file-import" accept=".json,application/json" style="display:none;">
    </div>
    <div class="footer-note">
      Proyecto fan sin ánimo de lucro. No afiliado con Eiichiro Oda, Shueisha ni Toei Animation.<br>
      One Piece y sus personajes son propiedad de sus respectivos dueños.
    </div>
  `);
  $('#mode-story').onclick = () => run ? screenMap() : screenSagas();
  if (totalWins) $('#mode-tower').onclick = () => screenTowerIntro();
  $('#btn-dex').onclick = screenDex;
  $('#btn-ship').onclick = screenShip;
  $('#btn-guide').onclick = () => showTypeChartModal(run ? run.team : null);
  const loginBtn = $('#btn-login');
  if (loginBtn) loginBtn.onclick = showLoginModal;
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
  const logoutBtn = $('#btn-logout');
  if (logoutBtn) logoutBtn.onclick = () => {
    session = null;
    localStorage.removeItem('oplike_session');
    // vuelve al progreso propio del invitado (separado del de la cuenta)
    loadMeta();
    loadRun();
    toast('Sesión cerrada. Sigues como invitado.');
    screenHome();
  };
}

// ============ PANTALLA: SAGAS ============
// Cada saga se desbloquea al conquistar la anterior (en cualquier modo)
const sagaUnlocked = i => i === 0 ||
  ((meta.wins[SAGAS[i - 1].id] || 0) + (meta.nuzWins[SAGAS[i - 1].id] || 0)) > 0;

// ============ MODAL: TABLA DE PROBABILIDADES POR SAGA ============
let currentProbSagaIdx = 0;
let currentProbTab = 'wild';

function showSagaProbabilitiesModal(initialSagaIdx = 0) {
  currentProbSagaIdx = initialSagaIdx;
  currentProbTab = 'wild';

  const renderModalContent = () => {
    const s = SAGAS[currentProbSagaIdx];
    if (!s) return '';

    // 1. Wild Pool
    const wildPool = (s.islands && s.islands[0] && s.islands[0].pool) || [];
    const wildPct = wildPool.length ? (100 / wildPool.length) : 0;

    // 2. Bosses (por isla)
    const islandBosses = s.islands.map(isl => ({
      name: isl.name,
      bosses: (isl.boss || []).filter(b => CHARS[b])
    }));

    // 3. Mercado Clandestino (Carteles SE BUSCA)
    const weights = [5, 4, 3, 2, 1];
    const totalWeight = 15;
    const gachaTiers = [1, 2, 3, 4, 5].map(r => {
      const pool = sagaPoolByRareza(s.id, r);
      const pct = (weights[r - 1] / totalWeight) * 100;
      const each = pool.length ? (pct / pool.length) : 0;
      return { rareza: r, pct, pool, each };
    });

    let tabHTML = '';
    if (currentProbTab === 'wild') {
      const rows = wildPool.map(id => {
        const c = CHARS[id];
        return `<tr>
          <td style="white-space:nowrap;">${charIcon(id, 20)} <b>${c.name}</b></td>
          <td>${'⭐'.repeat(c.rareza)}</td>
          <td>${typeBadges(c.types)}</td>
          <td><b>${wildPct.toFixed(2)}%</b></td>
        </tr>`;
      }).join('');
      tabHTML = `
        <div style="font-size:8px;line-height:1.7;margin-bottom:8px;color:#555;">
          Aparición en nodos de piratas salvajes 🏴‍☠️ y marines ⚓ durante el viaje.<br>
          <b>${wildPool.length}</b> personajes en el pool salvaje (${wildPct.toFixed(2)}% por slot de enemigo).
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
            <thead><tr><th>Isla</th><th>Jefe(s)</th><th>Probabilidad</th></tr></thead>
            <tbody>${rows}</tbody>
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
      <h2>📊 Probabilidades: ${s.name}</h2>
      <div style="display:flex;justify-content:center;margin-bottom:10px;">
        <select id="spm-saga-sel" style="font-family:inherit;font-size:9px;padding:6px 10px;border:2px solid var(--ink);background:#fff;">
          ${SAGAS.map((sg, i) => `<option value="${i}" ${i === currentProbSagaIdx ? 'selected' : ''}>${sg.sub}: ${sg.name}</option>`).join('')}
        </select>
      </div>
      <div class="tabs" style="margin-bottom:10px;">
        <div class="tab ${currentProbTab === 'wild' ? 'active' : ''}" id="spm-tab-wild">🏴‍☠️ SALVAJES (${wildPool.length})</div>
        <div class="tab ${currentProbTab === 'boss' ? 'active' : ''}" id="spm-tab-boss">💀 JEFES</div>
        <div class="tab ${currentProbTab === 'gacha' ? 'active' : ''}" id="spm-tab-gacha">🎰 MERCADO</div>
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
  ov.innerHTML = `<div class="modal" style="max-width:580px;">${renderModalContent()}</div>`;
  document.body.appendChild(ov);

  const bindEvents = () => {
    const sel = ov.querySelector('#spm-saga-sel');
    if (sel) sel.onchange = e => {
      currentProbSagaIdx = +e.target.value;
      ov.querySelector('.modal').innerHTML = renderModalContent();
      bindEvents();
    };
    const twild = ov.querySelector('#spm-tab-wild');
    if (twild) twild.onclick = () => {
      currentProbTab = 'wild';
      ov.querySelector('.modal').innerHTML = renderModalContent();
      bindEvents();
    };
    const tboss = ov.querySelector('#spm-tab-boss');
    if (tboss) tboss.onclick = () => {
      currentProbTab = 'boss';
      ov.querySelector('.modal').innerHTML = renderModalContent();
      bindEvents();
    };
    const tgacha = ov.querySelector('#spm-tab-gacha');
    if (tgacha) tgacha.onclick = () => {
      currentProbTab = 'gacha';
      ov.querySelector('.modal').innerHTML = renderModalContent();
      bindEvents();
    };
    const cbtn = ov.querySelector('#spm-close');
    if (cbtn) cbtn.onclick = () => ov.remove();
  };

  bindEvents();
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}

let storyMode = 'classic';
function screenSagas() {
  playMusic('menu');
  render(`
    ${topbar(false)}
    <button class="btn gray small back-btn" id="btn-back">← VOLVER</button>
    <div class="panel">
      <h2>Historia</h2>
      <p>El modo historia es la gran aventura: recorre las islas de cada saga,
      derrota a los capitanes enemigos y consigue sus emblemas hasta conquistar la saga.
      Elige Clásico o Nuzlocke, la dificultad y una saga para empezar.</p>
      <div style="text-align:center;margin-top:8px;">
        <button class="btn small blue" id="btn-saga-probs-all" style="font-size:8px;">📊 TABLA DE PROBABILIDADES POR SAGA</button>
      </div>
    </div>
    <div class="tabs">
      <div class="tab ${storyMode === 'classic' ? 'active' : ''}" id="tab-classic">CLÁSICO</div>
      <div class="tab ${storyMode === 'nuzlocke' ? 'active' : ''}" id="tab-nuz">NUZLOCKE</div>
    </div>
    <div class="panel" style="margin-bottom:12px;padding:10px;">
      <h3 style="font-size:10px;color:var(--red);margin-bottom:8px;text-align:center;">🎯 DIFICULTAD DE LA AVENTURA</h3>
      <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
        ${DIFFICULTIES.map(d => `
          <button class="btn small ${selectedDiff === d.id ? 'gold' : 'gray'}" data-diff="${d.id}" title="${d.desc}">
            ${d.emoji} ${d.name}
          </button>
        `).join('')}
      </div>
      <div style="font-size:8px;color:#666;text-align:center;margin-top:6px;">
        ${DIFFICULTIES.find(d => d.id === selectedDiff)?.desc}
      </div>
    </div>
    ${SAGAS.map((s, idx) => {
      const diffWins = meta.sagaDiffWins && meta.sagaDiffWins[s.id] ? Object.keys(meta.sagaDiffWins[s.id]).length : 0;
      return `
      <div class="saga-row ${sagaUnlocked(idx) ? '' : 'locked'}" data-saga="${idx}">
        <div class="saga-art" style="background:${s.color || '#777'}">
          <div>${sagaUnlocked(idx) ? '' : '🔒 '}${s.name}</div><small>${s.sub}</small>
        </div>
        <div class="saga-stats">
          Victorias Clásico <b>${meta.wins[s.id] || 0}</b><br>
          Victorias Nuzlocke <b>${meta.nuzWins[s.id] || 0}</b><br>
          Dificultades Superadas <b>${diffWins}/5 ⭐</b>
          <div style="margin-top:6px;text-align:right;">
            <button class="btn small gray btn-saga-probs" data-saga="${idx}" style="font-size:7px;padding:3px 6px;">📊 PROBABILIDADES</button>
          </div>
        </div>
      </div>
    `}).join('')}
    <div class="footer-note">Más sagas en camino. ¡Mientras tanto, prueba la Torre Marine!</div>
  `);
  $('#btn-back').onclick = screenHome;
  $('#tab-classic').onclick = () => { storyMode = 'classic'; screenSagas(); };
  $('#tab-nuz').onclick = () => { storyMode = 'nuzlocke'; screenSagas(); };
  const allProbsBtn = $('#btn-saga-probs-all');
  if (allProbsBtn) allProbsBtn.onclick = () => showSagaProbabilitiesModal(0);
  document.querySelectorAll('[data-diff]').forEach(btn => {
    btn.onclick = () => { selectedDiff = +btn.dataset.diff; screenSagas(); };
  });
  document.querySelectorAll('.saga-row').forEach(el => {
    const idx = +el.dataset.saga;
    if (sagaUnlocked(idx)) el.onclick = () => screenStarter(idx);
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

function screenStarter(sagaIdx) {
  playMusic('menu');
  const saga = SAGAS[sagaIdx];
  const veterans = meta.roster.filter(id => CHARS[id] && !saga.starters.includes(id));
  const allIds = [...saga.starters, ...veterans];
  starterView.page = 0;
  // Con "Dúo inicial" comprado se eligen 2 nakamas; si no, 1.
  let picked = null;
  render(`
    ${topbar(false)}
    <button class="btn gray small back-btn" id="btn-back">← VOLVER</button>
    <div class="subtitle" style="font-size:14px;">¡Elige ${meta.global.doblestarter ? 'a tus 2 primeros nakamas' : 'tu primer nakama'}!</div>
    <div class="panel">
      ${charControlsHTML(starterView)}
      <div id="char-grid"></div>
      <div style="font-size:8px;color:#888;margin-top:8px;text-align:center;">Toca una carta para elegir a tu nakama · ℹ️ para ver su ficha completa.</div>
    </div>
  `);
  $('#btn-back').onclick = screenSagas;
  const update = () => {
    const ids = filterSortChars(allIds, starterView);
    renderCharGrid($('#char-grid'), ids, starterView,
      id => {
        const isUnlocked = id === 'luffy' || (meta.roster && meta.roster.includes(id));
        return selCardHTML(id, veterans.includes(id), picked === id, isUnlocked);
      },
      el => {
        el.querySelectorAll('.sel-card').forEach(card => {
          card.onclick = () => {
            const id = card.dataset.id;
            const isUnlocked = id === 'luffy' || (meta.roster && meta.roster.includes(id));
            if (!isUnlocked) {
              toast('🔒 Personaje bloqueado. ¡Conquista islas/sagas para desbloquearlo!');
              return;
            }
            if (!meta.global.doblestarter) return startRun(sagaIdx, [id]);
            if (!picked) {
              picked = id;
              card.classList.add('picked');
              toast('👥 Dúo inicial: elige a tu segundo nakama');
            } else if (picked === id) {
              picked = null;
              card.classList.remove('picked');
            } else {
              startRun(sagaIdx, [picked, id]);
            }
          };
        });
        el.querySelectorAll('.info-btn').forEach(btn => {
          btn.onclick = e => { e.stopPropagation(); showCharModal(btn.dataset.info); };
        });
      });
  };
  bindCharControls(starterView, update);
  update();
}

// Nivel inicial de un nakama: +3 por cada saga conquistada con él (máx. +15)
function startLvlOf(id) {
  const clears = (meta.sagaClears || {})[baseFormOf(id)] || 0;
  return 5 + Math.min(15, clears * 3);
}

function startRun(sagaIdx, starterIds) {
  const saga = SAGAS[sagaIdx];
  run = {
    saga: sagaIdx, mode: storyMode, diff: selectedDiff || 1,
    islandIdx: 0,
    team: starterIds.map(id => applyUpgrades(makeChar(id, startLvlOf(id)))),
    items: { cartel: 3 + (meta.global.cartelesplus ? 2 : 0), carne: 2 },
    berries: 300 + (meta.global.berriesplus ? 200 : 0),
    badges: [],
    map: genMap(saga.islands[0]),
    pos: null,
    nuzCaught: {}, // isla -> ya reclutado
  };
  starterIds.forEach(registerRecruit);
  saveRun();
  screenMap();
}

// ============ PANTALLA: MAPA ============
function screenMap() {
  playMusic('menu');
  const saga = SAGAS[run.saga];
  const island = saga.islands[run.islandIdx];
  const reach = reachableNodes();
  const rows = run.map.rows;
  const H = Math.max(520, rows.length * 78);

  let nodesHTML = '', edgesHTML = '';
  const posOf = (r, i) => {
    const row = rows[r];
    const x = (i + 1) / (row.length + 1) * 100;
    const y = 92 - (r / (rows.length - 1)) * 80;
    return [x, y];
  };
  for (const e of run.map.edges) {
    const [x1, y1] = posOf(e[0], e[1]);
    const [x2, y2] = posOf(e[2], e[3]);
    edgesHTML += `<line x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%" stroke="#2b2b2b" stroke-width="2" stroke-dasharray="4 5" opacity="0.5"/>`;
  }
  rows.forEach((row, r) => row.forEach((n, i) => {
    const [x, y] = posOf(r, i);
    const isReach = reach.some(([rr, ii]) => rr === r && ii === i);
    const isCur = run.pos && run.pos[0] === r && run.pos[1] === i;
    nodesHTML += `<div class="map-node ${n.done ? 'done' : ''} ${isReach ? 'reachable' : ''} ${isCur ? 'current' : ''}"
      style="left:${x}%;top:${y}%" data-r="${r}" data-i="${i}" title="${NODE_TYPES[n.type].label}">${NODE_TYPES[n.type].emoji}</div>`;
  }));

  render(`
    ${topbar(true)}
    <div class="map-wrap">
      <div class="side-panel">
        <div class="panel">
          <h3>EQUIPO ${run.mode === 'nuzlocke' ? '☠️' : ''}</h3>
          ${run.team.map((f, idx) => `
            <div class="team-slot ${f.hp <= 0 ? 'dead' : ''}" data-idx="${idx}" draggable="true">
              <span class="drag-handle">≡</span>
              <span class="emoji">${charIcon(f.id, 18)}</span>
              <div class="info">${idx + 1}. ${charName(f)}<br>Nv${f.lvl}
                <div class="hp-mini"><i style="width:${f.hp / f.maxhp * 100}%"></i></div>
              </div>
            </div>`).join('')}
          <div style="font-size:7px;color:#666;margin-top:6px;">¡El orden importa! Combaten de arriba a abajo. Arrastra (o toca ≡ y luego el destino) para reordenar · toca para ver la ficha.</div>
          <h3 style="margin-top:8px;">SINERGIAS <button class="btn small gray" id="btn-syn-info" style="font-size:7px;padding:2px 6px;">ℹ️ VER TODAS</button>
            <button class="btn small gray" id="btn-chart-info" style="font-size:7px;padding:2px 6px;">📊 TIPOS</button></h3>
          <div class="syn-chips">${synChipsHTML(run.team)}</div>
        </div>
        <div class="panel">
          <h3>OBJETOS</h3>
          ${Object.entries(run.items).filter(([, n]) => n > 0).map(([id, n]) =>
            `<div class="item-row" data-item="${id}"><span>${ITEMS[id].emoji}</span> ${ITEMS[id].name} ×${n}</div>`
          ).join('') || '<div style="font-size:8px;color:#888;">Bolsa vacía</div>'}
          <h3 style="margin-top:10px;">EMBLEMAS</h3>
          <div class="badge-grid">
            ${saga.islands.map((isl, i) =>
              `<div class="badge-slot ${run.badges.includes(i) ? '' : 'empty'}" title="${isl.name}">${run.badges.includes(i) ? '🏅' : '·'}</div>`
            ).join('')}
          </div>
          <button class="btn red small" id="btn-abandon" style="margin-top:12px;width:100%;">ABANDONAR</button>
          <button class="btn gray small" id="btn-home" style="margin-top:6px;width:100%;">MENÚ</button>
        </div>
      </div>
      <div class="map-board" style="min-height:${H}px">
        <div class="map-title">🏝️ ${island.name} — Isla ${run.islandIdx + 1}/${saga.islands.length} (${run.mode === 'nuzlocke' ? 'NUZLOCKE' : 'CLÁSICO'})</div>
        <svg class="map-svg">${edgesHTML}</svg>
        ${nodesHTML}
      </div>
    </div>
  `);

  document.querySelectorAll('.map-node.reachable').forEach(el => {
    el.onclick = () => enterNode(+el.dataset.r, +el.dataset.i);
  });
  let dragIdx = null, dragged = false, pickedIdx = null;
  const moveSlot = (from, to) => {
    const [f] = run.team.splice(from, 1);
    run.team.splice(to, 0, f);
    saveRun(); screenMap();
  };
  document.querySelectorAll('.team-slot').forEach(el => {
    const idx = +el.dataset.idx;
    el.ondragstart = e => {
      dragIdx = idx; dragged = true;
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
    };
    el.ondragend = () => {
      el.classList.remove('dragging');
      setTimeout(() => { dragged = false; }, 100);
    };
    el.ondragover = e => { e.preventDefault(); el.classList.add('dragover'); };
    el.ondragleave = () => el.classList.remove('dragover');
    el.ondrop = e => {
      e.preventDefault();
      el.classList.remove('dragover');
      if (dragIdx === null || dragIdx === idx) return;
      moveSlot(dragIdx, idx);
      dragIdx = null;
    };
    // En táctil no hay drag & drop: toca ≡ para "coger" y luego toca el destino
    el.querySelector('.drag-handle').onclick = e => {
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
    el.onclick = () => {
      if (pickedIdx !== null) {
        if (pickedIdx !== idx) moveSlot(pickedIdx, idx);
        else {
          pickedIdx = null;
          el.classList.remove('dragging');
        }
        return;
      }
      if (!dragged) showCharModal(run.team[idx]);
    };
  });
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
}

function useItemFromMap(id) {
  const item = ITEMS[id];
  if (item.kind === 'heal') {
    const f = run.team.find(x => x.hp > 0 && x.hp < x.maxhp);
    if (!f) return toast('Nadie necesita curarse ahora.');
    f.hp = Math.min(f.maxhp, f.hp + item.val);
    run.items[id]--;
    toast(`${charName(f)} recupera PS. ${item.emoji}`);
    saveRun(); screenMap();
  } else if (item.kind === 'revive') {
    if (run.mode === 'nuzlocke') return toast('En Nuzlocke los caídos no vuelven...');
    const f = run.team.find(x => x.hp <= 0);
    if (!f) return toast('Nadie está debilitado.');
    f.hp = Math.floor(f.maxhp * item.val);
    run.items[id]--;
    toast(`¡${charName(f)} vuelve a la lucha!`);
    saveRun(); screenMap();
  } else if (item.kind === 'boost') {
    const f = run.team[0];
    if (item.stat === 1) { f.atkBonus += 2; f.atk += 2; toast(`+2 ATQ para ${charName(f)}`); }
    else { f.defBonus += 2; f.def += 2; toast(`+2 DEF para ${charName(f)}`); }
    run.items[id]--;
    saveRun(); screenMap();
  } else {
    toast('Eso solo se usa en combate.');
  }
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
      const id = pick(island.pool);
      const lvl = rnd(island.lvl[0], island.lvl[1]);
      wildEncounter(makeChar(id, lvl));
      break;
    }
    case 'marine': {
      const n = Math.random() < 0.45 ? 3 : 2;
      const enemies = [];
      for (let k = 0; k < n; k++) {
        enemies.push(makeChar(pick(island.pool), rnd(island.lvl[0], island.lvl[1] + 1)));
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
      const lootIds = ['carne', 'carne', 'carnereal', 'cartel', 'cartel', 'carteldorado', 'sake', 'bocadillo'];
      const id = pick(lootIds);
      run.items[id] = (run.items[id] || 0) + 1;
      saveRun();
      modalInfo('🎁 ¡Objeto encontrado!', `<div class="reward-list">${ITEMS[id].emoji} <b>${ITEMS[id].name}</b><br><small>${ITEMS[id].desc}</small></div>`, screenMap);
      break;
    }
    case 'mystery': doMystery(island); break;
    case 'special': doSpecialPirate(island); break;
    case 'crossover': doCrossoverEvent(island); break;
    case 'shop': screenShop(); break;
    case 'rest': {
      run.team.forEach(f => { if (f.hp > 0) f.hp = Math.min(f.maxhp, f.hp + Math.floor(f.maxhp * 0.5)); });
      saveRun();
      modalInfo('⛺ Campamento', `<div class="reward-list">Tu banda descansa junto al fuego.<br>Los nakamas conscientes recuperan el 50% de sus PS. 🔥</div>`, screenMap);
      break;
    }
  }
}

function doMystery(island) {
  const ev = pick(MYSTERY_EVENTS);
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
        const id = pick(island.pool);
        startBattle([makeChar(id, rnd(island.lvl[0] + 1, island.lvl[1] + 2))], { wild: true });
      });
      break;
    }
    case 'healall': {
      run.team.forEach(f => { if (f.hp > 0) f.hp = f.maxhp; });
      saveRun();
      modalInfo('❓ Misterio', `<div class="reward-list">${ev.text} ♨️</div>`, screenMap);
      break;
    }
    case 'boost': {
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
        const id = pick(island.pool);
        const f = applyUpgrades(makeChar(id, island.lvl[0]));
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
  }
}

// ============ ENCUENTRO SALVAJE ============
// Secuencia de 3 opciones: combatir (gana XP), seducir pagando Berries, o
// tentar a la suerte con las 3 cadenas (cada una tiene un 50% de romperse;
// si las tres se rompen, el pirata se une; si una aguanta, eliges entre pagar
// 3 Carteles de Recluta o luchar contra él potenciado a cambio de más XP).
function wildRecruitPrice(c) { return c.rareza * 150 * (run.islandIdx + 1); }

function wildEncounter(wild) {
  const c = charData(wild);
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
    ${nuzBlock ? '<div class="special-fail">Regla Nuzlocke: ya reclutaste en esta isla (solo puedes combatir).</div>' : ''}
    <div class="actions" style="flex-direction:column;align-items:stretch;">
      <button class="btn red" id="we-fight">⚔️ COMBATIR — gana XP para la banda</button>
      <button class="btn green" id="we-pay" ${nuzBlock || run.berries < price ? 'disabled' : ''}>💋 SEDUCIR — ${berriesHTML(price)}</button>
      <button class="btn gold" id="we-chains" ${nuzBlock ? 'disabled' : ''}>⛓️ TENTAR A LA SUERTE — las 3 cadenas</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const recruit = () => {
    const f = { ...wild };
    applyUpgrades(f);
    addToTeam(f, ok => {
      if (ok) {
        if (run.mode === 'nuzlocke') run.nuzCaught[run.islandIdx] = true;
        registerRecruit(f.id);
        saveRun();
        modalInfo('🎉 ¡Nuevo nakama!', `<div class="reward-list"><span style="font-size:34px;">${charIcon(f.id, 44)}</span><br><b>${c.name}</b> Nv${wild.lvl} se une a tu banda.</div>`, screenMap);
      } else {
        modalInfo('🌊 Se marcha', '<div class="reward-list">Dejas marchar al pirata con un saludo.</div>', screenMap);
      }
    });
  };
  ov.querySelector('#we-fight').onclick = () => { ov.remove(); startBattle([wild], { wild: true }); };
  const payBtn = ov.querySelector('#we-pay');
  if (!nuzBlock && run.berries >= price) payBtn.onclick = () => {
    run.berries -= price;
    saveRun();
    ov.remove();
    recruit();
  };
  const chainsBtn = ov.querySelector('#we-chains');
  if (!nuzBlock) chainsBtn.onclick = () => { ov.remove(); renderChains(wild, recruit); };
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

// ============ RECLUTAR CON BANDA LLENA ============
// Siempre se puede reclutar: si la banda está llena, eliges a quién despedir (o no reclutar).
function addToTeam(f, done) {
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
      ${run.team.map((m, i) => `
        <div class="pick-row" data-out="${i}">
          <span class="emoji">${charIcon(m.id, 20)}</span>
          <div class="info"><b>${charName(m)}</b> Nv${m.lvl}<br>${m.hp}/${m.maxhp} PS</div>
          <span style="font-size:8px;color:var(--red);">DESPEDIR</span>
        </div>`).join('')}
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
// Muestra stats, movimientos, pasiva y definitiva (datos del compendio).
// Acepta un personaje vivo (con nivel/stats) o un id de la Dex (ficha base Nv5).
function showCharModal(fOrId) {
  const isLive = typeof fOrId === 'object';
  const f = isLive ? migrateFighter(fOrId) : makeChar(fOrId, 5);
  const c = CHARS[f.id];
  const lore = LORE[f.id] || LORE[baseFormOf(f.id)] || {};
  const spVal = lore.sp ? statAt(lore.sp, f.lvl) : null;
  const stats = [
    ['PS', f.maxhp, 45], ['ATQ', f.atk, 20], ['DEF', f.def, 20],
    ['E.ATQ', f.spatk, 20], ['E.DEF', f.spdef, 20],
    ...(spVal !== null ? [['SP', spVal, 20]] : []), ['VEL', f.spd, 20],
  ];
  const isFru = c.types.includes('Fruta'), isHak = c.types.includes('Haki');
  const known = f.moves;
  const future = c.learnset.filter(([l, m]) => l > f.lvl && !known.includes(m));
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal char-sheet">
    <h2><span style="font-size:26px;">${charIcon(f.id, 34)}</span> ${c.name} ${isLive ? `<small>Nv${f.lvl}</small>` : '<small>Nv5 (base)</small>'}</h2>
    ${typeBadges(c.types)}
    ${isFru || isHak ? `<div class="sheet-line">
      ${isFru ? '<b>🍈 Tag FRUTA</b> — recibe la mitad de daño de atacantes sin HAKI. ' : ''}
      ${isHak ? '<b>👁️ Tag HAKI</b> — sus ataques anulan la defensa pasiva de los usuarios FRUTA.' : ''}
    </div>` : ''}
    ${c.nakama ? '<div class="sheet-line" style="color:var(--sea);"><b>🏴‍☠️ Nakama de la banda</b> — activa Espíritu de Tripulación</div>' : ''}
    ${lore.clase ? `<div class="sheet-line"><b>Clase:</b> ${lore.clase}</div>` : ''}
    ${lore.faccion ? `<div class="sheet-line"><b>Facción:</b> ${lore.faccion}</div>` : ''}
    <div class="sheet-stats">
      ${stats.map(([label, val, max]) => `
        <div class="sheet-stat"><label>${label}</label>
          <div class="stat-bar"><i style="width:${clamp(val / (max * (1 + 0.085 * (f.lvl - 1))) * 100, 4, 100)}%"></i></div>
          <span>${val}</span>
        </div>`).join('')}
    </div>
    <div class="sheet-line" style="text-align:center;color:#777;">
      EVA ${Math.round(BASE_EVA * 100)}% · CRIT ${Math.round(BASE_CRIT * 100)}% (x${BASE_CRIT_DMG}) — mejorables con sinergias
    </div>
    <div class="sheet-section"><b>⚔️ Movimientos</b>
      ${known.map(m => {
        const mv = MOVES[m];
        const cat = mv.power === 0 ? '' : isPhysType(mv.type) ? ' · FÍS' : ' · ESP';
        return `<div class="sheet-move"><span class="type-badge" style="background:${TYPES[mv.type].color}">${mv.type.toUpperCase()}</span>
          ${mv.name} <small>${mv.power ? mv.power + ' PWR · ' + Math.round(mv.acc * 100) + '%' + cat : 'APOYO'}</small></div>`;
      }).join('')}
      ${future.map(([l, m]) => `<div class="sheet-move future">🔒 Nv${l} — ${MOVES[m].name}</div>`).join('')}
    </div>
    ${lore.pasiva ? `<div class="sheet-section"><b>✨ Pasiva — ${lore.pasiva.name}</b><p>${lore.pasiva.desc}</p></div>` : ''}
    ${lore.ulti ? `<div class="sheet-section"><b>💥 Definitiva — ${lore.ulti.name}</b><p>${lore.ulti.desc}</p></div>` : ''}
    ${c.evo ? `<div class="sheet-section"><b>🔄 Transformación</b><p>Al nivel ${c.evo.lvl} se convierte en ${CHARS[c.evo.to].name}.</p></div>` : ''}
    <p class="sheet-desc">${c.desc}</p>
    <div class="actions"><button class="btn gray" id="sheet-close">CERRAR</button></div>
  </div>`;
  document.body.appendChild(ov);
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
  const f = applyUpgrades(makeChar(id, lvl));
  addToTeam(f, ok => {
    if (ok) {
      if (run.mode === 'nuzlocke') run.nuzCaught[run.islandIdx] = true;
      registerRecruit(id);
      saveRun();
      modalInfo('🎉 ¡Nuevo nakama!', `<div class="reward-list"><span style="font-size:34px;">${charIcon(id, 44)}</span><br><b>${CHARS[id].name}</b> Nv${lvl} se une a tu banda.</div>`, screenMap);
    } else {
      modalInfo('🌊 Trato deshecho', '<div class="reward-list">Dejas marchar al recluta. Lo pagado no se devuelve: negocios son negocios.</div>', screenMap);
    }
  });
}

function doSpecialPirate(island) {
  const lvl = island.lvl[1] + 2;
  const gachaPrice = 300 * (run.islandIdx + 1);
  const blocked = specialBlockedReason();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>🌟 Mercado clandestino</h2>
    <p style="font-size:9px;line-height:1.9;text-align:center;">Un contacto de los bajos fondos te ofrece reclutas (Nv${lvl}).<br><br>
    <b>🎯 Elegir:</b> cualquier pirata del catálogo, pagando su caché completo.<br>
    <b>🎰 Carteles:</b> 5 carteles de SE BUSCA boca abajo. Destápalos en orden:
    el 1º es el más probable (recluta de 1⭐)... y el 5º, el premio gordo (5⭐).</p>
    ${blocked ? `<div class="special-fail">${blocked}</div>` : ''}
    <div class="actions" style="flex-direction:column;align-items:stretch;">
      <button class="btn blue" id="sp-choose" ${blocked ? 'disabled' : ''}>🎯 ELEGIR PIRATA — catálogo</button>
      <button class="btn gold" id="sp-gacha" ${blocked || run.berries < gachaPrice ? 'disabled' : ''}>🎰 JUGAR CARTELES — ${berriesHTML(gachaPrice)}</button>
      <button class="btn gray" id="sp-rates">📊 TABLA DE PROBABILIDADES</button>
      <button class="btn gray" id="sp-leave">🌊 MARCHARSE</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
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

function renderSpecialGacha(lvl) {
  // pesos decrecientes: cartel 1 → 5/15, cartel 2 → 4/15 ... cartel 5 → 1/15
  const weights = [5, 4, 3, 2, 1];
  let roll = Math.random() * 15, stopIdx = 4;
  for (let i = 0; i < 5; i++) { roll -= weights[i]; if (roll <= 0) { stopIdx = i; break; } }
  const prizeId = pick(poolByRareza(stopIdx + 1)) || pick(basePirateIds());
  let current = 0;
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>🎰 Los 5 carteles de SE BUSCA</h2>
    <p style="font-size:8px;text-align:center;margin-bottom:10px;">Destapa los carteles en orden. ¡En uno de ellos está tu recluta!</p>
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
      registerDex(prizeId);
      ov.querySelectorAll('.poster').forEach(p => { p.onclick = null; });
      setTimeout(() => { ov.remove(); specialJoin(prizeId, lvl); }, 1400);
    } else {
      face.innerHTML = `💨<br><span>VACÍO</span>`;
      el.classList.add('empty');
      current++;
      update();
    }
  };
  update();
}

// Tabla de probabilidades (drop rates) del gacha de carteles SE BUSCA:
// probabilidad de cada cartel/rareza y de cada personaje dentro de su rareza.
function showDropRatesModal() {
  const weights = [5, 4, 3, 2, 1];
  const total = weights.reduce((a, b) => a + b, 0);
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
  render(`
    ${topbar(true)}
    <div class="panel">
      <h2>🏪 Tienda del puerto</h2>
      <p style="font-size:9px;margin-bottom:10px;">"¡Bienvenido! Todo pirata necesita provisiones."</p>
      ${stock.map(id => {
        const it = ITEMS[id];
        return `<div class="shop-item">
          <span class="emoji">${it.emoji}</span>
          <div class="info"><b>${it.name}</b> — <span class="price">${berriesHTML(it.price)}</span><br><small>${it.desc}</small></div>
          <button class="btn small ${run.berries >= it.price ? 'green' : 'gray'}" data-buy="${id}" ${run.berries >= it.price ? '' : 'disabled'}>COMPRAR</button>
        </div>`;
      }).join('')}
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
      saveRun();
      toast(`Comprado: ${ITEMS[id].name} ${ITEMS[id].emoji}`);
      screenShop();
    };
  });
  $('#btn-leave').onclick = screenMap;
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

const activeP = () => battle.pTeam.find(f => f.hp > 0);
const activeE = () => battle.eTeam.find(f => f.hp > 0);

// ---------- Motor de pasivas (compendio) ----------
const isP = (f, id) => baseFormOf(f.id) === id;
const teamOf = f => (battle && battle.pTeam.includes(f)) ? battle.pTeam : (battle ? battle.eTeam : []);

// Estado en tiempo real de cada pasiva implementada
const PASSIVE_IMPL = {
  luffy:    f => ({ active: f.hp > 0 && f.hp < f.maxhp * 0.5 }),
  zoro:     f => ({ active: f.hp > 0 && f.hp < f.maxhp, extra: `+${Math.round(25 * (1 - f.hp / Math.max(1, f.maxhp)))}% crít` }),
  nami:     f => ({ active: f.hp > 0 }),
  usopp:    f => ({ active: f.hp > 0 }),
  sanji:    f => ({ active: f.hp > 0 }),
  franky:   f => ({ active: f.hp > 0 }),
  brook:    f => ({ active: !f.reviveUsed }),
  marco:    f => ({ active: f.hp > 0 }),
  katakuri: f => ({ active: (f.dodgeLeft || 0) > 0, extra: `${f.dodgeLeft || 0} esquivas` }),
  buggy:    f => ({ active: f.hp > 0 }),
  // 5 estrellas One Piece
  roger:    f => ({ active: f.hp > 0 }),
  newgate:  f => ({ active: f.hp > 0 && f.hp < f.maxhp * 0.5 }),
  kaido:    f => ({ active: f.hp > 0 }),
  bigmom:   f => ({ active: f.hp > 0 }),
  shanks:   f => ({ active: f.hp > 0 }),
  teach:    f => ({ active: f.hp > 0 }),
  mihawk:   f => ({ active: f.hp > 0 }),
  akainu:   f => ({ active: f.hp > 0 }),
  kizaru:   f => ({ active: f.hp > 0 }),
  aokiji:   f => ({ active: f.hp > 0 }),
  garp:     f => ({ active: f.hp > 0 }),
  dragon:   f => ({ active: f.hp > 0 }),
  oden:     f => ({ active: f.hp > 0 }),
  smoker:   f => ({ active: f.hp > 0 }),
  sengoku:  f => ({ active: f.hp > 0 }),
  fujitora: f => ({ active: f.hp > 0 }),
  ryokugyu: f => ({ active: f.hp > 0 }),
  garling:  f => ({ active: f.hp > 0 }),
  saturn:   f => ({ active: f.hp > 0 }),
  mars:     f => ({ active: f.hp > 0 }),
  warcury:  f => ({ active: f.hp > 0 }),
  nusjuro:  f => ({ active: f.hp > 0 }),
  jupeter:  f => ({ active: f.hp > 0 }),
  im:       f => ({ active: f.hp > 0 }),
  xebec:    f => ({ active: f.hp > 0 }),
  // Crossover 5 estrellas
  goku:     f => ({ active: f.hp > 0 && f.hp < f.maxhp * 0.7 }),
  gokuui:   f => ({ active: f.hp > 0 && f.hp < f.maxhp * 0.7 }),
  vegeta:   f => ({ active: f.hp > 0 }),
  jiren:    f => ({ active: f.hp > 0 }),
  saitama:  f => ({ active: f.hp > 0 }),
  madara:   f => ({ active: f.hp > 0 }),
  sukuna:   f => ({ active: f.hp > 0 }),
  gojo:     f => ({ active: (f.dodgeLeft || 0) > 0, extra: `${f.dodgeLeft || 0} esquiva` }),
  kibutsuji: f => ({ active: f.hp > 0 }),
  cell:     f => ({ active: f.hp > 0 }),
  frieza:   f => ({ active: f.hp > 0 }),
  zenosama: f => ({ active: f.hp > 0 }),
};

function passiveInfo(f) {
  const base = baseFormOf(f.id);
  const lore = LORE[f.id] || LORE[base];
  if (!lore || !lore.pasiva) return null;
  const impl = PASSIVE_IMPL[base];
  let active = false, extra = '';
  if (impl) { const st = impl(f); active = st.active; extra = st.extra ? ` (${st.extra})` : ''; }
  return { label: lore.pasiva.name + extra, active, desc: lore.pasiva.desc, implemented: !!impl };
}

// ---------- Sinergias de equipo (rediseño) ----------
// 2+ nakamas vivos del mismo tipo = sinergia I; el equipo entero = sinergia II.
const SYNERGIES = {
  Corte: { name: 'Precisión Quirúrgica',
    d1: '+15% de Daño Crítico (CRIT_DMG) a todo el equipo',
    d2: '+35% de Daño Crítico y +10% de Probabilidad Crítica' },
  Golpe: { name: 'Fuerza Bruta',
    d1: '+12% de daño a movimientos de ATQ físico',
    d2: '+25% de daño físico y los ataques rompen un 15% de la DEF rival' },
  Disparo: { name: 'Ojo Crítico',
    d1: '+10% de Probabilidad Crítica (CRIT_CHANCE)',
    d2: '+20% de Probabilidad Crítica y los críticos ignoran la evasión rival' },
  Fuego: { name: 'Combustión',
    d1: '+12% de daño a movimientos de Fuego',
    d2: '+25% de daño de Fuego; al asestar un crítico inflige Quemadura (3% PS por turno)' },
  Hielo: { name: 'Control / Ralentización',
    d1: '+10% de daño de Hielo',
    d2: '+20% de daño de Hielo y los ataques reducen la VEL del enemigo un 15% durante 1 turno' },
  Veneno: { name: 'Corrosión',
    d1: '+10% de daño de movimientos de Veneno',
    d2: 'Todos los ataques tienen un 25% de probabilidad de envenenar; los envenenados pierden un 20% de ESP_DEF' },
  Oscuridad: { name: 'Vórtice',
    d1: '+10% de daño contra objetivos con el tag FRUTA',
    d2: '+25% de daño contra objetivos FRUTA y anula las pasivas de curación rivales' },
  Agua: { name: 'Flujo Vital',
    d1: 'El luchador activo recupera 4% PS al final de cada ronda',
    d2: 'Recupera 8% PS por ronda y todo el equipo gana +15% de ESP_DEF' },
  Rayo: { name: 'Aceleración y Reflejos',
    d1: '+20% de VEL',
    d2: '+40% de VEL y el primer ataque del combate es un crítico garantizado' },
  Viento: { name: 'Ligereza',
    d1: '+8% de EVA (Evasión)',
    d2: '+18% de EVA; esquivar un golpe aumenta la velocidad un 20% durante la ronda siguiente' },
  Tierra: { name: 'Baluarte',
    d1: '+15% de DEF física',
    d2: '+30% de DEF física y resistencia a críticos (los críticos enemigos hacen daño normal)' },
  Fruta: { name: 'Despertar Paramecia/Zoan/Logia',
    d1: '+12% al daño de ESP_ATQ',
    d2: '+25% al daño de ESP_ATQ y +15% a ESP_DEF' },
  Haki: { name: 'Voluntad Inquebrantable',
    d1: 'Otorga el tag HAKI a todo el equipo y +8% de daño general',
    d2: '+18% de daño general, +10% de CRIT_CHANCE y anula la evasión (EVA) del enemigo' },
  Nakama: { name: 'Espíritu de Tripulación',
    d1: '+10% a todas las estadísticas si ningún miembro comparte tipo primario',
    d2: 'Un aliado que caiga a 0 PS sobrevive con 1 PS una vez por viaje' },
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
const hasFruta = f => charData(f).types.includes('Fruta');
// HAKI: tipo propio o concedido por la sinergia Haki del equipo (nivel I+)
const hasHaki = f => charData(f).types.includes('Haki') ||
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
  ov.innerHTML = `<div class="modal">
    <h2>🧩 Sinergias de equipo</h2>
    <p style="font-size:8px;text-align:center;margin-bottom:10px;">2+ nakamas vivos que comparten tipo activan la Sinergia I;
    si el equipo entero lo comparte, la Sinergia II.</p>
    ${Object.keys(SYNERGIES).map(t => {
      const tier = team ? synergyTier(team, t) : 0;
      const s = SYNERGIES[t];
      return `<div class="sheet-section" style="${tier ? 'background:#fff8e0;' : ''}">
        <b>${synEmoji(t)} ${t} — ${s.name} ${tier ? `<span style="color:var(--accent);">— ACTIVA ${tier === 2 ? 'Ⅱ' : 'Ⅰ'}</span>` : ''}</b>
        <p>Ⅰ: ${s.d1}<br>Ⅱ: ${s.d2}</p>
      </div>`;
    }).join('')}
    <div class="actions">
      <button class="btn blue" id="syn-chart">📊 TABLA DE TIPOS</button>
      <button class="btn gray" id="syn-close">CERRAR</button>
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
  ov.innerHTML = `<div class="modal" style="max-width:560px;">
    <h2>📊 Tabla de debilidades</h2>
    <div style="overflow-x:auto;">
      <table class="chart-table">
        <tr><th>Atacante</th><th>+25% fuerte contra</th><th>-25% débil contra</th><th>Efecto especial</th></tr>
        ${rows}
      </table>
    </div>
    <div class="sheet-section" style="margin-top:10px;">
      <b>🍈👁️ Tags de Naturaleza</b>
      <p><b>FRUTA</b>: usuario de Fruta del Diablo · <b>HAKI</b>: capaz de imbuir Haki.<br><br>
      ⚖️ <b>Regla núcleo:</b> si el atacante NO tiene HAKI y el defensor tiene el tag FRUTA,
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
      por ronda</b> hasta anularse. Ningún combate puede durar para siempre.</p>
    </div>
    <div class="actions">
      <button class="btn blue" id="tc-syn">🧩 SINERGIAS</button>
      <button class="btn gray" id="tc-close">CERRAR</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#tc-close').onclick = () => ov.remove();
  const synBtn = ov.querySelector('#tc-syn');
  if (synBtn) synBtn.onclick = () => { ov.remove(); showSynergyModal(team); };
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
}

function startBattle(enemies, opts) {
  playMusic('combat');
  const team = opts.tower ? tower.team : run.team;
  if (!team.some(f => f.hp > 0)) return opts.tower ? towerGameOver() : gameOver();
  battle = {
    pTeam: team, eTeam: enemies,
    items: opts.tower ? tower.items : run.items,
    opts, speed: autoSpeed, over: false, waiting: false,
    tower: !!opts.tower,
    timer: null,
    round: 1,
  };
  enemies.forEach(e => registerDex(e.id));
  // reinicia pasivas y estados por-combate
  [...battle.pTeam, ...battle.eTeam].forEach(f => {
    migrateFighter(f);
    if (isP(f, 'katakuri')) f.dodgeLeft = 2;
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
  return `<div class="fcard ${f.hp <= 0 ? 'ko' : ''} ${f === active ? 'active' : ''}" id="fc-${side}-${idx}">
    <div class="fcard-title">${c.name} Nv${f.lvl} <span class="fcard-tags">${tagIcons(f)}</span><span class="fcard-st">${stIcons(f)}</span></div>
    <div class="fcard-hp">
      <div class="hp-bar"><i class="${hpBarClass(f)}" style="width:${clamp(f.hp / f.maxhp * 100, 0, 100)}%"></i></div>
      <div class="hp-nums">${f.hp}/${f.maxhp}</div>
    </div>
    <div class="fcard-sprite">
      <span class="sprite ${side === 'p' ? 'flip' : ''}">${charIcon(f.id, 44)}</span>
      <div class="platform"></div>
    </div>
    ${ps ? `<div class="fcard-passive ${ps.active ? 'on' : ''}" title="${ps.desc}">✨ ${ps.label}</div>` : ''}
  </div>`;
}

function controlsHTML() {
  const b = battle;
  let html = '';
  for (const id of ['carne', 'carnereal', 'bocadillo', 'sake']) {
    if (b.items[id] > 0) html += `<button class="btn small blue" data-ctl="item" data-arg="${id}" title="${ITEMS[id].name}">${ITEMS[id].emoji} ×${b.items[id]}</button>`;
  }
  html += `<button class="btn small gray" data-ctl="speed" title="Atajo: barra espaciadora">⏩ VELOCIDAD x${b.speed}</button>`;
  html += `<button class="btn small gray" data-ctl="info">🧩 SINERGIAS Y TIPOS</button>`;
  if (b.opts.wild && !b.tower) html += `<button class="btn small red" data-ctl="run">🏃 HUIR</button>`;
  if (b.tower) html += `<button class="btn small red" data-ctl="quit">🏳️ RENDIRSE</button>`;
  return html;
}

function renderBattle(logLines) {
  const b = battle;
  const eHead = b.opts.wild ? '🌊' : b.opts.boss ? '💀' : '⚓';
  render(`
    ${topbar(!b.tower)}
    <div class="battle-layout">
      <div class="battle-main">
        <div class="battle-cols">
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
        <div class="battle-log" id="battle-log">${logLines.map(l => `<div>${l}</div>`).join('')}</div>
      </div>
      <div class="battle-sidebar" id="battle-controls">${controlsHTML()}</div>
    </div>
  `);
  bindControls();
  // toca una carta para consultar su ficha sin pausar el combate
  [['p', b.pTeam], ['e', b.eTeam]].forEach(([side, team]) => {
    team.forEach((f, i) => {
      const card = $(`#fc-${side}-${i}`);
      if (card) card.onclick = () => showCharModal(f);
    });
  });
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
      const stEl = card.querySelector('.fcard-st');
      if (stEl) stEl.textContent = stIcons(f);
      const pEl = card.querySelector('.fcard-passive');
      if (pEl) {
        const ps = passiveInfo(f);
        pEl.textContent = `✨ ${ps.label}`;
        pEl.classList.toggle('on', ps.active);
      }
    });
  });
  const sp = $('#syn-p'); if (sp) sp.innerHTML = synChipsHTML(battle.pTeam);
  const se = $('#syn-e'); if (se) se.innerHTML = synChipsHTML(battle.eTeam);
}

// Elige automáticamente el mejor movimiento según potencia, precisión, tipos y categoría
function chooseMove(att, dfd) {
  let best = null, bestScore = -1;
  for (const m of att.moves) {
    const mv = MOVES[m];
    if (mv.power === 0) {
      // no malgasta el turno curando si el Clímax de combate ya anula las curaciones
      if (mv.effect === 'heal40' && att.hp < att.maxhp * 0.45 && healScaleNow() > 0) return mv;
      continue;
    }
    const stat = isPhysType(mv.type) ? att.atk : att.spatk;
    const score = mv.power * mv.acc * typeMult(mv.type, charData(dfd).types) * stat;
    if (score > bestScore) { bestScore = score; best = mv; }
  }
  return best || MOVES[att.moves[0]] || MOVES.punetazo;
}

// ---------- Críticos y evasión ----------
function critChanceFor(att) {
  let c = BASE_CRIT;
  // Pasiva Zoro: crítico creciente con el PS faltante
  if (isP(att, 'zoro')) c += 0.25 * (1 - att.hp / Math.max(1, att.maxhp));
  if (isP(att, 'mihawk')) c += 0.15;
  if (isP(att, 'oden')) c += 0.10;
  const team = teamOf(att);
  if (synergyTier(team, 'Corte') === 2) c += 0.10;
  const tD = synergyTier(team, 'Disparo');
  if (tD) c += tD === 2 ? 0.20 : 0.10;
  if (synergyTier(team, 'Haki') === 2) c += 0.10;
  return c;
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
  let e = BASE_EVA;
  // Pasiva Nami: +10% de evasión de equipo
  if (teamOf(dfd).some(x => x.hp > 0 && isP(x, 'nami'))) e += 0.10;
  if (teamOf(dfd).some(x => x.hp > 0 && isP(x, 'dragon'))) e += 0.15;
  if (isP(dfd, 'smoker')) e += 0.20;
  if (isP(dfd, 'gojo') && (dfd.dodgeLeft || 0) > 0) e = 1.0; // Gojo esquiva 1er golpe
  const tV = synergyTier(teamOf(dfd), 'Viento');
  if (tV) e += tV === 2 ? 0.18 : 0.08;
  return e;
}

function calcDamage(att, dfd, mv, crit) {
  const phys = isPhysType(mv.type);
  let eff = typeMult(mv.type, charData(dfd).types);
  // Pasiva Buggy: inmune al daño de espadas
  if (isP(dfd, 'buggy') && mv.type === 'Corte') eff = 0;
  const atkTeam = teamOf(att), defTeam = teamOf(dfd);
  // Categoría: físico usa ATQ vs DEF; especial usa ESP_ATQ vs ESP_DEF
  let atkStat = (phys ? att.atk : att.spatk) * nakamaStatMult(atkTeam);
  let defStat = (phys ? dfd.def : dfd.spdef) * nakamaStatMult(defTeam);
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
  const r = 0.85 + Math.random() * 0.15;
  let dmg = base * eff * r;
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
  if (isP(att, 'saitama')) dmg *= 1.35;
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
    if (mv.effect === 'heal40') {
      const heal = Math.floor(40 * healScaleNow());
      if (heal > 0) {
        att.hp = Math.min(att.maxhp, att.hp + heal);
        log(`${attName} usa ${mv.name} y recupera ${heal} PS.`);
      } else {
        log(`${attName} usa ${mv.name}... ¡pero el Clímax de combate anula la curación! ⚔️`);
      }
    }
    refreshHPCards();
    return;
  }
  // Pasiva Katakuri: esquiva los 2 primeros ataques del combate
  if (isP(dfd, 'katakuri') && (dfd.dodgeLeft || 0) > 0) {
    dfd.dodgeLeft--;
    log(`${charName(dfd)} esquiva el ataque. ✨ (Futuro Inalterable)`);
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

function runRound() {
  const b = battle;
  if (!b || b.over || b.waiting) return;
  const p = b.curP, e = b.curE;
  if (!p || !e || p.hp <= 0 || e.hp <= 0) return afterRound();
  // Velocidad efectiva: Rayo (+20/+40%), Nakama Ⅰ, ralentización de Hielo,
  // racha de Viento Ⅱ y pasiva Usopp (siempre ataca primero)
  const spdOf = f => {
    let s = f.spd * nakamaStatMult(teamOf(f));
    const tR = synergyTier(teamOf(f), 'Rayo');
    if (tR) s *= tR === 2 ? 1.40 : 1.20;
    if (f.st && f.st.slow) s *= 0.85;
    if (f.st && f.st.gust) s *= 1.20;
    if (isP(f, 'usopp')) s += 1000;
    return s;
  };
  const pSpd = spdOf(p), eSpd = spdOf(e);
  const order = pSpd >= eSpd
    ? [[p, e, 'enemy'], [e, p, 'player']]
    : [[e, p, 'player'], [p, e, 'enemy']];
  let i = 0;
  const step = () => {
    if (!battle || battle.over) return;
    if (battle.waiting) { battle.pendingStep = step; return; }
    if (i < order.length) {
      const [att, dfd, side] = order[i++];
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
  // Pasiva Brook (Segunda Vida) y sinergia Nakama Ⅱ (sobrevive con 1 PS, una vez por viaje)
  const checkRevive = f => {
    if (!f || f.hp > 0) return;
    if (isP(f, 'brook') && !f.reviveUsed) {
      f.reviveUsed = true;
      f.hp = Math.max(1, Math.floor(f.maxhp * 0.2));
      log(`✨ ¡Segunda Vida! ${charName(f)} se niega a morir. ¡Yohohoho!`);
      return;
    }
    if (synergyTier(teamOf(f), 'Nakama') === 2) {
      const isPlayer = b.pTeam.includes(f);
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
  checkRevive(b.curP); checkRevive(b.curE);
  const deadE = b.curE.hp <= 0, deadP = b.curP.hp <= 0;
  let changed = false;

  if (deadE) {
    log(`¡${charName(b.curE)} cae derrotado!`);
    // registro de vencidos en historia (habilita comprarlos en el mercado clandestino)
    if (run && !b.tower && !meta.defeated.includes(b.curE.id)) {
      meta.defeated.push(b.curE.id);
      saveMeta();
    }
    const xp = Math.floor(b.curE.lvl * 14 * (charData(b.curE).boss ? 1.6 : 1) * (b.opts.xpMult || 1));
    log(`¡Toda la banda gana ${xp} EXP!`);
    b.pTeam.forEach(f => { if (f.hp > 0) gainXP(f, xp, log); });
    changed = true;
  }
  if (deadP) {
    log(`¡${charName(b.curP)} está debilitado!`);
    if (run && run.mode === 'nuzlocke' && !b.tower) {
      const idx = run.team.indexOf(b.curP);
      if (idx >= 0) {
        run.team.splice(idx, 1);
        log(`☠️ ${charName(b.curP)} abandona la banda para siempre...`);
      }
    }
    changed = true;
  }

  const ne = activeE(), np = activeP();
  if (!ne) {
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
  // Pasiva Marco, Kibutsuji, Ryokugyu + Sinergia Agua: curan al luchador activo cada ronda.
  // Oscuridad Ⅱ del rival (Vórtice) anula estas curaciones pasivas.
  [[b.pTeam, np], [b.eTeam, ne]].forEach(([team, act]) => {
    if (act.hp <= 0 || act.hp >= act.maxhp) return;
    const foe = team === b.pTeam ? b.eTeam : b.pTeam;
    const foeAct = team === b.pTeam ? ne : np;
    if (synergyTier(foe, 'Oscuridad') === 2) return;
    let heal = 0;
    if (team.some(x => x.hp > 0 && isP(x, 'marco'))) heal += 0.06;
    if (team.some(x => x.hp > 0 && isP(x, 'kibutsuji'))) heal += 0.05;
    if (team.some(x => x.hp > 0 && isP(x, 'ryokugyu'))) heal += 0.05;
    const tA = synergyTier(team, 'Agua');
    if (tA) heal += tA === 2 ? 0.08 : 0.04;
    heal *= healScaleNow(); // el Clímax de combate también apaga las curaciones pasivas
    if (heal > 0) act.hp = Math.min(act.maxhp, act.hp + Math.max(1, Math.floor(act.maxhp * heal)));
    // Big Mom Soul Pocus: drena PS del activo rival
    if (team.some(x => x.hp > 0 && isP(x, 'bigmom')) && foeAct && foeAct.hp > 0) {
      const drain = Math.max(1, Math.floor(foeAct.maxhp * 0.04));
      foeAct.hp = Math.max(0, foeAct.hp - drain);
      act.hp = Math.min(act.maxhp, act.hp + drain);
    }
  });
  // Avance de ronda y aviso del Clímax de combate
  b.round = (b.round || 1) + 1;
  if (b.round === CLIMAX_ROUND + 1) {
    log('⚔️ <b>¡Clímax de combate!</b> El daño aumenta cada ronda y las curaciones flaquean.');
  } else if (b.round > CLIMAX_ROUND + 1) {
    const pct = Math.round((climaxDmgMult() - 1) * 100);
    const hs = Math.round(healScaleNow() * 100);
    log(`⚔️ Clímax: +${pct}% de daño · curaciones al ${hs}%.`);
  }
  refreshHPCards();
  scheduleRound(changed ? 1800 : 1400);
}

// --- Intervenciones del jugador durante el combate automático ---
function bindControls() {
  document.querySelectorAll('[data-ctl]').forEach(btn => {
    btn.onclick = () => {
      const b = battle;
      if (!b || b.over) return;
      const kind = btn.dataset.ctl, arg = btn.dataset.arg;
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
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
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
    const newVets = unlockRoster();
    gainFame(20);
    const saga = SAGAS[run.saga];
    if (run.islandIdx >= saga.islands.length - 1) {
      saveRun();
      return offerCrossoverPath(newVets);
    }
    run.islandIdx++;
    run.map = genMap(saga.islands[run.islandIdx]);
    run.pos = null;
    // travesía entre islas: toda la banda revive y se recupera al completo
    run.team.forEach(f => { f.hp = f.maxhp; });
    saveRun();
    modalInfo('🏅 ¡Emblema conseguido!',
      `<div class="reward-list">¡Has conquistado la isla!<br>+20 ⭐ Fama<br><br>Rumbo a <b>${saga.islands[run.islandIdx].name}</b> 🧭<br>Tu equipo se recupera durante la travesía.${
        newVets.length ? `<br><br><small>🏅 Veteranos desbloqueados para futuras aventuras:<br>${newVets.map(id => `${charIcon(id, 16)} ${CHARS[id].name}`).join(' · ')}</small>` : ''
      }</div>`,
      screenMap);
    return;
  }
  saveRun();
  screenMap();
}

// ============ EVENTO: CROSSOVER DE ANIME ============
// Tras el combate de jefe de final de saga se abre un camino alternativo
// aparentemente sin salida (un nodo con una única conexión). Dentro, un jefe
// de otra serie con +50% de Daño y Defensa; al vencerlo, eliges 1 de 3
// personajes predefinidos de esa serie.
function offerCrossoverPath(newVets) {
  // partidas guardadas con mapas anteriores: asegura que el nodo exista
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
      <br>Pero al recoger el emblema, el aire vibra... Un <b>camino alternativo</b> 🌀
      aparece donde antes no había salida.<br><br>
      Puedes explorarlo (te espera un rival de otro mundo, <b>mucho más fuerte</b>...
      ¡y una recompensa legendaria!) o zarpar y conquistar la saga sin arriesgarte.</p>
    <div class="actions" style="flex-direction:column;align-items:stretch;">
      <button class="btn gold" id="cx-explore">🌀 EXPLORAR EL CAMINO</button>
      <button class="btn green" id="cx-finish">🏴‍☠️ CONQUISTAR LA SAGA</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
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
      Si lo derrotas, podrás reclutar a <b>1 héroe pendiente</b> de la serie.<br>
      <small>(Tu banda ha recuperado un 50% de PS con el aire dimensional.)</small></p>
    <div class="actions" style="flex-direction:column;align-items:stretch;">
      <button class="btn red" id="cx-fight">⚔️ ACEPTAR EL DUELO</button>
      <button class="btn gray" id="cx-leave">🌊 RETIRARSE Y CONQUISTAR LA SAGA</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#cx-fight').onclick = () => {
    ov.remove();
    startBattle(enemies, {
      wild: false, crossover: key,
      intro: `🌀 ¡${CHARS[bossId].name} bloquea el camino entre mundos!`,
    });
  };
  ov.querySelector('#cx-leave').onclick = () => { ov.remove(); sagaComplete(); };
}

// Recompensa del crossover: pantalla para elegir 1 de los personajes pendientes de la serie
function crossoverReward(key) {
  const s = CROSSOVER_SERIES[key];
  const island = SAGAS[run.saga].islands[run.islandIdx];
  const lvl = island.bossLvl[island.bossLvl.length - 1];
  let rewardPool = s.rewards.filter(id => !meta.recruited.includes(id) && !meta.roster.includes(id));
  if (!rewardPool.length) rewardPool = s.rewards;
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>🎁 Recompensa del crossover</h2>
    <p style="font-size:9px;text-align:center;line-height:1.9;margin-bottom:10px;">
      ¡Victoria! La grieta se cierra, pero antes... elige a <b>1 héroe</b>
      de <b>${s.name}</b> ${s.emoji} para que se una a tu leyenda. (+30 ⭐ Fama)</p>
    <div class="pick-grid">
      ${rewardPool.map(id => {
        const c = CHARS[id];
        return `<div class="pick-row" data-pick="${id}">
          <span class="emoji">${c.emoji}</span>
          <div class="info"><b>${c.name}</b> ${'⭐'.repeat(c.rareza)} · Nv${lvl}<br><small>${c.types.join(' / ')}</small></div>
          <span style="font-size:8px;color:var(--green);">RECLUTAR</span>
        </div>`;
      }).join('')}
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.querySelectorAll('[data-pick]').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.pick;
      ov.remove();
      const f = applyUpgrades(makeChar(id, lvl));
      addToTeam(f, ok => {
        if (ok) {
          registerRecruit(id);
          unlockRoster(true);
          saveRun();
          modalInfo('🎉 ¡Nuevo nakama legendario!',
            `<div class="reward-list"><span style="font-size:34px;">${CHARS[id].emoji}</span><br><b>${CHARS[id].name}</b> Nv${lvl} se une a tu banda<br>y queda desbloqueado como veterano.</div>`,
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
  playMusic('menu');
  const saga = SAGAS[run.saga];
  const diffLevel = (run && run.diff) || 1;
  const dObj = DIFFICULTIES.find(d => d.id === diffLevel) || DIFFICULTIES[0];
  
  if (run.mode === 'nuzlocke') meta.nuzWins[saga.id] = (meta.nuzWins[saga.id] || 0) + 1;
  else meta.wins[saga.id] = (meta.wins[saga.id] || 0) + 1;

  meta.sagaDiffWins = meta.sagaDiffWins || {};
  meta.sagaDiffWins[saga.id] = meta.sagaDiffWins[saga.id] || {};

  const isFirstDiffWin = !meta.sagaDiffWins[saga.id][diffLevel];
  meta.sagaDiffWins[saga.id][diffLevel] = true;

  const baseFame = run.mode === 'nuzlocke' ? 150 : 100;
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

  // Cada nakama de la banda gana experiencia de saga: +3 Nv inicial en futuros viajes
  meta.sagaClears = meta.sagaClears || {};
  run.team.forEach(f => {
    const b = baseFormOf(f.id);
    meta.sagaClears[b] = (meta.sagaClears[b] || 0) + 1;
  });
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
      ${team.map(f => `${charName(f)} Nv${f.lvl}`).join(' · ')}<br><br>
      ${rewardMessage}</p>
      <p style="font-size:9px;color:#666;margin-bottom:14px;">Tus nakamas ${addedLegendaries.length ? '(¡incluyendo legendarios!) ' : ''}quedan disponibles como veteranos para próximas aventuras<br>
      y empezarán los próximos viajes con +3 niveles por esta conquista.<br>¡La Torre Marine se ha desbloqueado!</p>
      <button class="btn green" id="btn-fin">VOLVER AL PUERTO</button>
    </div>
  `);
  $('#btn-fin').onclick = screenHome;
}

function gameOver() {
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
  render(`
    ${topbar(false)}
    <button class="btn gray small back-btn" id="btn-back">← VOLVER</button>
    <div class="panel">
      <h2>🗼 Torre Marine</h2>
      <p>Combates automáticos infinitos contra oleadas cada vez más fuertes.
      Elige a <b>3 nakamas desbloqueados</b> (salen a Nv15, con sus mejoras del Barco)
      y recibe 3 Platos de Sanji. ¿Hasta qué piso llegarás?</p>
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
    tower = { floor: 1, team: picked.map(id => applyUpgrades(makeChar(id, 15))), items: { bocadillo: 3, sake: 1 } };
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
  berriesplus:  { name: 'Fondo de expedición',   emoji: '💰', desc: '+200 Berries al zarpar en cada aventura.', cost: 250, lvl: 2 },
  cartelesplus: { name: 'Imprenta de carteles',  emoji: '📜', desc: '+2 Carteles de Recluta al zarpar.', cost: 300, lvl: 3 },
  doblestarter: { name: 'Dúo inicial',           emoji: '👥', desc: 'Zarpa con 2 nakamas iniciales en vez de 1.', cost: 600, lvl: 5 },
};

const UPG_STATS = [
  ['hp', 'PS', '+3 PS máx.'],
  ['atk', 'ATQ', '+1 ATQ'],
  ['def', 'DEF', '+1 DEF'],
  ['spatk', 'E.ATQ', '+1 E.ATQ'],
  ['spdef', 'E.DEF', '+1 E.DEF'],
  ['spd', 'VEL', '+1 VEL'],
];
const UPG_MAX = 10;
let shipBuyLock = 0;
// Costes por tramos: las 2 primeras compras cuestan ⭐30, las 2 siguientes ⭐60, luego ⭐90...
function upgCost(lvl) { return (Math.floor(lvl / 2) + 1) * 30; }

function screenShip() {
  playMusic('menu');
  const roster = meta.roster.filter(id => CHARS[id]);
  const accLvl = accountLevel();
  render(`
    ${topbar(false)}
    <button class="btn gray small back-btn" id="btn-back">← VOLVER</button>
    <div class="panel">
      <h2>🏪 Tienda</h2>
      <p style="font-size:9px;line-height:1.9;">Gasta ⭐ Fama en mejoras permanentes.
      La Fama se gana con emblemas (+20), sagas (+100 / +150 en Nuzlocke), pisos de la Torre (+5)
      e incluso derrotas honrosas — y cada punto también da PX de cuenta.</p>
      <div style="text-align:center;font-size:12px;margin:12px 0;color:var(--accent);">
        ⭐ ${meta.fame} Fama · 👤 Cuenta Nv${accLvl} (${meta.accXp || 0}/${accountNextAt()} PX)
      </div>
      <h2 style="font-size:11px;">🌍 Añadidos globales</h2>
      ${Object.entries(GLOBAL_ITEMS).map(([id, it]) => {
        const owned = !!meta.global[id];
        const locked = accLvl < it.lvl;
        const can = !owned && !locked && meta.fame >= it.cost;
        return `<div class="shop-item">
          <span class="emoji">${it.emoji}</span>
          <div class="info"><b>${it.name}</b> — <span class="price">⭐${it.cost}</span><br><small>${it.desc}</small></div>
          ${owned ? '<span style="font-size:8px;color:var(--green);">✓ COMPRADO</span>'
            : locked ? `<span style="font-size:8px;color:#888;">🔒 Cuenta Nv${it.lvl}</span>`
            : `<button class="btn small ${can ? 'green' : 'gray'}" data-global="${id}" ${can ? '' : 'disabled'}>COMPRAR</button>`}
        </div>`;
      }).join('')}
      <h2 style="font-size:11px;margin-top:16px;">⚓ Mi Barco — Entrenamiento de veteranos</h2>
      ${roster.length ? roster.map(id => {
        const c = CHARS[id];
        const u = meta.upgrades[id] || {};
        return `<div class="ship-row">
          <span class="emoji">${charIcon(id, 28)}</span>
          <div class="ship-name"><b>${c.name}</b>${typeBadges(c.types)}</div>
          <div class="ship-upgs">
            ${UPG_STATS.map(([stat, label, desc]) => {
              const lvl = u[stat] || 0;
              const cost = upgCost(lvl);
              const maxed = lvl >= UPG_MAX;
              const can = !maxed && meta.fame >= cost;
              return `<div class="upg">
                <span class="upg-label">${label} ${lvl}/${UPG_MAX}</span>
                <button class="btn small ${can ? 'green' : 'gray'}" data-up="${id}" data-stat="${stat}"
                  title="${desc}" ${can ? '' : 'disabled'}>${maxed ? 'MÁX' : `⭐${cost}`}</button>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('') : '<p style="text-align:center;font-size:9px;color:#888;">Aún no tienes veteranos.<br>Supera islas con nakamas en tu banda para desbloquearlos.</p>'}
    </div>
  `);
  $('#btn-back').onclick = screenHome;
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
  document.querySelectorAll('[data-up]').forEach(btn => {
    btn.onclick = () => {
      if (Date.now() - shipBuyLock < 300) return; // evita compras dobles accidentales
      shipBuyLock = Date.now();
      const id = btn.dataset.up, stat = btn.dataset.stat;
      const u = meta.upgrades[id] = meta.upgrades[id] || {};
      const lvl = u[stat] || 0;
      const cost = upgCost(lvl);
      if (lvl >= UPG_MAX || meta.fame < cost) return;
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
    <div class="emoji">${seen ? charIcon(id, 32) : '❔'}</div>
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

// ============ INICIO ============
screenHome();
