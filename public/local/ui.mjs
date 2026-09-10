import { LocalLink, decodeSignal, qrFrames, FrameCollector, MAX_TOKEN } from './connection.mjs';
import { LocalSession, BOSSES } from './session.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MODE = { duel: 'Duelo PvP', tournament: 'Torneo', coop: 'Alianza contra un yonko' };
let libraries;
function loadLibraries() {
  return libraries ||= Promise.all(['vendor/qrcode.js', 'vendor/jsQR.js'].map(path => new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = new URL(path, import.meta.url).href;
    script.onload = resolve; script.onerror = () => { libraries = null; script.remove(); reject(new Error('No se pudo cargar el lector QR. Recarga el juego.')); };
    document.head.append(script);
  })));
}
export async function openLocal() {
  if (document.getElementById('local-multiplayer')) return;
  const engine = globalThis.LocalCombat;
  const root = document.createElement('div');
  root.id = 'local-multiplayer'; root.className = 'local-game'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'local-title');
  root.innerHTML = `<header class="local-header"><div><span class="local-eyebrow">DOS DISPOSITIVOS O MÁS · MISMA RED</span><h1 id="local-title">Multijugador local</h1></div><button class="btn gray" id="local-exit">Salir</button></header><p class="local-notice" role="status" id="local-notice"></p><main id="local-content"></main><div id="local-pair-slot"></div>`;
  document.body.append(root);
  const original = document.getElementById('app'); original.inert = true;
  const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const main = root.querySelector('#local-content'), notice = root.querySelector('#local-notice');
  let session, guestLink, pairing, viewKey = '', timer, closed = false, displayName = 'Pirata';
  const links = new Map(); const room = crypto.randomUUID().replaceAll('-', '');
  const say = message => { notice.textContent = message; };
  const handle = fn => async event => { try { await fn(event); } catch (error) { say(error.message || 'No se pudo completar la operación.'); } };
  const onVisibility = () => { if (session) { session.visible = !document.hidden; session.pulse(); } };
  const onUnload = event => { if (session && session.view.players.length > 1) { event.preventDefault(); event.returnValue = ''; } };
  document.addEventListener('visibilitychange', onVisibility); window.addEventListener('beforeunload', onUnload);
  const leave = () => {
    closePair(true); session?.close(); for (const link of links.values()) link.close(); links.clear(); guestLink?.close();
    clearInterval(timer); timer = null; session = null; viewKey = ''; guestLink = null;
  };
  root.querySelector('#local-exit').onclick = () => {
    if (session && !confirm(session.host ? '¿Cerrar la sala? Los demás jugadores perderán al anfitrión.' : '¿Salir de la partida local?')) return;
    closed = true; leave(); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('beforeunload', onUnload);
    original.inert = false; document.body.style.overflow = previousOverflow; root.remove(); document.getElementById('btn-local')?.focus();
  };
  function startScreen() {
    main.innerHTML = `<section class="local-intro"><div class="local-emblem" aria-hidden="true">🏴‍☠️ ⚔️ 🏴‍☠️</div><h2>Reúne a tu tripulación</h2><p>Duelo de 1, 3 o 6 nakamas, torneo de 3 a 8 jugadores o alianza de 2 a 8 contra un yonko.</p><div class="local-steps"><p><b>1.</b> Conectaos a la misma Wi-Fi o punto de acceso.</p><p><b>2.</b> Un jugador crea la sala. Cada invitado escanea su QR y devuelve un QR de respuesta.</p><p><b>3.</b> Elegid equipos y marcaos como listos. Mantened el juego abierto.</p></div><label class="local-field">Tu nombre<input id="local-name" maxlength="24" autocomplete="nickname" value="${esc(displayName)}"></label><div class="local-actions"><button class="btn green" id="local-create">Crear sala</button><button class="btn blue" id="local-join">Unirse por QR</button></div><p class="local-fine">Sin cuentas ni servidores de partidas. El anfitrión debe permanecer conectado. Equipos a nivel 30, sin mejoras ni recompensas de historia.</p><details><summary>Si no conecta</summary><p>Evita redes de invitados, aislamiento de dispositivos y VPN. La cámara necesita HTTPS o localhost. Algunas combinaciones de navegador y punto de acceso impiden la conexión local.</p><p>Abre el juego en los dispositivos antes de comenzar. Para abrirlo también sin internet, prepara antes la copia sin conexión desde el menú principal.</p></details></section>`;
    const supported = !!globalThis.RTCPeerConnection && !!globalThis.crypto?.subtle && isSecureContext;
    if (!supported) {
      say('Abre el juego mediante HTTPS en un navegador actualizado. La conexión y la cámara no funcionan desde una dirección HTTP de red local.');
      main.querySelectorAll('#local-create, #local-join').forEach(b => { b.disabled = true; });
    }
    main.querySelector('#local-create').onclick = () => { displayName = main.querySelector('#local-name').value; createSession(true); };
    main.querySelector('#local-join').onclick = () => { displayName = main.querySelector('#local-name').value; createSession(false); showPair('guest'); };
  }
  function createSession(host) {
    say('');
    session = new LocalSession({ host, name: displayName, engine, send: packet => guestLink?.send(packet), onChange: renderSession, onError: message => {
      say(message); leave(); startScreen();
    } });
    session.visible = !document.hidden;
    timer = setInterval(() => { try { session?.pulse(); } catch (error) { say(`Partida pausada: ${error.message}`); clearInterval(timer); } }, 100);
    renderSession();
  }
  function renderSession() {
    if (!session || closed) return;
    const v = session.view, key = JSON.stringify(v) + session.self;
    if (key === viewKey) return; viewKey = key;
    const me = v.players.find(p => p.id === session.self);
    if (!me) { main.innerHTML = '<section class="local-intro"><h2>Únete a una sala</h2><p>Escanea la invitación y enseña el QR de respuesta al anfitrión.</p><button class="btn gray" id="local-back">Volver</button></section>'; main.querySelector('#local-back').onclick = () => { leave(); startScreen(); }; return; }
    const connected = v.players.filter(p => p.connected).length;
    const arena = main.querySelector('#local-arena');
    main.innerHTML = `<div class="local-room-heading"><h2>${esc(MODE[v.mode])}</h2><span class="local-badge">${session.host ? 'ANFITRIÓN' : 'INVITADO'} · ${connected}/${v.players.length} conectados</span></div>
      ${v.paused && v.phase !== 'lobby' ? '<p class="local-warning" role="status">Partida pausada. El anfitrión y los jugadores activos deben mantener el juego visible y la conexión abierta. Si alguien recargó o cerró el juego, cread una nueva sala.</p>' : ''}
      ${v.phase === 'lobby' ? lobbyHTML(v, me) : gameHTML(v, me)}`;
    if (v.phase === 'lobby') bindLobby(v, me);
    else {
      const placeholder = main.querySelector('#local-arena');
      if (arena && placeholder) placeholder.replaceWith(arena);
      const focus = focusedMatch(v, me);
      if (focus) globalThis.LocalBattleView.update(main.querySelector('#local-arena'), focus, session, playerName);
      main.querySelector('#local-next')?.addEventListener('click', handle(() => session.nextRound()));
      main.querySelector('#local-rematch')?.addEventListener('click', () => session.reset());
    }
  }
  const playerName = id => id === 'alliance' ? 'La alianza' : id === 'yonko' ? 'El yonko' : id === 'draw' ? 'Empate' : session.view.players.find(p => p.id === id)?.name || 'Pirata';
  function lobbyHTML(v, me) {
    const options = engine.roster.filter(c => session.roster.includes(c.id)).map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    return `<section class="local-panel"><div class="local-config"><label class="local-field">Modo<select id="local-mode" ${session.host ? '' : 'disabled'}>${Object.entries(MODE).map(([id, name]) => `<option value="${id}" ${id === v.mode ? 'selected' : ''}>${name}</option>`).join('')}</select></label><label class="local-field">Nakamas por jugador<select id="local-size" ${session.host ? '' : 'disabled'}>${[1, 3, 6].map(n => `<option ${n === v.size ? 'selected' : ''}>${n}</option>`).join('')}</select></label>${v.mode === 'coop' ? `<label class="local-field">Yonko<select id="local-boss" ${session.host ? '' : 'disabled'}>${BOSSES.map(id => `<option value="${id}" ${id === v.boss ? 'selected' : ''}>${esc(engine.name(id))}</option>`).join('')}</select></label>` : ''}</div>
      <p class="local-fine">${v.mode === 'tournament' ? 'Eliminación directa · sorteo de cruces · pases de ronda para completar el cuadro · los empates se repiten.' : v.mode === 'coop' ? 'Cada jugador ataca con su nakama activo. El yonko responde a cada uno; sus PS escalan con jugadores y tamaño de equipos.' : 'Los ataques son automáticos. Tú decides cuándo lanzar la definitiva del nakama activo.'}</p>
      <div class="local-player-list">${v.players.map(p => `<div class="local-player"><span>${p.id === 'host' ? '👑' : '🏴‍☠️'} <b>${esc(p.name)}</b>${p.id === me.id ? ' (tú)' : ''}</span><span>${!p.connected ? 'Desconectado' : !p.visible ? 'En segundo plano' : p.ready ? '✓ Listo' : 'Eligiendo equipo'}</span>${session.host && p.id !== 'host' ? `<button class="btn gray small" data-remove="${p.id}" aria-label="Retirar a ${esc(p.name)}">Retirar</button>` : ''}</div>`).join('')}</div>
      ${session.host ? `<button class="btn blue" id="local-invite" ${v.players.length >= (v.mode === 'duel' ? 2 : 8) ? 'disabled' : ''}>＋ Invitar por QR</button>` : '<p class="local-fine">El anfitrión elige el modo y el tamaño de las tripulaciones.</p>'}</section>
      <section class="local-panel"><h3>Tu equipo · nivel 30</h3><p class="local-fine">Elige entre los personajes de tu cuenta y sus evoluciones desbloqueadas. El orden determina quién entra en combate.</p>${me.team.length < v.size ? `<p class="local-warning">Tienes ${session.roster.length} personajes disponibles. Necesitas ${v.size} para este equipo; el anfitrión puede reducir el tamaño.</p>` : ''}<div class="local-team-picker">${me.team.map((id, i) => `<label class="local-pick"><span>${engine.icon(id, 40)}</span><span>Nakama ${i + 1}<select aria-label="Nakama ${i + 1}" data-pick="${i}">${options}</select></span></label>`).join('')}</div><div class="local-actions"><button class="btn ${me.ready ? 'gray' : 'green'}" id="local-ready" ${me.team.length !== v.size ? 'disabled' : ''}>${me.ready ? 'Dejar de estar listo' : 'Estoy listo'}</button>${session.host ? `<button class="btn gold" id="local-start" ${v.players.length < (v.mode === 'tournament' ? 3 : 2) || v.players.some(p => !p.ready || !p.connected || !p.visible) ? 'disabled' : ''}>Comenzar ${v.mode === 'tournament' ? 'torneo' : 'partida'}</button>` : ''}</div></section>`;
  }
  function bindLobby(v, me) {
    main.querySelectorAll('[data-pick]').forEach(select => {
      const i = Number(select.dataset.pick); select.value = me.team[i];
      select.onchange = handle(() => { const team = [...me.team]; team[i] = select.value; try { session.select(team); } catch (error) { select.value = me.team[i]; throw error; } });
    });
    for (const key of ['mode', 'size', 'boss']) main.querySelector(`#local-${key}`)?.addEventListener('change', handle(event => {
      try { session.configure({ [key]: key === 'size' ? Number(event.target.value) : event.target.value }); }
      catch (error) { event.target.value = v[key]; throw error; }
    }));
    main.querySelector('#local-ready').onclick = () => session.ready(!me.ready);
    main.querySelector('#local-start')?.addEventListener('click', handle(() => { say(''); session.start(); }));
    main.querySelector('#local-invite')?.addEventListener('click', handle(invite));
    main.querySelectorAll('[data-remove]').forEach(button => { button.onclick = () => { const id = button.dataset.remove; session.remove(id); links.get(id)?.close(); links.delete(id); }; });
  }
  function focusedMatch(v, me) {
    const relevant = v.matches.filter(m => m.round === v.round && m.status !== 'replay' && m.battle);
    return relevant.find(m => m.players.includes(me.id)) || relevant[0];
  }
  function gameHTML(v, me) {
    const relevant = v.matches.filter(m => m.round === v.round && m.status !== 'replay');
    const own = relevant.find(m => m.players.includes(me.id) && m.battle);
    const focus = own || relevant.find(m => m.battle);
    const result = v.phase === 'finished' ? `<div class="local-result" role="status"><span>🏆</span><h2>${v.champion === 'draw' ? '¡Empate!' : `¡${esc(playerName(v.champion))} gana!`}</h2><p>Partida amistosa completada.</p></div>` : '';
    const bracket = v.mode === 'tournament' ? `<section class="local-panel"><h3>Cuadro del torneo · ronda ${v.round}</h3><div class="local-bracket">${v.matches.map(m => `<div class="local-match ${m.status === 'playing' ? 'is-playing' : ''}"><small>Ronda ${m.round}${m.attempt > 1 ? ` · Repetición ${m.attempt}` : ''}</small><b>${m.players.map(id => esc(playerName(id))).join(' vs ')}</b><span>${m.status === 'bye' ? 'Pasa de ronda' : m.status === 'replay' ? 'Empate · se repite' : m.status === 'playing' ? 'En combate' : `Gana ${esc(playerName(m.winner))}`}</span></div>`).join('')}</div></section>` : '';
    const battleHTML = focus ? '<div id="local-arena"></div>' : '<section class="local-panel"><p>Has pasado de ronda. Espera a que terminen los otros combates.</p></section>';
    return `${result}${bracket}${battleHTML}${session.host && v.phase === 'round-end' ? '<button class="btn green" id="local-next">Comenzar siguiente ronda</button>' : ''}${session.host && v.phase === 'finished' ? '<button class="btn green" id="local-rematch">Volver a la sala · otra partida</button>' : ''}`;
  }
  function closePair(cancel = false) {
    if (!pairing) return;
    const current = pairing; pairing = null;
    clearInterval(current.qrTimer); clearTimeout(current.scanTimer); current.stream?.getTracks().forEach(t => t.stop());
    if (cancel && current.link && !current.joined) {
      current.link.close(); links.delete(current.link.id);
      if (session?.host) session.peers.delete(current.link.id);
    }
    current.element.remove();
  }
  function showPair(role) {
    closePair(true);
    const element = document.createElement('section'); element.className = 'local-pair-backdrop';
    element.innerHTML = `<div class="local-pair"><div class="local-room-heading"><h2>${role === 'host' ? 'Invitar a un jugador' : 'Unirse a la sala'}</h2><button class="btn gray small" id="pair-close">Cancelar</button></div><p id="pair-instruction">${role === 'host' ? 'Preparando la invitación…' : 'Escanea el QR que muestra el anfitrión dentro del juego.'}</p><div id="pair-qr" class="local-qr" hidden><canvas aria-label="Código QR de emparejamiento"></canvas><p id="pair-frame"></p><button class="btn gray small" id="pair-prev">←</button> <button class="btn gray small" id="pair-animation">Pausar QR</button> <button class="btn gray small" id="pair-next">→</button><p class="local-fine">Si hay varias imágenes, mantén la cámara apuntando hasta reunirlas todas.</p></div><div class="local-actions"><button class="btn blue" id="pair-scan">📷 Escanear QR</button><label class="btn gray local-file">Leer imagen QR<input type="file" id="pair-file" accept="image/*"></label></div><div id="pair-camera" hidden><video playsinline muted></video><button class="btn gray small" id="pair-stop">Apagar cámara</button></div><p id="pair-status" role="status"></p><details><summary>Usar código de texto</summary><label class="local-field">Código que muestras<textarea id="pair-output" readonly rows="3" aria-label="Código de conexión generado"></textarea></label><button class="btn gray small" id="pair-copy">Copiar código</button><label class="local-field">Código del otro jugador<textarea id="pair-input" rows="3" maxlength="${MAX_TOKEN}" spellcheck="false" aria-label="Código del otro jugador"></textarea></label><button class="btn green" id="pair-apply">Leer código</button></details></div>`;
    root.querySelector('#local-pair-slot').append(element);
    pairing = { element, role, collector: new FrameCollector(), stream: null, processing: false };
    const p = pairing;
    element.querySelector('#pair-close').onclick = () => { closePair(true); if (role === 'guest' && !p.joined) { leave(); startScreen(); } };
    element.querySelector('#pair-scan').onclick = handle(() => startCamera(p));
    element.querySelector('#pair-stop').onclick = () => stopCamera(p);
    element.querySelector('#pair-file').onchange = handle(async event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (!file) return;
      if (file.size > 12000000) throw new Error('Usa una imagen de menos de 12 MB.');
      await loadLibraries(); const bitmap = await createImageBitmap(file);
      try { await readImage(p, bitmap, bitmap.width, bitmap.height); } finally { bitmap.close(); }
    });
    element.querySelector('#pair-apply').onclick = handle(() => consume(p, element.querySelector('#pair-input').value));
    element.querySelector('#pair-copy').onclick = handle(async () => {
      const input = element.querySelector('#pair-output');
      try { await navigator.clipboard.writeText(input.value); p.element.querySelector('#pair-status').textContent = 'Código copiado.'; }
      catch { input.select(); p.element.querySelector('#pair-status').textContent = 'Seleccionado: usa Copiar en tu dispositivo.'; }
    });
    return p;
  }
  async function showQR(p, token) {
    await loadLibraries(); const frames = await qrFrames(token);
    if (pairing !== p) return;
    clearInterval(p.qrTimer);
    p.element.querySelector('#pair-output').value = token;
    p.element.querySelector('#pair-qr').hidden = false;
    const canvas = p.element.querySelector('canvas'); let frame = 0, animated = true;
    const paint = () => {
      const qr = globalThis.qrcode(0, 'M'); qr.addData(frames[frame]); qr.make();
      const count = qr.getModuleCount(), scale = 5; canvas.width = canvas.height = (count + 8) * scale;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = '#000';
      for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) if (qr.isDark(y, x)) ctx.fillRect((x + 4) * scale, (y + 4) * scale, scale, scale);
      canvas.dataset.frame = frames[frame];
      p.element.querySelector('#pair-frame').textContent = `QR ${frame + 1} de ${frames.length}`;
    };
    paint();
    p.qrTimer = setInterval(() => { if (animated) { frame = (frame + 1) % frames.length; paint(); } }, 1100);
    for (const [selector, delta] of [['#pair-prev', -1], ['#pair-next', 1]]) p.element.querySelector(selector).onclick = () => { frame = (frame + delta + frames.length) % frames.length; paint(); };
    p.element.querySelector('#pair-animation').onclick = event => { animated = !animated; event.target.textContent = animated ? 'Pausar QR' : 'Animar QR'; };
  }
  async function invite() {
    if (!session?.host || session.view.phase !== 'lobby') return;
    const p = showPair('host');
    const link = new LocalLink({ room,
      onState: state => {
        if (!session) return;
        if (['failed', 'closed', 'disconnected'].includes(state)) session.disconnect(link.id);
        if (state === 'timeout' || state === 'failed') say('No se pudo conectar. Revisad la misma Wi-Fi, permisos de red y VPN; cancelad la invitación y generad otra.');
      },
      onMessage: packet => {
        if (!session) return;
        session.receive(link.id, packet);
        if (packet.type === 'hello' && session.view.players.some(player => player.id === link.id)) { p.joined = true; if (pairing === p) closePair(); say('Jugador conectado. Puedes invitar al siguiente.'); }
      },
    });
    p.link = link; links.set(link.id, link); session.addPeer(link.id, packet => link.send(packet));
    try {
      const token = await link.offer(); if (pairing !== p) return;
      p.element.querySelector('#pair-instruction').textContent = '1. El invitado escanea esta invitación. 2. Tú escaneas su QR de respuesta.';
      await showQR(p, token);
    } catch (error) { if (pairing === p) { closePair(true); throw error; } }
  }
  async function consume(p, value) {
    if (pairing !== p || p.processing) return;
    p.processing = true;
    try {
      const signal = await decodeSignal(value);
      if (pairing !== p) return;
      if (p.role === 'host') {
        await p.link.accept(signal); stopCamera(p);
        p.element.querySelector('#pair-status').textContent = 'Conectando con el invitado… Manteneos en esta pantalla.';
      } else {
        if (signal.type !== 'offer') throw new Error('Necesitas la invitación del anfitrión, no una respuesta.');
        guestLink?.close();
        const link = new LocalLink({ room: signal.room, link: signal.link,
          onState: state => {
            if (!session) return;
            if (state === 'connected') session.connected();
            if (['closed', 'failed', 'disconnected'].includes(state)) { session.disconnect(); say('Conexión interrumpida. Mantened ambos juegos abiertos en la misma red.'); }
          },
          onMessage: packet => { if (!session) return; session.receive('host', packet); if (packet.type === 'state' && session?.self) { p.joined = true; if (pairing === p) closePair(); say('Conectado al anfitrión. Elige tu equipo.'); } },
        });
        p.link = guestLink = link;
        const token = await link.answer(signal); if (pairing !== p) return;
        stopCamera(p); p.collector.reset();
        p.element.querySelector('#pair-instruction').textContent = 'Ahora el anfitrión debe escanear este QR de respuesta. Mantén la pantalla abierta.';
        await showQR(p, token);
      }
    } finally { p.processing = false; }
  }
  function stopCamera(p) {
    clearTimeout(p.scanTimer); p.stream?.getTracks().forEach(track => track.stop()); p.stream = null;
    p.element.querySelector('video').srcObject = null; p.element.querySelector('#pair-camera').hidden = true;
    p.element.querySelector('#pair-scan').disabled = false;
  }
  async function readImage(p, source, width, height) {
    if (pairing !== p || p.processing || !width || !height) return;
    const ratio = Math.min(1, 1000 / Math.max(width, height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = globalThis.jsQR(pixels.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
    if (!code) { p.element.querySelector('#pair-status').textContent = 'No se distingue el QR. Acércalo y evita reflejos.'; return; }
    const result = await p.collector.add(code.data);
    p.element.querySelector('#pair-status').textContent = `Leídas ${result.received} de ${result.count} imágenes.`;
    if (result.token) await consume(p, result.token);
  }
  async function startCamera(p) {
    if (p.stream || p.cameraPending || pairing !== p) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('La cámara requiere HTTPS y permiso del navegador. También puedes leer una imagen o pegar el código.');
    p.cameraPending = true;
    p.element.querySelector('#pair-scan').disabled = true;
    try {
      await loadLibraries(); if (pairing !== p) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (pairing !== p) { stream.getTracks().forEach(t => t.stop()); return; }
      p.stream = stream; const video = p.element.querySelector('video'); video.srcObject = stream;
      p.element.querySelector('#pair-camera').hidden = false; await video.play();
      const scan = async () => {
        if (pairing !== p || !p.stream) return;
        try { await readImage(p, video, video.videoWidth, video.videoHeight); }
        catch (error) { if (pairing === p) p.element.querySelector('#pair-status').textContent = error.message; }
        if (pairing === p && p.stream) p.scanTimer = setTimeout(scan, 180);
      };
      scan();
    } catch { stopCamera(p); throw new Error('No se pudo abrir la cámara. Revisa el permiso, cierra otras apps de cámara o usa Leer imagen QR.'); }
    finally { p.cameraPending = false; }
  }
  startScreen(); root.querySelector('#local-exit').focus();
}
