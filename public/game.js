// ============ GRAND LINE LIKE — Motor del juego ============
'use strict';

const $ = sel => document.querySelector(sel);
const app = $('#app');
let worldNavigator = null, worldShipLocation = null, worldSelection = null;
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Mapa forma evolucionada -> forma base (para el roster de iniciales)
const BASE_OF = {};
for (const [id, c] of Object.entries(CHARS)) if (c.evo) BASE_OF[c.evo.to] = id;
function baseFormOf(id) { while (BASE_OF[id]) id = BASE_OF[id]; return id; }

// Las formas requieren tanto el nivel en partida como el nivel base permanente.
function evolutionFormAt(id, lvl, progress = meta) {
  const baseLevel = startLvlOf(id, progress);
  let form = baseFormOf(id);
  while (CHARS[form].evo && Math.min(lvl, baseLevel) >= CHARS[form].evo.lvl) form = CHARS[form].evo.to;
  return form;
}
function formMovesAt(id, lvl, exactForm = false, progress = meta) {
  const c = CHARS[id];
  const limit = !exactForm && c.evo && startLvlOf(id, progress) < c.evo.lvl ? c.evo.lvl - 1 : lvl;
  const moves = c.learnset.filter(([level]) => level <= Math.min(lvl, limit)).map(([,move]) => move).slice(-2);
  return moves.length ? moves : [c.learnset[0][1]];
}
function syncEvolution(f, progress = meta) {
  if (!CHARS[f.id] || !CHARS[baseFormOf(f.id)].evo) return f;
  const old = CHARS[f.id], nextId = evolutionFormAt(f.id, f.lvl, progress), next = CHARS[nextId];
  if (f.id === nextId && f.evolutionRulesVersion === 2) return f;
  // Apply only the base-stat difference, preserving equipment, fusion and event bonuses.
  const deltaHP = hpAt(next.base[0], f.lvl) - hpAt(old.base[0], f.lvl);
  f.maxhp += deltaHP;
  if (f.hp > 0) f.hp = clamp(f.hp + deltaHP, 1, f.maxhp);
  ['atk','def','spatk','spdef','spd'].forEach((key,i) => {
    f[key] += statAt(next.base[i+1], f.lvl) - statAt(old.base[i+1], f.lvl);
  });
  f.id = nextId;
  f.moves = formMovesAt(nextId, f.lvl, false, progress);
  f.evolutionRulesVersion = 2;
  return f;
}

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
const PORT_SHOP_STOCK = ['carne','carnereal','bocadillo','sake','bebida_ataque','bebida_defensa','cartel','carteldorado','cartelbuster'];
const AUTO_ROUTE_KEYS = ['random','wild','marine','item','mystery','shop','rest','special','boss','battle'];
const AUTO_DEFAULTS = () => ({
  speed:'x2', healThreshold:50, nodePriority:'random', wildAction:'fight',
  specialAction:'manual', chainItem:'risk', chainFail:'fight',
  revive:true, useUltimates:true, healItems:['carne','carnereal','bocadillo'],
  reserveBerries:0, pauseEvents:[],
  fullTeamAction:'keep', fullBagAction:'leave',
  shopItems:[{id:'carne',qty:3},{id:'sake',qty:2},{id:'cartel',qty:2}]
});
function normalizeAutoSettings(value) {
  const d = AUTO_DEFAULTS(), v = value && typeof value === 'object' ? value : {};
  const choice = (key, allowed) => allowed.includes(v[key]) ? v[key] : d[key];
  const integer = (value, fallback, max) => Number.isFinite(Number(value)) ? Math.min(max,Math.max(0,Math.floor(Number(value)))) : fallback;
  return {...d,
    speed:choice('speed',['x1','x2']), nodePriority:choice('nodePriority',AUTO_ROUTE_KEYS),
    healThreshold:choice('healThreshold',[0,25,50,75,99]),
    wildAction:choice('wildAction',['fight','recruit','chains','manual']),
    specialAction:choice('specialAction',['manual','gacha','leave']),
    chainItem:choice('chainItem',['risk','cartel','carteldorado','cartelbuster']),
    chainFail:choice('chainFail',['fight','pay','manual']),
    fullTeamAction:choice('fullTeamAction',['keep','higherLevel','manual']),
    fullBagAction:choice('fullBagAction',['leave','manual']),
    revive:typeof v.revive==='boolean'?v.revive:d.revive,
    useUltimates:typeof v.useUltimates==='boolean'?v.useUltimates:d.useUltimates,
    healItems:Array.isArray(v.healItems)?['carne','carnereal','bocadillo'].filter(id=>v.healItems.includes(id)):d.healItems,
    reserveBerries:integer(v.reserveBerries,0,999999),
    pauseEvents:Array.isArray(v.pauseEvents)?['wild','marine','item','mystery','shop','rest','special','boss'].filter(id=>v.pauseEvents.includes(id)):[],
    shopItems:Array.isArray(v.shopItems)?v.shopItems.filter(t=>t&&PORT_SHOP_STOCK.includes(t.id)).map(t=>({id:t.id,qty:integer(t.qty,0,99)})):d.shopItems
  };
}
let autoSettings = AUTO_DEFAULTS();
function pauseAutoForChoice(message) {
  autoMode=false;
  if(autoTimer) clearTimeout(autoTimer);
  autoTimer=null;
  const btn=$('#btn-topbar-auto');
  if(btn) {btn.textContent='🤖 PAUSADO';btn.classList.remove('green');btn.classList.add('gray');}
  if(message) toast(message);
}
function autoCanSpend(price) {return !!run && run.berries-price >= (autoSettings.reserveBerries || 0);}
function advanceAutoNode(r,i) {
  if(!autoMode || !run)return;
  resolveAutoLoot(run);
  if(hasPendingLoot(run)) {
    pauseAutoForChoice('🎒 Guarda o deja los objetos pendientes para continuar.');
    screenMap(2);
    return;
  }
  if(autoSettings.pauseEvents?.includes(run.map.rows[r][i].type)) {
    pauseAutoForChoice();screenMap();
    toast(`🤖 Pausa antes de ${NODE_TYPES[run.map.rows[r][i].type].label}. Elige cuándo entrar.`);
    return;
  }
  enterNode(r,i);
}

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

function autoBackpackSettings() {
  const saved = meta.settings?.autoBackpack || {};
  return {
    enabled: saved.enabled === true,
    threshold: [0,25,50,75,99].includes(saved.threshold) ? saved.threshold : 50,
    where: ['map','combat','both'].includes(saved.where) ? saved.where : 'both',
    items: {carne:saved.items?.carne !== false, carnereal:saved.items?.carnereal !== false,
      bocadillo:saved.items?.bocadillo === true, sake:saved.items?.sake === true}
  };
}
function setAutoBackpackSettings(change) {
  const current = autoBackpackSettings();
  meta.settings ||= {};
  meta.settings.autoBackpack = {...current,...change,items:{...current.items,...change.items}};
  saveMeta();
}
function runAutoItems(refresh = true) {
  const config = autoBackpackSettings();
  if (!config.enabled) return false;
  const isCombat = typeof battle !== 'undefined' && battle && !battle.over;
  if (isCombat && (battle.waiting || battle.opts?.challenge)) return false;
  if ((isCombat && config.where === 'map') || (!isCombat && config.where === 'combat')) return false;
  const owner = isCombat && battle.tower ? tower : run;
  const team = isCombat ? battle.pTeam : owner?.team;
  if (!owner?.items || !team) return false;
  const isNuz = !(isCombat && battle.tower) && owner.mode === 'nuzlocke';
  let changed = false, revived = null;
  const consume = (id, fighter) => {
    owner.items[id]--;
    changed = true;
    const message = `🎒 Auto: ${ITEMS[id].name} para ${charName(fighter)}.`;
    if (isCombat) log(message); else toast(message);
  };
  if (config.items.sake && !isNuz && (owner.items.sake || 0) > 0) {
    revived = team.find(f => f.hp <= 0);
    if (revived) {
      revived.hp = Math.max(1,Math.floor(revived.maxhp * ITEMS.sake.val));
      consume('sake',revived);
    }
  }
  for (const fighter of team) {
    if (!config.threshold || fighter === revived || fighter.hp <= 0 || fighter.hp >= fighter.maxhp ||
        (config.threshold !== 99 && fighter.hp / fighter.maxhp * 100 > config.threshold)) continue;
    const healing = ['carne','carnereal','bocadillo'].filter(id=>config.items[id] && owner.items[id] > 0)
      .sort((a,b)=>ITEMS[a].val-ITEMS[b].val);
    const missing = fighter.maxhp-fighter.hp;
    const id = healing.find(id=>ITEMS[id].val >= missing) || healing.at(-1);
    if (!id) continue;
    fighter.hp = Math.min(fighter.maxhp,fighter.hp + ITEMS[id].val);
    consume(id,fighter);
  }
  if (!changed) return false;
  if (owner === run) saveRun();
  if (isCombat && refresh) { refreshHPCards(); refreshControls(); }
  return true;
}

function pickAutoNode(reach) {
  if (!reach || !reach.length) return null;
  const pref = autoSettings.nodePriority;
  if (pref === 'random') return pick(reach);

  const rows = run.map.rows;
  let matches = [];
  if (Object.hasOwn(NODE_TYPES, pref)) {
    // Trace actual map connections back from unvisited events of the chosen type.
    // This keeps earlier choices on a route to the nearest reachable event.
    const distances = new Map(), incoming = new Map(), queue = [];
    rows.forEach((row, r) => row.forEach((node, i) => {
      if (node.type === pref && !node.done) {
        const key = `${r},${i}`;
        distances.set(key, 0);
        queue.push(key);
      }
    }));
    for (const [r, i, nextR, nextI] of run.map.edges || []) {
      if (rows[r]?.[i]?.done || rows[nextR]?.[nextI]?.done) continue;
      const key = `${nextR},${nextI}`;
      if (!incoming.has(key)) incoming.set(key, []);
      incoming.get(key).push(`${r},${i}`);
    }
    for (let idx = 0; idx < queue.length; idx++) {
      const key = queue[idx];
      for (const previous of incoming.get(key) || []) {
        if (distances.has(previous)) continue;
        distances.set(previous, distances.get(key) + 1);
        queue.push(previous);
      }
    }
    const nearest = Math.min(...reach.map(([r, i]) => distances.get(`${r},${i}`) ?? Infinity));
    if (Number.isFinite(nearest)) matches = reach.filter(([r, i]) => distances.get(`${r},${i}`) === nearest);
  } else if (pref === 'item') {
    matches = reach.filter(([r, i]) => ['item', 'mystery', 'shop'].includes(rows[r][i].type));
  } else if (pref === 'battle') {
    matches = reach.filter(([r, i]) => ['wild', 'marine', 'boss'].includes(rows[r][i].type));
  } else if (pref === 'rest') {
    matches = reach.filter(([r, i]) => ['rest', 'shop', 'item'].includes(rows[r][i].type));
  }

  if (matches.length > 0) return pick(matches);
  return pick(reach);
}

function showAutoSettingsModal(settingsHost = null, onClose = null) {
  if(document.querySelector('.auto-config-overlay'))return;
  const wasAuto=autoMode, activeBattle=battle && !battle.over ? battle : null;
  const wasWaiting=activeBattle?.waiting;
  pauseAutoForChoice();
  if(activeBattle && !wasWaiting)pauseBattle();
  const cfg=normalizeAutoSettings(autoSettings);
  const bagAuto=autoBackpackSettings();
  const ov=document.createElement('div');ov.className='overlay auto-config-overlay';
  const select=(id,value,options)=>`<select id="${id}">${options.map(([key,label])=>`<option value="${key}" ${String(key)===String(value)?'selected':''}>${label}</option>`).join('')}</select>`;
  const check=(id,label,on,disabled=false)=>`<label class="auto-check"><input type="checkbox" id="${id}" ${on?'checked':''} ${disabled?'disabled':''}><span>${label}</span></label>`;
  const routes=AUTO_ROUTE_KEYS.filter(id=>id!=='random'&&id!=='battle').map(id=>[id,`${NODE_TYPES[id].emoji} ${NODE_TYPES[id].label}`]);
  ov.innerHTML=`<div class="modal auto-config" role="dialog" aria-modal="true" aria-labelledby="auto-title">
    <header class="auto-header"><div><small>PILOTO AUTOMÁTICO</small><h2 id="auto-title">Prepara tu viaje</h2><p>El avance se pausa mientras configuras.</p></div><button class="btn gray" id="auto-apply-close" aria-label="Cerrar sin guardar">✕</button></header>
    <div class="auto-config-body">
      <section class="auto-section"><h3>🧭 Ruta y ritmo</h3>
        <label for="auto-node-sel">Evento al que quieres ir</label>
        ${select('auto-node-sel',cfg.nodePriority,[['random','🎲 Sin preferencia'],...routes,['battle','⚔️ Combates (piratas, Marines y jefes)']])}
        <p>Sigue las conexiones hacia el evento accesible más cercano. Si no hay ninguno, elige al azar. Los misterios se descubren al entrar.</p>
        <div class="auto-two"><div><label for="auto-speed-sel">Avance por el mapa</label>${select('auto-speed-sel',cfg.speed,[['x1','Normal'],['x2','Rápido']])}</div>
        <div><label for="auto-combat-speed">Velocidad de combate</label>${select('auto-combat-speed',preferredCombatSpeed(),[[1,'x1'],[2,'x2'],[4,'x4']])}</div></div>
        ${check('auto-ultimates','Usar definitivas cuando estén listas',cfg.useUltimates)}
        <details><summary>Parar antes de un evento</summary><div class="auto-check-grid">${routes.map(([id,label])=>check(`auto-pause-${id}`,label,cfg.pauseEvents.includes(id))).join('')}</div><p>Se detiene en el mapa para que entres manualmente.</p></details>
      </section>
      <section class="auto-section"><h3>🏴‍☠️ Encuentros y reclutas</h3>
        <label for="auto-wild-sel">Pirata salvaje</label>${select('auto-wild-sel',cfg.wildAction,[['fight','Combatir'],['recruit','Reclutar con Berries'],['chains','Tentar a la suerte: cadenas'],['manual','Pausar y decidir yo']])}
        <p>Si no puedes reclutar por precio, rareza o Nuzlocke, combate.</p>
        <div class="auto-two"><div><label for="auto-chain-item">En las cadenas</label>${select('auto-chain-item',cfg.chainItem,[['risk','Arriesgar: 50%'],...['cartel','carteldorado','cartelbuster'].map(id=>[id,ITEMS[id].name])])}</div>
        <div><label for="auto-chain-fail">Si una cadena aguanta</label>${select('auto-chain-fail',cfg.chainFail,[['fight','Combatir'],['pay','Pagar 3 carteles si tengo'],['manual','Pausar y decidir yo']])}</div></div>
        <p>Si no tienes el cartel elegido, arriesga. Si no puedes pagar los 3 carteles, combate.</p>
        <label for="auto-special-action">Crossguild</label>${select('auto-special-action',cfg.specialAction,[['manual','Pausar para elegir o jugar'],['gacha','Jugar carteles si puedo pagarlos'],['leave','Marcharme sin comprar']])}
        <p>El catálogo se elige manualmente. Si no alcanza para los carteles o Nuzlocke lo impide, se marcha.</p>
        <label for="auto-full-team">Si el equipo está lleno</label>${select('auto-full-team',cfg.fullTeamAction,[['keep','Conservar el equipo y dejar al nuevo'],['higherLevel','Sustituir al de menor nivel si el nuevo lo supera'],['manual','Pausar y decidir yo']])}
        <p>Los personajes repetidos se fusionan. En caso de empate de nivel, se conserva el equipo.</p>
      </section>
      <section class="auto-section"><h3>🎒 Uso automático de la mochila</h3>
        <label for="auto-full-bag">Si no cabe el objeto recogido</label>${select('auto-full-bag',cfg.fullBagAction,[['leave','Guardar lo que quepa y dejar el resto'],['manual','Pausar y decidir yo']])}
        <p>La opción automática conserva los objetos que ya llevas y se aplica a ambas mochilas.</p>
        ${check('auto-bag-enabled','Usar objetos automáticamente',bagAuto.enabled)}
        <p>Comparte estas preferencias con Ajustes. Funciona también con el avance automático pausado.</p>
        <label for="auto-bag-where">Dónde usar objetos</label>${select('auto-bag-where',bagAuto.where,[['both','Isla y combate'],['map','Solo en la isla'],['combat','Solo en combate']])}
        <label for="auto-heal-sel">Curar cuando los PS estén al…</label>${select('auto-heal-sel',bagAuto.threshold,[[0,'No curar automáticamente'],[25,'25% o menos'],[50,'50% o menos'],[75,'75% o menos'],[99,'Cualquier daño']])}
        <p>Objetos permitidos: usa uno por nakama y revisión, el menor que cubra el daño o el mayor disponible.</p>
        ${['carne','carnereal','bocadillo'].map(id=>check(`auto-heal-${id}`,`${ITEMS[id].emoji} ${ITEMS[id].name} · ${ITEMS[id].desc}`,bagAuto.items[id])).join('')}
        ${check('auto-revive',`${ITEMS.sake.emoji} Revivir con ${ITEMS.sake.name}`,bagAuto.items.sake,run?.mode==='nuzlocke')}
        <p>${run?.mode==='nuzlocke'?'Nuzlocke: los nakamas caídos no pueden revivir.':ITEMS.sake.desc}</p>
      </section>
      <section class="auto-section"><h3>🏪 Compras y presupuesto</h3>
        <label for="auto-reserve">Berries que quieres conservar</label><input id="auto-reserve" type="number" min="0" max="999999" step="50" value="${cfg.reserveBerries}">
        <p>La reserva se respeta al comprar provisiones, reclutar y jugar carteles. Cantidad 0 = no comprar. Prioridad 1 = comprar primero.</p>
        <div class="auto-stock-head"><span>Provisión</span><span>Hasta</span><span>Prioridad</span></div>
        ${PORT_SHOP_STOCK.map((id,index)=>{const entry=cfg.shopItems.find(t=>t.id===id);const priority=cfg.shopItems.findIndex(t=>t.id===id);return `<div class="auto-stock-row"><div><b>${ITEMS[id].emoji} ${ITEMS[id].name}</b><small>${ITEMS[id].desc} · ${ITEMS[id].price} Berries</small></div><input aria-label="Cantidad de ${ITEMS[id].name}" data-auto-stock="${id}" type="number" min="0" max="99" value="${entry?.qty||0}">${select(`auto-priority-${id}`,priority<0?PORT_SHOP_STOCK.length:priority+1,PORT_SHOP_STOCK.map((_,i)=>[i+1,i+1]))}</div>`}).join('')}
      </section>
    </div>
    <footer class="auto-footer"><button class="btn gray" id="auto-save-only">Guardar y pausar</button><button class="btn green" id="auto-apply-start">Guardar y activar</button></footer>
  </div>`;
  if (settingsHost) {
    settingsHost.classList.add('auto-config-overlay');
    ov.className = 'settings-auto-content';
    settingsHost.replaceChildren(ov);
    ov.querySelector('.auto-header small').textContent = 'AJUSTES / MODO AUTOMÁTICO';
    ov.querySelector('#auto-title').textContent = 'Modo automático';
  } else document.body.appendChild(ov);
  PORT_SHOP_STOCK.forEach(id=>ov.querySelector(`#auto-priority-${id}`).setAttribute('aria-label',`Prioridad de ${ITEMS[id].name}`));
  let closed=false;
  const close=(mode,save)=>{
    if(closed)return;closed=true;
    if(save) {
      const val=id=>ov.querySelector(`#${id}`).value;
      const on=id=>ov.querySelector(`#${id}`).checked;
      autoSettings=normalizeAutoSettings({speed:val('auto-speed-sel'),nodePriority:val('auto-node-sel'),wildAction:val('auto-wild-sel'),
        specialAction:val('auto-special-action'),chainItem:val('auto-chain-item'),chainFail:val('auto-chain-fail'),
        fullTeamAction:val('auto-full-team'),fullBagAction:val('auto-full-bag'),
        healThreshold:+val('auto-heal-sel'),revive:on('auto-revive'),useUltimates:on('auto-ultimates'),reserveBerries:val('auto-reserve'),
        healItems:['carne','carnereal','bocadillo'].filter(id=>on(`auto-heal-${id}`)),pauseEvents:routes.filter(([id])=>on(`auto-pause-${id}`)).map(([id])=>id),
        shopItems:PORT_SHOP_STOCK.map(id=>({id,qty:+ov.querySelector(`[data-auto-stock="${id}"]`).value,priority:+val(`auto-priority-${id}`)})).sort((a,b)=>a.priority-b.priority)
      });
      autoSpeed=+val('auto-combat-speed');combatSpeedOverride=autoSpeed;
      meta.settings.autoConfig={...autoSettings,combatSpeed:autoSpeed};
      setAutoBackpackSettings({enabled:on('auto-bag-enabled'),where:val('auto-bag-where'),threshold:+val('auto-heal-sel'),
        items:{carne:on('auto-heal-carne'),carnereal:on('auto-heal-carnereal'),bocadillo:on('auto-heal-bocadillo'),sake:on('auto-revive')}});
      if(activeBattle && battle===activeBattle)battle.speed=autoSpeed;
    }
    ov.remove();autoMode=mode;
    if (onClose) { if(activeBattle && battle===activeBattle)refreshControls(); onClose(); return; }
    if(activeBattle && battle===activeBattle && !battle.over) {refreshControls();if(!wasWaiting)resumeBattle();}
    else if(run)screenMap();
  };
  ov.querySelector('#auto-apply-start').onclick=()=>close(true,true);
  ov.querySelector('#auto-save-only').onclick=()=>close(false,true);
  ov.querySelector('#auto-apply-close').onclick=()=>close(wasAuto,false);
  if (settingsHost) settingsHost.onclick = e => { if (e.target === settingsHost) close(wasAuto,false); };
  ov.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();close(wasAuto,false);}
    if(e.key==='Tab') {
      const controls=[...ov.querySelectorAll('button,input,select,summary')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  ov.querySelector('#auto-node-sel').focus({preventScroll:true});
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
  pirateKingRewards: {}, // sagaId -> 'pending' o ID del legendario elegido
  islandProgress: {}, // saga:mode:difficulty -> completed island indices
  teamPresets: { 1: [], 2: [], 3: [] },
  stats: { kills: 0, items: 0 },
  sagaStats: {}, // sagaId -> repeatable achievement counters
  relics: [],
  relicEquipment: {},
  relicCopies: {},
  challenge: null,
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
  autoSettings = normalizeAutoSettings(meta.settings.autoConfig);
  // Preserve saved healing choices from the previous automatic-mode panel.
  if (!meta.settings.autoBackpack && meta.settings.autoConfig) {
    meta.settings.autoBackpack = {enabled:!!(autoSettings.healThreshold || autoSettings.revive),
      threshold:autoSettings.healThreshold,where:'both',
      items:Object.fromEntries(['carne','carnereal','bocadillo','sake'].map(id=>
        [id,id==='sake' ? autoSettings.revive : autoSettings.healItems.includes(id)]))};
  }
  migrateLegacyIslandWins(meta);
  preparePirateKingRewards(meta);
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
    prepareBackpack(run);
    persistLocalSave(run, true);
    return exportSave();
  };
  if (saveReadError) {
    modalConfirm('💾 ¿Sustituir el guardado?', 'No se pudo leer la copia anterior. Guardar la sustituirá por el progreso actual.', write);
  } else return write();
}

// ---------- Copias JSON portátiles, compatibles con el juego original ----------
async function exportSave() {
  const payload = GameSaveStorage.payload(meta, battle ? savedRun : run);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  if (typeof window.showSaveFilePicker === 'function') {
    let writable;
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'grandlinelike.json',
        types: [{ description: 'Partida JSON', accept: { 'application/json': ['.json'] } }],
        excludeAcceptAllOption: true
      });
      writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      toast('💾 Copia JSON guardada');
    } catch (error) {
      if (writable) await writable.abort().catch(() => {});
      if (error.name !== 'AbortError') toast('❌ No se pudo guardar el JSON. Inténtalo de nuevo.');
    }
    return;
  }
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = 'grandlinelike.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('📥 Descarga iniciada. Este navegador elige la carpeta según sus ajustes de descarga.');
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
      migrateLegacyIslandWins(nextMeta);
      preparePirateKingRewards(nextMeta);
      nextMeta.settings = Object.assign({ showEventConfirm: true, customSounds: false, theme: 'light', mobileColumns: 3 }, nextMeta.settings);
      if (!nextMeta.roster.includes('luffy')) nextMeta.roster.push('luffy');
      const nextRun = data.run || null;
      if (nextRun) {
        ensureStartingTeam(nextRun);
        if (nextRun.mode === 'nuzlocke') nextRun.team = nextRun.team.filter(f => f.hp > 0);
        nextRun.team.forEach(f => migrateFighter(f, false, nextMeta));
      }
      migrateIslandJourney(nextRun, nextMeta);
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
      if (!finishRetiredJourney()) screenHome();
    } catch (e) {
      toast('❌ No se pudo cargar: archivo inválido o guardado local no disponible. Tu partida anterior se conserva.');
    }
  };
  reader.readAsText(file);
}
function validateGameSave(data) {
  const progress=data.meta,t=progress.challenge;
  const equipment=Object.entries(progress.relicEquipment||{});
  if(equipment.some(([id,r])=>!CHARS[id]||baseFormOf(id)!==id||!RELICS[r]||!progress.relics?.includes(r))||
    new Set(equipment.map(([,r])=>r)).size!==equipment.length) throw new Error('Equipo de reliquias incompatible.');
  if(t){
    const ids=t.entrants.flatMap(e=>e.members);
    if(ids.some(id=>!CHARS[id]||(t.kind==='legends'&&CHARS[id].rareza!==5))||
      new Set(ids.map(baseFormOf)).size!==8||t.pendingRelics.some(id=>!RELICS[id])||
      (t.relicReward&&!RELICS[t.relicReward])) throw new Error('Torneo incompatible.');
  }

  for (const [sagaId, value] of Object.entries(data.meta.pirateKingRewards || {})) {
    if (!SAGAS.some(s => s.id === sagaId) || !data.meta.sagaDiffWins?.[sagaId]?.[5] ||
        (value !== 'pending' && !pirateKingLegendaryPool(sagaId).includes(value))) throw new Error('Recompensa de Rey Pirata inválida.');
  }
  if (Object.keys(data.meta.sagaStats || {}).some(id => !SAGAS.some(s => s.id === id))) throw new Error('Contadores de saga incompatibles.');
  for (const key of ['dex', 'recruited', 'roster', 'defeated']) {
    if (data.meta[key]?.some(id => !CHARS[id])) throw new Error('Personaje desconocido.');
  }
  const r = data.run;
  for (const [key, islands] of Object.entries(data.meta.islandProgress || {})) {
    const [sagaId,mode,diff] = key.split(':');
    const saga = SAGAS.find(s=>s.id===sagaId);
    if (!saga || !['classic','nuzlocke'].includes(mode) || !['1','2','3','4','5'].includes(diff) || islands.some(i=>i>=saga.islands.length)) throw new Error('Progreso de islas incompatible.');
  }
  if (!r) return;
  const bagCapacity = 9 + (data.meta.global?.backpackTier || 0) * 3;
  const stackLimit = 3 + (data.meta.global?.backpackTier || 0), occupied = [new Set(),new Set()];
  for (const [key,pos] of Object.entries(r.bagLayout || {})) {
    const [id,index] = key.split(':');
    if (!ITEMS[id] || !/^\d+$/.test(index) || key !== `${id}:${Number(index)}`) throw new Error('Pila de mochila incompatible.');
    if (Number(index) >= Math.ceil((r.items[id] || 0)/stackLimit)) continue; // A consumed stack may leave an old placement until the next checkpoint.
    const cells = backpackCells(ITEMS[id].slotSize,pos.cell,pos.vertical,bagCapacity), used = occupied[+isBattleItem(id)];
    if (cells.length !== ITEMS[id].slotSize || cells.some(c=>used.has(c))) throw new Error('Posición de mochila incompatible.');
    cells.forEach(c=>used.add(c));
  }
  if ([...Object.keys(r.items || {}), ...Object.keys(r.pendingLoot || {})].some(id => !Object.hasOwn(ITEMS,id))) throw new Error('Objeto desconocido en la mochila.');
  if (r.startingTeam?.some(id => !CHARS[id] || baseFormOf(id) !== id)) throw new Error('Equipo inicial incompatible.');
  if (!SAGAS[r.saga]?.islands[r.islandIdx] || r.team.some(f => !CHARS[f.id] || f.moves.some(id => !MOVES[id]))) throw new Error('Viaje incompatible.');
  if (r.mapIdx !== undefined && r.mapIdx >= islandMapCount(SAGAS[r.saga].islands[r.islandIdx])) throw new Error('Mapa de isla incompatible.');
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
function trackJourneyRewards(fame = 0, logPoses = 0) {
  if (!run) return;
  run.rewards ||= {fame:0, logPoses:0, partial:true};
  run.rewards.fame += fame;
  run.rewards.logPoses += logPoses;
}
function journeyRewardsHTML(journey = run) {
  const rewards = journey?.rewards;
  const amount = value => Number.isFinite(value) && value >= 0 ? value.toLocaleString('es') : '0';
  return `<div class="reward-list" aria-label="Recompensas conseguidas"><b>Conseguido en esta aventura</b><br>⭐ Fama: <strong>${amount(rewards?.fame)}</strong><br>🧭 Log Poses: <strong>${amount(rewards?.logPoses)}</strong>${!rewards || rewards.partial ? '<br><small>Solo se cuentan las recompensas registradas desde esta actualización.</small>' : ''}</div>`;
}
function saveRun() {
  ensureStartingTeam(run);
  prepareBackpack(run);
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
  ensureStartingTeam(run);
  if (run && run.mode === 'nuzlocke' && run.team) {
    run.team = run.team.filter(f => f && f.hp > 0);
  }
  if (run && run.team) run.team.forEach(f => migrateFighter(f));
  migrateIslandJourney(run, meta);
  prepareBackpack(run);
}
function migrateFighter(f, isEnemy = false, progress = meta) {
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
  if (!isEnemy) syncEvolution(f, progress);
  return f;
}
loadRun();

// ---------- Modelo de personaje ----------
function statAt(base, lvl) { return Math.floor(base * (1 + 0.085 * (lvl - 1))); }
function hpAt(base, lvl) { return Math.floor(base * (1 + 0.11 * (lvl - 1))) + lvl; }
function xpForLevel(lvl) { return Math.floor(lvl * lvl * 6); }

function xpBarHTML(f) {
  const maxed = f.lvl >= 100, goal = xpForLevel(f.lvl);
  const value = maxed ? goal : clamp(Number(f.xp) || 0, 0, goal);
  const label = maxed ? 'Nivel máximo' : `EXP ${value}/${goal} · siguiente nivel ${f.lvl + 1}`;
  return `<div class="xp-progress" data-level="${f.lvl}" title="${label}"><span class="xp-caption">${maxed ? 'NV. MÁX.' : 'EXP · NV. ' + f.lvl}</span><div class="xp-bar" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${value}"><i style="width:${value / goal * 100}%"></i></div></div>`;
}

function makeChar(id, lvl, isEnemy = false, exactForm = false) {
  if (!isEnemy && !exactForm) id = evolutionFormAt(id, lvl);
  const c = CHARS[id];
  const moves = formMovesAt(id, lvl, isEnemy || exactForm);
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
    ...(!isEnemy && !exactForm ? {evolutionRulesVersion:2} : {}),
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
  syncEvolution(f);
  f.xp += amount;
  const msgs = [];
  while (f.xp >= xpForLevel(f.lvl) && f.lvl < 100) {
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
      if (l === f.lvl && formMovesAt(f.id, f.lvl).includes(m) && !f.moves.includes(m)) {
        f.moves.push(m);
        if (f.moves.length > 2) f.moves.shift();
        msgs.push(`¡${c.name} aprende ${MOVES[m].name}!`);
      }
    }
    // transformación
    if (c.evo && f.lvl >= c.evo.lvl && startLvlOf(f.id) >= c.evo.lvl) {
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
      const nm = formMovesAt(to, f.lvl);
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
// Los reclutas de la banda actual solo son permanentes al completar la isla.
function unlockRoster(allowBosses = true) {
  const added = [];
  if (!run?.islandComplete) return added;
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
  marine: { emoji: '🧢', label: 'Combate Marine' },
  item: { emoji: '🎁', label: 'Objeto' },
  mystery: { emoji: '❓', label: 'Misterio' },
  shop: { emoji: '🏪', label: 'Tienda' },
  rest: { emoji: '⛺', label: 'Campamento' },
  special: { emoji: '🌟', label: 'Crossguild' },
  boss: { emoji: '💀', label: 'Jefe' },
  travel: { emoji: '🧭', label: 'Siguiente mapa' },
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
let musicFocused = document.hasFocus ? document.hasFocus() : true;

function syncMusicPlayback() {
  const audio = bgmAudio;
  if (!audio) return;
  if (!currentTrack || isMuted || document.hidden || !musicFocused) {
    audio.pause();
    return;
  }
  if (!audio.paused) return;
  // Autoplay can be denied until the next user interaction.
  audio.play()?.then(() => {
    if (audio !== bgmAudio || !currentTrack || isMuted || document.hidden || !musicFocused) audio.pause();
  }).catch(() => {});
}

document.addEventListener('visibilitychange', () => {
  musicFocused = !document.hidden && (document.hasFocus ? document.hasFocus() : true);
  syncMusicPlayback();
});
globalThis.addEventListener?.('blur', () => { musicFocused = false; syncMusicPlayback(); });
globalThis.addEventListener?.('focus', () => { musicFocused = true; syncMusicPlayback(); });
globalThis.addEventListener?.('pagehide', () => { musicFocused = false; syncMusicPlayback(); });
globalThis.addEventListener?.('pageshow', () => {
  musicFocused = document.hasFocus ? document.hasFocus() : true;
  syncMusicPlayback();
});
['click', 'keydown', 'touchstart'].forEach(type => document.addEventListener(type, syncMusicPlayback));

function playMusic(track) {
  if (currentTrack === track) return syncMusicPlayback();
  currentTrack = track;
  if (bgmAudio) {
    bgmAudio.pause();
    bgmAudio.currentTime = 0;
  }
  bgmAudio = null;
  if (!track) return;
  bgmAudio = new Audio(`soundtracks/${track}.mp3`);
  bgmAudio.loop = true;
  bgmAudio.muted = isMuted;
  bgmAudio.volume = 0.45;
  syncMusicPlayback();
}

function toggleMute() {
  isMuted = !isMuted;
  try { localStorage.setItem('oplike_muted', String(isMuted)); } catch (e) { }
  if (bgmAudio) bgmAudio.muted = isMuted;
  syncMusicPlayback();
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
    if (autoMode && combatSpeedOverride === null) {
      battle.speed = (autoSettings.speed === 'x1') ? 1 : 2;
      autoSpeed = battle.speed;
    }
    refreshControls();
    renderBattlePreserveLog();
  } else if (typeof run !== 'undefined' && run) {
    screenMap();
  } else {
    screenHome();
  }
}

// ---------- Render raíz ----------
// Mobile browser zoom, toolbars and keyboards can shrink the visible viewport
// without changing the layout viewport used by fixed event overlays.
function syncGameViewport() {
  const viewport = globalThis.visualViewport;
  const style = document.documentElement?.style;
  if (!viewport || !style) return;
  style.setProperty('--game-view-width', `${viewport.width}px`);
  style.setProperty('--game-view-height', `${viewport.height}px`);
  style.setProperty('--game-view-left', `${viewport.offsetLeft}px`);
  style.setProperty('--game-view-top', `${viewport.offsetTop}px`);
}
globalThis.visualViewport?.addEventListener('resize', syncGameViewport);
globalThis.visualViewport?.addEventListener('scroll', syncGameViewport);
syncGameViewport();

function render(html) {
  worldNavigator?.destroy();
  worldNavigator = null;
  worldSelection = null;
  applyDisplayPreferences();
  app.innerHTML = html;
  const btn = $('#btn-mute');
  if (btn) btn.onclick = toggleMute;
  const saveBtn = $('#btn-save');
  if (saveBtn) saveBtn.onclick = manualSave;
  const setBtn = $('#btn-settings');
  if (setBtn) setBtn.onclick = showSettingsModal;
  const speedBtn = $('#btn-map-speed');
  if (speedBtn) speedBtn.onclick = cycleBattleSpeed;
  const autoBtn = $('#btn-topbar-auto');
  if (autoBtn) autoBtn.onclick = cycleTopbarAuto;
  const cancelRepeat = $('#btn-cancel-island-repeat');
  if (cancelRepeat) cancelRepeat.onclick = cancelIslandRepeats;
}
function toast(msg) {
  document.querySelectorAll('.toast').forEach(el => el.remove());
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

function trackSagaStat(key, qty = 1) {
  if (!run || battle?.tower || !['classic','nuzlocke'].includes(run.mode) || !SAGAS[run.saga]) return;
  const sagaId = SAGAS[run.saga].id;
  meta.sagaStats ||= {};
  meta.sagaStats[sagaId] ||= {};
  meta.sagaStats[sagaId][key] = (meta.sagaStats[sagaId][key] || 0) + qty;
}

function trackStat(key, qty = 1) {
  meta.stats = meta.stats || { kills: 0, items: 0 };
  meta.stats[key] = (meta.stats[key] || 0) + qty;
  trackSagaStat(key, qty);
  saveMeta();
}

function trackItemCollected(qty = 1) {
  trackStat('items', qty);
}

function trackKills(qty = 1) {
  trackStat('kills', qty);
}

function berriesHTML(v) { return `฿${v.toLocaleString('es')}`; }

function topbar(showBerries = false, showAuto = showBerries, showSpeed = false, showFlee = false) {
  const autoLabel = !autoMode ? '🤖 PAUSADO' : (autoSettings.speed === 'x1' ? '🤖 AUTO x1' : '🤖 AUTO x2');
  const autoBtnClass = !autoMode ? 'gray' : 'green';
  const combatSpeed = battle?.speed ?? preferredCombatSpeed();
  return `<div class="topbar">
    <div class="logo">ONE PIECE <span>ROGUE LIKE</span></div>
    ${showBerries && run ? `<div class="floating-berries"><div class="berries">${berriesHTML(run.berries)}</div></div>` : ''}
    <div class="floating-controls">
      ${showAuto ? `<button class="btn small ${autoBtnClass}" id="btn-topbar-auto" title="Cambiar velocidad o activar/pausar modo auto">${autoLabel}</button>` : ''}
      <button class="btn small gray" id="btn-settings" title="Ajustes de juego">⚙️ AJUSTES</button>
      ${showSpeed ? `<button class="btn small gray" id="btn-map-speed" title="Velocidad de combate: x1, x2 o x4" aria-label="Velocidad de combate x${combatSpeed}" aria-live="polite">⏩ x${combatSpeed}</button>` : ''}
      <button class="btn small green" id="btn-save" title="Guardar partida como JSON" aria-label="Guardar partida como JSON">💾</button>
      ${showBerries && showAuto && run && !showFlee ? '<button class="btn small red" id="btn-abandon" title="Abandonar el viaje" aria-label="Abandonar el viaje"><span aria-hidden="true">🏳️</span></button>' : ''}
      ${showFlee ? '<button class="btn small red" data-ctl="run">🏃 HUIR</button>' : ''}
    </div>
  </div>${islandRepeatStatusHTML()}`;
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
  if (existing) return;

  const ov = document.createElement('div');
  ov.id = 'settings-modal-overlay';
  ov.className = 'overlay';

  const showConfirm = meta.settings.showEventConfirm !== false;
  const customSounds = !!meta.settings.customSounds;
  const bagAuto = autoBackpackSettings();
  const settingsBattle = battle && !battle.over ? battle : null;
  const wasWaiting = settingsBattle?.waiting;
  const settingsRun = run;
  const onMap = !!document.getElementById?.('island-carousel');
  if (onMap) { clearTimeout(autoTimer); autoTimer = null; }
  if (settingsBattle) pauseBattle();

  ov.innerHTML = `
    <div class="modal" style="max-width:440px;width:90%;">
      <h2 style="margin-top:0;color:var(--sea);font-size:14px;border-bottom:2px solid var(--gold);padding-bottom:6px;">⚙️ AJUSTES DE JUEGO</h2>
      <div class="display-settings">
        <label for="setting-theme">Aspecto del juego</label>
        <select id="setting-theme"><option value="light" ${meta.settings.theme !== 'dark' ? 'selected' : ''}>Claro · Egghead</option><option value="dark" ${meta.settings.theme === 'dark' ? 'selected' : ''}>Oscuro · Egghead</option></select>
        ${mobileColumnsControl()}
        <p>El aspecto y las columnas se guardan en este dispositivo.</p>
      </div>
      <fieldset class="bag-auto-settings"><legend>🤖 Modo automático</legend><p>Configura la ruta, encuentros, compras y uso de objetos. Si la mochila está llena, guarda lo que quepa y deja el excedente.</p><button class="btn blue" id="setting-auto-config">Configurar modo automático</button></fieldset>
      <fieldset class="bag-auto-settings">
        <legend>🎒 Uso automático de la mochila</legend>
        <label><input type="checkbox" id="setting-bag-auto" ${bagAuto.enabled ? 'checked' : ''}> Usar objetos automáticamente</label>
        <p>Funciona aunque el avance automático esté pausado. Se comprueba al volver al mapa y al inicio de cada ronda.</p>
        <label for="setting-bag-where">Dónde usar objetos</label>
        <select id="setting-bag-where"><option value="both" ${bagAuto.where === 'both' ? 'selected' : ''}>Isla y combate</option><option value="map" ${bagAuto.where === 'map' ? 'selected' : ''}>Solo en la isla</option><option value="combat" ${bagAuto.where === 'combat' ? 'selected' : ''}>Solo en combate</option></select>
        <label for="setting-bag-threshold">Curar con estos PS o menos</label>
        <select id="setting-bag-threshold">${[0,25,50,75,99].map(n=>`<option value="${n}" ${bagAuto.threshold === n ? 'selected' : ''}>${n === 0 ? 'No curar automáticamente' : n === 99 ? 'Cualquier daño' : n + '% de PS'}</option>`).join('')}</select>
        <span>Objetos permitidos</span>
        ${['carne','carnereal','bocadillo','sake'].map(id=>`<label><input type="checkbox" data-setting-bag-item="${id}" ${bagAuto.items[id] ? 'checked' : ''}> ${ITEMS[id].emoji} ${ITEMS[id].name}</label>`).join('')}
        <p>Prioriza la cura más pequeña que cubra el daño. Máximo un objeto por nakama en cada comprobación. El sake revive a un caído y respeta Nuzlocke. Frutas, mejoras y carteles conservan su uso actual.</p>
      </fieldset>
      <fieldset class="bag-auto-settings">
        <legend>🎒 Uso manual en combate</legend>
        <label><input type="checkbox" id="setting-bag-quick-use" ${meta.settings.quickBattleItems === true ? 'checked' : ''}> Usar objetos sin confirmación</label>
        <p>Al pulsar un objeto durante el combate se usa una unidad al instante. Puedes pulsar varios seguidos sin abrir su ficha.</p>
      </fieldset>
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

  ov.querySelector('#setting-bag-auto').onchange = e => setAutoBackpackSettings({enabled:e.target.checked});
  ov.querySelector('#setting-bag-quick-use').onchange = e => {
    meta.settings.quickBattleItems = e.target.checked;
    saveMeta();
  };
  ov.querySelector('#setting-bag-where').onchange = e => setAutoBackpackSettings({where:e.target.value});
  ov.querySelector('#setting-bag-threshold').onchange = e => setAutoBackpackSettings({threshold:Number(e.target.value)});
  ov.querySelectorAll('[data-setting-bag-item]').forEach(input => {
    input.onchange = e => setAutoBackpackSettings({items:{[input.dataset.settingBagItem]:e.target.checked}});
  });

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

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true; ov.remove();
    if (settingsBattle && battle === settingsBattle && !battle.over && !wasWaiting) resumeBattle();
    else if (!settingsBattle && onMap && run === settingsRun) screenMap(2);
  };
  ov.querySelector('#btn-save-settings').onclick = close;
  ov.querySelector('#setting-auto-config').onclick = () => showAutoSettingsModal(ov, close);
  ov.onclick = e => { if (e.target === ov) close(); };
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
      detailsText = 'Visita el Crossguild de la isla para comprar consumibles, reclutar nakamas o mejorar tu banda con Berries.';
      break;
    case 'rest':
      detailsText = 'Tu banda descansará en el campamento. Todos los nakamas conscientes recuperarán un 50% de sus PS máximos.';
      break;
    case 'special':
      detailsText = specialPiratePoolHTML();
      break;
    case 'travel':
      detailsText = 'Continúa al siguiente mapa de esta isla con tu banda, objetos y PS actuales. El jefe espera al final del último mapa.';
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
  let holdTimer = null;
  const cancelHold = () => { clearTimeout(holdTimer); holdTimer = null; };

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
      cancelHold();
      if (e.touches.length !== 1 || e.target.closest('button')) return;
      const touch = e.touches[0];
      touchStartY = touch.clientY;
      touchStartX = touch.clientX;
      touchStartElement = item;
      draggedIdx = idx;
      isTouchDragging = false;
      holdTimer = setTimeout(() => {
        if (!touchStartElement?.isConnected) return;
        isTouchDragging = true;
        touchStartElement.classList.add('dragging');
      }, 350);
    };

    item.ontouchmove = e => {
      if (draggedIdx === null || !touchStartElement) return;
      const touch = e.touches[0];
      const dy = touch.clientY - touchStartY;
      const dx = touch.clientX - touchStartX;

      if (!isTouchDragging && (Math.abs(dy) > 6 || Math.abs(dx) > 6)) {
        cancelHold();
        draggedIdx = null;
        touchStartElement = null;
        return;
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
      cancelHold();
      if (isTouchDragging && e.cancelable) e.preventDefault();
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
    item.ontouchcancel = () => {
      cancelHold();
      items.forEach(el => el.classList.remove('dragging', 'dragover'));
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
    desc: 'Visita nodos de Crossguild.',
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

// Preserve existing tiers and claims; append repeatable goals up to 10,000.
const GLOBAL_PROGRESSIVE_ACHIEVEMENTS = [...PROGRESSIVE_ACHIEVEMENTS];
for (const p of GLOBAL_PROGRESSIVE_ACHIEVEMENTS) {
  p.legacyTierLimit = p.goals.length;
  if (p.id === 'dex') continue; // Unique discoveries are bounded by the character roster.
  for (const goal of [100,250,500,1000,2000,3500,5000,7500,10000]) {
    if (goal <= p.goals.at(-1)) continue;
    p.goals.push(goal);
    p.fames.push(Math.ceil(p.fames.at(-1) * 1.35 / 50) * 50);
  }
}
const SAGA_PROGRESSIVE_ACHIEVEMENTS = SAGAS.flatMap(saga =>
  GLOBAL_PROGRESSIVE_ACHIEVEMENTS.filter(p => p.id !== 'dex').map(p => ({
    id: `saga_prog_${saga.id}_${p.id}`,
    sagaId: saga.id,
    title: `${p.title} · ${saga.name}`, emoji: p.emoji,
    desc: `${p.desc} Solo en ${saga.name}.`,
    goals: [...p.goals], fames: [...p.fames],
    check: () => {
      if (p.id === 'sagas') return (meta.wins[saga.id] || 0) + (meta.nuzWins[saga.id] || 0);
      if (p.id === 'nuzlocke_wins') return meta.nuzWins[saga.id] || 0;
      return meta.sagaStats?.[saga.id]?.[p.id] || 0;
    }
  }))
);
PROGRESSIVE_ACHIEVEMENTS.push(...SAGA_PROGRESSIVE_ACHIEVEMENTS);

const STATIC_ACHIEVEMENTS = [
  { id: 'solo_sailor', title: 'Lobo de Mar Solitario', emoji: '🐺', desc: 'Zarpa y completa una saga con solo 1 personaje.', goal: 1, check: () => (meta.soloWins || 0), fame: 300, cat: 'desafios' },
  { id: 'straw_hats', title: 'Los 10 Sombrero de Paja', emoji: '🏴‍☠️', desc: 'Desbloquea o recluta a los 10 nakamas principales.', goal: 10, check: () => STRAW_HAT_MEMBERS.filter(id => isNakamaUnlocked(id)).length, fame: 250, cat: 'desafios' },
  { id: 'saga_full', title: 'Compendio de Saga', emoji: '📜', desc: 'Completa al 100% los personajes de 1 saga en la Dex.', goal: 100, check: () => bestSagaDexProgress(), fame: 200, cat: 'desafios' },
  { id: 'dex_full', title: 'Leyenda Viviente', emoji: '📖', desc: 'Consigue a todos los personajes del juego en la Dex.', goal: Object.keys(CHARS).length, check: () => (meta.dex ? meta.dex.length : 0), fame: 1000, cat: 'desafios' },
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
    sagaId: s.id, cat: 'sagas'
  }))
);

const ISLAND_DIFF_ACHIEVEMENTS = SAGAS.flatMap((saga, sagaIdx) =>
  saga.islands.flatMap((island, islandIdx) => DIFFICULTIES.map(d => ({
    id: `island_diff_${saga.id}_${islandIdx}_${d.id}`,
    sagaId: saga.id, cat: 'islas', emoji: d.emoji,
    title: `${island.name} · ${d.name}`,
    desc: `Supera ${island.name} (${saga.name}) por primera vez en ${d.name}, en Clásico o Nuzlocke.`,
    goal: 1,
    check: () => ['classic','nuzlocke'].some(mode => completedIslands(sagaIdx,mode,d.id).includes(islandIdx)) ? 1 : 0,
    fame: 25 * (sagaIdx + 1) * d.id * d.id
  })))
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
  return Math.min(count, p.legacyTierLimit || p.goals.length);
}

function getAchievementsInfo() {
  meta.claimedAch = meta.claimedAch || {};
  meta.claimedProg = meta.claimedProg || {};
  const visibleStaticList = STATIC_ACHIEVEMENTS.concat(SAGA_DIFF_ACHIEVEMENTS, ISLAND_DIFF_ACHIEVEMENTS).filter(isVisibleAch);
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

function isVisibleAch(a) { return true; }

function claimAchievement(id, progressive = false) {
  if (progressive) {
    const p = PROGRESSIVE_ACHIEVEMENTS.find(a=>a.id===id);
    if (!p) return 0;
    const tier = getClaimedProgTier(p);
    if (tier >= p.goals.length || p.check() < p.goals[tier]) return 0;
    meta.claimedProg[id] = tier + 1;
    gainFame(p.fames[tier]);
    return p.fames[tier];
  }
  const a = STATIC_ACHIEVEMENTS.concat(SAGA_DIFF_ACHIEVEMENTS,ISLAND_DIFF_ACHIEVEMENTS).find(a=>a.id===id);
  if (!a || meta.claimedAch?.[id] || a.check() < a.goal) return 0;
  meta.claimedAch ||= {};
  meta.claimedAch[id] = true;
  gainFame(a.fame);
  return a.fame;
}

let currentAchCategory = 'all';
let currentAchSaga = 'all';

function collectionText(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function bindCollectionDialog(ov, close, initialSelector) {
  ov.onkeydown = event => {
    if ([...document.querySelectorAll('.overlay')].at(-1) !== ov) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== 'Tab') return;
    const buttons = [...ov.querySelectorAll('button:not(:disabled),input,select,summary,[tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = buttons[0], last = buttons.at(-1);
    if (!first) return;
    const active = document.activeElement, outside = !ov.contains(active);
    if (event.shiftKey && (outside || active === first || (first.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_PRECEDING))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (outside || active === last || (last.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING))) { event.preventDefault(); first.focus(); }
  };
  ov.querySelector(initialSelector)?.focus({preventScroll:true});
}
function showAchievementsModal(savedScrollTop = 0, initialCategory = currentAchCategory) {
  meta.claimedAch ||= {};
  meta.claimedProg ||= {};
  currentAchCategory = initialCategory;
  const previousFocus = document.activeElement;
  const visibleStaticList = STATIC_ACHIEVEMENTS.concat(SAGA_DIFF_ACHIEVEMENTS, ISLAND_DIFF_ACHIEVEMENTS).filter(isVisibleAch);
  let query = '', state = 'all', sort = 'ready', page = 0, filtersOpen = false;
  const pageSize = 20, number = value => Number(value).toLocaleString('es');
  const describe = (a, progressive) => {
    const tier = progressive ? getClaimedProgTier(a) : 0;
    const claimed = progressive ? tier >= a.goals.length : !!meta.claimedAch[a.id];
    const goal = progressive ? a.goals[Math.min(tier,a.goals.length-1)] : a.goal;
    const fame = progressive ? a.fames[Math.min(tier,a.fames.length-1)] : a.fame;
    const value = a.check(), ready = !claimed && value >= goal;
    return {a,progressive,tier,claimed,goal,fame,value,ready,status:claimed?'claimed':ready?'ready':'progress'};
  };
  const renderCard = item => {
    const {a,progressive,tier,claimed,goal,fame,value,ready} = item;
    const pct = Math.min(100,Math.floor(value/goal*100));
    const label = claimed ? 'Completado' : ready ? 'Por reclamar' : 'En progreso';
    return `<article class="achievement-card ${item.status} ${['sagas','islas'].includes(a.cat)?'native-difficulty':''}" data-achievement="${a.id}" tabindex="-1">
      <span class="achievement-icon" aria-hidden="true">${a.emoji}</span>
      <div class="achievement-content"><div class="achievement-meta"><span class="achievement-status">${claimed?'✓ ':''}${label}</span>${progressive?`<span>Etapa ${Math.min(tier+1,a.goals.length)} de ${a.goals.length}</span>`:''}</div>
        <h3>${a.title}</h3><p>${a.desc}</p>
        <div class="achievement-progress" role="progressbar" aria-label="Progreso de ${collectionText(a.title)}" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(value,goal)}" aria-valuetext="${number(value)} de ${number(goal)}"><i style="width:${pct}%"></i></div>
        <div class="achievement-count"><span>${number(value)} / ${number(goal)}</span><span>${pct}%</span></div>
      </div>
      <div class="achievement-reward"><strong>+${number(fame)} <span>Fama</span></strong>${ready?`<button class="btn green" ${progressive?'data-claim-prog':'data-claim'}="${a.id}" aria-label="Reclamar ${number(fame)} Fama por ${collectionText(a.title)}">Reclamar</button>`:`<span>${claimed?'Recompensa recibida':'Recompensa'}</span>`}</div>
    </article>`;
  };
  const renderContent = () => {
    const all = [...PROGRESSIVE_ACHIEVEMENTS.map(a=>describe(a,true)),...visibleStaticList.map(a=>describe(a,false))];
    const readyCount = all.filter(a=>a.ready).length;
    const q = query.trim().toLocaleLowerCase('es');
    const items = all.filter(({a,progressive,status}) =>
      (currentAchCategory==='all' || (currentAchCategory==='prog'?progressive:!progressive&&a.cat===currentAchCategory)) &&
      (currentAchSaga==='all' || (currentAchSaga==='global'?!a.sagaId:a.sagaId===currentAchSaga)) &&
      (state==='all'||state===status) && (!q || `${a.title} ${a.desc}`.toLocaleLowerCase('es').includes(q))
    ).sort((a,b)=>sort === 'ready' ? Number(b.ready)-Number(a.ready) :
      (sort === 'progress-desc' ? -1 : 1) * (Math.min(1,a.value/a.goal)-Math.min(1,b.value/b.goal)));
    const pages = Math.max(1,Math.ceil(items.length/pageSize));page=Math.min(page,pages-1);
    const {totalCompleted,totalAchievements} = getAchievementsInfo();
    return `<header class="collection-header"><div><span class="collection-eyebrow">Tu aventura</span><h2 id="ach-title" tabindex="-1">Logros de pirata</h2></div><button class="btn gray collection-close" id="ach-close" aria-label="Cerrar logros">Cerrar <span aria-hidden="true">×</span></button></header>
      <div class="collection-summary"><div><strong>${number(totalCompleted)} <small>/ ${number(totalAchievements)}</small></strong><span>Objetivos completados</span></div><button class="collection-summary-action" id="ach-show-ready"><strong>${number(readyCount)}</strong><span>Por reclamar →</span></button></div>
      <div class="collection-search"><label for="ach-search">Buscar logro<input id="ach-search" type="search" placeholder="Nombre, isla u objetivo" value="${collectionText(query)}"></label><label for="ach-state">Estado<select id="ach-state">${[['all','Todos'],['ready','Por reclamar'],['progress','En progreso'],['claimed','Completados']].map(([v,l])=>`<option value="${v}" ${state===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
      <details class="collection-extra" ${filtersOpen?'open':''}><summary>Filtros${currentAchCategory!=='all'||currentAchSaga!=='all'||sort!=='ready'?' · activos':''}</summary><div class="collection-filter-grid">
        <label for="ach-sort">Ordenar por<select id="ach-sort">${[['ready','Por reclamar primero'],['progress-desc','% completado: mayor a menor'],['progress-asc','% completado: menor a mayor']].map(([v,l])=>`<option value="${v}" ${sort===v?'selected':''}>${l}</option>`).join('')}</select></label>
        <label for="ach-category">Tipo de logro<select id="ach-category">${[['all','Todos los tipos'],['prog','Progresivos'],['sagas','Sagas'],['islas','Islas'],['desafios','Desafíos']].map(([v,l])=>`<option value="${v}" ${currentAchCategory===v?'selected':''}>${l}</option>`).join('')}</select></label>
        <label for="ach-saga">Saga<select id="ach-saga">${[['all','Todas las sagas'],['global','Globales'],...SAGAS.map(s=>[s.id,s.name])].map(([v,l])=>`<option value="${v}" ${currentAchSaga===v?'selected':''}>${l}</option>`).join('')}</select></label>
      </div></details>
      <div class="collection-results"><span role="status">${number(items.length)} logros${items.length?` · ${number(page*pageSize+1)}–${number(Math.min((page+1)*pageSize,items.length))}`:''}</span><button class="collection-text-button" id="ach-reset">Limpiar filtros</button></div>
      <div class="achieve-list-container collection-list" aria-label="Lista de logros" tabindex="0">${items.slice(page*pageSize,(page+1)*pageSize).map(renderCard).join('')||'<div class="collection-empty"><h3>No hay logros con estos filtros</h3><p>Prueba otra búsqueda o limpia los filtros.</p></div>'}</div>
      <nav class="collection-pagination" aria-label="Páginas de logros"><button class="btn gray" data-ach-page="-1" ${page===0?'disabled':''} aria-label="Página anterior de logros">← Anterior</button><span>Página ${page+1} de ${pages}</span><button class="btn gray" data-ach-page="1" ${page===pages-1?'disabled':''} aria-label="Página siguiente de logros">Siguiente →</button></nav>`;
  };
  document.querySelector('#achievements-overlay')?.remove();
  const ov = document.createElement('div');ov.id='achievements-overlay';ov.className='overlay collection-overlay';
  ov.innerHTML=`<section class="modal collection-modal achievements-modal" role="dialog" aria-modal="true" aria-labelledby="ach-title">${renderContent()}</section>`;
  document.body.appendChild(ov);
  const syncFameUI = () => {
    const info=getAchievementsInfo(),ach=$('#btn-achievements'),shop=$('#btn-ship'),top=$('#btn-top-ach');
    if(shop)shop.innerHTML=`🏪 Tienda (⭐${meta.fame})`;
    if(ach)ach.innerHTML=`<span>🏆 Logros${info.hasUnclaimedAch?' · ¡Por reclamar!':''}</span><span>(${info.totalCompleted}/${info.totalAchievements})</span>`;
    if(top)top.innerHTML=`🏆${info.hasUnclaimedAch?'🔴':''}`;
  };
  const close=()=>{ov.remove();syncFameUI();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});};
  const refresh=(selector,scroll=0,cursor=null)=>{
    filtersOpen=ov.querySelector('details').open;
    ov.querySelector('.modal').innerHTML=renderContent();bindEvents();
    ov.querySelector('.collection-list').scrollTop=scroll;
    const target=ov.querySelector(selector)||ov.querySelector('#ach-title');
    target.focus({preventScroll:true});if(cursor!==null)target.setSelectionRange?.(cursor,cursor);
  };
  const bindEvents=()=>{
    ov.querySelector('#ach-close').onclick=close;
    ov.querySelector('#ach-search').oninput=e=>{query=e.target.value;page=0;refresh('#ach-search',0,e.target.selectionStart);};
    for(const [id,update] of [['ach-sort',v=>sort=v],['ach-state',v=>state=v],['ach-category',v=>currentAchCategory=v],['ach-saga',v=>currentAchSaga=v]])ov.querySelector('#'+id).onchange=e=>{update(e.target.value);page=0;refresh('#'+id);};
    ov.querySelector('#ach-show-ready').onclick=()=>{state='ready';query='';currentAchCategory='all';currentAchSaga='all';page=0;refresh('#ach-state');};
    ov.querySelector('#ach-reset').onclick=()=>{query='';state='all';sort='ready';currentAchCategory='all';currentAchSaga='all';page=0;refresh('#ach-search');};
    ov.querySelectorAll('[data-ach-page]').forEach(btn=>btn.onclick=()=>{page+=Number(btn.dataset.achPage);refresh('.collection-list');});
    ov.querySelectorAll('[data-claim],[data-claim-prog]').forEach(btn=>btn.onclick=()=>{
      const progressive=!!btn.dataset.claimProg,id=btn.dataset.claimProg||btn.dataset.claim;
      const scroll=ov.querySelector('.collection-list').scrollTop;
      const fame=claimAchievement(id,progressive);if(!fame)return;
      saveMeta();syncFameUI();toast(`🏆 ¡Recompensa recibida: +${number(fame)} Fama!`);
      refresh(`[data-achievement="${id}"]`,scroll);
    });
  };
  bindEvents();if(typeof savedScrollTop==='number')ov.querySelector('.collection-list').scrollTop=savedScrollTop;
  ov.onclick=e=>{if(e.target===ov)close();};
  bindCollectionDialog(ov,close,'#ach-title');
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
        ¡Pueden tocarte reclutas de 1⭐ hasta 5⭐ legendarios!<br>
        Duplicados: 3⭐ → 50 🧭 · 4⭐ → 500 🧭 · 5⭐ → 1000 🧭.<br>
        Con 500 estrellas acumuladas, el siguiente premio es un legendario nuevo de las sagas seleccionadas; si ya tienes todos, recibes 1000 🧭.
      </p>
      <div style="font-size:10px;text-align:center;margin-bottom:6px;color:var(--gold);font-weight:bold;background:rgba(255,215,0,0.1);padding:6px;border-radius:6px;border:1px solid var(--gold);">
        🧭 Saldo: <b>${meta.logPoses} Log Poses</b>
      </div>
      <div style="font-size:9.5px;text-align:center;margin-bottom:10px;color:#f39c12;background:rgba(243,156,18,0.12);padding:6px 10px;border-radius:6px;border:1px solid rgba(243,156,18,0.4);display:flex;align-items:center;justify-content:center;gap:6px;">
        <span>⭐ Estrellas acumuladas (Pity): <b>${meta.starPity || 0} / 500</b></span>
        ${(meta.starPity || 0) >= 500 ? '<span style="color:#2ecc71;font-weight:bold;">¡LEGENDARIO ASEGURADO!</span>' : ''}
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

function duplicatePosterReward(id) {
  return isNakamaUnlocked(id) ? ({3:50,4:500,5:1000}[CHARS[id].rareza] || 0) : 0;
}

function startLogPoseGacha(activeSagas) {
  meta.starPity = meta.starPity || 0;
  const activePirates = [...new Set(activeSagas.flatMap(s => sagaBasePirateIds(s.id)))];
  const guaranteed = meta.starPity >= 500;
  const newLegendaries = activePirates.filter(id => CHARS[id].rareza === 5 && !isNakamaUnlocked(id));
  if (guaranteed && !newLegendaries.length) {
    meta.logPoses = (meta.logPoses || 0) + 1000;
    meta.starPity = 0;
    saveMeta();
    modalInfo('🧭 Compensación de legendario', 'No quedan legendarios nuevos en las sagas seleccionadas. Recibes <b>1000 Log Poses</b> en lugar de un personaje duplicado.', () => screenHome());
    return;
  }
  const weights = [41.5, 30, 21, 7, 0.5];
  let roll = Math.random() * 100, stopIdx = 4;
  if (meta.starPity >= 500) {
    stopIdx = 4; // Pity activado: legendario asegurado (5⭐)
  } else {
    for (let i = 0; i < 5; i++) {
      roll -= weights[i];
      if (roll <= 0) { stopIdx = i; break; }
    }
  }

  const targetRarity = stopIdx + 1;
  let pool = guaranteed ? newLegendaries : activePirates.filter(id => CHARS[id] && CHARS[id].rareza === targetRarity);

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
      ⭐ Estrellas acumuladas (Pity): <b>${meta.starPity} / 500</b>
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
    if (i !== current) return;
    const face = ov.querySelector(`#pf-${i}`);
    const el = ov.querySelector(`[data-p="${i}"]`);
    if (i === stopIdx) {
      current = -1;
      const c = CHARS[prizeId];
      const duplicateReward = duplicatePosterReward(prizeId);
      meta.logPoses = (meta.logPoses || 0) + duplicateReward;
      face.innerHTML = `${charIcon(prizeId, 28)}<br><span>${c.name}</span>`;
      el.classList.add('hit'); el.classList.remove('next');
      registerRecruit(prizeId);
      const b = baseFormOf(prizeId);
      if (!meta.roster.includes(b)) meta.roster.push(b);
      saveMeta();
      ov.querySelectorAll('.poster').forEach(p => { p.onclick = null; });
      setTimeout(() => {
        ov.remove();
        modalInfo(duplicateReward ? '🧭 Personaje duplicado' : '🎉 ¡Nuevo personaje reclutado!', `<div class="reward-list"><span style="font-size:34px;">${charIcon(prizeId, 44)}</span><br><b>${c.name}</b> ${'⭐'.repeat(c.rareza)}<br><small style="color:var(--gold);">${c.types.join(' / ')}</small><br><br><span style="font-size:9px;color:var(--green);">${duplicateReward ? `Duplicado: +${duplicateReward} Log Poses` : '¡Añadido a tu Dex e Inventario de Tripulación!'}</span></div>`, () => screenHome());
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
  const runnerUnlocked = accLvl >= 1;
  const towerUnlocked = accLvl >= 20;
  const challengeUnlocked = accLvl >= 35;
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
        <div class="mode-btn">${challengeUnlocked ? 'ENTRAR' : '🔒 NV. CUENTA 35'}</div>
      </div>
    </div>
    <button class="runner-menu-button" id="btn-runner" ${runnerUnlocked ? '' : 'disabled'}><img src="sprites/luffy.png" alt=""><span><strong>⚡ LUFFY RUN</strong><small>${runnerUnlocked ? 'Doble salto · 25 fama cada 1.000 m' : '🔒 Se desbloquea al nivel 1 de cuenta'}</small></span></button>
    <button class="local-menu-button" id="btn-local"><span aria-hidden="true">⚔️</span><span><strong>MULTIJUGADOR LOCAL</strong><small>Duelo · Torneo · Alianza contra un yonko · Conexión por QR</small></span></button>
    <div style="text-align:center;margin:12px 0"><button class="btn gray small" id="btn-offline">⬇ Preparar juego sin internet</button></div>
    ${pendingPirateKingRewards().length ? `<div class="panel"><button class="btn gold" id="btn-king-rewards">👑 ELEGIR LEGENDARIO · ${pendingPirateKingRewards().length} recompensa(s) de Rey Pirata</button></div>` : ''}
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
        <img class="carteles-menu-icon" src="/art/cross-guild-map.png" alt="" aria-hidden="true" draggable="false"> CARTELES (🧭 ${meta.logPoses || 0})
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
  $('#btn-local').onclick = async () => {
    const btn = $('#btn-local'); btn.disabled = true;
    try { const { openLocal } = await import('./local/ui.mjs'); await openLocal(); }
    catch (e) { toast('No se pudo abrir el modo local. Recarga el juego e inténtalo de nuevo.'); }
    finally { btn.disabled = false; }
  };
  $('#btn-king-rewards')?.addEventListener('click', () => showPirateKingReward(pendingPirateKingRewards()[0], screenHome));
  $('#btn-offline').onclick = async () => {
    try { const { prepareOffline } = await import('./local/offline.mjs'); await prepareOffline(); }
    catch (e) { toast(e.message || 'No se pudo preparar la copia sin conexión.'); }
  };
  if (towerUnlocked) $('#mode-tower').onclick = () => screenTowerIntro();
  if (challengeUnlocked) $('#mode-challenge').onclick = () => screenChallenges();
  $('#btn-runner').onclick = async () => {
    if (accountLevel() < 1) return toast('🔒 Luffy Run se desbloquea al nivel 1 de cuenta.');
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
function sagaMaxDiffCleared(sagaId, progress = meta) {
  const wins = (progress.sagaDiffWins && progress.sagaDiffWins[sagaId]) || {};
  const diffs = Object.keys(wins).filter(k => wins[k]).map(Number);
  return diffs.length ? Math.max(...diffs) : 0;
}

function sagaUnlocked(i, progress = meta) {
  if (i === 0) return true;
  const prevSaga = SAGAS[i - 1];
  return sagaMaxDiffCleared(prevSaga.id, progress) >= 3;
}

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

    // 3. Crossguild (Carteles SE BUSCA)
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
          Probabilidades de los 5 Carteles SE BUSCA en el Crossguild 🌟.
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
        <button type="button" class="tab ${currentProbTab === 'wild' ? 'active' : ''}" id="spm-tab-wild" style="font-size:8px;padding:4px 6px;">🏴‍☠️ SALVAJES</button>
        <button type="button" class="tab ${currentProbTab === 'boss' ? 'active' : ''}" id="spm-tab-boss" style="font-size:8px;padding:4px 6px;">💀 JEFES</button>
        <button type="button" class="tab ${currentProbTab === 'items' ? 'active' : ''}" id="spm-tab-items" style="font-size:8px;padding:4px 6px;">🎁 OBJETOS</button>
        <button type="button" class="tab ${currentProbTab === 'events' ? 'active' : ''}" id="spm-tab-events" style="font-size:8px;padding:4px 6px;">❓ MISTERIO</button>
        <button type="button" class="tab ${currentProbTab === 'gacha' ? 'active' : ''}" id="spm-tab-gacha" style="font-size:8px;padding:4px 6px;">🎰 MERCADO</button>
      </div>
      <div class="probabilities-content">${tabHTML}</div>
      <div class="actions" style="margin-top:12px;"><button class="btn gray" id="spm-close">CERRAR</button></div>
    `;
  };

  const existingOverlay = document.querySelector('#saga-prob-overlay');
  if (existingOverlay) existingOverlay.remove();

  const ov = document.createElement('div');
  ov.id = 'saga-prob-overlay';
  ov.className = 'overlay collection-overlay';
  ov.innerHTML = `<div class="modal collection-modal probabilities-modal" role="dialog" aria-modal="true" aria-label="Probabilidades de las sagas">${renderModalContent()}</div>`;
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

function screenSagas(focusSaga, previousScroll) {
  playMusic('menu');
  if (!Number.isInteger(focusSaga) && meta.lastCompletedIsland && SAGAS[meta.lastCompletedIsland.saga]?.islands[meta.lastCompletedIsland.index]) {
    storyMode = meta.lastCompletedIsland.mode === 'nuzlocke' ? 'nuzlocke' : 'classic';
    selectedDiff = DIFFICULTIES.some(d => d.id === meta.lastCompletedIsland.diff) ? meta.lastCompletedIsland.diff : 1;
  }

  const curDiffObj = DIFFICULTIES.find(d => d.id === selectedDiff) || DIFFICULTIES[0];

  render(`
    ${topbar(false)}
    <div class="world-controls">
      <div class="world-title-row"><button class="btn gray small" id="btn-back">← VOLVER</button><h1>HISTORIA · GRAND LINE</h1><button class="btn small blue" id="btn-saga-probs-all" aria-label="Probabilidades de todas las sagas">📊</button></div>
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

    <div class="world-nav"><details class="world-saga-picker" id="world-saga-picker"><summary id="world-jump">🧭 Sagas · ${SAGAS[focusSaga || 0].name}</summary><div class="world-saga-options">${SAGAS.map((s,i) => `<button type="button" data-jump-saga="${i}" aria-pressed="${i === (focusSaga || 0)}">${sagaUnlocked(i) ? '' : '🔒 '}${s.name}</button>`).join('')}</div></details><button class="btn small gray" id="world-to-start">↓ INICIO</button></div>
    </div>
    <div class="world-ocean-frame">
    <div class="world-sea" aria-hidden="true"></div>
    <div class="world-map" id="world-map" tabindex="0" role="region" aria-label="Carta de Grand Line. Avanza hacia arriba desde East Blue.">
      <div class="world-chart"><svg class="world-route" aria-hidden="true" preserveAspectRatio="none"><path/></svg><div class="world-ship" role="img" aria-label="Going Merry"><span class="world-ship-wake"></span><img src="/art/world/ship-north.webp" alt="" width="90" height="90"></div><p class="world-end">↑ EL VIAJE CONTINÚA</p>${SAGAS.map((_,i) => worldSagaHTML(i)).reverse().join('')}<p class="world-start">↑ Sigue el Log Pose hacia arriba<br>Explora también las islas y sagas bloqueadas.</p></div>
    </div>
    <section class="world-inspector" id="world-island-panel" aria-label="Destino seleccionado" hidden></section>
    </div>
  `);

  $('#btn-back').onclick = () => { screenHome(); };
  $('#tab-classic').onclick = () => { storyMode = 'classic'; screenSagas(Number($('#world-jump').dataset.saga), $('#world-map').scrollTop); };
  $('#tab-nuz').onclick = () => { storyMode = 'nuzlocke'; screenSagas(Number($('#world-jump').dataset.saga), $('#world-map').scrollTop); };

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
      screenSagas(Number($('#world-jump').dataset.saga), $('#world-map').scrollTop);
    };
  });

  document.querySelectorAll('[data-saga-info]').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      showSagaInfoModal(+btn.dataset.sagaInfo);
    };
  });

  document.querySelectorAll('.btn-saga-probs').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      showSagaProbabilitiesModal(+btn.dataset.saga);
    };
  });
  bindWorldMapNavigation(focusSaga, previousScroll);
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
function filterSortChars(ids, st, resolve = id => id) {
  const q = (st.q || '').trim().toLowerCase();
  const out = ids.filter(id => {
    const c = CHARS[resolve(id)];
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (st.saga && c.saga !== st.saga) return false;
    if (st.type && !c.types.includes(st.type)) return false;
    if (+st.rarity && c.rareza !== +st.rarity) return false;
    return true;
  });
  const byName = (a, b) => CHARS[resolve(a)].name.localeCompare(CHARS[resolve(b)].name);
  const baseStatSum = id => CHARS[resolve(id)].base.reduce((a, b) => a + b, 0);
  if (st.sort === 'name') out.sort(byName);
  else if (st.sort === 'rarezaAsc') out.sort((a, b) => CHARS[resolve(a)].rareza - CHARS[resolve(b)].rareza || byName(a, b));
  else if (st.sort === 'rarezaDesc') out.sort((a, b) => CHARS[resolve(b)].rareza - CHARS[resolve(a)].rareza || byName(a, b));
  else if (st.sort === 'statTotalDesc') out.sort((a, b) => baseStatSum(b) - baseStatSum(a) || byName(a, b));
  else if (st.sort === 'hpDesc') out.sort((a, b) => CHARS[resolve(b)].base[0] - CHARS[resolve(a)].base[0] || byName(a, b));
  else if (st.sort === 'atkDesc') out.sort((a, b) => CHARS[resolve(b)].base[1] - CHARS[resolve(a)].base[1] || byName(a, b));
  else if (st.sort === 'defDesc') out.sort((a, b) => CHARS[resolve(b)].base[2] - CHARS[resolve(a)].base[2] || byName(a, b));
  else if (st.sort === 'spatkDesc') out.sort((a, b) => CHARS[resolve(b)].base[3] - CHARS[resolve(a)].base[3] || byName(a, b));
  else if (st.sort === 'spdefDesc') out.sort((a, b) => CHARS[resolve(b)].base[4] - CHARS[resolve(a)].base[4] || byName(a, b));
  else if (st.sort === 'spdDesc') out.sort((a, b) => CHARS[resolve(b)].base[5] - CHARS[resolve(a)].base[5] || byName(a, b));
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

// Keep the roster position when opening another team slot.
let nakamaPickerState = { q:'', saga:'', type:'', rarity:0, sort:'name', scope:'all', page:0 };
function showNakamaPicker(opts) {
  document.querySelector('#inventory-modal-overlay')?.remove();
  const previousFocus = document.activeElement;
  const st = opts.state || nakamaPickerState;
  const team = opts.currentTeam || [];
  const unlocked = [...new Set(['luffy', ...(meta.roster || [])])].filter(id => CHARS[id] && isNakamaUnlocked(id) && (!opts.allowedIds || opts.allowedIds.includes(baseFormOf(id))));
  const display = id => evolutionFormAt(id, startLvlOf(id));
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sagaIds = new Set(unlocked.map(id => CHARS[display(id)].saga));
  const sagas = SAGAS.filter(s => sagaIds.has(s.id));
  if (!sagas.some(s => s.id === st.saga)) st.saga = '';
  const ov = document.createElement('div');
  ov.id = 'inventory-modal-overlay';
  ov.className = 'overlay nakama-picker-overlay';
  if (opts.allowedIds) ov.classList.add('challenge-nakama-picker');
  ov.innerHTML = `<section class="modal nakama-picker" role="dialog" aria-modal="true" aria-labelledby="nakama-picker-title" aria-describedby="nakama-picker-hint">
    <header class="nakama-picker-header"><div><small>TU TRIPULACIÓN</small><h2 id="nakama-picker-title">${esc(opts.title || 'Elige un nakama')}</h2></div><button class="btn gray" id="np-close" aria-label="Cerrar selector">✕</button></header>
    <p id="nakama-picker-hint">${esc(opts.hint || 'Pulsa un retrato para elegirlo. Los nakamas de otro hueco se intercambian.')}</p>
    <div class="nakama-picker-filters">
      <label>Nombre<input id="np-search" type="search" placeholder="Buscar nakama…" value="${esc(st.q)}" autocomplete="off"></label>
      <label>Saga<select id="np-saga"><option value="">Todas las sagas</option>${sagas.map(s => `<option value="${esc(s.id)}" ${st.saga === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
    </div>
    <div class="nakama-picker-scopes" role="group" aria-label="Disponibilidad">${[['all','Todos'],['free','Fuera del equipo'],['team','En el equipo']].map(([value,label]) => `<button class="btn gray" data-scope="${value}" aria-pressed="${st.scope === value}">${label}</button>`).join('')}</div>
    <details class="nakama-picker-more"><summary>Tipo, rareza y orden</summary><div class="nakama-picker-extra">
      <label>Tipo<select id="np-type"><option value="">Todos los tipos</option>${Object.keys(TYPES).map(t => `<option value="${esc(t)}" ${st.type === t ? 'selected' : ''}>${TYPES[t].emoji} ${esc(t)}</option>`).join('')}</select></label>
      <label>Rareza<select id="np-rarity"><option value="0">Todas las rarezas</option>${[1,2,3,4,5].map(r => `<option value="${r}" ${+st.rarity === r ? 'selected' : ''}>${r} estrellas</option>`).join('')}</select></label>
      <label>Orden<select id="np-sort">${[['name','Nombre A–Z'],['rarezaDesc','Mayor rareza'],['statTotalDesc','Stats base totales'],['atkDesc','Ataque base'],['spatkDesc','Ataque especial base'],['spdDesc','Velocidad base']].map(([value,label]) => `<option value="${value}" ${st.sort === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
    </div></details>
    <div class="nakama-picker-summary"><span id="np-count" role="status"></span><button class="btn gray" id="np-reset">Limpiar filtros</button></div>
    <div class="nakama-picker-roster" id="np-roster"></div>
    <footer class="nakama-picker-pages"><button class="btn gray" id="np-prev" aria-label="Página anterior">◀</button><span id="np-page" role="status"></span><button class="btn gray" id="np-next" aria-label="Página siguiente">▶</button></footer>
  </section>`;
  document.body.appendChild(ov);
  const find = sel => ov.querySelector(sel);
  const close = () => { ov.remove(); if (previousFocus?.isConnected) previousFocus.focus(); };
  const draw = () => {
    const ids = filterSortChars(unlocked, st, display).filter(id => st.scope === 'all' || (st.scope === 'team' ? team.includes(id) : !team.includes(id)));
    const pageSize = 12, pages = Math.max(1, Math.ceil(ids.length / pageSize));
    st.page = clamp(st.page, 0, pages - 1);
    find('#np-count').textContent = `${ids.length} de ${unlocked.length} nakamas`;
    find('#np-page').textContent = `Página ${st.page + 1} de ${pages}`;
    find('#np-prev').disabled = st.page === 0;
    find('#np-next').disabled = st.page === pages - 1;
    find('#np-reset').disabled = !st.q && !st.saga && !st.type && !+st.rarity && st.scope === 'all' && st.sort === 'name';
    find('.nakama-picker-more').classList.toggle('filtered', !!st.type || !!+st.rarity || st.sort !== 'name');
    ov.querySelectorAll('[data-scope]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scope === st.scope)));
    find('#np-roster').innerHTML = ids.slice(st.page * pageSize, (st.page + 1) * pageSize).map(id => {
      const c = CHARS[display(id)], current = opts.selectedId === id;
      return `<article class="nakama-picker-card ${team.includes(id) ? 'in-team' : ''}">
        <button class="nakama-picker-pick" data-id="${esc(id)}" aria-label="Elegir a ${esc(c.name)}${current ? ', en este hueco' : team.includes(id) ? ', en el equipo' : ''}">
          <span class="nakama-picker-badge">${current ? 'Este hueco' : team.includes(id) ? 'En equipo' : ''}</span>
          ${charIcon(display(id), 48)}<strong>${esc(c.name)}</strong><span>Nv. ${startLvlOf(id)} · ${'⭐'.repeat(c.rareza)}</span><span class="type-badges">${typeBadges(c.types)}</span>
        </button><button class="nakama-picker-info" data-info="${esc(id)}" aria-label="Ver ficha de ${esc(c.name)}" title="Ver ficha">ⓘ</button>
      </article>`;
    }).join('') || '<p class="nakama-picker-empty">No hay nakamas con estos filtros. Prueba otra saga o pulsa «Limpiar filtros».</p>';
    find('#np-roster').scrollTop = 0;
    ov.querySelectorAll('[data-id]').forEach(btn => btn.onclick = () => { close(); opts.onSelect(btn.dataset.id); });
    ov.querySelectorAll('[data-info]').forEach(btn => btn.onclick = () => {
      showCharModal(btn.dataset.info);
      const closeSheet = document.querySelector('#sheet-close');
      const sheet = closeSheet.closest('.overlay');
      const returnToPicker = () => { sheet.remove(); btn.focus(); };
      closeSheet.onclick = returnToPicker;
      sheet.onclick = e => { if (e.target === sheet) returnToPicker(); };
      sheet.onkeydown = e => {
        if (e.key === 'Escape') { e.preventDefault(); returnToPicker(); }
        if (e.key === 'Tab') {
          const buttons = [...sheet.querySelectorAll('button:not(:disabled)')];
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      closeSheet.focus();
    });
  };
  find('#np-close').onclick = close;
  find('#np-search').oninput = e => { st.q = e.target.value; st.page = 0; draw(); };
  for (const key of ['saga','type','rarity','sort']) find(`#np-${key}`).onchange = e => { st[key] = e.target.value; st.page = 0; draw(); };
  ov.querySelectorAll('[data-scope]').forEach(btn => btn.onclick = () => { st.scope = btn.dataset.scope; st.page = 0; draw(); });
  find('#np-reset').onclick = () => {
    Object.assign(st, {q:'', saga:'', type:'', rarity:0, sort:'name', scope:'all', page:0});
    find('#np-search').value = '';
    for (const key of ['saga','type','rarity','sort']) find(`#np-${key}`).value = st[key];
    draw();
  };
  for (const [key, step] of [['prev',-1],['next',1]]) find(`#np-${key}`).onclick = () => {
    st.page += step; draw();
    // A disabled paging control must not strand keyboard focus.
    if (find(`#np-${key}`).disabled) find('.nakama-picker-pick')?.focus();
  };
  ov.onclick = e => { if (e.target === ov) close(); };
  ov.onkeydown = e => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      const focusable = [...ov.querySelectorAll('button:not(:disabled),input,select,summary')].filter(el => el.getClientRects().length);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  draw();
  find('#np-close').focus();
}

function showInventoryModal(opts = {}) {
  if (opts.onSelect) return showNakamaPicker(opts);
  const previousFocus=document.activeElement;
  const currentTeam=opts.currentTeam || (run?.team || []).map(f=>baseFormOf(f.id));
  const roster=(meta.roster || []).filter(id=>CHARS[id]);
  const allUnlocked=[...new Set(['luffy',...roster])].filter(id=>CHARS[id]&&isNakamaUnlocked(id));
  const number=value=>Number(value).toLocaleString('es');
  const compact=value=>Number(value).toLocaleString('es',{notation:value>=1000000?'compact':'standard',maximumFractionDigits:1});
  let page=0,filtersOpen=false;
  const pageSize=12;
  invViewState={q:'',type:'',rarity:0,saga:'',sort:'name'};
  const renderContent=()=>{
    const ids=filterSortChars(allUnlocked,invViewState,id=>evolutionFormAt(id,startLvlOf(id)));
    const pages=Math.max(1,Math.ceil(ids.length/pageSize));page=Math.min(page,pages-1);
    const cap=maxStartLvlCap();
    const cards=ids.slice(page*pageSize,(page+1)*pageSize).map(id=>{
      const displayId=evolutionFormAt(id,startLvlOf(id)),c=CHARS[displayId],level=startLvlOf(id);
      const cost=logPoseUpgradeCost(level),maxed=level>=cap,canAfford=(meta.logPoses||0)>=cost;
      const relic=meta.relics.includes(meta.relicEquipment?.[id])?RELICS[meta.relicEquipment[id]]:null;
      return `<article class="inventory-card ${currentTeam.includes(id)?'in-team':''}" data-id="${id}">
        <div class="inventory-card-top"><span>${currentTeam.includes(id)?'En tu equipo':'Nakama'}</span><span class="inventory-rarity" aria-label="Rareza ${c.rareza} de 5 estrellas"><span aria-hidden="true">★</span> ${c.rareza}/5</span></div>
        <button class="inventory-profile btn-info-inv" data-id="${id}" aria-label="Ver ficha de ${collectionText(c.name)}"><span class="inventory-portrait" aria-hidden="true">${charIcon(displayId,80)}</span><strong>${c.name}</strong><span class="inventory-profile-link">Ver ficha ↗</span></button>
        <div class="inventory-level">Nivel base <strong>${level}</strong></div><div class="type-badges">${typeBadges(c.types)}</div>
        <p class="inventory-relic">${relic?`🏺 ${esc(relic.name)}<br><span>${relic.character===id?'Afinidad activa':'Boost común activo'}</span>`:'Sin reliquia equipada'}</p>
        <div class="inventory-upgrade">${maxed?`<span class="inventory-limit">Límite de saga: Nv. ${cap}</span><button class="btn btn-upg-inv" data-id="${id}" disabled aria-label="Nivel máximo de saga alcanzado"><span class="inventory-upgrade-label">Nivel máximo</span><span class="inventory-upgrade-short" aria-hidden="true">Máx.</span></button>`:`<span class="inventory-cost" title="${number(cost)} Log Poses">Coste: <strong>${compact(cost)} 🧭</strong></span><button class="btn gold btn-upg-inv" data-id="${id}" ${canAfford?'':'disabled'} aria-label="Mejorar a ${collectionText(c.name)} al nivel base ${level+1} por ${number(cost)} Log Poses"><span class="inventory-upgrade-label">Subir a Nv. ${level+1}</span><span class="inventory-upgrade-short" aria-hidden="true">↑ Lv. ${level+1}</span></button>${canAfford?'':`<span class="inventory-shortfall">Faltan ${compact(cost-(meta.logPoses||0))} 🧭</span>`}`}</div>
      </article>`;
    }).join('');
    const filtered=invViewState.type||+invViewState.rarity||invViewState.saga;
    return `<header class="collection-header"><div><span class="collection-eyebrow">Tu tripulación</span><h2 id="inv-title" tabindex="-1">${collectionText(opts.title || 'Inventario')}</h2></div><button class="btn gray collection-close" id="inv-close-x" aria-label="Cerrar inventario">Cerrar <span aria-hidden="true">×</span></button></header>
      <button class="btn gray inventory-relics-link" id="inv-relics">🏺 Reliquias (${meta.relics.filter(id=>RELICS[id]).length}) · Ver y equipar →</button>
      <div class="collection-summary"><div><strong>${allUnlocked.length}</strong><span>Nakamas disponibles</span></div><button class="collection-summary-action" id="inv-logpose-info" aria-label="${number(meta.logPoses||0)} Log Poses disponibles. Ver cómo conseguirlos"><strong>${compact(meta.logPoses||0)} 🧭</strong><span>Log Poses · ¿Cómo conseguirlos?</span></button></div>
      <label for="inv-q" class="inventory-search-label">Buscar nakama<input id="inv-q" type="search" placeholder="Nombre del personaje o su forma" value="${collectionText(invViewState.q)}"></label>
      <details class="collection-extra" ${filtersOpen?'open':''}><summary>Filtros y vista${filtered?' · activos':''}</summary><div class="collection-filter-grid inventory-filters">
        <label for="inv-saga">Saga<select id="inv-saga"><option value="">Todas las sagas</option>${groupUpgradeRoster(allUnlocked).map(g=>`<option value="${g.id}" ${invViewState.saga===g.id?'selected':''}>${g.name}</option>`).join('')}</select></label>
        <label for="inv-type">Tipo<select id="inv-type"><option value="">Todos los tipos</option>${Object.keys(TYPES).map(t=>`<option value="${t}" ${invViewState.type===t?'selected':''}>${t}</option>`).join('')}</select></label>
        <label for="inv-rarity">Rareza<select id="inv-rarity"><option value="0">Todas las rarezas</option>${[1,2,3,4,5].map(r=>`<option value="${r}" ${+invViewState.rarity===r?'selected':''}>${r} ${r===1?'estrella':'estrellas'}</option>`).join('')}</select></label>
        <label for="inv-sort">Ordenar<select id="inv-sort">${[['name','Nombre A–Z'],['rarezaDesc','Mayor rareza'],['rarezaAsc','Menor rareza'],['statTotalDesc','Mayor fuerza base']].map(([v,l])=>`<option value="${v}" ${invViewState.sort===v?'selected':''}>${l}</option>`).join('')}</select></label>
      </div></details>
      <div class="collection-results"><span role="status">${ids.length} nakamas${ids.length?` · ${page*pageSize+1}–${Math.min((page+1)*pageSize,ids.length)}`:''}</span><button class="collection-text-button" id="inv-reset">Limpiar filtros</button></div>
      <div id="inv-cards-grid" class="collection-list inventory-grid" aria-label="Lista de nakamas" tabindex="0">${cards||'<div class="collection-empty"><h3>No hay nakamas con estos filtros</h3><p>Prueba otro nombre o limpia los filtros.</p></div>'}</div>
      <nav class="collection-pagination" aria-label="Páginas de nakamas"><button class="btn gray" data-inv-page="-1" ${page===0?'disabled':''} aria-label="Página anterior de nakamas">← Anterior</button><span>Página ${page+1} de ${pages}</span><button class="btn gray" data-inv-page="1" ${page===pages-1?'disabled':''} aria-label="Página siguiente de nakamas">Siguiente →</button></nav>`;
  };
  document.querySelector('#inventory-modal-overlay')?.remove();
  const ov=document.createElement('div');ov.id='inventory-modal-overlay';ov.className='overlay collection-overlay';
  ov.innerHTML=`<section class="modal collection-modal inventory-modal" role="dialog" aria-modal="true" aria-labelledby="inv-title">${renderContent()}</section>`;
  document.body.appendChild(ov);
  const close=()=>{ov.remove();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});};
  const refresh=(selector,resetScroll=false,cursor=null)=>{
    const scroll=resetScroll?0:ov.querySelector('#inv-cards-grid').scrollTop;
    filtersOpen=ov.querySelector('details').open;
    ov.querySelector('.modal').innerHTML=renderContent();bindEvents();
    ov.querySelector('#inv-cards-grid').scrollTop=scroll;
    const target=selector.split(',').map(part=>ov.querySelector(part)).find(Boolean)||ov.querySelector('#inv-cards-grid');
    target.focus({preventScroll:true});if(cursor!==null)target.setSelectionRange?.(cursor,cursor);
  };
  const bindEvents=()=>{
    ov.querySelector('#inv-close-x').onclick=close;
    ov.querySelector('#inv-relics').onclick=()=>showRelicCollection({onClose:()=>refresh('#inv-relics')});
    ov.querySelector('#inv-q').oninput=e=>{invViewState.q=e.target.value;page=0;refresh('#inv-q',true,e.target.selectionStart);};
    for(const [id,key] of [['inv-type','type'],['inv-rarity','rarity'],['inv-saga','saga'],['inv-sort','sort']])ov.querySelector('#'+id).onchange=e=>{invViewState[key]=e.target.value;page=0;refresh('#'+id,true);};
    ov.querySelector('#inv-reset').onclick=()=>{invViewState={q:'',type:'',rarity:0,saga:'',sort:'name'};page=0;refresh('#inv-q',true);};
    ov.querySelectorAll('[data-inv-page]').forEach(btn=>btn.onclick=()=>{page+=Number(btn.dataset.invPage);refresh('#inv-cards-grid',true);});
    ov.querySelectorAll('.btn-upg-inv').forEach(btn=>btn.onclick=()=>{
      if(upgradeCharLvl(btn.dataset.id))refresh(`.btn-upg-inv[data-id="${btn.dataset.id}"]:not(:disabled),.btn-info-inv[data-id="${btn.dataset.id}"]`);
    });
    ov.querySelectorAll('.btn-info-inv').forEach(btn=>btn.onclick=()=>{
      showCharModal(btn.dataset.id);
      const sheet=document.querySelector('#sheet-close')?.closest('.overlay');if(!sheet)return;
      const closeSheet=()=>{sheet.remove();if(btn.isConnected)btn.focus({preventScroll:true});};
      sheet.querySelector('#sheet-close').onclick=closeSheet;
      sheet.onclick=e=>{if(e.target===sheet)closeSheet();};
      sheet.querySelector('.modal').setAttribute('role','dialog');sheet.querySelector('.modal').setAttribute('aria-modal','true');sheet.querySelector('.modal').setAttribute('aria-label',`Ficha de ${CHARS[evolutionFormAt(btn.dataset.id,startLvlOf(btn.dataset.id))].name}`);
      bindCollectionDialog(sheet,closeSheet,'#sheet-close');
    });
    ov.querySelector('#inv-logpose-info').onclick=()=>{
      const returnFocus=()=>ov.querySelector('#inv-logpose-info')?.focus({preventScroll:true});
      modalInfo('🧭 Log Poses de navegación','<div class="collection-help"><p>Sirven para subir el <strong>nivel base permanente</strong> de tus nakamas y desbloquear sus evoluciones.</p><p>Se obtienen al derrotar enemigos: en East Blue, cada pirata entrega 3, cada marine 4 y cada jefe 7. La cantidad se multiplica por el número de saga.</p><p>El coste aumenta con cada nivel. El nivel máximo disponible depende de tu progreso en las sagas.</p></div>',returnFocus);
      const help=document.querySelector('#modal-ok').closest('.overlay');const closeHelp=()=>{help.remove();returnFocus();};
      help.querySelector('.modal').setAttribute('role','dialog');help.querySelector('.modal').setAttribute('aria-modal','true');help.querySelector('.modal').setAttribute('aria-label','Log Poses de navegación');
      bindCollectionDialog(help,closeHelp,'#modal-ok');
    };
  };
  bindEvents();ov.onclick=e=>{if(e.target===ov)close();};bindCollectionDialog(ov,close,'#inv-title');
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

function islandMapCount(island) {
  return Math.min(5, Math.max(3, 2 + island.boss.length));
}
function migrateLegacyIslandWins(progress) {
  progress.islandProgress ||= {};
  for (const saga of SAGAS) for (const [diff, won] of Object.entries(progress.sagaDiffWins?.[saga.id] || {})) {
    if (!won || Object.keys(progress.islandProgress).some(k=>k.startsWith(`${saga.id}:`) && k.endsWith(`:${diff}`))) continue;
    for (const mode of ['classic','nuzlocke']) progress.islandProgress[`${saga.id}:${mode}:${diff}`] = saga.islands.map((_,i)=>i);
  }
}
function islandProgressKey(sagaIdx, mode = storyMode, diff = selectedDiff || 1) {
  return `${SAGAS[sagaIdx].id}:${mode}:${diff}`;
}
function migrateIslandJourney(journey, progress) {
  if (!journey || journey.campaignVersion === 1 || !SAGAS[journey.saga]?.islands[journey.islandIdx]) return;
  journey.campaignVersion = 1;
  // Continue the existing map as the final map; never regenerate or discard saved nodes.
  journey.mapIdx = islandMapCount(SAGAS[journey.saga].islands[journey.islandIdx]) - 1;
  progress.islandProgress ||= {};
  const key = islandProgressKey(journey.saga, journey.mode, journey.diff || 1);
  const legacyWins = progress.sagaDiffWins?.[SAGAS[journey.saga].id]?.[journey.diff || 1] ? SAGAS[journey.saga].islands.map((_,i)=>i) : [];
  progress.islandProgress[key] = [...new Set([...(progress.islandProgress[key] || legacyWins), ...(journey.badges || []).filter(i => Number.isInteger(i) && i < journey.islandIdx)])];
}
function completedIslands(sagaIdx, mode = storyMode, diff = selectedDiff || 1) {
  const key = islandProgressKey(sagaIdx, mode, diff);
  if (Object.hasOwn(meta.islandProgress || {}, key)) return meta.islandProgress[key];
  // Previously conquered sagas keep all their islands accessible.
  // A new victory in one mode must not grant the other mode's island progress.
  if (Object.keys(meta.islandProgress || {}).some(k => k.startsWith(`${SAGAS[sagaIdx].id}:`) && k.endsWith(`:${diff}`))) return [];
  return meta.sagaDiffWins?.[SAGAS[sagaIdx].id]?.[diff] ? SAGAS[sagaIdx].islands.map((_,i) => i) : [];
}
function islandAvailable(sagaIdx, index, mode = storyMode, diff = selectedDiff || 1) {
  const done = completedIslands(sagaIdx, mode, diff);
  return index === 0 || done.includes(index) || done.includes(index - 1);
}
function genIslandMap(island, mapIdx) {
  const finalMap = mapIdx === islandMapCount(island) - 1;
  const map = genMap({...island, final:finalMap && island.final});
  if (!finalMap) map.rows[map.rows.length - 1][0].type = 'travel';
  return map;
}
// One chart shared by Historia and every return from an island expedition.
function worldIslandState(sagaIdx, index) {
  const saga = SAGAS[sagaIdx];
  const active = !!(run && !run.islandComplete && run.saga === sagaIdx && run.islandIdx === index && run.mode === storyMode && (run.diff || 1) === selectedDiff);
  let reason = '';
  if (!sagaUnlocked(sagaIdx)) reason = `Supera ${SAGAS[sagaIdx - 1].name} en dificultad Capitán.`;
  else if (!sagaDiffUnlocked(saga.id, selectedDiff)) reason = `Supera esta saga en dificultad ${DIFFICULTIES.find(d => d.id === selectedDiff - 1)?.name}.`;
  else if (!islandAvailable(sagaIdx, index)) reason = `Completa ${saga.islands[index - 1]?.name} para desbloquear esta isla.`;
  return {active, available:active || !reason, reason:active ? '' : reason};
}

function worldSagaHTML(sagaIdx) {
  const saga = SAGAS[sagaIdx], done = completedIslands(sagaIdx);
  const wins = meta.sagaDiffWins?.[saga.id] || {};
  const entry = worldIslandState(sagaIdx, 0);
  const crossing = saga.id === 'eastblue'
    ? '<div class="world-redline" data-world-crossing><strong>RED LINE · REVERSE MOUNTAIN</strong><span>↑ Entrada a Grand Line · Paradise</span></div>'
    : saga.id === 'gyojin'
      ? '<div class="world-redline" data-world-crossing><strong>RED LINE · NUEVO MUNDO ↑</strong><span>La ruta pasa bajo el continente, por la Isla Gyojin</span></div>' : '';
  return `${crossing}<section class="world-saga" id="world-saga-${sagaIdx}" data-world-saga="${sagaIdx}" style="--saga-color:${saga.color}">
    <div class="world-islands">${saga.islands.map((island, i) => {
      const {active, available} = worldIslandState(sagaIdx, i);
      const state = active ? `Continuar · mapa ${(run.mapIdx || 0) + 1}/${islandMapCount(island)}` : !available ? 'Bloqueada' : done.includes(i) ? 'Completada · explorar' : 'Explorar destino';
      return `<div class="world-stop ${i % 2 ? 'starboard' : 'port'} ${done.includes(i) ? 'is-complete' : ''} ${active ? 'is-current' : ''} ${available ? '' : 'is-locked'}" id="world-island-${sagaIdx}-${i}" data-location-key="${saga.id}-${i}">
        <div class="world-island-card">
        <button class="island-select" data-world-island="${i}" data-world-saga="${sagaIdx}" aria-controls="world-island-panel" aria-expanded="false" aria-label="${island.name}. ${state}">
          <span class="island-land" aria-hidden="true">
            <img src="/art/world/${saga.id}-${i}.webp" alt="" width="320" height="240" loading="lazy" decoding="async">
          </span>

          <span class="island-label"><b>${island.location?.place || island.name}</b><span class="island-zone">${island.location?.zone || saga.name}</span><span>${islandMapCount(island)} mapas · ${island.boss.length} ${island.boss.length === 1 ? 'jefe' : 'jefes'}</span><small>${state}</small></span>
        </button>
        </div>
      </div>`;
    }).reverse().join('')}</div>
    <header class="world-saga-heading">
      <span class="atlas-eyebrow">${sagaIdx === 0 ? 'EAST BLUE · COMIENZA AQUÍ' : sagaIdx <= 5 ? 'GRAND LINE · PARADISE' : sagaIdx === 6 ? 'BAJO LA RED LINE · 10.000 M' : 'GRAND LINE · NUEVO MUNDO'}</span>
      <h2>${saga.name}</h2>
      <p>${done.length}/${saga.islands.length} islas completadas ${wins[selectedDiff] ? '· ★ Dificultad superada' : ''}</p>
      ${entry.reason ? `<p class="world-lock">🔒 ${entry.reason}</p>` : ''}
      <details class="world-saga-details"><summary>Datos de saga · dificultades e información</summary>
        <p>Victorias Clásico: ${meta.wins[saga.id] || 0} · Nuzlocke: ${meta.nuzWins[saga.id] || 0}</p>
        <div class="world-difficulties">${DIFFICULTIES.map(d => `<span>${d.emoji} ${d.name}: ${wins[d.id] ? '✓ Superada' : sagaDiffUnlocked(saga.id, d.id) ? 'Disponible' : '🔒 Bloqueada'}</span>`).join('')}</div>
        <div class="actions"><button class="btn small gray btn-saga-probs" data-saga="${sagaIdx}">📊 PROBABILIDADES</button><button class="btn small blue" data-saga-info="${sagaIdx}">ⓘ JEFES Y NIVELES</button></div>
      </details>
    </header>
  </section>`;
}

function worldStopTop(chart,stop) {
  return stop.getBoundingClientRect ? chart.scrollTop + stop.getBoundingClientRect().top - chart.getBoundingClientRect().top : stop.offsetTop;
}
function updateWorldSagaPicker(index) {
  $('#world-jump').dataset.saga = String(index);
  $('#world-jump').textContent = '🧭 Sagas · ' + SAGAS[index].name;
  document.querySelectorAll('[data-jump-saga]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.jumpSaga) === index)));
}
function scrollWorldStart(chart) {
  updateWorldSagaPicker(0);
  // On short phones, keep the first island in view rather than only its saga footer.
  const first = $('#world-island-0-0');
  chart.scrollTop = Math.min(chart.scrollHeight - chart.clientHeight, worldStopTop(chart,first) - 16);
}

function bindWorldMapNavigation(focusSaga, previousScroll) {
  const chart = $('#world-map');
  const recent = meta.lastCompletedIsland;
  updateWorldSagaPicker(Number.isInteger(focusSaga) ? focusSaga : recent && SAGAS[recent.saga]?.islands[recent.index] ? recent.saga : 0);
  if (previousScroll != null) chart.scrollTop = previousScroll;
  else if (recent && SAGAS[recent.saga]?.islands[recent.index] && (!Number.isInteger(focusSaga) || focusSaga === recent.saga)) {
    const target = $(`#world-island-${recent.saga}-${recent.index}`);
    updateWorldSagaPicker(recent.saga);
    chart.scrollTop = worldStopTop(chart,target) - chart.clientHeight / 2 + target.offsetHeight / 2;
  }
  else if (Number.isInteger(focusSaga)) {
    const current = run && run.saga === focusSaga && !run.islandComplete && run.mode === storyMode && (run.diff || 1) === selectedDiff;
    const index = current ? run.islandIdx : SAGAS[focusSaga].islands.findIndex((_, i) => worldIslandState(focusSaga, i).available && !completedIslands(focusSaga).includes(i));
    const target = $(`#world-island-${focusSaga}-${Math.max(0, index)}`);
    chart.scrollTop = worldStopTop(chart,target) - chart.clientHeight / 2 + target.offsetHeight / 2;
  } else scrollWorldStart(chart);
  $('#world-to-start').onclick = () => scrollWorldStart(chart);
  document.querySelectorAll('[data-jump-saga]').forEach(button => button.onclick = () => {
    const index = Number(button.dataset.jumpSaga);
    const target = $(`#world-island-${index}-0`);
    chart.scrollTop = worldStopTop(chart,target) - 16;
    updateWorldSagaPicker(index);
    $('#world-saga-picker').open = false;
    $('#world-jump').focus();
  });
  worldNavigator = globalThis.WorldVoyage?.mount(chart, {
    initialId:worldShipLocation || (run && !run.islandComplete ? `${SAGAS[run.saga]?.id}-${run.islandIdx}` : recent && SAGAS[recent.saga]?.islands[recent.index] ? `${SAGAS[recent.saga].id}-${recent.index}` : null),
    onTravel:() => updateWorldArrival(true),
    onArrival:id => { worldShipLocation=id; updateWorldArrival(false); }
  });
  chart.parentElement && (chart.parentElement.onkeydown = e => {
    if(e.key === 'Escape' && worldSelection){e.preventDefault();closeWorldIsland();}
  });
  document.querySelectorAll('[data-island-info]').forEach(button => {
    button.onclick = () => selectWorldIsland(+button.dataset.worldSaga, +button.dataset.islandInfo, button);
  });
  document.querySelectorAll('[data-world-island]').forEach(button => {
    button.onclick = () => selectWorldIsland(+button.dataset.worldSaga, +button.dataset.worldIsland, button);
  });
}

// Reading a destination never starts or replaces an expedition.
function worldIslandCompletion(sagaIdx,index,mode,diff) {
  const key=islandProgressKey(sagaIdx,mode,diff),progress=meta.islandProgress || {};
  if(Object.hasOwn(progress,key))return progress[key].includes(index);
  const saga=SAGAS[sagaIdx].id;
  if(Object.keys(progress).some(k=>k.startsWith(`${saga}:`)&&k.endsWith(`:${diff}`)))return false;
  // Legacy saga victories unlocked islands but did not record a mode per difficulty.
  return meta.sagaDiffWins?.[saga]?.[diff] ? 'legacy' : false;
}
function worldIslandPanelHTML(sagaIdx,index) {
  const saga=SAGAS[sagaIdx],island=saga.islands[index],location=island.location;
  const state=worldIslandState(sagaIdx,index);
  const progress=['classic','nuzlocke'].map(mode => `<div class="world-mode-progress"><strong>${mode==='classic'?'Clásico':'Nuzlocke'}</strong><div>${DIFFICULTIES.map(d=>{
    const result=worldIslandCompletion(sagaIdx,index,mode,d.id),won=result===true;
    const status=won?'superada':result==='legacy'?'guardado antiguo: modo no registrado':'pendiente';
    return `<span class="${won?'won':''}" title="${d.name}: ${status}" aria-label="${d.name}: ${status}">${d.emoji} ${won?'✓':result==='legacy'?'?':'—'}</span>`;
  }).join('')}</div></div>`).join('');
  return `<header><div><h2>${location?.place || island.name}</h2><p>${location?.zone || saga.name} · ${location?.kind || 'Destino'}</p></div><button class="btn gray small" id="world-close" aria-label="Cerrar destino">✕</button></header>
    <div class="world-inspector-body">
    <div class="world-completions" aria-label="Dificultades completadas por modo">${progress}</div>
    <p>${islandMapCount(island)} mapas · Enemigos Nv. ${island.lvl[0]}–${island.lvl[1]}</p>
    <details><summary>Jefes y datos del destino</summary><p>${location?.description || ''}</p><p>${island.boss.map((id,k)=>`${CHARS[id].name} · Nv. ${island.bossLvl[k]}`).join('<br>')}</p><p>${saga.name} · ${storyMode==='classic'?'Clásico':'Nuzlocke'} · ${DIFFICULTIES.find(d=>d.id===selectedDiff)?.name}</p></details>
    ${state.reason?`<p class="world-lock">🔒 ${state.reason}</p>`:''}</div>
    <footer><span id="world-arrival" role="status" aria-live="polite">Destino seleccionado</span><div class="world-panel-actions"><button class="btn small gray" id="world-skip" hidden>SALTAR TRAVESÍA</button><button class="btn small gold" id="world-enter" ${state.available?'':'disabled'}>${state.active?'CONTINUAR':'ENTRAR'}</button></div></footer>`;
}
function selectWorldIsland(sagaIdx,index,trigger) {
  const panel=$('#world-island-panel');if(!panel)return;
  if(worldSelection?.trigger?.setAttribute)worldSelection.trigger.setAttribute('aria-expanded','false');
  worldSelection={sagaIdx,index,trigger};
  panel.innerHTML=worldIslandPanelHTML(sagaIdx,index);panel.hidden=false;
  trigger?.setAttribute?.('aria-expanded','true');
  document.querySelectorAll('.world-stop.is-selected').forEach(el=>el.classList.remove('is-selected'));
  $(`#world-island-${sagaIdx}-${index}`)?.classList?.add('is-selected');
  $('#world-close').onclick=closeWorldIsland;
  $('#world-skip').onclick=()=>worldNavigator?.finish();
  $('#world-enter').onclick=enterWorldIsland;
  const started=worldNavigator?.travelTo(`${SAGAS[sagaIdx].id}-${index}`);
  if(!started)updateWorldArrival(false);
  $('#world-close').focus?.({preventScroll:true});
}
function updateWorldArrival(sailing) {
  if(!worldSelection)return;
  const state=worldIslandState(worldSelection.sagaIdx,worldSelection.index);
  $('#world-enter').disabled=sailing || !state.available;
  $('#world-skip').hidden=!sailing;
  $('#world-arrival').textContent=sailing?'Navegando…':state.available?'¡Destino alcanzado!':'Destino bloqueado';
}
function closeWorldIsland() {
  const selection=worldSelection;worldSelection=null;
  $('#world-island-panel').hidden=true;
  selection?.trigger?.setAttribute?.('aria-expanded','false');
  document.querySelectorAll('.world-stop.is-selected').forEach(el=>el.classList.remove('is-selected'));
  if(selection?.trigger?.isConnected)selection.trigger.focus({preventScroll:true});
}
function enterWorldIsland() {
  if(!worldSelection || worldNavigator?.sailing)return;
  const {sagaIdx,index}=worldSelection,state=worldIslandState(sagaIdx,index);
  if(!state.available)return;
  if(state.active){screenMap();return;}
  const choose=()=>screenStarter(sagaIdx,index);
  if(run)modalConfirm('🧭 ¿Preparar otra expedición?', 'Al zarpar sustituirás el viaje en curso. Los reclutas de una isla sin completar aún no son permanentes.', choose);
  else choose();
}

function screenIslands(sagaIdx) {
  screenSagas(sagaIdx);
}

function showIslandInfo(sagaIdx, index, trigger) {
  const saga=SAGAS[sagaIdx], island=saga.islands[index];
  const {available, reason}=worldIslandState(sagaIdx,index);
  const ov=document.createElement('div');
  ov.className='overlay';
  ov.innerHTML=`<div class="modal island-info" role="dialog" aria-modal="true" aria-label="Información de ${island.name}">
    <h2>${available ? 'ⓘ' : '🔒'} ${island.name}</h2>
    <p>${islandMapCount(island)} mapas · ${island.boss.length} ${island.boss.length===1 ? 'jefe' : 'jefes'} en un único combate final.</p>
    <div class="island-bosses"><h3>Jefes y niveles</h3>${island.boss.map((id,k)=>`<div class="island-boss"><span>${CHARS[id].name}</span><strong>Nv. ${island.bossLvl[k]}</strong></div>`).join('')}</div>
    <p>${available ? 'Isla disponible. Selecciónala en el mapa para preparar tu banda o continuar tu viaje.' : reason}</p>
    <div class="actions"><button class="btn gray" data-close-island-info>CERRAR</button></div>
  </div>`;
  const close=()=>{ov.remove();if(trigger?.isConnected)trigger.focus();};
  ov.querySelector('[data-close-island-info]').onclick=close;
  ov.onclick=e=>{if(e.target===ov)close();};
  ov.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}else if(e.key==='Tab'){e.preventDefault();ov.querySelector('[data-close-island-info]').focus();}};
  document.body.appendChild(ov);
  ov.querySelector('[data-close-island-info]').focus();
}

function screenStarter(sagaIdx, islandIdx = 0) {
  playMusic('menu');
  const saga = SAGAS[sagaIdx];
  const maxSlots = starterSlotsCount();
  let picked = [];

  meta.teamPresets = meta.teamPresets || { 1: [], 2: [], 3: [] };

  const renderSlotsGrid = () => {
    let slotsHTML = '';
    const cap = maxStartLvlCap();
    for (let i = 0; i < 6; i++) {
      if (i >= maxSlots) {
        slotsHTML += `<div class="starter-slot-card locked-slot" aria-label="Hueco ${i + 1} bloqueado"><div class="starter-slot-badge">HUECO ${i + 1}</div><span aria-hidden="true">🔒</span><b>Bloqueado</b><small>Desbloquea más huecos en la tienda</small></div>`;
        continue;
      }
      const id = picked[i];
      if (id && CHARS[id]) {
        const displayId = evolutionFormAt(id, startLvlOf(id));
        const c = CHARS[displayId];
        const startLvl = startLvlOf(id);
        const cost = logPoseUpgradeCost(startLvl);
        const isMax = startLvl >= cap;
        const canAfford = (meta.logPoses || 0) >= cost;

        slotsHTML += `
          <div class="starter-slot-card occupied" data-slot="${i}">
            <div class="starter-slot-badge">HUECO ${i + 1}</div>
            <div style="margin-top:14px;" class="emoji">${charIcon(displayId, 40)}</div>
            <div style="font-size:10px;font-weight:bold;margin:3px 0;">${c.name}</div>
            <div class="char-lvl" style="font-size:8px;">Nv. ${startLvl} · ${'⭐'.repeat(c.rareza)}</div>
            <div class="type-badges" style="margin:3px 0;justify-content:center;">${typeBadges(c.types)}</div>
            <div style="margin:4px 0;width:100%;">
              ${isMax ? `
                <span style="font-size:7.5px;color:var(--green);font-weight:bold;background:rgba(0,0,0,0.06);padding:2px 6px;border-radius:3px;display:inline-block;">🔒 Nv. Máx (${cap})</span>
              ` : `
                <button class="btn small gold btn-upg-slot" data-id="${id}" ${canAfford ? '' : 'disabled'} style="font-size:7.5px;padding:3px 6px;width:100%;" title="Cuesta ${cost} Log Poses">
                  Nv +1 · ${cost} 🧭
                </button>
              `}
            </div>
            <div style="display:flex;gap:3px;margin-top:2px;width:100%;justify-content:center;">
              <button class="btn small blue btn-swap-slot" data-slot="${i}" style="font-size:7.5px;padding:3px 5px;flex:1;" aria-label="Cambiar nakama">↔</button>
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
    <div class="subtitle" style="font-size:14px;">${saga.name} · ${saga.islands[islandIdx].name}</div>
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
        <h2 id="starter-team-heading" style="margin:0;">🏴‍☠️ Configuración de la Banda (${picked.length}/${maxSlots})</h2>
        <div id="starter-logpose-info" style="font-size:9.5px;font-weight:bold;color:var(--gold);background:var(--ink);padding:4px 8px;border-radius:4px;border:1px solid var(--gold);cursor:pointer;" title="Toca para saber más sobre los Log Poses">
          🧭 Log Poses: ${meta.logPoses || 0} ℹ️
        </div>
      </div>
      <p style="font-size:8.5px;color:#555;margin-bottom:12px;">Toca para elegir · Mantén pulsado para reordenar.</p>
      
      <div id="starter-slots-container"></div>
      <section class="team-synergy-summary" aria-label="Sinergias del equipo"><h3>Sinergias activas</h3><div id="starter-synergies" aria-live="polite"></div><button class="btn small gray" id="starter-synergy-info">Ver sinergias y tipos</button></section>
      ${renderPresetsBar()}

      <div class="starter-launch-actions" style="text-align:center;margin-top:16px;">
        <button class="btn green" id="btn-zarpar" style="font-size:11px;padding:10px 20px;">
          ⚔️ ZARPAR CON TU BANDA (${picked.length}/${maxSlots})
        </button>
        <button class="btn blue" id="btn-auto-island">🤖 Automático</button>
      </div>
    </div>
  `);

  $('#btn-back').onclick = () => screenIslands(sagaIdx);

  const openInventoryPicker = (slotIdx) => {
    showInventoryModal({
      title: `Añadir / Sustituir Nakama (Hueco ${slotIdx + 1})`,
      currentTeam: picked,
      selectedId: picked[slotIdx],
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
    const repeatBtn = $('#btn-auto-island');
    if (repeatBtn) {
      const team = picked.filter(Boolean);
      repeatBtn.disabled = team.length < 1;
      repeatBtn.onclick = () => showIslandRepeatSetup(sagaIdx, team, islandIdx);
    }
    if (zarparBtn) {
      const cleanPicked = picked.filter(Boolean);
      zarparBtn.disabled = cleanPicked.length < 1;
      zarparBtn.textContent = `⚔️ ZARPAR CON TU BANDA (${cleanPicked.length}/${maxSlots})`;
      zarparBtn.onclick = () => {
        if (cleanPicked.length >= 1) startRun(sagaIdx, cleanPicked, islandIdx);
      };
    }
  };

  const update = () => {
    const heading = $('#starter-team-heading');
    if (heading) heading.textContent = `🏴‍☠️ Configuración de la Banda (${picked.filter(Boolean).length}/${maxSlots})`;
    const slotsContainer = $('#starter-slots-container');
    if (slotsContainer) slotsContainer.innerHTML = renderSlotsGrid();
    const previewTeam = picked.filter(Boolean).map(id => applyUpgrades(makeChar(id, startLvlOf(id))));
    $('#starter-synergies').innerHTML = activeSynergiesHTML(previewTeam);
    $('#starter-synergy-info').onclick = () => showSynergyModal(previewTeam);
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
// East Blue permite Nv.15; las siguientes sagas nunca reducen ese límite.
function maxStartLvlCap(progress = meta) {
  let highestSaga = 0;
  for (let i = 0; i < SAGAS.length; i++) {
    if (sagaUnlocked(i, progress)) highestSaga = i;
  }
  return Math.max(15, SAGAS[highestSaga] ? SAGAS[highestSaga].islands[0].lvl[0] : 15);
}

function logPoseUpgradeCost(currentLvl) {
  const diff = Math.max(0, currentLvl - 5);
  return Math.floor(3 * Math.pow(1.5, diff) + diff * 2 + 3);
}

function startLvlOf(id, progress = meta) {
  const base = baseFormOf(id);
  const purchased = (progress.charUpgrades || {})[base] || 0;
  const rawLvl = 5 + purchased;
  const cap = maxStartLvlCap(progress);
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
  for (const team of [run?.team, tower?.team]) {
    for (const f of team || []) if (baseFormOf(f.id) === base) {
      syncEvolution(f);
      registerDex(f.id);
    }
  }
  if (run) saveRun();
  saveMeta();
  toast(`✨ ¡${CHARS[id].name} sube al Nivel ${startLvlOf(id)}! (${cost} 🧭 consumidos)`);
  return true;
}

// Preserve the embarkation selection even when Nuzlocke removes fallen fighters.
function ensureStartingTeam(journey) {
  if (!journey || journey.startingTeam !== undefined) return;
  const ids = (journey.team || []).filter(f => f && CHARS[f.id]).map(f => baseFormOf(f.id)).slice(0,6);
  if (ids.length) journey.startingTeam = ids;
}
function islandRepeatStatusHTML() {
  const repeat = run?.islandRepeat;
  if (!repeat || repeat.result) return '';
  return `<div class="island-repeat-status"><span title="${repeat.wins} victorias · ${repeat.losses} derrotas">🤖 Intento <b>${repeat.completed+1}/${repeat.total}</b></span><button class="btn small gray" id="btn-cancel-island-repeat" aria-label="Cancelar repeticiones automáticas">Cancelar serie</button></div>`;
}
function showIslandRepeatSetup(sagaIdx, starterIds, islandIdx) {
  const island = SAGAS[sagaIdx].islands[islandIdx], trigger = document.activeElement;
  const difficulty = DIFFICULTIES.find(d => d.id === selectedDiff) || DIFFICULTIES[0];
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<section class="modal repeat-setup" role="dialog" aria-modal="true" aria-labelledby="repeat-title">
    <h2 id="repeat-title">🤖 Repetir isla</h2><p><strong>${island.name}</strong> · ${storyMode==='nuzlocke'?'Nuzlocke':'Clásico'} · ${difficulty.name}</p>
    <p class="repeat-team">${starterIds.map(id=>CHARS[id].name).join(' · ')}</p>
    <label for="repeat-count">Número de intentos<input id="repeat-count" type="number" inputmode="numeric" min="1" max="1000" step="1" value="10" required></label>
    <p>Cada victoria o derrota cuenta como un intento. Cada salida empieza con este mismo equipo, sus niveles base y las provisiones iniciales.</p>
    <p>Usa tu configuración actual del modo automático: ruta, eventos, reclutamiento, compras, curas y velocidad. Si necesita una decisión o falta espacio en la mochila, la serie se pausa sin perder el contador. Puedes continuarla o cancelarla.</p>
    <p id="repeat-error" role="alert"></p><div class="actions"><button class="btn gray" id="repeat-cancel">Volver</button><button class="btn green" id="repeat-start">Jugar 10 intentos</button></div>
  </section>`;
  document.body.appendChild(ov);
  const close=()=>{ov.remove();if(trigger?.isConnected)trigger.focus({preventScroll:true});};
  const input=ov.querySelector('#repeat-count'), start=ov.querySelector('#repeat-start');
  input.oninput=()=>{start.textContent=`Jugar ${input.value || '…'} intentos`;};
  ov.querySelector('#repeat-cancel').onclick=close;
  start.onclick=()=>{
    if (!input.reportValidity()) return;
    if (!startIslandRepeats(sagaIdx,starterIds,islandIdx,Number(input.value))) {
      ov.querySelector('#repeat-error').textContent='Revisa el número de intentos, la isla y el equipo.';return;
    }
    ov.remove();
  };
  ov.onclick=e=>{if(e.target===ov)close();};bindCollectionDialog(ov,close,'#repeat-count');
}
function startIslandRepeats(sagaIdx, starterIds, islandIdx, total) {
  if (!Number.isInteger(total) || total<1 || total>1000 || !SAGAS[sagaIdx]?.islands[islandIdx] ||
      !Array.isArray(starterIds) || !starterIds.length || starterIds.length>starterSlotsCount() ||
      new Set(starterIds).size!==starterIds.length || starterIds.some(id=>!CHARS[id] || baseFormOf(id)!==id || !isNakamaUnlocked(id)) ||
      !islandAvailable(sagaIdx,islandIdx)) return false;
  clearTimeout(autoTimer);autoTimer=null;autoMode=true;
  startRun(sagaIdx,starterIds,islandIdx,{total,completed:0,wins:0,losses:0,result:null});
  return true;
}
function finishIslandRepeat(result, continueAuto = autoMode) {
  const repeat=run?.islandRepeat;
  if (!repeat) return false;
  if (!repeat.result) {
    repeat.result=result;repeat.completed++;
    if(result==='win')repeat.wins++;else repeat.losses++;
    saveRun();
  }
  showIslandRepeatCheckpoint(continueAuto);
  return true;
}
function showIslandRepeatCheckpoint(continueAuto = false) {
  const journey=run, repeat=journey?.islandRepeat;
  if (!repeat?.result) return;
  clearTimeout(autoTimer);autoTimer=null;
  const finished=repeat.completed>=repeat.total;
  autoMode=!!continueAuto && !finished;
  const attempt=islandRetrySpec(journey);
  render(`${topbar(false)}<section class="panel repeat-checkpoint" id="repeat-checkpoint">
    <h2>${finished?'🏁 Serie completada':'🤖 Intento completado'}</h2><p>${SAGAS[journey.saga].islands[journey.islandIdx].name}</p>
    <p class="repeat-progress"><strong>${repeat.completed} / ${repeat.total}</strong> intentos</p>
    <p>${repeat.wins} victorias · ${repeat.losses} derrotas</p><p>Último resultado: ${repeat.result==='win'?'victoria':'derrota'}. El progreso permanente se conserva.</p>
    ${journeyRewardsHTML(journey)}
    ${finished?'':`<p>${autoMode?'El siguiente intento comienza automáticamente.':'Serie pausada. Continúa cuando quieras.'}</p><button class="btn green" id="repeat-next">Continuar serie</button>`}
    <button class="btn gray" id="repeat-finish">${finished?'Volver a las islas':'Cancelar repeticiones'}</button></section>`);
  const next=()=>{
    if(run!==journey || !journey.islandRepeat || !$('#repeat-checkpoint') || finished)return;
    clearTimeout(autoTimer);autoTimer=null;
    storyMode=attempt.mode;selectedDiff=attempt.diff;autoMode=true;
    startRun(attempt.saga,attempt.starterIds,attempt.islandIdx,{...repeat,result:null});
  };
  if(!finished)$('#repeat-next').onclick=next;
  $('#repeat-finish').onclick=()=>{
    if(run!==journey)return;
    autoMode=false;clearTimeout(autoTimer);autoTimer=null;
    storyMode=attempt.mode;selectedDiff=attempt.diff;clearRun();screenIslands(attempt.saga);
  };
  if(autoMode)scheduleAutoStep(next,1200);
}
function cancelIslandRepeats() {
  if(!run?.islandRepeat)return;
  delete run.islandRepeat;
  autoMode=false;clearTimeout(autoTimer);autoTimer=null;saveRun();
  toast('Repeticiones canceladas. Puedes terminar este intento manualmente.');
  if(battle)renderBattlePreserveLog();else screenMap();
}
function islandRetrySpec(journey) {
  ensureStartingTeam(journey);
  if (!journey?.startingTeam?.length || !SAGAS[journey.saga]?.islands[journey.islandIdx]) return null;
  return {saga:journey.saga, islandIdx:journey.islandIdx, mode:journey.mode,
    diff:journey.diff || 1, starterIds:[...journey.startingTeam]};
}
function retryIsland(attempt) {
  if (!attempt) return;
  autoMode = false;
  clearTimeout(autoTimer); autoTimer = null;
  if (battle) { battle.over = true; clearTimeout(battle.timer); battle = null; }
  storyMode = attempt.mode; selectedDiff = attempt.diff;
  startRun(attempt.saga, attempt.starterIds, attempt.islandIdx);
}
function confirmRestartIsland() {
  const journey = run, attempt = islandRetrySpec(journey);
  if (!attempt) return;
  const wasAuto = autoMode;
  autoMode = false; clearTimeout(autoTimer); autoTimer = null;
  modalConfirm('🔄 ¿Reiniciar isla?',
    'Volverás al mapa 1 con el equipo que elegiste al zarpar, sus niveles base actuales y las provisiones iniciales.<br>Se perderán los reclutas y las mejoras temporales de este intento. El progreso permanente se conserva.',
    () => { if (run === journey) retryIsland(attempt); },
    () => { if (run === journey) { autoMode = wasAuto; screenMap(); } });
}

// Quantities remain authoritative; placements only describe each stack's footprint.
function backpackCapacity() { return 9 + Math.min(17, Math.max(0, meta.global.backpackTier || 0)) * 3; }
function backpackStackLimit() { return 3 + Math.min(17, Math.max(0, meta.global.backpackTier || 0)); }
function backpackUpgradeCost() { return 300 * ((meta.global.backpackTier || 0) + 1); }
function buyBackpackUpgrade() {
  const cost = backpackUpgradeCost();
  if (backpackCapacity() >= 60 || meta.fame < cost) return false;
  meta.fame -= cost;
  meta.global.backpackTier = (meta.global.backpackTier || 0) + 1;
  saveMeta();
  return true;
}
function backpackUsed(items, combat = null) {
  return Object.entries(items || {}).reduce((sum, [id, count]) => {
    const item = ITEMS[id];
    return sum + (item && count > 0 && (combat === null || isBattleItem(id) === combat) ? Math.ceil(count / backpackStackLimit()) * item.slotSize : 0);
  }, 0);
}
function planBackpackAddition(owner, id, count = 1) {
  if (!owner || !ITEMS[id] || !Number.isInteger(count) || count <= 0) return null;
  const items = {...owner.items, [id]:(owner.items[id] || 0) + count};
  const category = isBattleItem(id);
  if (backpackUsed(items,category) > backpackCapacity()) return null;
  let plan = planBackpack({...owner,items});
  const fits = () => !plan.missing.some(s => isBattleItem(s.id) === category);
  if (!fits()) {
    // Reorganize this bag only when the free cells are too fragmented.
    const bagLayout = Object.fromEntries(backpackStacks(owner)
      .filter(s => isBattleItem(s.id) !== category && owner.bagLayout?.[s.key])
      .map(s => [s.key,owner.bagLayout[s.key]]));
    plan = planBackpack({...owner,items,bagLayout},true);
  }
  return fits() ? plan : null;
}
function backpackFits(owner, id, count = 1) {
  return !!planBackpackAddition(owner,id,count);
}
function addBackpackItem(owner, id, count = 1) {
  const plan = planBackpackAddition(owner,id,count);
  if (!plan) return false;
  owner.items[id] = (owner.items[id] || 0) + count;
  owner.bagLayout = plan.layout;
  return true;
}
function receiveBackpackItem(owner, id, count = 1) {
  if (!ITEMS[id] || !Number.isInteger(count) || count < 1) return false;
  const stored = addBackpackItem(owner, id, count);
  if (!stored) {
    owner.pendingLoot ||= {};
    owner.pendingLoot[id] = (owner.pendingLoot[id] || 0) + count;
    if (autoMode) resolveAutoLoot(owner);
    else { clearTimeout(autoTimer); autoTimer = null; }
  }
  return stored;
}
function resolveAutoLoot(owner) {
  if (!autoMode || !hasPendingLoot(owner)) return;
  if (autoSettings.fullBagAction === 'manual') {
    pauseAutoForChoice('🎒 Mochila llena: guarda o deja el objeto.');
    return;
  }
  const left = [];
  for (const [id, count] of Object.entries(owner.pendingLoot || {})) {
    if (!ITEMS[id] || count <= 0) continue;
    let remaining = count;
    while (remaining > 0 && addBackpackItem(owner, id)) remaining--;
    if (remaining) left.push(`${ITEMS[id].name} ×${remaining}`);
    delete owner.pendingLoot[id];
  }
  if (left.length) toast(`🤖 Mochila llena: se deja ${left.join(', ')}.`);
  saveBackpack(owner);
}
function prepareBackpack(owner) {
  if (!owner) return;
  owner.items ||= {};
  owner.pendingLoot ||= {};
  const plan = planBackpack(owner);
  for (const {id,count} of plan.missing) {
    owner.items[id] -= count;
    owner.pendingLoot[id] = (owner.pendingLoot[id] || 0) + count;
  }
  owner.bagLayout = planBackpack({...owner,bagLayout:plan.layout}).layout;
  owner.backpackVersion = 1;
}
function hasPendingLoot(owner) { return Object.values(owner?.pendingLoot || {}).some(n => n > 0); }
function isBattleItem(id) { return ['heal','revive','battleBoost'].includes(ITEMS[id]?.kind); }
function backpackStacks(owner) {
  const stacks = [];
  for (const [id,total] of Object.entries(owner.items || {})) {
    const item = ITEMS[id];
    if (!item) continue;
    for (let remaining = total, index = 0; remaining > 0; remaining -= backpackStackLimit(), index++) {
      stacks.push({id, key:`${id}:${index}`, count:Math.min(remaining,backpackStackLimit()), size:item.slotSize});
    }
  }
  return stacks;
}
function backpackShape(size, vertical = false) {
  return size === 4 ? {w:2,h:2} : {w:vertical ? 1 : size,h:vertical ? size : 1};
}
function backpackCells(size, cell, vertical = false, capacity = backpackCapacity()) {
  const {w,h} = backpackShape(size,vertical);
  if (!Number.isInteger(cell) || cell < 0 || cell % 3 + w > 3 || Math.floor(cell / 3) + h > capacity / 3) return [];
  return Array.from({length:h},(_,r)=>Array.from({length:w},(_,c)=>cell+r*3+c)).flat();
}
function planBackpack(owner, horizontalFirst = false) {
  const stacks = backpackStacks(owner), layout = {}, missing = [], occupied = [new Set(),new Set()];
  const reserve = (s,pos) => {
    if (!pos || typeof pos.vertical !== 'boolean') return false;
    const cells = backpackCells(s.size,pos.cell,pos.vertical), used = occupied[+isBattleItem(s.id)];
    if (cells.length !== s.size || cells.some(c => used.has(c))) return false;
    layout[s.key] = {cell:pos.cell,vertical:pos.vertical};
    cells.forEach(c => used.add(c)); return true;
  };
  // Keep valid user placements. Pack only new stacks and legacy inventories.
  for (const s of stacks) reserve(s,owner.bagLayout?.[s.key]);
  const positions = Array.from({length:backpackCapacity()},(_,cell)=>[
    {cell,vertical:false},{cell,vertical:true}
  ]).flat();
  // During repacking, keep full-width pieces in rows before using narrow side gaps.
  if (horizontalFirst) positions.sort((a,b)=>Number(a.vertical)-Number(b.vertical));
  for (const s of stacks.filter(s=>!layout[s.key]).sort((a,b)=>b.size-a.size)) {
    let stored = false;
    for (const pos of positions) if (reserve(s,pos)) { stored=true;break; }
    if (!stored) missing.push(s);
  }
  return {layout,missing};
}
function canPlaceBackpackStack(owner, key, cell, vertical) {
  const stacks = backpackStacks(owner), stack = stacks.find(s=>s.key===key);
  if (!stack) return false;
  const cells = backpackCells(stack.size,cell,vertical);
  if (cells.length !== stack.size) return false;
  return stacks.filter(s=>s.key!==key && isBattleItem(s.id)===isBattleItem(stack.id)).every(s=>{
    const p = owner.bagLayout?.[s.key];
    return !p || !backpackCells(s.size,p.cell,p.vertical).some(c=>cells.includes(c));
  });
}
function moveBackpackStack(owner, key, cell, vertical) {
  prepareBackpack(owner);
  if (!canPlaceBackpackStack(owner,key,cell,vertical)) return false;
  owner.bagLayout[key] = {cell,vertical};
  return true;
}
function placePendingBackpackItem(owner, id, cell, vertical) {
  if (!(owner.pendingLoot?.[id] > 0) || !ITEMS[id]) return false;
  prepareBackpack(owner);
  const total = owner.items[id] || 0, key = `${id}:${Math.floor(total/backpackStackLimit())}`;
  if (total % backpackStackLimit()) {
    if (!addBackpackItem(owner,id)) return false;
  } else {
    const proposed = {...owner,items:{...owner.items,[id]:total+1}};
    if (!canPlaceBackpackStack(proposed,key,cell,vertical)) return false;
    owner.items[id] = total+1;
    owner.bagLayout[key] = {cell,vertical};
  }
  owner.pendingLoot[id]--;
  return true;
}
function backpackHTML(owner, combat = false, category = null) {
  if (!combat && category === null) return `<div class="backpacks">${backpackHTML(owner,false,false)}${backpackHTML(owner,false,true)}</div>`;
  const battleBag = combat || category === true;
  const capacity = backpackCapacity(), used = backpackUsed(owner.items,battleBag);
  const layout = planBackpack(owner).layout;
  const stacks = backpackStacks(owner).filter(({id,key}) => isBattleItem(id) === battleBag && layout[key]);
  const occupied = new Set();
  const cells = stacks.map(({id,key,count,size}) => {
    const item = ITEMS[id], pos = layout[key], {w,h} = backpackShape(size,pos.vertical);
    const footprint = backpackCells(size,pos.cell,pos.vertical);footprint.forEach(c=>occupied.add(c));
    return `<button type="button" class="bag-piece bag-filled" style="grid-column:${pos.cell%3+1}/span ${w};grid-row:${Math.floor(pos.cell/3)+1}/span ${h};--bag-piece-columns:${w}" data-bag-item="${id}" data-bag-count="${count}" data-bag-stack="${key}" title="${item.name} ×${count} · ${w}×${h}" aria-label="${item.name} ×${count}, ocupa ${w} por ${h} casillas">
      <span class="bag-piece-cells">${footprint.map(c=>`<span class="bag-cell bag-occupied"><span class="bag-slot-number">${c+1}</span></span>`).join('')}</span>
      <span class="bag-icon">${item.emoji}</span><span class="bag-quantity">×${count}</span>
      <span class="bag-item-name">${item.name}${size > 1 ? ` · ${w}×${h}` : ''}</span>
    </button>`;
  }).join('');
  const empty = Array.from({length:capacity},(_,i)=>i).filter(i=>!occupied.has(i)).map(i=>`<div class="bag-cell bag-empty" style="grid-column:${i%3+1};grid-row:${Math.floor(i/3)+1}" aria-label="Casilla ${i+1} libre"><span class="bag-slot-number">${i+1}</span><span>＋</span></div>`).join('');
  const pending = Object.entries(owner.pendingLoot || {}).filter(([id,n])=>ITEMS[id] && n>0 && (isBattleItem(id) === battleBag)).map(([id,n])=>`
    <div class="bag-pending-item"><span>${ITEMS[id].emoji} ${ITEMS[id].name} ×${n}</span>
      <button type="button" data-bag-collect="${id}">COLOCAR</button>
      <button type="button" data-bag-leave="${id}">DEJAR ×${n}</button></div>`).join('');
  return `<div class="backpack ${combat ? 'backpack-combat' : ''}">
    <div class="bag-heading"><strong>🎒 ${battleBag ? 'COMBATE' : 'ISLA'}</strong><span aria-label="Espacio ocupado">${used}/${capacity} casillas</span></div>
    <div class="bag-grid">${cells}${empty}</div>
    ${combat ? '' : `<button type="button" class="btn small" data-bag-organize="${battleBag}">ORGANIZAR MOCHILA</button>`}
    ${pending ? `<div class="bag-pending"><b>Pendiente de guardar</b><p>Elige una posición, reorganiza la mochila o deja los objetos para continuar.</p>${pending}</div>` : ''}
    ${combat ? '' : `<p class="bag-help">${battleBag ? 'Curas, resurrecciones y bebidas de combate.' : 'Carteles, frutas y mejoras para la isla.'} Hasta ${backpackStackLimit()} unidades del mismo objeto por pila. Las dos mochilas tienen su propio espacio y se amplían juntas.</p>`}
  </div>`;
}
function saveBackpack(owner) { if (owner === run) saveRun(); }
function showBackpackOrganizer(owner, battleBag, refresh, initialId = null) {
  prepareBackpack(owner);
  if (autoMode) pauseAutoForChoice();
  const activeBattle = battle && (battle.tower ? tower : run) === owner ? battle : null;
  const wasWaiting = activeBattle?.waiting;
  if (activeBattle && !activeBattle.over) pauseBattle();
  const ov = document.createElement('div');ov.className='overlay';
  let selection=initialId ? `pending:${initialId}` : '', cell=null, vertical=false, closed=false;
  const close=()=>{
    if (closed) return;
    closed=true;ov.remove();refresh();
    if (activeBattle && battle===activeBattle && !battle.over && !wasWaiting) resumeBattle();
  };
  const renderOrganizer=()=>{
    const modalScroll=ov.querySelector('.bag-organizer')?.scrollTop || 0;
    const gridScroll=ov.querySelector('.bag-grid')?.scrollTop || 0;
    const stacks=backpackStacks(owner).filter(s=>isBattleItem(s.id)===battleBag);
    const pending=Object.entries(owner.pendingLoot || {}).filter(([id,n])=>n>0&&isBattleItem(id)===battleBag);
    const options=[...stacks.map(s=>({value:s.key,label:`${ITEMS[s.id].name} ×${s.count}`})),...pending.map(([id,n])=>({value:`pending:${id}`,label:`Por guardar: ${ITEMS[id].name} ×${n}`}))];
    if (!options.some(o=>o.value===selection)) {selection=options[0]?.value || '';cell=null;}
    const incoming=selection.startsWith('pending:'), id=incoming ? selection.slice(8) : stacks.find(s=>s.key===selection)?.id;
    const total=owner.items[id] || 0, merging=incoming && total%backpackStackLimit()>0;
    const key=incoming ? `${id}:${Math.floor(total/backpackStackLimit())}` : selection;
    if (cell===null && !incoming) {cell=owner.bagLayout[key]?.cell ?? null;vertical=owner.bagLayout[key]?.vertical || false;}
    const proposed=incoming ? {...owner,items:{...owner.items,[id]:total+1}} : owner;
    const valid=!!id && (merging || canPlaceBackpackStack(proposed,key,cell,vertical));
    const footprint=id ? backpackCells(ITEMS[id].slotSize,cell,vertical) : [];
    const occupied=new Map();
    for(const s of stacks){const p=owner.bagLayout[s.key];for(const c of backpackCells(s.size,p.cell,p.vertical))occupied.set(c,s);}
    ov.innerHTML=`<div class="modal bag-organizer"><h2>🎒 Organizar ${battleBag?'combate':'isla'}</h2>
      <p>Elige una pila, gírala y toca su casilla inicial. Cada pieza debe caber entera, sin cruzar el borde de una fila.</p>
      <label>Pila de objetos<select data-layout-select>${options.map(o=>`<option value="${o.value}" ${selection===o.value?'selected':''}>${o.label}</option>`).join('')}</select></label>
      <div class="actions"><button class="btn small" data-layout-rotate ${!id||[1,4].includes(ITEMS[id].slotSize)||merging?'disabled':''}>GIRAR · ${vertical?'VERTICAL':'HORIZONTAL'}</button></div>
      <div class="bag-grid">${Array.from({length:backpackCapacity()},(_,i)=>{
        const stack=occupied.get(i),ghost=footprint.includes(i);
        return `<button type="button" class="bag-cell ${stack?'bag-occupied':'bag-empty'} ${ghost?(valid?'bag-placement-valid':'bag-placement-invalid'):''}" data-layout-cell="${i}" aria-label="Casilla ${i+1}${stack?`: ${ITEMS[stack.id].name}`:': libre'}"><span class="bag-slot-number">${i+1}</span><span>${stack?ITEMS[stack.id].emoji:ghost&&id?ITEMS[id].emoji:'＋'}</span></button>`;
      }).join('')}</div>
      <p role="status">${!id?'No hay objetos en esta mochila.':merging?'Se añadirá a una pila del mismo objeto.':cell===null?'Selecciona una casilla inicial.':valid?'La pieza cabe en esta posición.':'No cabe aquí: gira la pieza o elige otras casillas.'}</p>
      <div class="actions"><button class="btn green" data-layout-place ${valid?'':'disabled'}>${merging?'APILAR 1':incoming?'GUARDAR 1':'MOVER PILA'}</button><button class="btn gray" data-layout-close>VOLVER</button></div></div>`;
    ov.querySelector('[data-layout-select]').onchange=e=>{selection=e.target.value;cell=null;vertical=false;renderOrganizer();};
    ov.querySelector('[data-layout-rotate]').onclick=()=>{vertical=!vertical;renderOrganizer();};
    ov.querySelectorAll('[data-layout-cell]').forEach(btn=>{btn.onclick=()=>{cell=Number(btn.dataset.layoutCell);renderOrganizer();};});
    ov.querySelector('[data-layout-place]').onclick=()=>{
      if(closed || !valid) return;
      const done=incoming ? placePendingBackpackItem(owner,id,cell,vertical) : moveBackpackStack(owner,key,cell,vertical);
      if(!done){renderOrganizer();return;}
      saveBackpack(owner);cell=null;renderOrganizer();
    };
    ov.querySelector('[data-layout-close]').onclick=close;
    ov.querySelector('.bag-organizer').scrollTop=modalScroll;
    ov.querySelector('.bag-grid').scrollTop=gridScroll;
  };
  renderOrganizer();document.body.appendChild(ov);
  ov.onclick=e=>{if(e.target===ov)close();};
}
function bindBackpack(root, owner, combat, refresh) {
  root.querySelectorAll('[data-bag-organize]').forEach(button => {
    button.onclick = () => showBackpackOrganizer(owner,button.dataset.bagOrganize==='true',refresh);
  });
  root.querySelectorAll('[data-bag-item]').forEach(button => {
    button.onclick = () => showBackpackItem(owner, button.dataset.bagItem, Number(button.dataset.bagCount), combat, refresh);
  });
  root.querySelectorAll('[data-bag-collect]').forEach(button => {
    button.onclick = () => {
      const id = button.dataset.bagCollect;
      if (!(owner.pendingLoot?.[id] > 0)) return;
      showBackpackOrganizer(owner,isBattleItem(id),refresh,id);
    };
  });
  root.querySelectorAll('[data-bag-leave]').forEach(button => {
    button.onclick = () => {
      const id = button.dataset.bagLeave;
      modalConfirm('¿Dejar el objeto?', `Dejarás ${ITEMS[id].name} ×${owner.pendingLoot[id]}.`, () => {
        delete owner.pendingLoot[id]; saveBackpack(owner); refresh();
      });
    };
  });
}
function showBackpackItem(owner, id, count, combat, refresh) {
  if (!(owner.items[id] > 0) || (combat && !isBattleItem(id))) return;
  const b = combat ? battle : null;
  if (combat && (!b || b.over || b.waiting)) return;
  if (combat && meta.settings.quickBattleItems === true) return useBattleItem(id);
  if (b) pauseBattle();
  const item = ITEMS[id], ov = document.createElement('div');
  ov.className = 'overlay';
  const usable = combat ? isBattleItem(id) : owner === run && !['ball','battleBoost'].includes(item.kind);
  ov.innerHTML = `<div class="modal bag-item-modal"><h2>${item.emoji} ${item.name}</h2><p>${item.desc}</p>
    <p>${item.slotSize} casilla${item.slotSize > 1 ? 's' : ''} · Hasta ${backpackStackLimit()} por pila</p>
    ${!usable ? `<p>${item.kind === 'ball' ? 'Se usa en el evento de las cadenas.' : item.kind === 'battleBoost' ? 'Se usa durante el combate.' : 'Se usa fuera del combate.'}</p>` : ''}
    <div class="actions"><button class="btn green" data-bag-use ${usable ? '' : 'disabled'}>USAR</button>
      <button class="btn red" data-bag-discard>DESCARTAR ${count > 1 ? `PILA ×${count}` : '1'}</button>
      <button class="btn gray" data-bag-close>VOLVER</button></div></div>`;
  document.body.appendChild(ov);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true; ov.remove();
    if (b && battle === b && !b.over) resumeBattle();
  };
  ov.querySelector('[data-bag-close]').onclick = close;
  ov.querySelector('[data-bag-use]').onclick = () => {
    if (!usable || closed) return;
    close();
    if (combat) useBattleItem(id); else useItemFromMap(id);
  };
  ov.querySelector('[data-bag-discard]').onclick = () => {
    if (closed) return;
    modalConfirm('¿Descartar objeto?', `Descartarás ${item.name} ×${Math.min(count,owner.items[id])}.`, () => {
      if (closed) return;
      owner.items[id] = Math.max(0,owner.items[id]-count);
      saveBackpack(owner); close(); refresh();
    });
  };
  ov.onclick = event => { if (event.target === ov) close(); };
}
function refreshBattleBackpack() {
  const el = $('#battle-backpack');
  if (!el || !battle) return;
  if (battle.opts?.challenge) { el.innerHTML = '<p class="challenge-no-items">🏆 Equipo de evento · sin consumibles</p>'; return; }
  const owner = battle.tower ? tower : run;
  if (!owner) return;
  el.innerHTML = backpackHTML(owner,true);
  bindBackpack(el,owner,true,refreshBattleBackpack);
}

function showTowerBackpack(onContinue) {
  const owner = tower, ov = document.createElement('div');
  ov.className = 'overlay';
  let continued = false;
  const update = () => {
    ov.innerHTML = `<div class="modal"><h2>🎒 Prepara tu mochila</h2>${backpackHTML(owner)}<div class="actions"><button class="btn green" data-bag-continue ${hasPendingLoot(owner) ? 'disabled' : ''}>CONTINUAR</button></div></div>`;
    bindBackpack(ov,owner,false,update);
    ov.querySelector('[data-bag-continue]').onclick = () => {
      if (continued || hasPendingLoot(owner) || tower !== owner) return;
      continued = true; ov.remove(); onContinue();
    };
  };
  update(); document.body.appendChild(ov);
}

function startRun(sagaIdx, starterIds, islandIdx = 0, islandRepeat = null) {
  const saga = SAGAS[sagaIdx];
  if (!saga?.islands[islandIdx] || !islandAvailable(sagaIdx,islandIdx)) return;
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
    islandIdx, mapIdx:0, campaignVersion:1, islandComplete:false,
    startingTeam: starterIds.map(baseFormOf),
    rewards: {fame:0, logPoses:0},
    team: starterIds.map(id => applyUpgrades(makeChar(id, startLvlOf(id)))),
    items,
    berries,
    badges: [],
    map: genIslandMap(saga.islands[islandIdx],0),
    pos: null,
    nuzCaught: {}, // isla -> ya reclutado
  };
  if(islandRepeat)run.islandRepeat={...islandRepeat};
  prepareBackpack(run);
  starterIds.forEach(registerRecruit);
  run.team.forEach(f => registerDex(f.id));
  saveRun();
  screenMap(hasPendingLoot(run) ? 2 : 0);
}

// ============ PANTALLA: MAPA ============
function screenMap(activePageIdx = 0) {
  if(run?.islandRepeat?.result)return showIslandRepeatCheckpoint(autoMode);
  if(run?.islandRepeat && !run.team.some(f=>f.hp>0))return gameOver();
  playMusic('combat');
  runAutoItems(false);
  resolveAutoLoot(run);
  if (autoMode && hasPendingLoot(run)) {
    pauseAutoForChoice('🎒 Guarda o deja los objetos pendientes para continuar.');
    activePageIdx = 2;
  }
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
      style="--map-x:${x}%;--map-y:${y}%;--map-forward:${100-y}%" data-r="${r}" data-i="${i}" title="${NODE_TYPES[n.type].label}" aria-label="${NODE_TYPES[n.type].label}, etapa ${r+1}${isCur ? ", posición actual" : ''}" ${isReach ? '' : 'disabled'}>${n.type === 'special' ? '<img class="map-event-icon" src="/art/cross-guild-map.png" alt="" aria-hidden="true" draggable="false">' : NODE_TYPES[n.type].emoji}</button>`;
  }));

  render(`
    ${topbar(true, true, true)}
    <div class="map-wrap">
      <div class="map-carousel" id="island-carousel">
        <!-- PÁGINA 1: MAPA (ANCHO Y ALTO COMPLETO) -->
        <div class="carousel-page" id="page-map">
          <div class="map-board" style="--scene:url('${SAGAS[run.saga]?.img}');--map-rows:${rows.length}">
            <div class="map-heading"><div class="map-title">📍 <b>${saga.name}</b> · Isla ${run.islandIdx + 1}/${saga.islands.length}: <b>${island.name}</b> · Mapa ${(run.mapIdx || 0)+1}/${islandMapCount(island)} (${run.mode === 'nuzlocke' ? 'NUZLOCKE' : 'CLÁSICO'})</div>
            <div class="map-tools">
              <button class="btn gold small" id="btn-restart-island" aria-label="Reiniciar isla" title="Volver a empezar esta isla con tu equipo inicial" style="font-size:8.5px;padding:4px 8px;box-shadow:0 2px 5px rgba(0,0,0,0.5);font-weight:bold;">
                ↻ REINICIAR
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
                      <div class="hp-nums">PS: ${f.hp}/${f.maxhp}</div>
                      <div class="hp-mini"><i style="width:${f.hp / f.maxhp * 100}%"></i></div>${xpBarHTML(f)}
                    </div>
                    ${run.team.length > 1 ? `<span class="btn-dismiss-slot" data-dismiss-idx="${idx}" title="Expulsar de la banda" style="color:#e74c3c;font-size:11px;cursor:pointer;padding:2px 4px;margin-left:auto;opacity:0.75;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.75">🗑️</span>` : ''}
                  </div>`;
              }).join('')}
            </div>
            <div style="font-size:7.5px;color:#666;margin-top:8px;">¡El orden importa! Combaten de arriba a abajo. Arrastra (o toca ≡ y luego el destino) para reordenar · toca para ver la ficha.</div>
            <h3 style="margin-top:12px;">SINERGIAS DE TRIPULACIÓN <button class="btn small gray" id="btn-syn-info" style="font-size:7px;padding:2px 6px;">ℹ️ VER TODAS</button>
              <button class="btn small gray" id="btn-chart-info" style="font-size:7px;padding:2px 6px;">📊 TIPOS</button></h3>
            <div class="team-synergy-summary">${activeSynergiesHTML(run.team)}</div>
          </div>
        </div>

        <!-- PÁGINA 3: MOCHILA Y EMBLEMAS (ANCHO COMPLETO) -->
        <div class="carousel-page" id="page-bag">
          <div class="panel">
            <div id="map-backpack">${backpackHTML(run)}</div>
            <h3 style="margin-top:14px;">🏅 EMBLEMAS DE LA SAGA</h3>
            <div class="badge-grid">
              ${saga.islands.map((isl, i) =>
                `<div class="badge-slot ${run.badges.includes(i) ? '' : 'empty'}" title="${isl.name}">${run.badges.includes(i) ? '🏅' : '·'}</div>`
              ).join('')}
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
          <div class="hp-nums">PS: ${f.hp}/${f.maxhp}</div>
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
  const refreshMapBackpack = () => {
    const root = $('#map-backpack');
    root.innerHTML = backpackHTML(run);
    bindBackpack(root, run, false, refreshMapBackpack);
  };
  bindBackpack($('#map-backpack'), run, false, refreshMapBackpack);
  $('#btn-restart-island').onclick = confirmRestartIsland;
  $('#btn-abandon').onclick = () => {
    const journey = run, wasAuto = autoMode;
    pauseAutoForChoice();
    modalConfirm('🏳️ ¿Abandonar el viaje?',
      'Se perderá todo el progreso de esta aventura.<br>La Fama, los veteranos y la Dex se conservan.',
      () => { clearRun(); screenHome(); },
      () => { if (run === journey) { autoMode = wasAuto; screenMap(); } });
  };
  $('#btn-syn-info').onclick = () => showSynergyModal(run.team);
  $('#btn-chart-info').onclick = () => showTypeChartModal(run.team);


  if (autoMode && run) {
    if (reach.length > 0) {
      const target = pickAutoNode(reach);
      if (target) {
        const [r, i] = target;
        scheduleAutoStep(() => {
          advanceAutoNode(r,i);
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
  if (!item || !run || !(run.items[id] > 0) || (battle && !battle.over)) return;
  if (item.kind === 'battleBoost') return toast('Esta bebida se usa durante el combate.');

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
                ${xpBarHTML(f)}
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
          trackStat('fruit_use', 1);
          saveRun();
          screenMap(2);
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
  resolveAutoLoot(run);
  if (hasPendingLoot(run)) {
    if (autoMode) pauseAutoForChoice();
    toast('🎒 Guarda o deja los objetos pendientes antes de continuar.'); screenMap(2); return;
  }
  const node = run.map.rows[r][i];
  run.pos = [r, i];
  node.done = true;
  saveRun();
  const saga = SAGAS[run.saga];
  const island = saga.islands[run.islandIdx];

  switch (node.type) {
    case 'travel': {
      if ((run.mapIdx || 0) >= islandMapCount(island)-1) return;
      run.mapIdx = (run.mapIdx || 0)+1;
      run.map = genIslandMap(island,run.mapIdx);
      run.pos = null;
      saveRun();
      modalInfo('🧭 La expedición continúa', `<p class="reward-list">${island.name} · Mapa ${run.mapIdx+1}/${islandMapCount(island)}<br>Tu banda conserva sus PS, objetos y progreso. El jefe espera en el último mapa.</p>`,screenMap);
      break;
    }
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
      startBattle(enemies, { wild: false, marine: true });
      break;
    }
    case 'boss': {
      const enemies = island.boss.map((id, k) => makeChar(id, island.bossLvl[k], false, true));
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
      const stored = receiveBackpackItem(run,id);
      trackItemCollected(1);
      saveRun();
      modalInfo('🎁 ¡Objeto encontrado!', `<div class="reward-list">${ITEMS[id].emoji} <b>${ITEMS[id].name}</b><br><small>${ITEMS[id].desc}</small>${stored ? '' : hasPendingLoot(run) ? '<br>🎒 Elige dónde guardar el objeto en la mochila.' : '<br>🤖 Mochila llena: objeto dejado.'}</div>`, () => screenMap(hasPendingLoot(run) ? 2 : 0));
      break;
    }
    case 'mystery': trackStat('mystery_visit', 1); doMystery(island); break;
    case 'special': trackStat('special_visit', 1); doSpecialPirate(island); break;
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
  const eventArt = `<div class="event-art" aria-hidden="true">${{berries:'🎁',item:'🧑‍🌾',battle:'⚔️',healall:'♨️',boost:'🥋',damage:'🕸️',recruit:'🏴‍☠️',fruta:'🍈'}[ev.kind] || '❓'}</div>`;
  switch (ev.kind) {
    case 'berries': {
      const n = rnd(ev.min, ev.max) * (run.islandIdx + 1);
      run.berries += n; saveRun();
      modalInfo('❓ Misterio', `${eventArt}<div class="reward-list">${ev.text.replace('{n}', n)}</div>`, screenMap);
      break;
    }
    case 'item': {
      const id = pick(['carne', 'cartel', 'carnereal', 'carteldorado']);
      const stored = receiveBackpackItem(run,id); saveRun();
      modalInfo('❓ Misterio', `${eventArt}<div class="reward-list">${ev.text}<br><br>${ITEMS[id].emoji} <b>${ITEMS[id].name}</b>${stored ? '' : hasPendingLoot(run) ? '<br>🎒 Elige dónde guardar el objeto en la mochila.' : '<br>🤖 Mochila llena: objeto dejado.'}</div>`, () => screenMap(hasPendingLoot(run) ? 2 : 0));
      break;
    }
    case 'battle': {
      modalInfo('❓ ¡Emboscada!', `${eventArt}<div class="reward-list">${ev.text}</div>`, () => {
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
      modalInfo('❓ Misterio', `${eventArt}<div class="reward-list">${ev.text} ♨️</div>`, screenMap);
      break;
    }
    case 'boost': {
      trackStat('mystery_train', 1);
      const f = run.team[0];
      f.atkBonus += 2; f.atk += 2; saveRun();
      modalInfo('❓ Misterio', `${eventArt}<div class="reward-list">${ev.text}<br>(${charName(f)})</div>`, screenMap);
      break;
    }
    case 'damage': {
      const f = run.team[0];
      f.hp = Math.max(1, f.hp - ev.val); saveRun();
      modalInfo('❓ Misterio', `${eventArt}<div class="reward-list">${ev.text}<br>(${charName(f)})</div>`, screenMap);
      break;
    }
    case 'recruit': {
      if (run.mode === 'nuzlocke' && run.nuzCaught[run.islandIdx]) {
        run.berries += 200; saveRun();
        modalInfo('❓ Misterio', `${eventArt}<div class="reward-list">Un pirata quería unirse, pero la regla Nuzlocke lo impide.<br>Te deja 200 Berries de regalo.</div>`, screenMap);
      } else {
        const id = pickWildEnemy(island.pool);
        const recLvl = Math.max(1, Math.floor(island.lvl[0] * 0.85));
        const f = applyUpgrades(makeChar(id, recLvl));
        addToTeam(f, ok => {
          if (ok) {
            if (run.mode === 'nuzlocke') run.nuzCaught[run.islandIdx] = true;
            registerRecruit(id); saveRun();
            modalInfo('❓ ¡Nuevo nakama!', `${eventArt}<div class="reward-list">${ev.text}<br><br><span style="font-size:30px">${charIcon(id, 40)}</span><br><b>${CHARS[id].name}</b> Nv${f.lvl}</div>`, screenMap);
          } else {
            run.berries += 100; saveRun();
            modalInfo('❓ Misterio', `${eventArt}<div class="reward-list">Dejas marchar al pirata. Te regala 100 Berries por la molestia.</div>`, screenMap);
          }
        });
      }
      break;
    }
    case 'fruta': {
      const stored = receiveBackpackItem(run,'fruta_diablo');
      trackItemCollected(1);
      saveRun();
      modalInfo('❓ Misterio', `${eventArt}<div class="reward-list">${ev.text}<br><br>${ITEMS['fruta_diablo'].emoji} <b>${ITEMS['fruta_diablo'].name}</b>${stored ? ' añadida a tu mochila.' : hasPendingLoot(run) ? '<br>🎒 Elige dónde guardar el objeto en la mochila.' : '<br>🤖 Mochila llena: objeto dejado.'}</div>`, () => screenMap(hasPendingLoot(run) ? 2 : 0));
      break;
    }
  }
}

// ============ ENCUENTRO SALVAJE ============
function wildRecruitPrice(c) { return c.rareza * 150 * ((run?.mapIdx || 0) + 1); }

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
      if(autoSettings.wildAction==='manual'){pauseAutoForChoice('Elige qué hacer con este pirata.');return;}
      if (!isLegendary && autoSettings.wildAction === 'recruit') {
        const payBtn = ov.querySelector('#we-pay');
        if (payBtn && !payBtn.disabled && autoCanSpend(price)) { payBtn.click(); return; }
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
    if(autoMode) scheduleAutoStep(()=>{
      if(!document.body.contains(ov))return;
      const item=ov.querySelector(`[data-chainball="${autoSettings.chainItem}"]`);
      if(item)item.click();else ov.querySelector(`[data-c="${current}"]`)?.click();
    },700);
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
  if(autoMode)scheduleAutoStep(()=>{
    if(!document.body.contains(ov))return;
    if(autoSettings.chainFail==='manual'){pauseAutoForChoice('La cadena aguanta: decide si pagar o combatir.');return;}
    ov.querySelector(autoSettings.chainFail==='pay'&&can?'#cd-pay':'#cd-fight').click();
  },700);

}

// ============ RECLUTAR Y FUSIÓN DE PERSONAJES ============
// Si el personaje ya está en la banda, se fusionan: gana 1 estrella y +5% de stats.
function addToTeam(f, done) {
  syncEvolution(f);
  const existing = run.team.find(m => baseFormOf(m.id) === baseFormOf(f.id));
  if (existing) {
    syncEvolution(existing);
    existing.stars = (existing.stars || 0) + 1;
    const oldLvl = existing.lvl;
    const newLvl = Math.max(existing.lvl, f.lvl);
    if (newLvl > oldLvl) {
      existing.lvl = newLvl;
      existing.xp = f.xp || 0;
      existing.id = evolutionFormAt(existing.id, existing.lvl);
      const c = CHARS[existing.id];
      if (c) {
        existing.maxhp = hpAt(c.base[0], existing.lvl);
        existing.atk = statAt(c.base[1], existing.lvl);
        existing.def = statAt(c.base[2], existing.lvl);
        existing.spatk = statAt(c.base[3], existing.lvl);
        existing.spdef = statAt(c.base[4], existing.lvl);
        existing.spd = statAt(c.base[5], existing.lvl);
        const updatedMoves = formMovesAt(existing.id, existing.lvl);
        if (updatedMoves.length) existing.moves = updatedMoves;
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
  if (autoMode && autoSettings.fullTeamAction !== 'manual') {
    const lowest = run.team.reduce((index, member, i) => member.lvl < run.team[index].lvl ? i : index, 0);
    const replace = autoSettings.fullTeamAction === 'higherLevel' && f.lvl > run.team[lowest].lvl;
    if (replace) {
      const out = run.team[lowest];
      run.team[lowest] = f;
      saveRun();
      toast(`🤖 ${charName(f)} (Nv${f.lvl}) sustituye a ${charName(out)} (Nv${out.lvl}).`);
    } else toast(`🤖 Equipo lleno: se conserva la banda y se deja marchar a ${charName(f)}.`);
    done && done(replace);
    return;
  }
  if(autoMode)pauseAutoForChoice('Banda llena: elige a quién sustituir.');
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
function showCharModal(fOrId, existingOverlay = null) {
  const isLive = typeof fOrId === 'object';
  const previewId = !isLive && !BASE_OF[fOrId] ? evolutionFormAt(fOrId, startLvlOf(fOrId)) : fOrId;
  const f = isLive ? migrateFighter(fOrId, !!battle?.eTeam.includes(fOrId)) : applyUpgrades(makeChar(previewId, startLvlOf(fOrId), false, true));
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
  const future = c.learnset.filter(([l, m]) => (l > f.lvl || (c.evo && l >= c.evo.lvl && startLvlOf(f.id) < c.evo.lvl)) && !known.includes(m));
  const rarityTag = c.rareza ? `<span style="color:var(--gold);font-size:14px;margin-left:6px;" title="Rareza: ${c.rareza} estrellas">${'⭐'.repeat(c.rareza)}</span>` : '';
  const fusionTag = f.stars ? `<span style="color:#ff6b6b;font-size:11px;font-weight:bold;margin-left:6px;">[+${f.stars}⭐ Fusión]</span>` : '';
  const hasUpgrades = (f.hpBonus || 0) + (f.atkBonus || 0) + (f.defBonus || 0) + (f.spatkBonus || 0) + (f.spdefBonus || 0) + (f.spdBonus || 0) > 0;

  const cap = maxStartLvlCap();
  const upgCost = logPoseUpgradeCost(f.lvl);
  const canAffordUpg = (meta.logPoses || 0) >= upgCost;
  const isMaxLvl = f.lvl >= cap;

  const ov = existingOverlay || document.createElement('div');
  const closeSheet = existingOverlay?.querySelector('#sheet-close')?.onclick || (() => ov.remove());
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal char-sheet" role="dialog" aria-modal="true" aria-label="Ficha de ${collectionText(c.name)}">
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
    ${equippedRelic(f) ? `<div class="sheet-section">${relicDetailsHTML(equippedRelic(f))}<p>${equippedRelic(f).character===baseFormOf(f.id)?'✨ Afinidad activa':'Boost común activo'}</p></div>` : ''}
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
      ${future.map(([l, m]) => `<div class="sheet-move future">🔒 Nv${l}${c.evo && l >= c.evo.lvl ? ` · nivel base ${c.evo.lvl}` : ''} — ${MOVES[m] ? MOVES[m].name : m}</div>`).join('')}
    </div>
    ${pInfo ? `<div class="sheet-section"><b>✨ Pasiva — ${pInfo.label}</b><p>${pInfo.desc}</p></div>` : ''}
    ${ultMv ? `<div class="sheet-section"><b>💥 Habilidad Definitiva — ${ultMv.name}</b><p>${ultMv.type ? `<span class="type-badge" style="background:${TYPES[ultMv.type]?.color || '#888'}">${ultMv.type.toUpperCase()}</span> ` : ''}${ultMv.power ? ultMv.power + ' PWR · ' + Math.round((ultMv.acc || 0.9) * 100) + '% precisión' : 'MOVIMIENTO DEFINITIVO'}</p></div>` : ''}
    ${c.evo ? `<div class="sheet-section"><b>🔄 Transformación</b><p>${CHARS[c.evo.to].name} requiere nivel base ${c.evo.lvl} y nivel ${c.evo.lvl} en partida. Tu nivel base: ${startLvlOf(f.id)}. ${startLvlOf(f.id) >= c.evo.lvl ? 'Forma desbloqueada.' : 'Puedes seguir subiendo en partida, pero sus ataques se desbloquean al mejorar el nivel base.'}</p></div>` : ''}
    <p class="sheet-desc">${c.desc}</p>
    <div class="actions" style="flex-direction:column;gap:6px;">
      ${isLive && (!battle || battle.over) && run && run.team && run.team.includes(f) ? `<button class="btn red small" id="sheet-dismiss-btn" style="width:100%;">🗑️ EXPULSAR DE LA BANDA</button>` : ''}
      <button class="btn gray" id="sheet-close" style="width:100%;">CERRAR</button>
    </div>
  </div>`;
  if (!existingOverlay) document.body.appendChild(ov);
  const upgradeBtn = ov.querySelector('#sheet-upg-btn');
  if (upgradeBtn) {
    let upgrading = false;
    upgradeBtn.onclick = () => {
      if (upgrading || upgradeBtn.disabled) return;
      upgrading = true;
      if (!upgradeCharLvl(f.id)) { upgrading = false; return; }
      const scrollTop = ov.querySelector('.modal').scrollTop;
      showCharModal(fOrId, ov);
      ov.querySelector('.modal').scrollTop = scrollTop;
      (ov.querySelector('#sheet-upg-btn:not(:disabled)') || ov.querySelector('#sheet-close')).focus?.({preventScroll:true});
    };
  }
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
  ov.querySelector('#sheet-close').onclick = closeSheet;
  if (!existingOverlay) ov.onclick = e => { if (e.target === ov) closeSheet(); };
}

// ============ EVENTO: CROSSGUILD ============
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
const specialMapMultiplier = () => (run?.mapIdx || 0) + 1;
const specialGachaPrice = () => 300 * specialMapMultiplier();
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

function specialPiratePoolHTML() {
  const pool = basePirateIds().sort((a, b) => CHARS[a].rareza - CHARS[b].rareza || CHARS[a].name.localeCompare(CHARS[b].name));
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `
    <p class="special-pool-heading">${esc(SAGAS[run.saga].name)} · ${pool.length} piratas posibles</p>
    <div class="special-pool" role="list" aria-label="Piratas disponibles en este evento">
      ${pool.map(id => {
        const c = CHARS[id], seen = meta.dex.includes(id);
        return `<div class="special-pool-card ${seen ? 'seen' : 'unseen'}" role="listitem" aria-label="${seen ? esc(c.name) : 'Pirata sin avistar'}, ${c.rareza} estrellas">
          <div class="special-pool-portrait" aria-hidden="true">${charIcon(id, 54)}</div>
          <b>${seen ? esc(c.name) : '???'}</b><span class="special-pool-stars">${'⭐'.repeat(c.rareza)}</span>
        </div>`;
      }).join('')}
    </div>`;
}

function doSpecialPirate(island) {
  meta.starPity = meta.starPity || 0;
  const lvl = island.lvl[1] + 2;
  const gachaPrice = specialGachaPrice();
  const blocked = specialBlockedReason();
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>🌟 Crossguild</h2>
    ${specialPiratePoolHTML()}
    <p class="special-map-price" style="font-size:8px;text-align:center;line-height:1.8;">Mapa ${specialMapMultiplier()} · Carteles ×${specialMapMultiplier()} · 5⭐ solo en carteles</p>
    ${cartelesBadgeHTML()}
    <div style="font-size:9.5px;text-align:center;margin-top:6px;margin-bottom:6px;color:#f39c12;background:rgba(243,156,18,0.12);padding:6px 10px;border-radius:6px;border:1px solid rgba(243,156,18,0.4);display:flex;align-items:center;justify-content:center;gap:6px;">
      <span>⭐ Estrellas acumuladas (Pity): <b>${meta.starPity || 0} / 1000</b></span>
      ${(meta.starPity || 0) >= 1000 ? '<span style="color:#2ecc71;font-weight:bold;">¡LEGENDARIO ASEGURADO!</span>' : ''}
    </div>
    ${blocked ? `<div class="special-fail">${blocked}</div>` : ''}
    <div class="actions" style="flex-direction:column;align-items:stretch;">
      <button class="btn blue" id="sp-choose" ${blocked ? 'disabled' : ''}>🎯 ELEGIR PIRATA — catálogo</button>
      <button class="btn gold" id="sp-gacha" ${blocked || run.berries < gachaPrice ? 'disabled' : ''}>🌟 JUGAR CARTELES — ${berriesHTML(gachaPrice)}</button>
      <button class="btn gray" id="sp-rates">📊 TABLA DE PROBABILIDADES</button>
      <button class="btn gray" id="sp-leave">🌊 MARCHARSE</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  if (autoMode) {
    scheduleAutoStep(() => {
      if(autoSettings.specialAction==='manual'){pauseAutoForChoice('Crossguild: elige catálogo o carteles.');return;}
      const play=ov.querySelector('#sp-gacha');
      const btn = autoSettings.specialAction==='gacha' && play && !play.disabled && autoCanSpend(gachaPrice) ? play : ov.querySelector('#sp-leave');
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
    .filter(id => CHARS[id].rareza < 5 && meta.defeated.includes(id))
    .sort((a, b) => CHARS[a].rareza - CHARS[b].rareza || CHARS[a].name.localeCompare(CHARS[b].name));
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal">
    <h2>🎯 Catálogo de reclutas (Nv${lvl})</h2>
    <div style="text-align:center;font-size:9px;margin-bottom:8px;color:var(--accent);">${berriesHTML(run.berries)} disponibles</div>
    <p style="font-size:8px;text-align:center;color:#777;margin-bottom:8px;">Piratas de 1–4 estrellas de esta saga que ya has derrotado.</p>
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
      if (!ids.includes(id) || CHARS[id].rareza >= 5) return;
      const price = hirePrice(CHARS[id]);
      if (run.berries < price) return;
      run.berries -= price;
      ov.remove();
      specialJoin(id, lvl);
    };
  });
}

function revealSpecialRecruit(ov, prizeId, lvl, reward = CHARS[prizeId].rareza) {
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
        rewardText:`+${reward} Log Pose${reward === 1 ? '' : 's'}`,
        portraitHTML:charIcon(prizeId, 140), onComplete:complete});
      if(autoMode){
        const advance=()=>{if(!ov.isConnected)return;const button=ov.querySelector('.mr-continue');if(button)button.click();if(ov.isConnected)scheduleAutoStep(advance,700);};
        scheduleAutoStep(advance,1400);
      }
      return;
    }
  } catch (_) { /* A cosmetic failure must not prevent recruitment. */ }
  toast(`🧭 +${reward} Log Poses del cartel premiado`);
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

  let current = 0, resolved = false;
  const ov = document.createElement('div');
  ov.className = 'overlay market-cartels';
  ov.innerHTML = `<div class="modal">
    <h2>🎰 Los 5 carteles de SE BUSCA</h2>
    <p style="font-size:8px;text-align:center;margin-bottom:6px;">Destapa los carteles en orden. ¡En uno de ellos está tu recluta! El cartel premiado también da 1 Log Pose por estrella. Si ya tienes al personaje en tu inventario, los de 3⭐ dan 50, los de 4⭐ dan 500 y los de 5⭐ dan 1000 Log Poses.</p>
    <div style="font-size:9px;text-align:center;margin-bottom:10px;color:#f39c12;">
      ⭐ Estrellas acumuladas (Pity): <b>${meta.starPity} / 1000</b>
    </div>
    <div class="poster-row">
      ${[0, 1, 2, 3, 4].map(i => `
        <button type="button" class="poster" data-p="${i}" aria-label="Destapar cartel de ${i + 1} estrellas" disabled>
          <div class="poster-stars">${'★'.repeat(i + 1)}</div>
          <div class="poster-face" id="pf-${i}"><strong>WANTED</strong><span class="poster-silhouette">?</span><span>DEAD OR ALIVE</span></div>
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
    if(autoMode && !resolved)scheduleAutoStep(()=>{if(document.body.contains(ov))ov.querySelector(`[data-p="${current}"]`)?.click();},700);
  };
  const flip = i => {
    if (resolved || !ov.isConnected || i !== current) return;
    const face = ov.querySelector(`#pf-${i}`);
    const el = ov.querySelector(`[data-p="${i}"]`);
    if (i === stopIdx) {
      resolved = true;
      const c = CHARS[prizeId];
      const reward = duplicatePosterReward(prizeId) || c.rareza;
      trackJourneyRewards(0, reward);
      meta.logPoses = (meta.logPoses || 0) + reward;
      saveMeta();
      face.innerHTML = `${charIcon(prizeId, 28)}<br><span>${c.name}</span>`;
      el.classList.add('hit'); el.classList.remove('next');
      registerDex(prizeId);
      ov.querySelectorAll('.poster').forEach(p => { p.onclick = null; p.disabled = true; });
      revealSpecialRecruit(ov, prizeId, lvl, reward);
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
  playMusic('combat');
  const stock = PORT_SHOP_STOCK;
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
        <b>${it.name}</b> <span style="font-size:8.5px;color:#aaa;">(Tienes: ${n})</span> — Venta (75%): <span class="price" style="color:#2ecc71;font-weight:bold;">+${berriesHTML(sellPrice)}</span></div>
      <button class="btn small green" data-sell="${id}">VENDER</button>
    </div>`;
  }).join('') : '<div style="font-size:8.5px;color:#888;text-align:center;padding:8px;background:rgba(0,0,0,0.15);border-radius:6px;margin-bottom:10px;">Tu bolsa está vacía. No tienes objetos para vender.</div>';

  render(`
    ${topbar(true, false)}
    <div class="panel">
      <h2>🏪 Tienda del puerto</h2>

      <div style="font-size:9.5px;background:rgba(255,215,0,0.12);padding:6px 10px;border-radius:6px;border:1px solid var(--gold);margin-bottom:10px;text-align:center;">
        <b>🎒 Isla: ${backpackUsed(run.items,false)}/${backpackCapacity()} · Combate: ${backpackUsed(run.items,true)}/${backpackCapacity()} casillas</b><br>${inventorySummary || 'Vacía'}
      </div>

      <h3 style="margin-top:10px;margin-bottom:6px;font-size:11px;color:var(--gold);">🛒 COMPRAR PROVISIONES</h3>
      ${stock.map(id => {
    const it = ITEMS[id];
    const owned = (run && run.items && run.items[id]) || 0;
    return `<div class="shop-item">
          <span class="emoji">${it.emoji}</span>
          <div class="info">
            <b>${it.name}</b> <span style="font-size:8.5px;color:var(--gold);font-weight:bold;margin-left:4px;">(Tienes: ${owned})</span> — <span class="price">${berriesHTML(it.price)}</span><br>
            <small>${it.desc} · ${it.slotSize} casilla${it.slotSize > 1 ? 's' : ''} / ${backpackStackLimit()} uds.</small>
          </div>
          <button class="btn small ${run.berries >= it.price && backpackFits(run,id) ? 'green' : 'gray'}" data-buy="${id}" ${run.berries >= it.price && backpackFits(run,id) ? '' : 'disabled'}>${backpackFits(run,id) ? 'COMPRAR' : 'SIN ESPACIO'}</button>
        </div>`;
  }).join('')}

      <h3 style="margin-top:14px;margin-bottom:6px;font-size:11px;color:#2ecc71;">💰 VENDER · 75% del valor</h3>
      ${sellItemsHTML}

      <div class="actions" style="margin-top:14px;text-align:center;">
        <button class="btn blue" id="btn-leave">SEGUIR VIAJE →</button>
      </div>
    </div>
  `);
  document.querySelectorAll('[data-buy]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.buy;
      if (!stock.includes(id) || run.berries < ITEMS[id].price) return;
      if (!backpackFits(run,id)) { toast('🎒 No hay espacio en la mochila.'); return; }
      const stored = receiveBackpackItem(run,id);
      run.berries -= ITEMS[id].price;
      trackItemCollected(1);
      trackStat('shop_buy', 1);
      saveRun();
      toast(`Comprado: ${ITEMS[id].name} ${ITEMS[id].emoji}`);
      screenShop();
      if (!stored) showBackpackOrganizer(run,isBattleItem(id),screenShop,id);
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
          if (autoCanSpend(itemPrice)) {
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
let autoSpeed = [1,2,4].includes(meta.settings.autoConfig?.combatSpeed) ? meta.settings.autoConfig.combatSpeed : 1; // recordado entre combates
let combatSpeedOverride = meta.settings.autoConfig?.combatSpeed === autoSpeed ? autoSpeed : null; // elección manual compartida entre mapa y combate
function preferredCombatSpeed() {
  return combatSpeedOverride ?? (autoMode ? (autoSettings.speed === 'x1' ? 1 : 2) : autoSpeed);
}

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
// Two matching living members unlock I, three unlock II; six reinforce its numeric bonuses.
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

function synergyCount(team, type) {
  return team.filter(f => f.hp > 0 && (type === 'Nakama' ? isNakamaChar(f) : fighterTypes(f).includes(type))).length;
}
function synergyTier(team, type) {
  const count = synergyCount(team, type);
  return count >= 3 ? 2 : count >= 2 ? 1 : 0;
}
function synergyBoost(team, type) {
  return team.length === 6 && synergyCount(team, type) === 6 ? 1.4 : 1;
}
function synergyBonus(team, type, first, second) {
  const tier = synergyTier(team, type);
  return tier === 2 ? second * synergyBoost(team, type) : tier === 1 ? first : 0;
}
function teamSynergies(team) {
  return Object.keys(SYNERGIES).map(t => ({ t, tier: synergyTier(team, t) })).filter(x => x.tier > 0);
}
function synChipsHTML(team) {
  const list = teamSynergies(team);
  if (!list.length) return '<span class="syn-none">sin sinergias</span>';
  return list.map(({ t, tier }) =>
    `<span class="syn-chip t${tier}" title="${SYNERGIES[t].name}: ${tier === 2 ? SYNERGIES[t].d2 : SYNERGIES[t].d1}${synergyBoost(team,t)>1 ? ' · 6/6: bonus numéricos reforzados (25% → 35%)' : ''}">${synEmoji(t)} ${t} ${tier === 2 ? 'Ⅱ' : 'Ⅰ'}${synergyBoost(team,t)>1 ? ' ★ 6/6' : ''}</span>`
  ).join('');
}

function activeSynergiesHTML(team) {
  const active = teamSynergies(team);
  if (!active.length) return '<p class="synergy-empty">Sin sinergias activas. Reúne 2 nakamas con el mismo tag para activar el nivel I.</p>';
  return '<div class="active-synergy-grid">' + active.map(({t,tier}) =>
    `<article class="active-synergy-card"><header><b>${synEmoji(t)} ${t}</b><span>Nivel ${tier === 2 ? 'II' : 'I'} · ${synergyCount(team,t)} nakamas</span></header><p>${tier === 2 ? SYNERGIES[t].d2 : SYNERGIES[t].d1}</p>${synergyBoost(team,t)>1 ? '<strong>★ 6/6 · Bonus numéricos ×1,4</strong>' : ''}</article>`
  ).join('') + '</div>';
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
  return new Set(prim).size === prim.length ? 1 + synergyBonus(team, 'Nakama', .10, .10) : 1;
}

// Modal informativo con todas las sinergias y el estado del equipo actual
function showSynergyModal(team) {
  const ov = document.createElement('div');
  ov.className = 'overlay collection-overlay';
  ov.innerHTML = `<div class="modal collection-modal guide-modal" role="dialog" aria-modal="true" aria-label="Guía de sinergias y tipos">
    <h2 style="flex-shrink:0;">🧩 Sinergias de equipo</h2>
    <p style="font-size:8px;text-align:center;margin-bottom:10px;flex-shrink:0;">2 nakamas vivos del mismo tag: nivel I. 3 o más: nivel II.
    Con 6/6 del mismo tag, sus bonus numéricos aumentan un 40 % (por ejemplo, 25 % → 35 %). Los efectos absolutos se mantienen.</p>
    <div class="collection-list guide-content">
      ${Object.keys(SYNERGIES).map(t => {
    const tier = team ? synergyTier(team, t) : 0;
    const s = SYNERGIES[t];
    return `<div class="sheet-section synergy-guide-card ${tier ? 'is-active' : ''}">
            <b>${synEmoji(t)} ${t} — ${s.name}${team ? ` · ${synergyCount(team,t)} nakamas` : ''} ${tier ? `<span style="color:var(--accent);">— ACTIVA ${tier === 2 ? 'Ⅱ' : 'Ⅰ'}</span>` : ''}</b>
            <p>Ⅰ: ${s.d1}<br>Ⅱ: ${s.d2}<br><b>6/6:</b> ${t === 'Nakama' ? 'Bonus de estadísticas +14 % si no repiten tipo primario; la protección conserva 1 PS.' : 'Bonus numéricos ×1,4; sin duplicar inmunidades ni efectos garantizados.'}${team && synergyBoost(team,t)>1 ? ' ★ ACTIVO' : ''}</p>
          </div>`;
  }).join('')}
    </div>
    <div class="actions guide-actions">
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
      <td>${note || '—'}</td>
    </tr>`;
  }).join('');
  const ov = document.createElement('div');
  ov.className = 'overlay collection-overlay';
  ov.innerHTML = `<div class="modal collection-modal guide-modal" role="dialog" aria-modal="true" aria-label="Guía de sinergias y tipos">
    <h2 style="flex-shrink:0;">📊 Tabla de debilidades</h2>
    <div class="collection-list guide-content">
      <div class="guide-type-table">
        <table class="chart-table" aria-label="Tabla de debilidades y efectos especiales">
          <thead><tr><th scope="col">Atacante</th><th scope="col">+25%<br>Fuerte contra</th><th scope="col">−25%<br>Débil contra</th><th scope="col">Efecto especial</th></tr></thead>
          <tbody>${rows}</tbody>
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
    <div class="actions guide-actions">
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


function getUltimateMove(f) {
  if (!f) return MOVES.punetazo;
  const base = baseFormOf(f.id);


  const c = CHARS[f.id] || CHARS[base];
  if (!c) return MOVES.punetazo;

  if (c.evo && !battle?.opts?.local && startLvlOf(f.id) < c.evo.lvl && !battle?.eTeam.includes(f)) {
    const lockedMoves = c.learnset.filter(([level]) => level >= c.evo.lvl).map(([,id]) => id);
    if (!c.ultimate || lockedMoves.includes(c.ultimate)) {
      const available = formMovesAt(f.id, f.lvl).map(id => MOVES[id]).filter(m => m?.power > 0);
      return available.sort((a,b) => b.power * b.acc - a.power * a.acc)[0] || MOVES.punetazo;
    }
  }
  if (c.ultimate && MOVES[c.ultimate]) return MOVES[c.ultimate];
  if (c.learnset && c.learnset.length >= 3) {
    const highMove = c.learnset[c.learnset.length - 1][1];
    if (MOVES[highMove]) return MOVES[highMove];
  }

  const ownMoves = c.learnset.map(([,id]) => MOVES[id]).filter(m => m && m.power > 0);
  return ownMoves.sort((a,b) => b.power * b.acc - a.power * a.acc)[0] || MOVES.punetazo;
}

function enemyUltimatesEnabled(b = battle) {
  if (b?.opts?.local || b?.opts?.challenge) return true;
  const marineford = SAGAS.findIndex(s => s.id === 'marineford');
  return !!b && !b.tower && !!run && marineford >= 0 && run.saga >= marineford;
}

function useUltimate(f) {
  const b = battle;
  if (!b || b.over || !f || f.hp <= 0) return;
  const isEnemy = b.eTeam.includes(f);
  if (isEnemy && !enemyUltimatesEnabled(b)) return;
  const enemy = isEnemy ? b.curP : b.curE;
  if (!enemy || enemy.hp <= 0) return;
  if (f.lvl < 20) return toast(`🔒 Ultimate de ${charName(f)} desbloqueable a Nv20.`);
  if ((f.ultCharge || 0) < 100) return toast(`⚡ Ultimate de ${charName(f)} al ${Math.floor(f.ultCharge || 0)}% (golpea para cargar).`);

  f.ultCharge = 0;
  const ultMv = getUltimateMove(f);
  log(`💥 <b>¡DEFINITIVA DE ${charName(f).toUpperCase()}!</b> Desata <b>${ultMv.name}</b> 💥`);
  attackWith(f, enemy, ultMv, isEnemy ? 'player' : 'enemy');
  refreshHPCards();
}

function startBattle(enemies, opts) {
  playMusic('combat');
  const team = opts.challenge ? opts.team : opts.tower ? tower.team : run.team;
  if (!team.some(f => f.hp > 0)) return opts.challenge ? endChallengeBattle(false) : opts.tower ? towerGameOver() : gameOver();
  autoSpeed = preferredCombatSpeed();
  battle = {
    pTeam: team, eTeam: enemies,
    items: opts.challenge ? opts.items : opts.tower ? tower.items : run.items,
    opts, speed: autoSpeed, over: false, waiting: false,
    tower: !!opts.tower,
    timer: null,
    round: 1,
    switchUsed: false,
    itemBuffs: new Map(),
    teamTotals: {p: team.length, e: enemies.length},
  };
  enemies.forEach(e => registerDex(e.id));
  // reinicia pasivas y estados por-combate
  [...battle.pTeam, ...battle.eTeam].forEach(f => {
    migrateFighter(f, battle.eTeam.includes(f) || !!opts.challenge);
    f.battleRelic = opts.challenge && battle.eTeam.includes(f)
      ? `relic_${baseFormOf(f.id)}`
      : !opts.local && battle.pTeam.includes(f) && meta.relics.includes(meta.relicEquipment?.[baseFormOf(f.id)]) ? meta.relicEquipment[baseFormOf(f.id)] : null;
    f.dodgeLeft = (passiveRule(f).dodge || 0) + (relicRule(f).dodge || 0);
    f.ultCharge = Math.max(f.ultCharge || 0, relicRule(f).charge || 0);
    // Carry timed effects through the journey; reset combat-only passive flags.
    const previous = battle.pTeam.includes(f) ? f.st || {} : {};
    f.st = Object.fromEntries(['burn','burnRate','poison','poisonDefense','slow','slowRate','gust','gustBonus']
      .filter(key => previous[key] !== undefined).map(key => [key, previous[key]]));
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

function battleItemMult(f, stat) {
  return 1 + ((!battle || battle.over) ? 0 : battle.itemBuffs?.get(f)?.[stat] || 0);
}
function combatStatsHTML(f) {
  return `      <span class="combat-stat">⚔️ ATQ ${Math.floor(f.atk * battleItemMult(f,'atk') * relicStatMult(f))}${battleItemMult(f,'atk') > 1 ? ' ↑' : ''}</span>
      <span class="combat-stat">🛡️ DEF ${Math.floor(f.def * battleItemMult(f,'def') * relicStatMult(f))}${battleItemMult(f,'def') > 1 ? ' ↑' : ''}</span>
      <span class="combat-stat">⚡ VEL ${Math.floor(f.spd * relicStatMult(f))}</span>${equippedRelic(f) ? `<span class="combat-stat" title="${esc(equippedRelic(f).desc)}">🏺 ${equippedRelic(f).character===baseFormOf(f.id)?'Afinidad':'Reliquia'} +10%</span>` : ''}`;
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
  const rarityTag = c.rareza ? `<span style="color:var(--gold);font-size:7.5px;" title="Rareza ${c.rareza} estrellas">${'⭐'.repeat(c.rareza)}</span>` : '';
  const fusionTag = f.stars ? `<span style="color:#ff6b6b;font-weight:bold;font-size:7.5px;" title="Fusión +${f.stars}">[+${f.stars}⭐]</span>` : '';
  const isUltUnlocked = f.lvl >= 20;
  const isUltReady = isUltUnlocked && (f.ultCharge || 0) >= 100;
  const ultPct = isUltUnlocked ? clamp(f.ultCharge || 0, 0, 100) : 0;

  const ultBarHTML = (side === 'p' || enemyUltimatesEnabled()) ? `
    <div class="ult-bar-wrap ${isUltUnlocked ? '' : 'locked'}" title="${isUltUnlocked ? 'Ultimate (' + Math.floor(ultPct) + '%)' : 'Desbloquea Ultimate a Nv20'}">
      ${isUltUnlocked ? `<div class="ult-bar" style="width:${ultPct}%"></div>` : '<div class="ult-bar-text">🔒 ULTI A NV20</div>'}
    </div>` : '';

  return `<div class="fcard ${f.hp <= 0 ? 'ko' : ''} ${f === active ? 'active' : ''} ${isUltReady ? 'ult-ready' : ''}" id="fc-${side}-${idx}">
    <div class="fcard-title">${c.name} ${rarityTag} ${fusionTag} Nv${f.lvl} <span class="fcard-tags">${tagIcons(f)}</span><span class="fcard-st">${stIcons(f)}</span>
      ${side === 'p' ? xpBarHTML(f) : ''}
    </div>
    <div class="fcard-hp">
      <div class="hp-bar"><i class="${hpBarClass(f)}" style="width:${clamp(f.hp / f.maxhp * 100, 0, 100)}%"></i></div>
      <div class="hp-nums">${f.hp}/${f.maxhp}</div>
    </div>
    <div class="fcard-meters">${ultBarHTML}</div>
    <div class="fcard-stats-mini" style="font-size:7.5px;color:#eee;text-align:center;margin:2px 0;background:rgba(0,0,0,0.3);padding:2px 4px;border-radius:3px;">
      ${combatStatsHTML(f)}
    </div>
    <div class="fcard-sprite" data-character="${f.id}">
      <span class="sprite ${side === 'e' ? 'flip' : ''}">${charIcon(f.id, 64)}</span>
      <div class="platform"></div>
    </div>
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
        ${charIcon(f.id,36)}<span><b>${charName(f)}</b> · Nv${f.lvl}<small>${f.hp}/${f.maxhp} PS · ${f.hp <= 0 ? 'Fuera de combate' : b.opts.duos ? 'En combate' : f === active ? 'Activo' : 'En reserva'}</small></span><span>ℹ️</span>
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
  let html = '<div class="battle-control-row battle-tools" aria-label="Controles del combate">';
  html += `<button class="btn small gray battle-crew-button" data-ctl="crew">👥 BANDAS</button>`;
  html += '</div><div class="battle-control-row battle-exit" aria-label="Salir del combate">';
  if (b.tower || b.opts?.challenge) html += `<button class="btn small red" data-ctl="quit">🏳️ RENDIRSE</button>`;
  return html + '</div>';
}

function battleTeamCount(side) {
  const team = side === 'p' ? battle.pTeam : battle.eTeam;
  const total = battle.teamTotals?.[side] ?? team.length;
  return `${team.filter(f => f.hp > 0).length}/${total} en pie`;
}

function switchBattleFighter(index) {
  const b = battle;
  const next = b?.pTeam[index];
  if (!b || b.opts?.duos || b.over || b.waiting || b.switchUsed || !next || next.hp <= 0 ||
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
  if (b.opts?.duos) return '<div class="battle-reserve-heading">👥 2 CONTRA 2 · Cada personaje vivo actúa una vez por ronda</div>';
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

// Las pasivas se agrupan después de la tripulación, fuera de las cartas de combate.
function battleTeamPassivesHTML(team) {
  const entries = team.flatMap(f => {
    const info = passiveInfo(f), relic = equippedRelic(f), rows = [];
    if (info) rows.push({label:info.label, desc:info.desc, active:info.active});
    if (relic && relic.character === baseFormOf(f.id)) {
      rows.push({label:`🏺 ${relic.passiveName}`, desc:relic.passiveDesc, active:f.hp > 0});
    }
    return rows.map(info => `<li class="team-passive ${info.active ? 'on' : ''}" title="${esc(info.desc)}">
      <b>${esc(charName(f))}</b><span>${info.active ? '✨' : '◇'} ${esc(info.label)}</span>
    </li>`);
  });
  return entries.length ? `<ul class="team-passive-list">${entries.join('')}</ul>` : '<p class="team-passive-empty">Sin pasivas</p>';
}

function battleLayoutHTML(logLines, labels = {}) {
  const b = battle;
  const eHead = b.opts.wild ? '🌊' : b.opts.boss ? '💀' : '⚓';
  return `
    <div class="battle-layout ${b.opts.duos ? 'challenge-duos' : ''}">
      <div class="battle-main">
        <div class="battle-cols" style="--scene:url('${b.opts.challenge ? '/art/scenes/wano.webp' : b.opts.local ? (b.opts.coop ? '/art/scenes/wano.webp' : '/art/scenes/eastblue.webp') : b.tower ? '/art/scenes/marineford.webp' : (SAGAS[run?.saga || 0]?.img || '/art/scenes/eastblue.webp')}')">
          <div class="battle-side" id="side-p">
            <div class="side-head"><div class="trainer">🏴‍☠️</div>${labels.p || 'TU BANDA'}
              <div class="battle-team-count" id="count-p">${battleTeamCount('p')}</div>
              <div class="syn-chips" id="syn-p">${synChipsHTML(b.pTeam)}</div>
            </div>
            ${b.pTeam.map((f, i) => fighterCardHTML(f, 'p', i, b.curP)).join('')}
          </div>
          <div class="battle-side" id="side-e">
            <div class="side-head"><div class="trainer">${eHead}</div>${labels.e || (b.opts.wild ? 'SALVAJE' : 'ENEMIGO')}
              <div class="battle-team-count" id="count-e">${battleTeamCount('e')}</div>
              <div class="syn-chips" id="syn-e">${synChipsHTML(b.eTeam)}</div>
            </div>
            ${b.eTeam.map((f, i) => fighterCardHTML(f, 'e', i, b.curE)).join('')}
          </div>
        </div>
        <div class="battle-reserves" id="battle-reserves"></div>
        <div class="battle-team-passives" aria-label="Pasivas de los equipos">
          <section><h3>✨ ${labels.p || 'TU BANDA'}</h3><div id="passives-p">${battleTeamPassivesHTML(b.pTeam)}</div></section>
          <section><h3>✨ ${labels.e || 'ENEMIGOS'}</h3><div id="passives-e">${battleTeamPassivesHTML(b.eTeam)}</div></section>
        </div>
        <div class="battle-lower-panels">
          <section class="battle-log-panel"><h3>REGISTRO</h3><div class="battle-log" id="battle-log">${logLines.map(l => `<div>${l}</div>`).join('')}</div></section>
          <section id="battle-backpack" aria-label="Mochila de combate"></section>
        </div>
      </div>
      <div class="battle-sidebar" id="battle-controls">${b.opts.local ? '' : controlsHTML()}</div>
    </div>
  `;
}

function renderBattle(logLines) {
  const b = battle;
  render(`${topbar(!b.tower && !b.opts.challenge, !b.tower && !b.opts.challenge, true, b.opts.wild && !b.tower)}${battleLayoutHTML(logLines)}`);
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
            if (b.opts?.duos) return showCharModal(f);
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
  refreshBattleBackpack();
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
  refreshBattleBackpack();
}

function log(msg) {
  if (battle?.opts?.local) {
    battle.lines.push(msg.replace(/<[^>]*>/g, ''));
    battle.lines = battle.lines.slice(-12);
    return;
  }
  const el = $('#battle-log');
  if (!el) return;
  const follow = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  const d = document.createElement('div');
  d.innerHTML = msg;
  el.appendChild(d);
  while (el.children.length > 30) el.removeChild(el.firstChild);
  if (follow) el.scrollTop = el.scrollHeight;
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
  if (battle.opts?.local) return;
  for (const side of ['p', 'e']) {
    const count = $(`#count-${side}`);
    if (count) count.textContent = battleTeamCount(side);
  }
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
      const statsEl = card.querySelector('.fcard-stats-mini');
      if (statsEl) statsEl.innerHTML = combatStatsHTML(f);
      const stEl = card.querySelector('.fcard-st');
      if (stEl) stEl.textContent = stIcons(f);
    });
  });
  for (const [side, team] of [['p',battle.pTeam],['e',battle.eTeam]]) {
    const el = $(`#passives-${side}`); if (el) el.innerHTML = battleTeamPassivesHTML(team);
  }
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
  c += synergyBonus(team, 'Corte', 0, .10);
  const tD = synergyTier(team, 'Disparo');
  if (tD) c += synergyBonus(team, 'Disparo', .10, .20);
  c += synergyBonus(team, 'Haki', 0, .10);
  c += relicRule(att).critical || 0;
  return Math.min(.75, c);
}
function critDmgFor(att) {
  let m = BASE_CRIT_DMG + (relicRule(att).critDamage || 0);
  if (isP(att, 'oden')) m += 0.20;
  const tC = synergyTier(teamOf(att), 'Corte');
  if (tC) m += synergyBonus(teamOf(att), 'Corte', .15, .35);
  return m;
}
function evaChanceFor(dfd) {
  let e = BASE_EVA + (passiveRule(dfd).evasion || 0) + (relicRule(dfd).evasion || 0) + relicTeamBonus(dfd,'teamEvasion');
  // Pasiva Nami: +10% de evasión de equipo
  if (teamOf(dfd).some(x => x.hp > 0 && isP(x, 'nami'))) e += 0.10;
  if (teamOf(dfd).some(x => x.hp > 0 && isP(x, 'dragon'))) e += 0.15;
  if (isP(dfd, 'smoker')) e += 0.20;
  const tV = synergyTier(teamOf(dfd), 'Viento');
  if (tV) e += synergyBonus(teamOf(dfd), 'Viento', .08, .18);
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
  let atkStat = (phys ? att.atk : att.spatk) * nakamaStatMult(atkTeam) * battleItemMult(att,'atk');
  let defStat = (phys ? dfd.def : dfd.spdef) * nakamaStatMult(defTeam) * battleItemMult(dfd,'def');
  atkStat *= relicStatMult(att);
  defStat *= relicStatMult(dfd);
  const relic = relicRule(att);
  defStat *= 1 - (relic.pierce || 0) - (phys ? relic.physicalPierce || 0 : relic.specialPierce || 0);
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
  // Veneno: daño neutral que ignora el 20% de la defensa
  if (mv.type === 'Veneno') defStat *= 0.8;
  // Golpe Ⅱ: los ataques físicos rompen un 15% de la DEF rival
  if (phys) defStat *= 1 - synergyBonus(atkTeam, 'Golpe', 0, .15);
  // Tierra: +15/+30% de DEF física
  const tT = synergyTier(defTeam, 'Tierra');
  if (phys && tT) defStat *= 1 + synergyBonus(defTeam, 'Tierra', .15, .30);
  // Agua Ⅱ y Fruta Ⅱ: +15% de ESP_DEF
  if (!phys) defStat *= 1 + synergyBonus(defTeam, 'Agua', 0, .15);
  if (!phys) defStat *= 1 + synergyBonus(defTeam, 'Fruta', 0, .15);
  // Estado Veneno: el envenenado pierde un 20% de ESP_DEF
  if (!phys && dfd.st && dfd.st.poison) defStat *= 1 - (dfd.st.poisonDefense || .20);
  // Efectos de daño por tag FRUTA
  if (mv.type === 'Agua' && hasFruta(dfd)) eff *= 1.5;
  if (mv.type === 'Oscuridad' && hasFruta(dfd)) eff *= 1.35;

  const base = ((2 * att.lvl / 5 + 2) * mv.power * atkStat / Math.max(1, defStat)) / 50 + 2;
  const r = variance ?? (0.85 + Math.random() * 0.15);
  let dmg = base * eff * r * relicDamageMult(att,dfd,mv);
  dmg *= (phys ? ar.physical : ar.special) || 1;
  dmg *= ar.types?.[mv.type] || 1;
  dmg *= dr.reduction || 1;
  if (dr.dryReduction && mv.type !== 'Agua') dmg *= dr.dryReduction;
  if (crit) dmg *= critDmgFor(att);
  // Sinergias de daño del atacante
  const tGolpe = synergyTier(atkTeam, 'Golpe');
  if (phys && tGolpe) dmg *= 1 + synergyBonus(atkTeam, 'Golpe', .12, .25);
  const tFuego = synergyTier(atkTeam, 'Fuego');
  if (mv.type === 'Fuego' && tFuego) dmg *= 1 + synergyBonus(atkTeam, 'Fuego', .12, .25);
  const tHielo = synergyTier(atkTeam, 'Hielo');
  if (mv.type === 'Hielo' && tHielo) dmg *= 1 + synergyBonus(atkTeam, 'Hielo', .10, .20);
  if (mv.type === 'Veneno') dmg *= 1 + synergyBonus(atkTeam, 'Veneno', .10, .10);
  const tOsc = synergyTier(atkTeam, 'Oscuridad');
  if (tOsc && hasFruta(dfd)) dmg *= 1 + synergyBonus(atkTeam, 'Oscuridad', .10, .25);
  const tFru = synergyTier(atkTeam, 'Fruta');
  if (!phys && tFru) dmg *= 1 + synergyBonus(atkTeam, 'Fruta', .12, .25);
  const tHaki = synergyTier(atkTeam, 'Haki');
  if (tHaki) dmg *= 1 + synergyBonus(atkTeam, 'Haki', .08, .18);
  // Pasivas de daño de 5 estrellas
  if (teamOf(att).some(x => x.hp > 0 && isP(x, 'roger'))) dmg *= 1.20;
  if (isP(dfd, 'kaido')) dmg *= 0.85;
  if (isP(att, 'teach') && hasFruta(dfd)) dmg *= 1.25;
  if (isP(att, 'akainu') && mv.type === 'Fuego') dmg *= 1.20;
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
  if (battle?.opts?.local) return;
  // localiza la carta activa del lado golpeado
  const side = who === 'enemy' ? 'e' : 'p';
  const team = side === 'e' ? battle.eTeam : battle.pTeam;
  const active = side === 'e' ? battle.curE : battle.curP;
  const idx = team.indexOf(active);
  const card = $(`#fc-${side}-${idx}`);
  popDamageCard(card, text, color);
}

function popDamageCard(card, text, color) {
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
      dfd.st.gustBonus = .20 * synergyBoost(teamOf(dfd), 'Viento');
      log(`💨 ¡Ligereza! ${charName(dfd)} gana +${Math.round(dfd.st.gustBonus * 100)}% de VEL.`);
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
  const relic = relicRule(att);
  if (relic.burn && dmg > 0) { dfd.st.burn=3; dfd.st.burnRate=Math.max(dfd.st.burnRate||0,relic.burn); }
  if (relic.slow && dmg > 0) { dfd.st.slow=2; dfd.st.slowRate=Math.max(dfd.st.slowRate||0,relic.slow); }
  // Recarga de Ultimate al golpear al enemigo (para personajes de nivel base >= 20)
  if (att && att.lvl >= 20 && (b.opts?.local || b.pTeam.includes(att) || (enemyUltimatesEnabled(b) && b.eTeam.includes(att)))) {
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
    dfd.st.burnRate = .03 * synergyBoost(atkTeam, 'Fuego');
    log(`🔥 ¡${charName(dfd)} sufre una Quemadura!`);
  }
  // Hielo Ⅱ: los ataques ralentizan (-15% VEL, 1 turno)
  if (synergyTier(atkTeam, 'Hielo') === 2) { dfd.st.slow = 2; dfd.st.slowRate = .15 * synergyBoost(atkTeam, 'Hielo'); }
  // Veneno Ⅱ: 25% de probabilidad de envenenar con cualquier ataque
  if (synergyTier(atkTeam, 'Veneno') === 2 && !dfd.st.poison && Math.random() < .25 * synergyBoost(atkTeam, 'Veneno')) {
    dfd.st.poison = true;
    dfd.st.poisonDefense = .20 * synergyBoost(atkTeam, 'Veneno');
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
  if (battle.opts?.local) return;
  clearTimeout(battle.timer);
  battle.timer = setTimeout(runRound, (delay == null ? 1200 : delay) / battle.speed);
}

function effectiveSpeed(f) {
  const rule = passiveRule(f);
  let speed = f.spd * nakamaStatMult(teamOf(f)) * (rule.speed || 1) * relicStatMult(f) * (relicRule(f).speed || 1);
  const tier = synergyTier(teamOf(f), 'Rayo');
  if (tier) speed *= 1 + synergyBonus(teamOf(f), 'Rayo', .20, .40);
  if (f.st?.slow) speed *= 1 - (f.st.slowRate || .15);
  if (f.st?.gust) speed *= 1 + (f.st.gustBonus || .20);
  if (rule.lowSpeed && f.hp < f.maxhp * .5) speed *= rule.lowSpeed;
  if (rule.openingSpeed && battle.round === 1) speed *= rule.openingSpeed;
  const foe = battle.pTeam.includes(f) ? battle.curE : battle.curP;
  if (foe?.hp > 0) speed *= passiveRule(foe).foeSpeed || 1;
  return speed;
}

function runRound() {
  const b = battle;
  if (!b || b.over || b.waiting) return;
  if (b.opts?.duos) return runChallengeDuoRound();
  if (!b.opts?.challenge) runAutoItems();
  const p = b.curP, e = b.curE;
  if (!p || !e || p.hp <= 0 || e.hp <= 0) return afterRound();

  // Modo auto: tira la Ultimate automáticamente si está cargada
  if ((b.opts?.challenge || autoMode && autoSettings.useUltimates !== false) && p.lvl >= 20 && (p.ultCharge || 0) >= 100) {
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
    b.pendingStep = null;
    if (i < order.length) {
      const side = order[i++][2];
      // Preserve this round's turn order; a manual relay changes its actors, not its number of attacks.
      const att = side === 'enemy' ? b.curP : b.curE;
      const dfd = side === 'enemy' ? b.curE : b.curP;
      if (att.hp > 0 && dfd.hp > 0) {
        if (side === 'player' && enemyUltimatesEnabled(b) && att.lvl >= 20 && (att.ultCharge || 0) >= 100) useUltimate(att);
        else attackWith(att, dfd, chooseMove(att, dfd), side);
      }
      b.pendingStep = step;
      b.timer = setTimeout(step, 900 / battle.speed);
    } else {
      afterRound();
    }
  };
  step();
}

function afterRound() {
  const b = battle;
  if (!b || b.over) return;
  const actors = b.opts?.duos ? [...b.pTeam,...b.eTeam] : b.opts?.local && b.localActors ? b.localActors : [b.curP, b.curE];
  // Daño residual de estados y expiración de contadores
  for (const f of actors) {
    if (!f || !f.st) continue;
    if (f.hp > 0 && f.st.burn) {
      const d = Math.max(1, Math.floor(f.maxhp * (f.st.burnRate || .03)));
      f.hp = Math.max(0, f.hp - d);
      log(`🔥 ${charName(f)} sufre quemaduras (-${d} PS).`);
      if (--f.st.burn <= 0) { delete f.st.burn; delete f.st.burnRate; }
    }
    if (f.hp > 0 && f.st.poison) {
      const d = Math.max(1, Math.floor(f.maxhp * 0.04));
      f.hp = Math.max(0, f.hp - d);
      log(`☠️ ${charName(f)} sufre el veneno (-${d} PS).`);
    }
    if (f.st.slow && --f.st.slow <= 0) { delete f.st.slow; delete f.st.slowRate; }
    if (f.st.gust && --f.st.gust <= 0) { delete f.st.gust; delete f.st.gustBonus; }
  }
  // Resolución simultánea: nadie revive por drenaje ni ataca tras caer.
  const targets = actors.map(act => b.pTeam.includes(act) ? b.curE : b.curP);
  const hpDelta = actors.map((act, i) => {
    if (!act || act.hp <= 0) return 0;
    const team = teamOf(act), foe = targets[i];
    if (!foe || foe.hp <= 0) return 0;
    const drain = Math.min(foe.hp, Math.floor(foe.maxhp * (passiveRule(act).drain || 0)));
    let heal = (passiveRule(act).regen || 0) + (relicRule(act).regen || 0) + relicTeamBonus(act,'teamRegen');
    if (team.some(x => x.hp > 0 && isP(x,'marco'))) heal += .06;
    if (team.some(x => x.hp > 0 && isP(x,'ryokugyu'))) heal += .05;
    const water = synergyTier(team,'Agua');
    if (water) heal += synergyBonus(team, 'Agua', .04, .08);
    const blocked = synergyTier(teamOf(foe),'Oscuridad') === 2;
    return {drain, heal:blocked ? 0 : Math.floor((heal * act.maxhp + drain) * healScaleNow())};
  });
  actors.forEach((act,i) => {
    if (!act || act.hp <= 0) return;
    const drained = actors.reduce((sum, other, j) => sum + (targets[j] === act ? hpDelta[j].drain || 0 : 0), 0);
    act.hp = Math.max(0, Math.min(act.maxhp, act.hp + (hpDelta[i].heal || 0)) - drained);
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
    if (!b.opts?.local && !b.opts?.challenge && isPlayer && run && run.mode === 'nuzlocke' && !b.tower) return; // En Nuzlocke los aliados no sobreviven ni reviven
    if (isP(f, 'brook') && !f.reviveUsed) {
      f.reviveUsed = true;
      f.hp = Math.max(1, Math.floor(f.maxhp * 0.2));
      log(`✨ ¡Segunda Vida! ${charName(f)} se niega a morir. ¡Yohohoho!`);
      return;
    }
    const guardTeam = teamOf(f).map(ally => ally === f ? {...ally, hp:1} : ally);
    if (synergyTier(guardTeam, 'Nakama') === 2) {
      const used = b.opts?.challenge ? b.challengeGuardUsed : b.opts?.local ? b.localGuard[isPlayer ? 'p' : 'e'] : isPlayer
        ? (b.tower ? tower && tower.nakamaGuardUsed : run && run.nakamaGuardUsed)
        : b.eGuardUsed;
      if (!used) {
        if (b.opts?.challenge) b.challengeGuardUsed = true;
        else if (b.opts?.local) b.localGuard[isPlayer ? 'p' : 'e'] = true;
        else if (isPlayer) { if (b.tower && tower) tower.nakamaGuardUsed = true; else if (run) { run.nakamaGuardUsed = true; saveRun(); } }
        else b.eGuardUsed = true;
        f.hp = 1;
        log(`🏴‍☠️ ¡Espíritu de Tripulación! ${charName(f)} resiste con ${f.hp} PS.`);
      }
    }
  };
  [...b.pTeam, ...b.eTeam].forEach(checkRevive);
  if (b.opts?.challenge) return afterChallengeRound(b);
  const deadE = b.curE.hp <= 0, deadP = b.curP.hp <= 0;
  // Las partidas locales nunca conceden EXP, modifican el viaje ni escriben el guardado.
  if (b.opts?.local) {
    b.curP = activeP(); b.curE = activeE();
    if (!b.curP || !b.curE) {
      b.over = true;
      b.winner = b.curP ? 'p' : b.curE ? 'e' : 'draw';
      log(b.winner === 'draw' ? '¡Empate!' : '¡Combate terminado!');
    } else {
      b.round++;
    }
    return;
  }
  let changed = false;

  b.rewarded ||= new Set();
  for (const defeated of b.eTeam.filter(f => f.hp <= 0 && !b.rewarded.has(f))) {
    b.rewarded.add(defeated);
    trackKills();
    log(`¡${charName(defeated)} cae derrotado!`);
    // registro de vencidos en historia (habilita comprarlos en Crossguild)
    if (run && !b.tower && !meta.defeated.includes(defeated.id)) {
      meta.defeated.push(defeated.id);
      saveMeta();
    }
    // Recompensa de Log Poses al derrotar enemigos en historia
    if (run && !b.tower) {
      if (b.opts.boss) {
        const fame = bossFameReward(run.diff);
        trackJourneyRewards(fame);
        gainFame(fame);
        b.bossFameEarned = (b.bossFameEarned || 0) + fame;
        log(`🏅 ${charName(defeated)}: +${fame} ⭐ Fama`);
      }
      const logPosesWon = enemyLogPoseReward(defeated, b.opts, run.saga || 0);
      trackJourneyRewards(0, logPosesWon);
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
    refreshHPCards();
    return setTimeout(() => endBattle(true), 1300 / b.speed);
  }
  if (!np) {
    b.over = true;
    refreshHPCards();
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
        if (b.opts?.challenge) {
          modalConfirm('¿Rendirse en este combate?', 'Contará como derrota en este cruce. Si pierdes una semifinal del torneo individual, podrás luchar por el tercer puesto.', () => {
            if (battle !== b || b.over) return;
            b.over=true; clearTimeout(b.timer); endBattle(false);
          });
          return;
        }
        modalConfirm('🏳️ ¿Rendirse en la torre?',
          'Terminarás tu ascenso en el piso actual.<br>Conservas la Fama ganada por los pisos superados.',
          () => { if (battle) { battle.over = true; clearTimeout(battle.timer); } towerGameOver(); });
        return;
      }
      if (b.waiting) return;
      if (kind === 'item') {
        useBattleItem(arg);
      } else if (kind === 'run') {
        confirmBattleFlee();
      }
    };
  });
}

function cycleBattleSpeed() {
  const b = battle;
  if (b?.over || (!b && !run)) return;
  autoSpeed = { 1: 2, 2: 4, 4: 1 }[b ? b.speed : preferredCombatSpeed()] || 1;
  combatSpeedOverride = autoSpeed;
  if (b) { b.speed = autoSpeed; refreshControls(); }
  const button = $('#btn-map-speed');
  if (button) {
    button.textContent = `⏩ x${autoSpeed}`;
    button.setAttribute('aria-label', `Velocidad de combate x${autoSpeed}`);
  }
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
  if (b.pendingStep) { const s = b.pendingStep; b.pendingStep = null; b.timer = setTimeout(s, 500 / b.speed); }
  else scheduleRound(delay == null ? 900 : delay);
}

function useBattleItem(id) {
  if (battle?.opts?.challenge) return;
  const item = ITEMS[id];
  const b = battle;
  if (!isBattleItem(id) || !b || b.over || b.waiting || !(b.items[id] > 0)) return;
  if (item.kind === 'heal') {
    const f = b.curP;
    if (!f || f.hp <= 0) return toast('No hay un nakama activo consciente.');
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
  } else if (item.kind === 'battleBoost') {
    const f = b.curP;
    if (!f || f.hp <= 0) return toast('No hay un nakama activo consciente.');
    const buffs = b.itemBuffs.get(f) || {};
    if (buffs[item.stat]) return toast(`${charName(f)} ya tiene esta mejora durante el combate.`);
    b.items[id]--;
    b.itemBuffs.set(f,{...buffs,[item.stat]:item.val});
    log(`${item.emoji} ${charName(f)} usa ${item.name}: +${item.val * 100}% hasta el final del combate.`);
  }
  if (!b.tower) saveRun();
  refreshHPCards();
  refreshControls();
}

function confirmBattleFlee() {
  const b = battle;
  if (!b || b.over || b.waiting || !b.opts.wild || b.tower) return;
  pauseBattle();
  let settled = false;
  const finish = flee => {
    if (settled || battle !== b || b.over) return;
    settled = true;
    if (flee) tryFlee(); else resumeBattle();
  };
  modalConfirm('🏃 ¿Intentar huir?',
    'Si escapas, abandonarás este combate sin su recompensa. La huida tiene un 70 % de probabilidad de éxito; si falla, el combate continúa. ¿Quieres intentarlo?',
    () => finish(true), () => finish(false));
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

function enemyLogPoseReward(enemy, opts, sagaIdx) {
  const kind = opts.boss || CHARS[enemy.id]?.boss ? 'boss' : opts.marine ? 'marine' : 'pirate';
  return {pirate:3,marine:4,boss:7}[kind] * (sagaIdx + 1);
}
function encounterBerries(opts, sagaIdx, islandIdx) {
  const base = opts.marine ? rnd(240,420) : rnd(80,160);
  return Math.floor(base * (islandIdx + 1) * (1 + sagaIdx * .25));
}

function bossFameReward(diff = 1) {
  const difficulty = DIFFICULTIES.find(d => d.id === diff) || DIFFICULTIES[0];
  return Math.round(40 * difficulty.mult);
}

function endBattle(victory, fled, recruited) {
  if (battle?.opts?.challenge) { clearTimeout(battle.timer); battle = null; document.querySelectorAll?.('.dmg-pop').forEach(el=>el.remove()); return endChallengeBattle(victory); }
  if (battle && battle.tower) { battle = null; return endTowerBattle(victory); }
  const opts = battle ? battle.opts : {};
  const bossFame = battle?.bossFameEarned || 0;
  battle = null;
  if (run && run.mode === 'nuzlocke') {
    run.team = run.team.filter(f => f && f.hp > 0);
  }
  const notes = [];
  if (victory) {
    // cada enfrentamiento ganado sube 1 nivel completo a toda la banda viva
    run.team.forEach(f => { if (f.hp > 0) gainXP(f, xpForLevel(f.lvl)); });
    notes.push('⬆️ +1 nivel a la banda');
  }
  if (victory && opts.reward) {
    run.berries += opts.reward;
    notes.push(`+${berriesHTML(opts.reward)}`);
  } else if (victory && (opts.wild || opts.marine) && !recruited) {
    const b = encounterBerries(opts, run.saga || 0, run.islandIdx);
    run.berries += b;
    notes.push(`+${berriesHTML(b)}`);
  }
  if (notes.length) toast(notes.join(' · '));
  if (victory && opts.boss) {
    if (run.islandComplete) return screenMap();
    run.islandComplete = true;
    run.badges.push(run.islandIdx);
    const completed = completedIslands(run.saga,run.mode,run.diff || 1);
    meta.islandProgress ||= {};
    meta.islandProgress[islandProgressKey(run.saga,run.mode,run.diff || 1)] = [...new Set([...completed,run.islandIdx])];
    meta.lastCompletedIsland = {saga:run.saga, index:run.islandIdx, mode:run.mode, diff:run.diff || 1};
    meta.totalIslands = (meta.totalIslands || 0)+1;
    trackSagaStat('islands');
    const newVets = unlockRoster(true);
    if (newVets.length > 0) {
      toast(`🎉 ¡${newVets.map(id => CHARS[id] ? CHARS[id].name : id).join(', ')} desbloqueado/s para tu plantilla permanente!`);
    }
    const saga = SAGAS[run.saga];
    // Al vencer al jefe de la isla (en modo Clásico), toda la banda (incluyendo caídos) se recupera al 100% de PS
    run.team.forEach(f => { f.hp = f.maxhp; });
    if (run.islandIdx >= saga.islands.length - 1) {
      saveRun();
      return sagaComplete();
    }
    if(finishIslandRepeat('win'))return;
    const sagaIdx = run.saga, islandIdx = run.islandIdx;
    storyMode = run.mode; selectedDiff = run.diff || 1;
    autoMode = false;
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    const rewardsHTML = journeyRewardsHTML();
    clearRun();
    modalInfo('🏅 ¡Emblema conseguido!',
      `${rewardsHTML}<div class="reward-list">¡Has completado ${saga.islands[islandIdx].name}!<br>+${bossFame} ⭐ Fama<br><br>Desbloqueada: <b>${saga.islands[islandIdx+1].name}</b> 🧭<br>Elige la siguiente isla y prepara tu equipo.${newVets.length ? `<br><br><small>🏅 Nakamas permanentes:<br>${newVets.map(id => `${charIcon(id, 16)} ${CHARS[id].name}`).join(' · ')}</small>` : ''
      }</div>`,
      () => screenIslands(sagaIdx));
    return;
  }
  saveRun();
  screenMap();
}

function pirateKingLegendaryPool(sagaId) {
  return Object.keys(CHARS).filter(id => CHARS[id].saga === sagaId && CHARS[id].rareza === 5 && !BASE_OF[id]);
}
function finishRetiredJourney() {
  if (!run?.retiredFinalReward || !run.islandComplete || run.islandIdx !== SAGAS[run.saga]?.islands.length - 1) return false;
  delete run.retiredFinalReward; sagaComplete(); return true;
}
function preparePirateKingRewards(progress) {
  progress.pirateKingRewards ||= {};
  for (const saga of SAGAS) if (progress.sagaDiffWins?.[saga.id]?.[5] && !Object.hasOwn(progress.pirateKingRewards, saga.id)) {
    progress.pirateKingRewards[saga.id] = 'pending';
  }
}
function pendingPirateKingRewards() {
  return SAGAS.map(s => s.id).filter(id => meta.pirateKingRewards?.[id] === 'pending');
}
function claimPirateKingReward(sagaId, id) {
  if (meta.pirateKingRewards?.[sagaId] !== 'pending' || !pirateKingLegendaryPool(sagaId).includes(id)) return false;
  const before = { roster: meta.roster, recruited: meta.recruited, dex: meta.dex, pirateKingRewards: meta.pirateKingRewards };
  for (const key of ['roster','recruited','dex']) meta[key] = [...new Set([...(meta[key] || []), id])];
  meta.pirateKingRewards = { ...meta.pirateKingRewards, [sagaId]: id };
  if (saveMeta() === false) { Object.assign(meta, before); return false; }
  return true;
}
function showPirateKingReward(sagaId, done = () => {}) {
  if (meta.pirateKingRewards?.[sagaId] !== 'pending' || document.querySelector('#pirate-king-reward')) return;
  autoMode = false; clearTimeout(autoTimer); autoTimer = null;
  const saga = SAGAS.find(s => s.id === sagaId), pool = pirateKingLegendaryPool(sagaId);
  const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'pirate-king-reward';
  ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-labelledby','king-reward-title');
  ov.innerHTML = `<div class="modal"><h2 id="king-reward-title">👑 Legendario de ${saga.name}</h2>
    <p>Has conquistado esta saga en Rey Pirata. Elige un legendario para tu cuenta. Esta recompensa solo se concede una vez por saga, compartida entre Clásico y Nuzlocke.</p>
    <div class="pick-grid">${pool.map(id => `<button class="pick-row" data-legendary="${id}"><span class="emoji">${charIcon(id,64)}</span><span class="info"><b>${CHARS[id].name}</b><br>⭐⭐⭐⭐⭐<br>${meta.roster.includes(id) ? 'Ya en tu cuenta · no añade otra copia' : 'Desbloquear para tu cuenta'}</span></button>`).join('')}</div>
    <p id="king-reward-status" role="status"></p><button class="btn gray" id="king-reward-later">Elegir más tarde</button></div>`;
  document.body.appendChild(ov);
  const previousFocus = document.activeElement, previousInert = app.inert;
  app.inert = true;
  let closed = false;
  const onKey = event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const buttons = [...ov.querySelectorAll('button')], first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };
  const close = () => {
    if (closed) return; closed = true;
    document.removeEventListener('keydown', onKey); app.inert = previousInert; ov.remove(); done();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  document.addEventListener('keydown', onKey);
  ov.querySelector('#king-reward-later').onclick = close;
  ov.querySelectorAll('[data-legendary]').forEach(button => {
    button.onclick = () => {
      if (!claimPirateKingReward(sagaId, button.dataset.legendary)) {
        ov.querySelector('#king-reward-status').textContent = 'No se pudo guardar la elección. La recompensa sigue pendiente.'; return;
      }
      toast(`👑 ${CHARS[button.dataset.legendary].name} está en tu inventario.`); close();
    };
  });
  ov.querySelector('[data-legendary]')?.focus();
}

function sagaComplete() {
  if (!run || ((run.diff || 1) === 5 && (!run.islandComplete || run.islandIdx !== SAGAS[run.saga]?.islands.length - 1))) return;
  if(run?.islandRepeat?.result)return showIslandRepeatCheckpoint(autoMode);
  const continueRepeat=autoMode;
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
    trackSagaStat('all_nakama_wins');
  }

  meta.sagaDiffWins = meta.sagaDiffWins || {};
  meta.sagaDiffWins[saga.id] = meta.sagaDiffWins[saga.id] || {};

  const isFirstDiffWin = !meta.sagaDiffWins[saga.id][diffLevel];
  meta.sagaDiffWins[saga.id][diffLevel] = true;
  if (diffLevel === 5 && isFirstDiffWin && run.islandIdx === saga.islands.length - 1 && run.islandComplete) {
    meta.pirateKingRewards ||= {};
    if (!Object.hasOwn(meta.pirateKingRewards, saga.id)) meta.pirateKingRewards[saga.id] = 'pending';
  }

  const baseFame = 500;
  let fameWon = 0;
  let rewardMessage = '';

  if (isFirstDiffWin) {
    fameWon = Math.round(baseFame * dObj.mult);
    rewardMessage = `<div style="color:var(--green);font-size:9px;margin-top:6px;">🎉 ¡Primera victoria en Dificultad <span class="native-difficulty">${dObj.emoji}</span> ${dObj.name}! Recompensa completa: +${fameWon} ⭐ Fama</div>`;
  } else {
    fameWon = Math.round(baseFame * dObj.mult * 0.2);
    rewardMessage = `<div style="color:var(--accent);font-size:8px;margin-top:6px;">⚠️ Ya habías conquistado esta saga en Dificultad ${dObj.name}. Recompensa reducida: +${fameWon} ⭐ Fama.<br>¡Cambia a otra dificultad para ganar la recompensa completa!</div>`;
  }

  trackJourneyRewards(fameWon);
  gainFame(fameWon);

  // Guarda la banda completa (incluyendo legendarios/jefes) en meta.roster
  const addedLegendaries = unlockRoster(true);
  saveMeta();
  const legendaryPending = meta.pirateKingRewards?.[saga.id] === 'pending';
  if(finishIslandRepeat('win',continueRepeat && !legendaryPending)) {
    if (legendaryPending) showPirateKingReward(saga.id);
    return;
  }
  const team = run.team;
  const rewardsHTML = journeyRewardsHTML();
  clearRun();
  render(`
    ${topbar(false)}
    <div class="panel" style="text-align:center;">
      <h2>🏴‍☠️ ¡SAGA CONQUISTADA!</h2>
      <p style="margin:14px 0;">¡Has derrotado a todos los capitanes del ${saga.name} en Dificultad <b><span class="native-difficulty">${dObj.emoji}</span> ${dObj.name}</b>!<br>
      Tu banda ya es leyenda en este mar.<br><br>
      <span style="font-size:30px;">${team.map(f => charIcon(f.id, 38)).join(' ')}</span><br><br>
      ${team.map(f => `${charName(f)}${f.stars ? ` ⭐${f.stars}` : ''} Nv${f.lvl}`).join(' · ')}<br><br>
      ${rewardMessage}</p>
      ${rewardsHTML}
      <p style="font-size:9px;color:#666;margin-bottom:14px;">Tus nakamas ${addedLegendaries.length ? '(¡incluyendo legendarios!) ' : ''}quedan disponibles como veteranos para próximas aventuras.<br></p>
      <button class="btn green" id="btn-fin">VOLVER AL PUERTO</button>
    </div>
  `);
  $('#btn-fin').onclick = screenHome;
  if (legendaryPending) showPirateKingReward(saga.id);
}

function gameOver() {
  const continueRepeat=autoMode;
  autoMode = false;
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
  playMusic('dead');
  battle = null;
  const retry = islandRetrySpec(run);
  const wasNuz = run && run.mode === 'nuzlocke';
  const consuelo = run ? run.badges.length * 10 : 0;
  trackJourneyRewards(consuelo);
  if (consuelo) gainFame(consuelo);
  if(finishIslandRepeat('loss',continueRepeat))return;
  const rewardsHTML = journeyRewardsHTML();
  clearRun();
  render(`
    ${topbar(false)}
    <div class="panel" style="text-align:center;">
      <h2>☠️ FIN DEL VIAJE</h2>
      <p style="margin:14px 0;">Toda tu banda ha sido derrotada.<br>
      ${wasNuz ? 'Las reglas Nuzlocke no perdonan...' : 'El mar es implacable, pero siempre puedes volver a zarpar.'}
      ${consuelo ? `<br><br>Tu hazaña no se olvida: +${consuelo} ⭐ Fama` : ''}</p>
      ${rewardsHTML}
      <div class="actions" style="flex-wrap:wrap;justify-content:center;">
        ${retry ? '<button class="btn green" id="btn-retry-island">🔄 VOLVER A INTENTAR</button>' : ''}
        <button class="btn red" id="btn-fin">VOLVER AL PUERTO</button>
      </div>
    </div>
  `);
  $('#btn-fin').onclick = screenHome;
  if (retry) {
    let used = false;
    $('#btn-retry-island').onclick = () => { if (!used) { used = true; retryIsland(retry); } };
  }
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
  const previews = Object.fromEntries(pool.map(id => [id, applyUpgrades(makeChar(id, startLvl))]));
  render(`
    ${topbar(false)}
    <button class="btn gray small back-btn" id="btn-back">← VOLVER</button>
    <div class="panel tower-selection">
      <h2>🗼 Torre Marine ${start50 ? '<span style="color:var(--gold);font-size:12px;">(Piso 50)</span>' : ''}</h2>
      <p>Combates automáticos infinitos contra oleadas cada vez más fuertes.
      Elige a <b>3 nakamas desbloqueados</b> (salen a Nv.${startLvl}, con sus mejoras del Barco)
      y recibe 3 Platos de Sanji. ${start50 ? '<b>¡Inicias tu ascenso directamente en el Piso 50!</b>' : '¿Hasta qué piso llegarás?'}</p>
      <p style="margin-top:10px;">Récord actual: <b>${meta.towerRecord}</b> pisos</p>
      <div class="tower-selection-bar"><div id="tower-picked" aria-live="polite"></div><div id="tower-synergies"></div></div>
      <label class="tower-search" for="tower-search">Buscar nakama<input type="search" id="tower-search" placeholder="Nombre o tipo"></label>
      <p id="tower-results" role="status">${pool.length} nakamas disponibles</p>
      <div class="tower-roster">
        ${pool.map(id => {
    const f = previews[id], c = CHARS[f.id];
    return `<button type="button" class="tower-card" data-tower="${id}" aria-pressed="false">
            <span class="emoji">${charIcon(f.id, 64)}</span>
            <b>${c.name}</b><span class="tower-rarity">${'⭐'.repeat(c.rareza)} · Nv. ${startLvl}</span>
            <span class="type-badges">${typeBadges(fighterTypes(f))}</span>
            <span class="tower-stats">♥ ${f.maxhp} PS · ⚔ ${f.atk} ATQ</span>
            <span class="tower-check">Añadir al equipo</span>
          </button>`;
  }).join('')}
      </div>
      <div class="actions tower-launch" style="text-align:center;margin-top:14px;">
        <button class="btn blue" id="btn-start" disabled>ELIGE 3 NAKAMAS (0/3)</button>
      </div>
    </div>
  `);
  $('#btn-back').onclick = screenHome;
  const startBtn = $('#btn-start');
  const updateSelection = () => {
    document.querySelectorAll('[data-tower]').forEach(r => {
      const selected = picked.includes(r.dataset.tower);
      r.setAttribute('aria-pressed', String(selected));
      r.disabled = !selected && picked.length === 3;
      r.querySelector('.tower-check').textContent = selected ? '✓ Seleccionado · Quitar' : 'Añadir al equipo';
    });
    $('#tower-picked').innerHTML = `<b>Tu equipo · ${picked.length}/3</b><div class="tower-picked-slots">${[0,1,2].map(i => picked[i] ? `<button class="btn gray" data-tower-remove="${picked[i]}">${charIcon(previews[picked[i]].id,32)} ${CHARS[previews[picked[i]].id].name} ×</button>` : `<span class="tower-empty-slot">${i+1}. Elige un nakama</span>`).join('')}</div>`;
    $('#tower-picked').querySelectorAll('[data-tower-remove]').forEach(button => button.onclick = () => {picked.splice(picked.indexOf(button.dataset.towerRemove),1);updateSelection();});
    $('#tower-synergies').innerHTML = activeSynergiesHTML(picked.map(id => previews[id]));
    startBtn.disabled = picked.length !== 3;
    startBtn.textContent = picked.length === 3 ? '¡SUBIR A LA TORRE!' : `ELIGE 3 NAKAMAS (${picked.length}/3)`;
  };
  $('#tower-search').oninput = e => {
    const query = e.target.value.trim().toLocaleLowerCase('es');
    let visible = 0;
    document.querySelectorAll('[data-tower]').forEach(card => {
      const f = previews[card.dataset.tower];
      card.hidden = !`${CHARS[f.id].name} ${fighterTypes(f).join(' ')}`.toLocaleLowerCase('es').includes(query);
      if (!card.hidden) visible++;
    });
    $('#tower-results').textContent = visible ? `${visible} nakamas disponibles` : 'No hay nakamas con esta búsqueda.';
  };
  document.querySelectorAll('[data-tower]').forEach(el => {
    el.onclick = () => {
      const id = el.dataset.tower;
      const i = picked.indexOf(id);
      if (i >= 0) picked.splice(i, 1);
      else if (picked.length < 3) picked.push(id);
      updateSelection();
    };
  });
  updateSelection();
  startBtn.onclick = () => {
    if (picked.length !== 3) return;
    tower = { floor: startFloor, team: picked.map(id => applyUpgrades(makeChar(id, startLvl))), items: { bocadillo: 3, sake: 1 } };
    prepareBackpack(tower);
    if (hasPendingLoot(tower)) showTowerBackpack(towerNextBattle); else towerNextBattle();
  };
}

function towerNextBattle() {
  let highestSaga = 0;
  SAGAS.forEach((_, i) => { if (sagaUnlocked(i)) highestSaga = i; });
  const availableSagas = new Set(SAGAS.slice(0, highestSaga + 1).map(s => s.id));
  // sin formas evolucionadas; solo personajes de las sagas desbloqueadas
  const pool = Object.keys(CHARS).filter(id => !BASE_OF[id] && availableSagas.has(CHARS[id].saga));
  const lvl = 13 + tower.floor * 2;
  const isBossFloor = tower.floor % 5 === 0;
  const bossIds = Object.keys(CHARS).filter(id => CHARS[id].boss && availableSagas.has(CHARS[id].saga));
  const id = isBossFloor ? pick(bossIds) : pick(pool);
  const enemy = makeChar(id, lvl + (isBossFloor ? 2 : 0), false, true);
  startBattle([enemy], {
    wild: false, tower: true,
    intro: `🗼 Piso ${tower.floor} — ¡${CHARS[id].name} te desafía!`,
  });
}

function endTowerBattle(victory) {
  if (!victory) return towerGameOver();
  tower.team.forEach(f => {
    if (f.hp > 0) {
      gainXP(f, xpForLevel(f.lvl)); // +1 nivel por piso conservando EXP
      gainXP(f, 30 + tower.floor * 6);
      f.hp = Math.min(f.maxhp, f.hp + Math.floor(f.maxhp * 0.3));
    }
  });
  tower.floor++;
  if (tower.floor % 3 === 0) receiveBackpackItem(tower,'bocadillo');
  if (hasPendingLoot(tower)) showTowerBackpack(towerNextBattle); else towerNextBattle();
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
      desc: 'Los seis huecos están disponibles.',
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
const shipTraining = { selected: null, saga: '', teamOnly: false, page: 0 };
function groupUpgradeRoster(ids) {
  const groups = [...SAGAS.map(s => ({id:s.id,name:s.name})), {id:'other',name:'OTROS'}];
  const known = new Set(groups.map(g => g.id));
  return groups.map(g => ({...g,ids:ids.filter(id => {
    const saga = CHARS[id]?.saga;
    return (known.has(saga) ? saga : 'other') === g.id;
  })})).filter(g => g.ids.length);
}

function upgCost(lvl) { return 30 + lvl * 10; }

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
  if (!run?.team?.length) shipTraining.teamOnly = false;
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

  render(`
    ${topbar(false)}
    <div class="shop-sticky-bar">
      <button class="btn gray small back-btn" id="btn-back">← VOLVER</button>
      <output class="shop-fame" aria-label="Fama disponible" aria-live="polite">⭐ ${meta.fame.toLocaleString('es')} Fama</output>
    </div>
    <div class="panel">
      <h2>🏪 Tienda</h2>
      <p>Mejoras permanentes · Cuenta Nv${accLvl}</p>
      <section class="ship-training" aria-label="Entrenamiento de nakamas">
        <h2>Entrena a tu tripulación</h2>
        <p>Elige un retrato y mejora sus stats.</p>
        <div class="training-filters">
          <input id="ship-search-q" aria-label="Buscar nakama" placeholder="Buscar nakama…" value="${(shipSearchQ || '').replace(/"/g, '&quot;')}">
          <select id="ship-training-saga" aria-label="Filtrar por saga">
            <option value="">Todas las sagas</option>
            ${groupUpgradeRoster(roster).map(g => `<option value="${g.id}" ${shipTraining.saga === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}
          </select>
          <button class="btn small gray" id="ship-training-team" aria-pressed="${shipTraining.teamOnly}" ${run?.team?.length ? '' : 'disabled'}>Mi equipo</button>
        </div>
        <div id="ship-roster-list"></div>
      </section>


      <h2 style="font-size:11px;">👥 Casillas de Nakamas Iniciales</h2>
      <div class="global-upg-row ${nextSlot.maxed ? 'owned' : accLvl < nextSlot.lvl ? 'locked' : ''}">
        <span class="upg-emoji">${nextSlot.emoji}</span>
        <div class="upg-details">
          <div class="upg-head">
            <b class="upg-name">${nextSlot.name}</b>
            ${nextSlot.maxed ? '' : `<span class="price">⭐${nextSlot.cost}</span>`}
          </div>
          <div class="upg-desc">${starterSlotsCount()}/6 huecos disponibles${nextSlot.maxed ? "" : ` · Próximo: ${nextSlot.nextN}`}</div>
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
          <div class="upg-desc">Entrenamiento: Nv.${nextCap.curMax} → ${nextCap.nextMax}</div>
        </div>
        <div class="upg-action">
          ${accLvl < nextCap.lvl ? `<span class="upg-badge locked">🔒 Cuenta Nv${nextCap.lvl}</span>`
      : `<button class="btn small ${meta.fame >= nextCap.cost ? 'green' : 'gray'}" id="btn-buy-capitania" ${meta.fame >= nextCap.cost ? '' : 'disabled'}>COMPRAR (+5 NV)</button>`}
        </div>
      </div>

      <h2 style="font-size:11px;margin-top:14px;">🌍 Añadidos globales</h2>
      <div class="global-upg-grid">
        <div class="global-upg-row">
          <span class="upg-emoji">🎒</span><div class="upg-details"><b class="upg-name">Ampliar ambas mochilas</b>
            <div class="upg-desc">${backpackCapacity()} casillas cada una · Pilas de ${backpackStackLimit()} · ${backpackCapacity() < 60 ? '+3 casillas en cada mochila y +1 unidad por pila' : 'Capacidad máxima'}</div>
            ${backpackCapacity() < 60 ? `<span class="price">⭐${backpackUpgradeCost()} Fama</span>` : ''}</div>
          <div class="upg-action"><button class="btn small green" id="btn-buy-backpack" ${backpackCapacity() >= 60 || meta.fame < backpackUpgradeCost() ? 'disabled' : ''}>${backpackCapacity() >= 60 ? 'MÁXIMO' : 'AMPLIAR +3'}</button></div>
        </div>
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


    </div>
  `);

  const renderRosterUI = () => {
    const q = (shipSearchQ || '').trim().toLocaleLowerCase('es');
    const teamIds = new Set((run?.team || []).map(f => baseFormOf(f.id)));
    const filteredRoster = groupUpgradeRoster(roster)
      .filter(g => !shipTraining.saga || g.id === shipTraining.saga)
      .flatMap(g => g.ids)
      .filter(id => (!shipTraining.teamOnly || teamIds.has(baseFormOf(id))) && CHARS[id].name.toLocaleLowerCase('es').includes(q));
    const container = $('#ship-roster-list');
    if (!container) return;
    const pageSize = 8;
    const pages = Math.max(1, Math.ceil(filteredRoster.length / pageSize));
    shipTraining.page = Math.min(shipTraining.page, pages - 1);
    if (!filteredRoster.includes(shipTraining.selected)) shipTraining.selected = filteredRoster[0] || null;
    const visible = filteredRoster.slice(shipTraining.page * pageSize, (shipTraining.page + 1) * pageSize);
    const fame = document.querySelector('.shop-fame');
    if (fame) fame.textContent = `⭐ ${meta.fame.toLocaleString('es')} Fama`;
    document.querySelectorAll('[data-global],#btn-buy-starter-slot,#btn-buy-capitania').forEach(btn => {
      const item = btn.dataset.global ? GLOBAL_ITEMS[btn.dataset.global] : btn.id === 'btn-buy-starter-slot' ? nextSlot : nextCap;
      const can = !item.maxed && !(btn.dataset.global && meta.global[btn.dataset.global]) && accLvl >= item.lvl && meta.fame >= item.cost;
      btn.disabled = !can;
      btn.classList.toggle('green', can);
      btn.classList.toggle('gray', !can);
    });

    const cardHTML = id => {
      const c = CHARS[id];
      const u = meta.upgrades[id] || {};
      const isExpanded = true;
      const totalStats = UPG_STATS.reduce((acc, [st]) => acc + (u[st] || 0), 0);
      const totalSpent = charTotalUpgSpent(id);
      const refund = Math.floor(totalSpent * 0.5);
      return `<div class="ship-card-acc">
        <div class="ship-card-header">
          <span class="emoji">${charIcon(id, 28)}</span>
          <div style="flex:1;">
            <b>${c.name}</b> ${typeBadges(c.types)}<br>
            <small style="color:#666;font-size:7px;">Stats mejorados: <b>${totalStats}</b> (Límite: Nv${maxLvl})</small>
          </div>
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
                  <span class="upg-label">${label} ${lvl}/${maxLvl}</span><small class="training-gain">${desc}</small>
                  <button class="btn small ${can ? 'green' : 'gray'}" data-up="${id}" data-stat="${stat}"
                    aria-label="Mejorar ${label} de ${c.name}: ${desc}, ${cost} Fama" title="${desc}" ${can ? '' : 'disabled'}>${maxed ? 'MÁX' : `⭐${cost}`}</button>
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
    container.innerHTML = `<div class="training-layout">
      <div class="training-picker">
        <div class="training-portraits">${visible.map(id => `<button type="button" class="training-portrait" data-train="${id}" aria-pressed="${id === shipTraining.selected}">
          ${charIcon(id,48)}<span>${CHARS[id].name}</span><small>${'⭐'.repeat(CHARS[id].rareza)}</small>
        </button>`).join('') || '<p>No hay nakamas con estos filtros.</p>'}</div>
        <nav class="training-pages" aria-label="Páginas de nakamas">
          <button class="btn small gray" data-training-page="-1" aria-label="Página anterior" ${shipTraining.page === 0 ? 'disabled' : ''}>←</button>
          <span aria-live="polite">${shipTraining.page + 1} / ${pages} · ${filteredRoster.length} nakamas</span>
          <button class="btn small gray" data-training-page="1" aria-label="Página siguiente" ${shipTraining.page >= pages - 1 ? 'disabled' : ''}>→</button>
        </nav>
      </div>
      <div class="training-detail" aria-label="Stats del nakama seleccionado">${shipTraining.selected ? cardHTML(shipTraining.selected) : '<p>Cambia los filtros para elegir un nakama.</p>'}</div>
    </div>`;
    container.querySelectorAll('[data-train]').forEach(btn => {
      btn.onclick = () => {
        shipTraining.selected = btn.dataset.train;
        renderRosterUI();
        container.querySelector(`[data-train="${shipTraining.selected}"]`)?.focus({preventScroll:true});
      };
    });
    container.querySelectorAll('[data-training-page]').forEach(btn => {
      btn.onclick = () => {
        const direction = btn.dataset.trainingPage;
        shipTraining.page += Number(direction);
        renderRosterUI();
        const next = container.querySelector(`[data-training-page="${direction}"]`);
        (next?.disabled ? container.querySelector('[data-train]') : next)?.focus({preventScroll:true});
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
        renderRosterUI();
        container.querySelector(`[data-up="${id}"][data-stat="${stat}"]`)?.focus({preventScroll:true});
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
          renderRosterUI();
        });
      };
    });
  };

  renderRosterUI();

  $('#btn-back').onclick = screenHome;
  const searchInput = $('#ship-search-q');
  if (searchInput) searchInput.oninput = e => { shipSearchQ = e.target.value; shipTraining.page = 0; renderRosterUI(); };
  $('#ship-training-saga').onchange = e => { shipTraining.saga = e.target.value; shipTraining.page = 0; renderRosterUI(); };
  $('#ship-training-team').onclick = e => {
    shipTraining.teamOnly = !shipTraining.teamOnly;
    shipTraining.page = 0;
    e.currentTarget.setAttribute('aria-pressed', String(shipTraining.teamOnly));
    renderRosterUI();
  };

  const backpackBtn = $('#btn-buy-backpack');
  if (backpackBtn) backpackBtn.onclick = () => {
    if (Date.now() - shipBuyLock < 300) return;
    shipBuyLock = Date.now();
    if (!buyBackpackUpgrade()) return;
    screenShip();
    toast(`🎒 Ambas mochilas ampliadas a ${backpackCapacity()} casillas cada una y pilas de ${backpackStackLimit()}.`);
  };
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
    <div class="dex-rarity" style="font-size:7px;" aria-label="Rareza ${c.rareza} de 5 estrellas"><span class="dex-rarity-full" aria-hidden="true">${'⭐'.repeat(c.rareza)}</span><span class="dex-rarity-compact" aria-hidden="true">★ ${c.rareza}/5</span></div>
    ${vet ? '<div style="color:var(--accent)">🏅 veterano</div>' : got ? '<div style="color:var(--green)">✓ nakama</div>' : (seen ? '<div style="color:#999">visto</div>' : '<div style="color:#aaa">sin avistar</div>')}
  </div>`;
}

function screenDex() {
  playMusic('menu');
  const all = Object.keys(CHARS);
  const sagaOpts = [...SAGAS.map(s => ({ id: s.id, name: s.name }))];
  render(`
    ${topbar(false)}
    <button class="btn gray small back-btn" id="btn-back">← VOLVER</button>
    <div class="panel pirate-dex">
      <header class="dex-header"><h2>📖 Dex Pirata</h2><div class="dex-progress" aria-label="Progreso de la colección"><span><strong>${meta.dex.length} <small>/ ${all.length}</small></strong>Avistados</span><span><strong>${meta.recruited.length}</strong>Reclutados</span></div></header>
      ${charControlsHTML(dexView, { sagas: sagaOpts })}
      <div id="char-grid"></div>
      <p class="dex-help">Toca un personaje avistado para abrir su ficha. Los no avistados solo muestran su nombre.</p>
    </div>
  `);
  $('#btn-back').onclick = screenHome;
  // Orden original: agrupado por saga, respetando el orden de definición
  const sagaOrder = {};
  SAGAS.forEach((s, i) => { sagaOrder[s.id] = i; });
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

// Todos los miembros vivos de una pareja tienen turno, ordenado por velocidad.
function runChallengeDuoRound() {
  const b=battle;
  if(!b||b.over||b.waiting)return;
  const order=[...b.pTeam,...b.eTeam].filter(f=>f.hp>0).sort((a,c)=>effectiveSpeed(c)-effectiveSpeed(a));
  let index=0;
  const step=()=>{
    if(battle!==b||b.over)return;
    if(b.waiting){b.pendingStep=step;return;}
    b.pendingStep=null;
    if(index>=order.length)return afterRound();
    const actor=order[index++],isPlayer=b.pTeam.includes(actor);
    const foes=isPlayer?b.eTeam:b.pTeam;
    const target=foes.filter(f=>f.hp>0).sort((a,c)=>a.hp/a.maxhp-c.hp/c.maxhp)[0];
    if(actor.hp>0&&target){
      if(isPlayer){b.curP=actor;b.curE=target;}else{b.curE=actor;b.curP=target;}
      refreshHPCards();
      if(actor.lvl>=20&&(actor.ultCharge||0)>=100)useUltimate(actor);
      else attackWith(actor,target,chooseMove(actor,target),isPlayer?'enemy':'player');
    }
    b.pendingStep=step;b.timer=setTimeout(step,900/b.speed);
  };
  step();
}
function afterChallengeRound(b) {
  const p=activeP(),e=activeE();
  if(!p||!e){
    b.over=true;refreshHPCards();
    b.timer=setTimeout(()=>{if(battle===b)endBattle(!!p&&!e);},1300/b.speed);
    return;
  }
  b.curP=p;b.curE=e;b.round++;
  refreshHPCards();scheduleRound(1400);
}

// ============ DESAFÍOS Y RELIQUIAS ============
const RELIC_BOOST = '+10% ATQ, ESP.ATQ, DEF, ESP.DEF y VEL';
// Una reliquia por identidad; sus transformaciones comparten afinidad y hueco.
const SIGNATURE_RELICS = {
  luffy: ['Sombrero de la Promesa','👒','Libertad sin límites','Con menos del 50% de PS, +30% de daño.', {lowDamage:1.30}],
  zoro: ['Piedra de afilar de Kuina','⚔️','Promesa del espadachín','+15 puntos de crítico y +25% de daño crítico.', {critical:.15,critDamage:.25}],
  nami: ['Aguja del Clima-Tact','🌩️','Pronóstico perfecto','+25% de daño de Rayo y +10 puntos de evasión.', {type:'Rayo',damage:1.25,evasion:.10}],
  usopp: ['Semilla del francotirador','🌱','Disparo preparado','+35% de daño contra rivales con todos sus PS.', {openingDamage:1.35}],
  sanji: ['Encendedor del All Blue','🔥','Pasión del cocinero','+25% de daño de Fuego; recupera 3% de PS por ronda.', {type:'Fuego',damage:1.25,regen:.03}],
  chopper: ['Recetario de Hiriluk','💊','Medicina milagrosa','Cura 4% de los PS de cada aliado participante por ronda.', {teamRegen:.04}],
  robin: ['Fragmento de Ohara','📜','Conocimiento prohibido','Los ataques especiales ignoran 25% de defensa especial.', {specialPierce:.25}],
  franky: ['Reserva de cola','🥤','Superblindaje','Recibe 20% menos daño con más del 50% de PS.', {healthyReduction:.80}],
  brook: ['Tone Dial de Laboon','🎻','Canción de regreso','Empieza cada combate con 68% de carga de Ultimate.', {charge:68}],
  jinbe: ['Copa de los Piratas del Sol','🍶','Corriente protectora','+30% de daño de Agua y -10% de daño recibido.', {type:'Agua',damage:1.30,reduction:.90}],
  roger: ['Brújula del último viaje','🧭','Herencia del rey','Los aliados vivos infligen 12% más daño.', {teamDamage:1.12}],
  newgate: ['Fragmento de Murakumogiri','🌊','Terremoto paternal','Con menos del 50% de PS, +35% de daño.', {lowDamage:1.35}],
  kaido: ['Escama del dragón azul','🐉','Fortaleza de Onigashima','Con menos del 50% de PS recibe 25% menos daño.', {lowReduction:.75}],
  bigmom: ['Corona de los Homies','👑','Tributo de almas','Recupera 5% de PS por ronda y +20% de daño de Oscuridad.', {regen:.05,type:'Oscuridad',damage:1.20}],
  shanks: ['Guarda de Gryphon','⚔️','Presencia del emperador','Los aliados reciben 12% menos daño mientras viva.', {teamReduction:.88}],
  teach: ['Anillo de la oscuridad','🌑','Atracción del abismo','+30% de daño contra usuarios de Fruta.', {fruitDamage:1.30}],
  mihawk: ['Cruz de Yoru','✝️','Corte sin límites','Los ataques físicos ignoran 25% de defensa.', {physicalPierce:.25}],
  akainu: ['Corazón de magma','🌋','Justicia abrasadora','Cada golpe causa quemadura: 3% de PS durante 3 rondas.', {burn:.03}],
  kizaru: ['Lente de luz','✨','Destello encadenado','+25% de velocidad; empieza con 34% de Ultimate.', {speed:1.25,charge:34}],
  aokiji: ['Cristal de Ice Age','❄️','Frío persistente','Los golpes ralentizan un 30% durante la siguiente ronda.', {slow:.30}],
  garp: ['Guante del héroe','👊','Impacto galáctico','+25% de daño de Golpe y +10 puntos de crítico.', {type:'Golpe',damage:1.25,critical:.10}],
  dragon: ['Retazo revolucionario','🌪️','Viento de cambio','+10 puntos de evasión a todos los aliados vivos.', {teamEvasion:.10}],
  lucci: ['Pluma de Hattori','🕊️','Instinto del depredador','+30% de daño contra rivales con menos del 50% de PS.', {execute:1.30}],
  oden: ['Vaina de Enma','⚔️','Dos cielos','+25% de daño de Corte y +25% de daño crítico.', {type:'Corte',damage:1.25,critDamage:.25}],
  katakuri: ['Bufanda del futuro','🧣','Un segundo por delante','Esquiva un ataque adicional al inicio de cada combate.', {dodge:1}],
  enel: ['Aro de los tambores','🥁','Juicio de Skypiea','+35% de daño de Rayo.', {type:'Rayo',damage:1.35}],
  moria: ['Tijeras de sombras','✂️','Banquete de sombras','Recupera 5% de PS por ronda; +20% de daño de Oscuridad.', {regen:.05,type:'Oscuridad',damage:1.20}],
  sengoku: ['Rosario del Buda','📿','Guardia iluminada','Los aliados reciben 12% menos daño mientras viva.', {teamReduction:.88}],
  fujitora: ['Dado de la justicia','🎲','Órbita pesada','Ignora 20% de ambas defensas y ralentiza al golpear un 20%.', {pierce:.20,slow:.20}],
  rayleigh: ['Petaca del Rey Oscuro','🍶','Lección de Haki','+30% de daño de Haki y +10 puntos de crítico.', {type:'Haki',damage:1.30,critical:.10}],
  ryokugyu: ['Semilla del bosque','🌿','Bosque compartido','Cura 4% de los PS de cada aliado participante por ronda.', {teamRegen:.04}],
  garling: ['Medalla del caballero','🏅','Sentencia celestial','+35% de daño contra rivales con todos sus PS.', {openingDamage:1.35}],
  saturn: ['Sello del círculo abisal','🕸️','Persistencia abisal','Recupera 6% de PS por ronda.', {regen:.06}],
  mars: ['Pluma del Itsumade','🪶','Vuelo del presagio','+20% de velocidad y +10 puntos de evasión.', {speed:1.20,evasion:.10}],
  warcury: ['Colmillo del Hoki','🐗','Muralla viviente','Recibe 20% menos daño con más del 50% de PS.', {healthyReduction:.80}],
  nusjuro: ['Guarda del Bakotsu','❄️','Escarcha de acero','Los ataques físicos ignoran 20% de defensa y ralentizan un 20%.', {physicalPierce:.20,slow:.20}],
  jupeter: ['Fósil del gusano de arena','🪨','Hambre ancestral','+25% de daño de Tierra y recupera 4% de PS por ronda.', {type:'Tierra',damage:1.25,regen:.04}],
  im: ['Astilla del Trono Vacío','🖤','Dominio oculto','Ignora 25% de ambas defensas.', {pierce:.25}],
  xebec: ['Insignia de Rocks','☠️','Ambición desatada','Con menos del 50% de PS, +35% de daño.', {lowDamage:1.35}],
  joyboy: ['Tambor de la liberación','🥁','Ritmo de libertad','Los aliados vivos infligen 12% más daño.', {teamDamage:1.12}],
  smoker: ['Punta del jitte','🌫️','Cerco de humo','+25% de daño contra usuarios de Fruta y +10 puntos de evasión.', {fruitDamage:1.25,evasion:.10}],
};
const RELICS = Object.fromEntries(Object.entries(CHARS).filter(([id]) => !BASE_OF[id]).map(([id,c]) => {
  const moveId = c.ultimate || [...c.learnset].reverse().find(([,m]) => MOVES[m]?.power > 0)?.[1];
  const move = MOVES[moveId];
  const [name,emoji,passiveName,passiveDesc,rule] = SIGNATURE_RELICS[id] || [
    `Emblema de ${c.name}`, c.emoji, `Legado: ${move?.name || c.name}`,
    `+35% de daño al usar ${move?.name || 'su técnica característica'}.`, {move:moveId,damage:1.35}
  ];
  const key = `relic_${id}`;
  return [key,{id:key,character:id,name,emoji,desc:RELIC_BOOST,passiveName,passiveDesc,rule}];
}));
// Conserva objetos obtenidos con versiones anteriores y les da una afinidad real.
const LEGACY_RELICS = {sombrero_paja:'luffy',espada_shusui:'zoro',fruta_despertada:'robin',capa_marina:'sengoku',botella_sake:'shanks',dial_impacto:'usopp',mera_mera_core:'ace',gura_gura_core:'newgate'};
for (const [id,character] of Object.entries(LEGACY_RELICS)) RELICS[id] = {...RELICS[`relic_${character}`],id};
function equippedRelic(f) { return battle?.opts?.local ? null : RELICS[f?.battleRelic] || null; }
function relicRule(f) {
  const r = equippedRelic(f);
  return r && r.character === baseFormOf(f.id) ? r.rule : {};
}
function relicStatMult(f) { return equippedRelic(f) ? 1.10 : 1; }
function relicTeamBonus(f,key) {
  return teamOf(f).filter(a=>a.hp>0).reduce((n,a)=>n+(relicRule(a)[key] || 0),0);
}
function relicDamageMult(att,dfd,mv) {
  const a = relicRule(att), d = relicRule(dfd);
  let mult = 1;
  if ((a.type && a.type === mv.type) || (a.move && MOVES[a.move] === mv)) mult *= a.damage;
  if (att.hp < att.maxhp*.5) mult *= a.lowDamage || 1;
  if (dfd.hp < dfd.maxhp*.5) mult *= (a.execute || 1)*(d.lowReduction || 1);
  if (dfd.hp > dfd.maxhp*.5) mult *= d.healthyReduction || 1;
  if (dfd.hp === dfd.maxhp) mult *= a.openingDamage || 1;
  if (hasFruta(dfd)) mult *= a.fruitDamage || 1;
  mult *= d.reduction || 1;
  for (const f of teamOf(att).filter(f=>f.hp>0)) mult *= relicRule(f).teamDamage || 1;
  for (const f of teamOf(dfd).filter(f=>f.hp>0)) mult *= relicRule(f).teamReduction || 1;
  return mult;
}
function equipRelic(id,character) {
  if (battle || !meta.relics.includes(id) || !RELICS[id]) return false;
  if (character && !challengeOwnedBases().includes(character)) return false;
  meta.relicEquipment ||= {};
  for (const [base,equipped] of Object.entries(meta.relicEquipment)) if (equipped === id) delete meta.relicEquipment[base];
  if (character) meta.relicEquipment[character] = id;
  saveMeta();
  return true;
}
function relicDetailsHTML(r) {
  return `<b>${r.emoji} ${esc(r.name)}</b><p>${r.desc}</p><p class="relic-affinity">Afinidad: ${esc(CHARS[r.character].name)} y sus formas<br><b>${esc(r.passiveName)}</b> · ${esc(r.passiveDesc)}</p>`;
}
function showRelicCollection(opts = {}) {
  const previousFocus=document.activeElement;
  const owned=[...new Set(meta.relics)].filter(id=>RELICS[id]);
  const bases=challengeOwnedBases().sort((a,b)=>CHARS[a].name.localeCompare(CHARS[b].name,'es'));
  let query='',page=0;
  const pageSize=12;
  const ov=document.createElement('div');ov.className='overlay collection-overlay';ov.id='relic-modal-overlay';
  ov.innerHTML=`<section class="modal collection-modal relic-modal" role="dialog" aria-modal="true" aria-labelledby="relic-title">
    <header class="collection-header"><div><span class="collection-eyebrow">Inventario</span><h2 id="relic-title" tabindex="-1">🏺 Reliquias · ${owned.length}</h2></div><button class="btn gray collection-close" id="relic-close" aria-label="Cerrar reliquias">Cerrar <span aria-hidden="true">×</span></button></header>
    <details class="collection-extra"><summary>Cómo funcionan las reliquias</summary><p class="relic-help">Una reliquia por personaje, una copia equipada a la vez. El boost funciona en cualquier portador; la pasiva solo con su afinidad. Elegir otro portador mueve la reliquia y sustituye la que tuviera equipada. Se aplica al empezar el siguiente combate de aventura, Torre o Desafíos.</p></details>
    ${battle?'<p role="status">Puedes consultar las reliquias, pero debes terminar el combate para cambiar su portador.</p>':''}
    <label for="relic-search">Buscar reliquia o afinidad<input type="search" id="relic-search" placeholder="Nombre de la reliquia o personaje"></label>
    <div class="collection-results"><span id="relic-count" role="status"></span><button class="collection-text-button" id="relic-reset">Limpiar búsqueda</button></div>
    <div id="relic-cards" class="collection-list relic-grid" aria-label="Reliquias obtenidas" tabindex="0"></div>
    <nav class="collection-pagination" aria-label="Páginas de reliquias"><button class="btn gray" id="relic-prev" aria-label="Página anterior de reliquias">← Anterior</button><span id="relic-page"></span><button class="btn gray" id="relic-next" aria-label="Página siguiente de reliquias">Siguiente →</button></nav>
    <p id="relic-feedback" role="status" aria-live="polite"></p>
  </section>`;
  document.body.appendChild(ov);
  const find=selector=>ov.querySelector(selector);
  const close=()=>{ov.remove();if(typeof opts.onClose==='function')opts.onClose();else if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});};
  const draw=()=>{
    const ids=owned.filter(id=>{const r=RELICS[id];return `${r.name} ${CHARS[r.character].name}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es'));});
    const pages=Math.max(1,Math.ceil(ids.length/pageSize));page=Math.min(page,pages-1);
    find('#relic-count').textContent=`${ids.length} reliquias${ids.length?` · ${page*pageSize+1}–${Math.min((page+1)*pageSize,ids.length)}`:''}`;
    find('#relic-page').textContent=`Página ${page+1} de ${pages}`;
    find('#relic-prev').disabled=page===0;find('#relic-next').disabled=page===pages-1;
    find('#relic-cards').innerHTML=ids.slice(page*pageSize,(page+1)*pageSize).map(id=>{
      const r=RELICS[id],owner=Object.keys(meta.relicEquipment||{}).find(base=>meta.relicEquipment[base]===id);
      const candidates=[...bases].sort((a,b)=>Number(b===r.character)-Number(a===r.character));
      return `<article class="relic-card" data-relic-card="${id}">${relicDetailsHTML(r)}
        <label>Equipar a<select data-equip-relic="${id}" aria-label="Portador de ${esc(r.name)}" ${battle?'disabled':''}><option value="">Sin equipar</option>${candidates.map(base=>`<option value="${base}" ${owner===base?'selected':''}>${esc(CHARS[base].name)}${base===r.character?' · ✨ AFINIDAD':''}</option>`).join('')}</select></label>
        <p class="relic-owner">${owner?`Portador: ${esc(CHARS[owner].name)} · ${owner===r.character?'✨ Pasiva de afinidad activa':'Boost común activo'}`:'Sin portador'} · Copias: ${meta.relicCopies?.[id]||1}</p></article>`;
    }).join('')||`<div class="collection-empty"><h3>${owned.length?'No hay reliquias con esta búsqueda':'Aún no tienes reliquias'}</h3><p>${owned.length?'Prueba otro nombre o limpia la búsqueda.':'Gana Batalla de Leyendas en Desafíos para conseguir tu primera reliquia.'}</p></div>`;
    find('#relic-cards').scrollTop=0;
    ov.querySelectorAll('[data-equip-relic]').forEach(el=>el.onchange=()=>{
      const id=el.dataset.equipRelic,character=el.value,scroll=find('#relic-cards').scrollTop;
      const equipped=equipRelic(id,character);
      draw();find('#relic-cards').scrollTop=scroll;find(`[data-equip-relic="${id}"]`).focus({preventScroll:true});
      find('#relic-feedback').textContent=equipped?(character?`${RELICS[id].name} equipada a ${CHARS[character].name}.`:`${RELICS[id].name} sin equipar.`):'Termina el combate para cambiar las reliquias.';
    });
  };
  find('#relic-close').onclick=close;
  find('#relic-search').oninput=e=>{query=e.target.value;page=0;draw();};
  find('#relic-reset').onclick=()=>{query='';page=0;find('#relic-search').value='';draw();find('#relic-search').focus();};
  for(const [id,step] of [['relic-prev',-1],['relic-next',1]])find('#'+id).onclick=()=>{page+=step;draw();find('#relic-cards').focus();};
  ov.onclick=e=>{if(e.target===ov)close();};draw();bindCollectionDialog(ov,close,'#relic-title');
}

const CHALLENGE_PRIZES = {1:7500,2:5000,3:2500};
function challengeOwnedBases() { return [...new Set([...SAGAS[0].starters,...meta.roster].filter(id=>CHARS[id]).map(baseFormOf))]; }
function challengeLevel(kind) {
  if (kind==='tournament') return 65;
  const wano=SAGAS.find(s=>s.id==='wano');
  return Math.max(...wano.islands[Math.floor(wano.islands.length/2)].bossLvl);
}
function challengePool(kind) {
  return challengeOwnedBases().map(id=>evolutionFormAt(id,startLvlOf(id))).filter(id=>kind!=='legends'||CHARS[id].rareza===5);
}
function shuffleChallenge(list) {
  const out=[...list];
  for(let i=out.length-1;i>0;i--){const j=rnd(0,i);[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
function challengeMatch(a,b) { return {a,b,winner:null}; }
function challengeCurrentMatch(t=meta.challenge) {
  if (!t || t.finished) return null;
  if (t.bronze) return t.bronze.winner===null?t.bronze:null;
  return t.rounds[t.stage].matches.find(m=>m.winner===null&&(m.a===0||m.b===0)) || null;
}
function challengeCanStart() { return !battle && accountLevel()>=35 && (!meta.challenge || (meta.challenge.finished && !meta.challenge.pendingRelics?.length)); }
function startChallenge(kind,picked) {
  if (!['tournament','legends'].includes(kind)||!challengeCanStart()) return false;
  const count=kind==='legends'?2:1, allowed=challengePool(kind);
  if (!Array.isArray(picked)||picked.length!==count||new Set(picked.map(baseFormOf)).size!==count||picked.some(id=>!allowed.includes(id))) return false;
  const level=challengeLevel(kind),excluded=new Set(picked.map(baseFormOf));
  const candidates=Object.keys(CHARS).filter(id=>!BASE_OF[id]&&!excluded.has(id));
  const opponents=shuffleChallenge(candidates.map(id=>{
    if(kind!=='legends')return id;
    const forms=Object.keys(CHARS).filter(form=>baseFormOf(form)===id&&CHARS[form].rareza===5);
    return forms.at(-1);
  }).filter(Boolean)).slice(0,8-count);
  if(opponents.length!==8-count)return false;
  const entrants=[{members:[...picked]}];
  for(let i=0;i<opponents.length;i+=count)entrants.push({members:opponents.slice(i,i+count)});
  const seeds=shuffleChallenge(entrants.map((_,i)=>i));
  const matches=[];for(let i=0;i<seeds.length;i+=2)matches.push(challengeMatch(seeds[i],seeds[i+1]));
  meta.challenge={version:1,kind,level,entrants,stage:0,rounds:[{name:count===1?'Cuartos de final':'Semifinales',matches}],finished:false,placement:null,reward:0,pendingRelics:[]};
  saveMeta();screenChallengeBracket();return true;
}
function simulateChallengeMatch(t,m) {
  if(m.winner!==null)return;
  const strength=index=>t.entrants[index].members.reduce((n,id)=>n+CHARS[id].base.reduce((a,b)=>a+b,0),0);
  const a=strength(m.a),b=strength(m.b);
  m.winner=Math.random()<a/(a+b)?m.a:m.b;
}
function challengeRelicChoices(t) {
  const keys=Object.keys(RELICS).filter(id=>id.startsWith('relic_'));
  const unowned=keys.filter(id=>!meta.relics.some(owned=>RELICS[owned]?.character===RELICS[id].character));
  const pool=unowned.length?unowned:keys;
  const affinities=t.entrants[0].members.map(id=>`relic_${baseFormOf(id)}`).filter(id=>pool.includes(id));
  return [...new Set([...affinities,...shuffleChallenge(pool)])].slice(0,3);
}
function finishChallenge(placement) {
  const t=meta.challenge;if(!t||t.finished)return;
  t.finished=true;t.placement=placement;
  t.reward=t.kind==='tournament'?(CHALLENGE_PRIZES[placement]||0):0;
  meta.logPoses=(meta.logPoses||0)+t.reward;
  if(t.kind==='legends'&&placement===1)t.pendingRelics=challengeRelicChoices(t);
  saveMeta();
}
function endChallengeBattle(victory) {
  const t=meta.challenge,m=challengeCurrentMatch(t);
  if(!m)return;
  m.winner=victory?0:(m.a===0?m.b:m.a);
  if(t.bronze)finishChallenge(victory?3:4);
  else {
    const round=t.rounds[t.stage];
    round.matches.forEach(match=>simulateChallengeMatch(t,match));
    if(round.matches.length===1)finishChallenge(victory?1:2);
    else {
      const winners=round.matches.map(match=>match.winner);
      const matches=[];for(let i=0;i<winners.length;i+=2)matches.push(challengeMatch(winners[i],winners[i+1]));
      t.rounds.push({name:matches.length===1?'Final':'Semifinales',matches});t.stage++;
      if(!victory){
        if(t.kind==='tournament'&&round.matches.length===2){
          const losers=round.matches.map(match=>match.winner===match.a?match.b:match.a);
          t.bronze=challengeMatch(...losers);matches.forEach(match=>simulateChallengeMatch(t,match));
        }else{
          // Completa el cuadro de la IA aunque el jugador ya haya quedado eliminado.
          while(t.rounds[t.stage].matches.length>1){
            const current=t.rounds[t.stage];current.matches.forEach(match=>simulateChallengeMatch(t,match));
            const ws=current.matches.map(match=>match.winner),next=[];
            for(let i=0;i<ws.length;i+=2)next.push(challengeMatch(ws[i],ws[i+1]));
            t.rounds.push({name:next.length===1?'Final':'Semifinales',matches:next});t.stage++;
          }
          t.rounds[t.stage].matches.forEach(match=>simulateChallengeMatch(t,match));
          finishChallenge(t.kind==='legends'?3:5);
        }
      }
    }
  }
  saveMeta();screenChallengeBracket();
}
function challengeEnemyLevel(t) {
  return t.kind==='legends'&&t.rounds[t.stage].name==='Final'?Math.max(...SAGAS.find(s=>s.id==='wano').islands.at(-1).bossLvl):t.level;
}
function challengePlayerTeam(t) {
  return t.entrants[0].members.map(id=>applyUpgrades(makeChar(baseFormOf(id),startLvlOf(id))));
}
function playChallengeMatch() {
  const t=meta.challenge,m=challengeCurrentMatch(t);
  if(battle||!m||accountLevel()<35)return;
  const enemyIndex=m.a===0?m.b:m.a;
  const enemyLevel=challengeEnemyLevel(t);
  const allies=challengePlayerTeam(t);
  if(t.kind==='legends'&&allies.some(f=>CHARS[f.id].rareza!==5))return toast('Tu pareja debe conservar dos personajes de rareza 5★. Revisa sus niveles base o inicia un nuevo torneo.');
  t.entrants[0].members=allies.map(f=>f.id);
  saveMeta();
  const enemies=t.entrants[enemyIndex].members.map(id=>makeChar(id,enemyLevel,false,true));
  startBattle(enemies,{challenge:true,duos:t.kind==='legends',team:allies,items:{},intro:`🏆 ${t.bronze?'Tercer puesto':t.rounds[t.stage].name} · ${t.kind==='legends'?'Batalla de Leyendas · 2 contra 2':'Torneo de 8'} · Nv. rival ${enemyLevel}`});
}
function claimChallengeRelic(id) {
  const t=meta.challenge;
  if(!t?.finished||t.kind!=='legends'||t.placement!==1||!t.pendingRelics.includes(id)||!RELICS[id])return false;
  meta.relics.push(id); // Si la colección está completa, se conserva la nueva copia en el inventario.
  meta.relics=[...new Set(meta.relics)];
  meta.relicCopies ||= {};meta.relicCopies[id]=(meta.relicCopies[id]||0)+1;
  t.pendingRelics=[];t.relicReward=id;saveMeta();return true;
}
function screenChallenges() {
  playMusic('menu');if(accountLevel()<35){toast('🔒 Desafíos requiere nivel de cuenta 35.');return screenHome();}
  render(`${topbar(false)}<button class="btn gray small back-btn" id="btn-back">← PUERTO</button>
    <section class="panel challenge-panel"><h2 id="challenge-title" tabindex="-1">🏆 Desafíos</h2><p>Torneos offline contra la IA. Desbloqueados a nivel de cuenta 35.</p>
    ${meta.challenge?`<button class="btn gold" id="challenge-resume">${meta.challenge.finished?'VER RESULTADO Y RECOMPENSA':'CONTINUAR TORNEO'}</button>`:''}
    <div class="challenge-events"><article class="challenge-event"><span class="challenge-emblem">🏆</span><h3>Torneo de los Ocho</h3>
    <p>8 participantes · duelos 1 contra 1 · Rivales Nv.65. Cuartos, semifinales, final y combate por el tercer puesto.</p><div class="challenge-prizes"><span>🥇 7.500</span><span>🥈 5.000</span><span>🥉 2.500</span></div><p>Log Poses por torneo. El resto de puestos no recibe premio.</p><button class="btn blue" data-challenge="tournament" ${challengeCanStart()?'':'disabled'}>ELEGIR LUCHADOR</button></article>
    <article class="challenge-event legends"><span class="challenge-emblem">👑</span><h3>Batalla de Leyendas</h3><p>8 personajes · 4 parejas · combates 2 contra 2. Solo rareza 5★; las estrellas de fusión no cuentan.</p><p>Rivales de Wano · Nv.${challengeLevel('legends')} y final Nv.${Math.max(...SAGAS.find(s=>s.id==='wano').islands.at(-1).bossLvl)}. Cada personaje vivo actúa por ronda.</p><p>🏺 Campeones: elige una reliquia entre tres, priorizando afinidades de tu pareja y reliquias nuevas.</p><button class="btn gold" data-challenge="legends" ${challengeCanStart()?'':'disabled'}>FORMAR PAREJA</button></article></div>
    <p><b>Tus personajes usan su nivel permanente actual.</b> Todos los rivales llevan una reliquia afín con boost y pasiva. Empiezas cada combate con PS completos y conservas tus mejoras y reliquias equipadas.</p><details class="challenge-rules"><summary>Cómo funcionan los torneos</summary><p>Sin consumibles. Ultimate reiniciada en cada combate, salvo la carga inicial de una reliquia. Puedes volver al puerto y continuar el cuadro guardado. Tus niveles se consultan de nuevo al empezar cada combate.</p></details>
    <button class="btn gray" id="challenge-relics">🎒 RELIQUIAS (${meta.relics.length})</button></section>`);
  $('#btn-back').onclick=screenHome;$('#challenge-relics').onclick=showRelicCollection;
  if(meta.challenge)$('#challenge-resume').onclick=screenChallengeBracket;
  document.querySelectorAll('[data-challenge]').forEach(el=>el.onclick=()=>screenChallengeSelection(el.dataset.challenge));
  $('#challenge-title').focus();
}
function screenChallengeSelection(kind) {
  if(!challengeCanStart()||!['tournament','legends'].includes(kind))return screenChallenges();
  const pool=challengePool(kind), count=kind==='legends'?2:1, picked=Array(count).fill(null);
  const pickerState={q:'',saga:'',type:'',rarity:0,sort:'name',scope:'all',page:0};
  render(`${topbar(false)}<button class="btn gray small back-btn" id="btn-back">← DESAFÍOS</button>
    <section class="panel challenge-panel challenge-selection"><h2 id="challenge-title" tabindex="-1">${kind==='legends'?'👑 Forma tu pareja legendaria':'🏆 Elige tu luchador'}</h2>
    <p>Participas con el <b>nivel permanente de cada nakama</b>. Rivales Nv.${challengeLevel(kind)}${kind==='legends'?' · Final Nv.'+Math.max(...SAGAS.find(s=>s.id==='wano').islands.at(-1).bossLvl):''}, todos con reliquia afín.</p>
    ${pool.length<count?'<p class="challenge-notice" role="status">No tienes suficientes personajes elegibles. Recluta legendarios o desbloquea sus formas de 5★ mejorando su nivel base.</p>':''}
    <div class="challenge-team-slots" id="challenge-slots"></div>
    <div id="challenge-selection-synergies"></div>
    <div class="challenge-launch"><p id="challenge-picked" role="status"></p><button class="btn blue" id="challenge-start" disabled>COMENZAR TORNEO</button></div></section>`);
  $('#btn-back').onclick=screenChallenges;
  const draw=()=>{
    $('#challenge-slots').innerHTML=picked.map((id,index)=>{
      const f=id?applyUpgrades(makeChar(id,startLvlOf(id))):null;
      const relic=id?RELICS[meta.relicEquipment?.[id]]:null;
      return `<article class="challenge-slot"><h3>${count===1?'Tu luchador':`Nakama ${index+1}`}</h3>
        <button class="challenge-slot-pick" data-challenge-slot="${index}" aria-label="${f?'Cambiar a '+esc(charName(f)):'Elegir nakama '+(index+1)}" ${pool.length?'':'disabled'}>
        ${f?`${charIcon(f.id,80)}<strong>${esc(charName(f))}</strong><span>Nv. ${f.lvl} · ${'⭐'.repeat(CHARS[f.id].rareza)}</span><span class="type-badges">${typeBadges(fighterTypes(f))}</span><span>${f.maxhp} PS · ${f.atk} ATQ</span>`:'<span class="challenge-slot-plus" aria-hidden="true">＋</span><strong>Elegir nakama</strong><span>Buscar, filtrar y consultar fichas</span>'}</button>
        ${f?`<p>${relic&&meta.relics.includes(relic.id)?`🏺 ${esc(relic.name)} · ${relic.character===id?'Afinidad activa':'Boost común'}`:'Sin reliquia equipada'}</p><button class="btn gray" data-challenge-info="${index}">Ver ficha</button><button class="btn gray" data-challenge-remove="${index}" aria-label="Quitar a ${esc(charName(f))}">Quitar</button>`:''}</article>`;
    }).join('');
    const team=picked.filter(Boolean).map(id=>applyUpgrades(makeChar(id,startLvlOf(id))));
    $('#challenge-picked').textContent=`${team.length} de ${count} seleccionados${team.length===count?' · Equipo listo':''}`;
    $('#challenge-start').disabled=team.length!==count;
    $('#challenge-selection-synergies').innerHTML=activeSynergiesHTML(team);
    document.querySelectorAll('[data-challenge-slot]').forEach(button=>button.onclick=()=>{
      const index=Number(button.dataset.challengeSlot);
      showNakamaPicker({title:count===1?'Elige tu luchador':`Elige el nakama ${index+1}`,allowedIds:challengePool(kind).map(baseFormOf),state:pickerState,
        hint:`${kind==='legends'?'Solo personajes de rareza 5★. ':''}Se muestra tu nivel permanente. Si eliges un nakama del otro hueco, se intercambian.`,
        currentTeam:picked.filter(Boolean),selectedId:picked[index],onSelect:id=>{
          const base=baseFormOf(id),other=picked.indexOf(base);if(other>=0)picked[other]=picked[index];picked[index]=base;draw();
          $(`[data-challenge-slot="${index}"]`).focus();
        }});
    });
    document.querySelectorAll('[data-challenge-info]').forEach(button=>button.onclick=()=>{
      const index=Number(button.dataset.challengeInfo);showCharModal(picked[index]);
      const sheet=$('#sheet-close')?.closest('.overlay');if(!sheet)return;
      const close=()=>{sheet.remove();draw();$(`[data-challenge-info="${index}"]`).focus();};
      sheet.querySelector('#sheet-close').onclick=close;sheet.onclick=e=>{if(e.target===sheet)close();};
      bindCollectionDialog(sheet,close,'#sheet-close');
    });
    document.querySelectorAll('[data-challenge-remove]').forEach(button=>button.onclick=()=>{const index=Number(button.dataset.challengeRemove);picked[index]=null;draw();$(`[data-challenge-slot="${index}"]`).focus();});
  };
  $('#challenge-start').onclick=()=>startChallenge(kind,picked.filter(Boolean).map(id=>evolutionFormAt(id,startLvlOf(id))));
  draw();$('#challenge-title').focus();
}
function screenChallengeBracket() {
  const t=meta.challenge;if(!t)return screenChallenges();
  const playerTeam=challengePlayerTeam(t);
  const entrant=index=>index===0?playerTeam.map(f=>esc(charName(f))).join(' + '):t.entrants[index].members.map(id=>esc(CHARS[id].name)).join(' + ');
  const next=challengeCurrentMatch(t), enemyIndex=next?(next.a===0?next.b:next.a):null;
  const matchHTML=m=>`<div class="challenge-match">${[m.a,m.b].map(index=>`<div class="${m.winner===index?'winner':''} ${index===0?'your-entry':''}">${index===0?'🏴‍☠️ ':''}${entrant(index)}${m.winner===index?' ✓':''}</div>`).join('')}</div>`;
  render(`${topbar(false)}<button class="btn gray small back-btn" id="btn-back">← DESAFÍOS</button><section class="panel challenge-panel"><h2 id="challenge-title" tabindex="-1">${t.kind==='legends'?'👑 Batalla de Leyendas':'🏆 Torneo de los Ocho'}</h2>
    <p><b>Tu equipo:</b> ${playerTeam.map(f=>`${esc(charName(f))} · Nv.${f.lvl}`).join(' + ')}</p>
    ${next?`<section class="challenge-next"><h3>Próximo combate · ${t.bronze?'Tercer puesto':t.rounds[t.stage].name}</h3><p>${entrant(enemyIndex)} · Rivales Nv.${challengeEnemyLevel(t)}</p>
      <button class="btn blue" id="challenge-fight">⚔️ ${t.bronze?'LUCHAR POR EL TERCER PUESTO':'SIGUIENTE COMBATE'}</button>
      <details class="challenge-rules"><summary>Ver las reliquias del rival</summary>${t.entrants[enemyIndex].members.map(id=>`<article class="challenge-rival-relic"><h3>${esc(CHARS[id].name)}</h3>${relicDetailsHTML(RELICS[`relic_${baseFormOf(id)}`])}</article>`).join('')}</details></section>`:''}
    <p>Los cruces entre rivales de la IA se simulan según la fuerza de sus equipos.</p>
    <div class="challenge-bracket">${t.rounds.map(round=>`<section><h3>${round.name}</h3>${round.matches.map(matchHTML).join('')}</section>`).join('')}${t.bronze?`<section><h3>Tercer puesto</h3>${matchHTML(t.bronze)}</section>`:''}</div>
    ${t.finished?`<div class="challenge-result" role="status"><h3>${t.placement===0?'Torneo abandonado':t.placement===1?'🏆 ¡Campeón!':t.placement===5?'Eliminado en cuartos · puestos 5–8':`Puesto ${t.placement}${t.kind==='legends'&&t.placement===3?'–4':''}`}</h3><p>${t.reward?`🧭 +${t.reward.toLocaleString('es')} Log Poses añadidos a tu cuenta.`:t.pendingRelics.length?'🏺 Elige tu reliquia de campeón.':t.relicReward?`🏺 Reliquia obtenida: ${esc(RELICS[t.relicReward].name)}`:'Sin premio de Log Poses.'}</p></div>`:`<button class="btn gray" id="challenge-abandon">ABANDONAR TORNEO</button>`}
    ${t.pendingRelics.length?`<div class="relic-grid">${t.pendingRelics.map(id=>`<article class="relic-card">${relicDetailsHTML(RELICS[id])}<button class="btn gold" data-claim-relic="${id}">ELEGIR</button></article>`).join('')}</div>`:''}
    ${t.relicReward?'<button class="btn gold" id="challenge-equip">EQUIPAR RELIQUIA</button>':''}</section>`);
  $('#btn-back').onclick=screenChallenges;
  if(!t.finished){$('#challenge-fight').onclick=playChallengeMatch;$('#challenge-abandon').onclick=()=>modalConfirm('¿Abandonar torneo?','Terminarás este torneo sin premio.',()=>{finishChallenge(0);screenChallenges();});}
  document.querySelectorAll('[data-claim-relic]').forEach(el=>el.onclick=()=>{if(claimChallengeRelic(el.dataset.claimRelic))screenChallengeBracket();});
  if(t.relicReward)$('#challenge-equip').onclick=showRelicCollection;
  $('#challenge-title').focus();
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
if (!finishRetiredJourney()) screenHome();
if (saveReadError) toast('⚠️ No se pudo leer la partida local. La copia anterior se ha conservado; puedes importar un JSON.');
