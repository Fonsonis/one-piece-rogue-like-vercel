import { LocalLink, decodeSignal } from './connection.mjs';
import { LocalSession, BOSSES, RULES } from './session.mjs';
import { formatRoomCode, normalizeRoomCode, roomSignal } from './signaling.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MODE = { duel: 'Duelo PvP', tournament: 'Torneo', coop: 'Alianza contra un yonko' };
export async function openLocal({ awardYonkoWin = () => ({ kind: 'not-earned' }), denDenAvailable = () => 4, consumeDenDen = () => true } = {}) {
  if (document.getElementById('local-multiplayer')) return;
  const engine = globalThis.LocalCombat;
  const root = document.createElement('div');
  root.id = 'local-multiplayer'; root.className = 'local-game'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'local-title');
  root.innerHTML = `<header class="local-header"><div><span class="local-eyebrow">DOS DISPOSITIVOS O MÁS · CONEXIÓN NECESARIA</span><h1 id="local-title">Multijugador</h1></div><button class="btn gray" id="local-exit">Salir</button></header><p class="local-notice" role="status" id="local-notice"></p><main id="local-content"></main>`;
  document.body.append(root);
  const original = document.getElementById('app'); original.inert = true;
  const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
  const main = root.querySelector('#local-content'), notice = root.querySelector('#local-notice');
  let session, guestLink, viewKey = '', timer, signalTimer, signalBusy = false, signalFailures = 0, closed = false, displayName = 'Pirata', rewardStatus;
  let roomCode = '', hostSecret = '', guestTicket = null;
  const links = new Map(); const room = crypto.randomUUID().replaceAll('-', '');
  const pendingJoins = new Map();
  const say = message => { notice.textContent = message; };
  const handle = fn => async event => { try { await fn(event); } catch (error) { say(error.message || 'No se pudo completar la operación.'); } };
  const onVisibility = () => { if (session) { session.visible = !document.hidden; session.pulse(); } };
  const onUnload = event => { if (session && session.view.players.length > 1) { event.preventDefault(); event.returnValue = ''; } };
  document.addEventListener('visibilitychange', onVisibility); window.addEventListener('beforeunload', onUnload);
  const leave = () => {
    const closingCode = roomCode, closingHost = hostSecret, closingGuest = guestTicket;
    session?.close(); for (const link of links.values()) link.close(); links.clear(); pendingJoins.clear(); guestLink?.close();
    clearInterval(timer); clearInterval(signalTimer); timer = signalTimer = null; session = null; viewKey = ''; guestLink = null; rewardStatus = null;
    roomCode = ''; hostSecret = ''; guestTicket = null; signalBusy = false; signalFailures = 0;
    if (closingHost) void roomSignal('close', { code: closingCode, hostSecret: closingHost }).catch(() => {});
    else if (closingGuest) void roomSignal('cancel', { code: closingCode, ...closingGuest }).catch(() => {});
  };
  root.querySelector('#local-exit').onclick = () => {
    if (session && !confirm(session.host ? '¿Cerrar la sala? Los demás jugadores perderán al anfitrión.' : '¿Salir de la partida local?')) return;
    closed = true; leave(); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('beforeunload', onUnload);
    original.inert = false; document.body.style.overflow = previousOverflow; root.remove(); document.getElementById('btn-local')?.focus();
  };
  function startScreen() {
    main.innerHTML = `<section class="local-intro"><div class="local-emblem" aria-hidden="true">🏴‍☠️ ⚔️ 🏴‍☠️</div><h2>Reúne a tu tripulación</h2><p>Duelo de 1, 3 o 6 nakamas, torneo de 3 a 8 jugadores o alianza de 2 a 8 contra un yonko.</p><div class="local-steps"><p><b>1.</b> Ambos dispositivos necesitan conexión: Wi-Fi, cable o un punto de acceso con datos.</p><p><b>2.</b> Un jugador crea la sala y comparte su código de 8 caracteres.</p><p><b>3.</b> Los demás introducen el código, eligen equipo y se marcan como listos.</p></div><label class="local-field">Tu nombre<input id="local-name" maxlength="24" autocomplete="nickname" value="${esc(displayName)}"></label><div class="local-actions"><button class="btn green" id="local-create">Crear sala</button></div><div class="local-join-box"><label class="local-field">Código de sala<input id="local-code" maxlength="9" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="ABCD-EFGH"></label><button class="btn blue" id="local-join">Unirse a la sala</button></div><p class="local-fine">Sin cuentas. El servicio solo intercambia los datos necesarios para conectar los dispositivos; la partida viaja directamente entre ellos. El anfitrión debe mantener el juego abierto.</p><details><summary>Si no conecta</summary><p>Comprueba que ambos dispositivos tienen Internet y pueden comunicarse por la misma Wi-Fi o punto de acceso. Evita redes de invitados, aislamiento de dispositivos y VPN.</p><p>El multijugador requiere conexión aunque hayas preparado una copia del juego para usarla sin Internet.</p></details></section>`;
    const supported = !!globalThis.RTCPeerConnection && !!globalThis.crypto?.subtle && isSecureContext;
    if (!supported) {
      say('Abre el juego mediante HTTPS o la aplicación instalada y utiliza un dispositivo compatible con WebRTC.');
      main.querySelectorAll('#local-create, #local-join').forEach(b => { b.disabled = true; });
    }
    main.querySelector('#local-code').oninput = event => { event.target.value = formatRoomCode(event.target.value); };
    main.querySelector('#local-code').onkeydown = event => { if (event.key === 'Enter') main.querySelector('#local-join').click(); };
    main.querySelector('#local-create').onclick = handle(async () => {
      displayName = main.querySelector('#local-name').value;
      const created = await roomSignal('create', { protocol: RULES }); roomCode = created.code; hostSecret = created.hostSecret;
      createSession(true); startSignalLoop(syncHost); say(`Sala ${formatRoomCode(roomCode)} creada. Comparte el código con los demás jugadores.`);
    });
    main.querySelector('#local-join').onclick = handle(async () => {
      displayName = main.querySelector('#local-name').value;
      const code = normalizeRoomCode(main.querySelector('#local-code').value);
      if (code.length !== 8) throw new Error('Introduce el código completo de 8 caracteres.');
      const joined = await roomSignal('join', { code, protocol: RULES }); roomCode = joined.code; guestTicket = { joinId: joined.joinId, guestSecret: joined.guestSecret };
      createSession(false); startSignalLoop(syncGuest); say('Solicitud enviada. Esperando al anfitrión…');
    });
  }
  function createSession(host) {
    say('');
    session = new LocalSession({ host, name: displayName, engine, roomId: room, denDenAvailable, consumeDenDen, send: packet => guestLink?.send(packet), onChange: renderSession, onError: message => {
      say(message); leave(); startScreen();
    } });
    session.visible = !document.hidden;
    timer = setInterval(() => { try { session?.pulse(); } catch (error) { say(`Partida pausada: ${error.message}`); clearInterval(timer); } }, 100);
    renderSession();
  }
  function renderSession() {
    if (!session || closed) return;
    const v = session.view;
    if (v.mode === 'coop' && v.phase === 'finished' && v.champion === 'alliance' && (rewardStatus?.match !== v.matches[0]?.rewardId || rewardStatus?.kind === 'save-failed')) {
      rewardStatus = { ...awardYonkoWin(v), match: v.matches[0]?.rewardId };
      if (rewardStatus.kind === 'save-failed') say('No se pudo guardar la recompensa. Revisa el almacenamiento del dispositivo antes de salir.');
    }
    const key = JSON.stringify(v) + session.self + rewardStatus?.kind + roomCode + (v.phase==='lobby'?denDenAvailable():'');
    if (key === viewKey) return; viewKey = key;
    const me = v.players.find(p => p.id === session.self);
    if (!me) { main.innerHTML = `<section class="local-intro"><h2>Conectando con ${esc(formatRoomCode(roomCode))}</h2><p>El anfitrión está preparando la conexión. Mantén el juego abierto.</p><button class="btn gray" id="local-back">Cancelar</button></section>`; main.querySelector('#local-back').onclick = () => { leave(); startScreen(); }; return; }
    const connected = v.players.filter(p => p.connected).length;
    const arena = main.querySelector('#local-arena');
    main.innerHTML = `<div class="local-room-heading"><h2>${esc(MODE[v.mode])}</h2><span class="local-badge">${session.host ? 'ANFITRIÓN' : 'INVITADO'} · ${connected}/${v.players.length} conectados</span></div>
      ${v.paused && v.phase !== 'lobby' ? '<p class="local-warning" role="status">Partida pausada. El anfitrión y los jugadores activos deben mantener el juego visible y la conexión abierta. Si alguien recargó o cerró el juego, cread una nueva sala.</p>' : ''}
      ${v.phase === 'lobby' ? lobbyHTML(v, me) : gameHTML(v, me)}`;
    if (session.host && v.phase !== 'lobby' && hostSecret) closeHostedRoom();
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
    return `<section class="local-panel"><div class="local-config"><label class="local-field">Modo<select id="local-mode" ${session.host ? '' : 'disabled'}>${Object.entries(MODE).map(([id, name]) => `<option value="${id}" ${id === v.mode ? 'selected' : ''}>${name}</option>`).join('')}</select></label><div class="local-den-den" role="status" aria-label="Den den mushis disponibles"><span aria-hidden="true">🐌</span><strong>${denDenAvailable()} / 4</strong><small>Den den mushis · uno por desafío yonkou · se renuevan cada día</small></div><label class="local-field">Nakamas por jugador<select id="local-size" ${session.host ? '' : 'disabled'}>${[1, 3, 6].map(n => `<option ${n === v.size ? 'selected' : ''}>${n}</option>`).join('')}</select></label>${v.mode === 'coop' ? `<label class="local-field">Yonko<select id="local-boss" ${session.host ? '' : 'disabled'}>${BOSSES.map(id => `<option value="${id}" ${id === v.boss ? 'selected' : ''}>${esc(engine.name(id))}</option>`).join('')}</select></label>` : ''}</div>
      <p class="local-fine">${v.mode === 'tournament' ? 'Eliminación directa · sorteo de cruces · pases de ronda para completar el cuadro · los empates se repiten.' : v.mode === 'coop' ? 'Cada jugador ataca con su nakama activo. El yonko responde a cada uno; sus PS escalan con jugadores y tamaño de equipos.' : 'Los ataques son automáticos. Tú decides cuándo lanzar la definitiva del nakama activo.'}</p>
      <div class="local-player-list">${v.players.map(p => `<div class="local-player"><span>${p.id === 'host' ? '👑' : '🏴‍☠️'} <b>${esc(p.name)}</b>${p.id === me.id ? ' (tú)' : ''}</span><span>${!p.connected ? 'Desconectado' : !p.visible ? 'En segundo plano' : v.mode==='coop' && p.denDen<1 ? 'Sin den den mushis' : p.ready ? '✓ Listo' : 'Eligiendo equipo'}</span>${session.host && p.id !== 'host' ? `<button class="btn gray small" data-remove="${p.id}" aria-label="Retirar a ${esc(p.name)}">Retirar</button>` : ''}</div>`).join('')}</div>
      ${session.host ? `<div class="local-room-code"><span>Código de sala</span><strong>${esc(formatRoomCode(roomCode))}</strong><button class="btn blue small" id="local-copy-code">Copiar código</button><small>Los invitados pueden entrar mientras permanezcas en esta sala.</small></div>` : `<p class="local-fine">Sala ${esc(formatRoomCode(roomCode))} · El anfitrión elige el modo y el tamaño de las tripulaciones.</p>`}</section>
      <section class="local-panel"><h3>Tu equipo · nivel 30</h3><p class="local-fine">Elige entre los personajes de tu cuenta y sus evoluciones desbloqueadas. El orden determina quién entra en combate.</p>${me.team.length < v.size ? `<p class="local-warning">Tienes ${session.roster.length} personajes disponibles. Necesitas ${v.size} para este equipo; el anfitrión puede reducir el tamaño.</p>` : ''}<div class="local-team-picker">${me.team.map((id, i) => `<label class="local-pick"><span>${engine.icon(id, 40)}</span><span>Nakama ${i + 1}<select aria-label="Nakama ${i + 1}" data-pick="${i}">${options}</select></span></label>`).join('')}</div><div class="local-actions"><button class="btn ${me.ready ? 'gray' : 'green'}" id="local-ready" ${me.team.length !== v.size || (v.mode==='coop' && denDenAvailable()<1) ? 'disabled' : ''}>${me.ready ? 'Dejar de estar listo' : 'Estoy listo'}</button>${session.host ? `<button class="btn gold" id="local-start" ${v.players.length < (v.mode === 'tournament' ? 3 : 2) || v.players.some(p => !p.ready || !p.connected || !p.visible || (v.mode==='coop' && p.denDen<1)) ? 'disabled' : ''}>Comenzar ${v.mode === 'tournament' ? 'torneo' : 'partida'}</button>` : ''}</div></section>`;
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
    main.querySelector('#local-copy-code')?.addEventListener('click', handle(async () => {
      try { await navigator.clipboard.writeText(formatRoomCode(roomCode)); say('Código de sala copiado.'); }
      catch { say(`Comparte este código: ${formatRoomCode(roomCode)}`); }
    }));
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
    const reward = v.mode === 'coop' && v.champion === 'alliance' ? rewardStatus?.kind === 'granted' || rewardStatus?.kind === 'already' ? '<p>🧭 +100.000 Log Poses · ⭐ +10.000 Fama para tu cuenta.</p>' : rewardStatus?.kind === 'limit' ? '<p>Límite diario alcanzado: 4 victorias recompensadas.</p>' : rewardStatus?.kind === 'save-failed' ? '<p>No se pudo guardar la recompensa.</p>' : '' : '';
    const result = v.phase === 'finished' ? `<div class="local-result" role="status"><span>🏆</span><h2>${v.champion === 'draw' ? '¡Empate!' : `¡${esc(playerName(v.champion))} gana!`}</h2><p>Partida amistosa completada.</p>${reward}</div>` : '';
    const bracket = v.mode === 'tournament' ? `<section class="local-panel"><h3>Cuadro del torneo · ronda ${v.round}</h3><div class="local-bracket">${v.matches.map(m => `<div class="local-match ${m.status === 'playing' ? 'is-playing' : ''}"><small>Ronda ${m.round}${m.attempt > 1 ? ` · Repetición ${m.attempt}` : ''}</small><b>${m.players.map(id => esc(playerName(id))).join(' vs ')}</b><span>${m.status === 'bye' ? 'Pasa de ronda' : m.status === 'replay' ? 'Empate · se repite' : m.status === 'playing' ? 'En combate' : `Gana ${esc(playerName(m.winner))}`}</span></div>`).join('')}</div></section>` : '';
    const battleHTML = focus ? '<div id="local-arena"></div>' : '<section class="local-panel"><p>Has pasado de ronda. Espera a que terminen los otros combates.</p></section>';
    return `${result}${bracket}${battleHTML}${session.host && v.phase === 'round-end' ? '<button class="btn green" id="local-next">Comenzar siguiente ronda</button>' : ''}${session.host && v.phase === 'finished' ? '<button class="btn green" id="local-rematch">Volver a la sala · otra partida</button>' : ''}`;
  }
  function startSignalLoop(task) {
    clearInterval(signalTimer); signalFailures = 0;
    signalTimer = setInterval(() => void runSignalTask(task), 1200);
    void runSignalTask(task);
  }
  async function runSignalTask(task) {
    if (signalBusy || !session || closed) return;
    signalBusy = true;
    try { await task(); signalFailures = 0; }
    catch (error) {
      signalFailures++;
      if (signalFailures >= 3) say(error.message || 'Se ha interrumpido el servicio de salas. Comprueba tu conexión.');
    } finally { signalBusy = false; }
  }
  async function createHostOffer(joinId) {
    const link = new LocalLink({ room,
      onState: state => {
        if (!session) return;
        if (['failed', 'closed', 'disconnected'].includes(state)) {
          if (session.view.players.some(player => player.id === link.id)) session.disconnect(link.id);
          else {
            pendingJoins.delete(joinId); session.peers.delete(link.id); links.delete(link.id);
            if (hostSecret) void roomSignal('reject', { code: roomCode, hostSecret, joinId, reason: 'No se pudo establecer la conexión directa.' }).catch(() => {});
          }
        }
        if (state === 'timeout' || state === 'failed') say('No se pudo conectar con un invitado. Comprobad que estáis en la misma Wi-Fi o punto de acceso.');
      },
      onMessage: packet => {
        if (!session) return;
        session.receive(link.id, packet);
        if (packet.type === 'hello' && session.view.players.some(player => player.id === link.id)) say('Jugador conectado a la sala.');
      },
    });
    pendingJoins.set(joinId, { link, accepting: false }); links.set(link.id, link);
    session.addPeer(link.id, packet => link.send(packet));
    try {
      const offer = await link.offer();
      await roomSignal('offer', { code: roomCode, hostSecret, joinId, offer });
    } catch (error) {
      pendingJoins.delete(joinId); links.delete(link.id); session.peers.delete(link.id); link.close();
      await roomSignal('reject', { code: roomCode, hostSecret, joinId, reason: error.message }).catch(() => {});
      throw error;
    }
  }
  async function syncHost() {
    if (!session?.host || !hostSecret || session.view.phase !== 'lobby') return;
    const result = await roomSignal('host-poll', { code: roomCode, hostSecret });
    for (const request of result.joins) {
      const pending = pendingJoins.get(request.joinId);
      if (request.status === 'answered' && pending && !pending.accepting) {
        pending.accepting = true;
        try {
          await pending.link.accept(await decodeSignal(request.answer));
          await roomSignal('complete', { code: roomCode, hostSecret, joinId: request.joinId });
          pendingJoins.delete(request.joinId);
        } catch (error) {
          pending.link.close(); links.delete(pending.link.id); session.peers.delete(pending.link.id); pendingJoins.delete(request.joinId);
          await roomSignal('reject', { code: roomCode, hostSecret, joinId: request.joinId, reason: 'No se pudo completar la conexión.' }).catch(() => {});
          throw error;
        }
        continue;
      }
      if (request.status !== 'waiting' || pending) continue;
      const max = session.view.mode === 'duel' ? 2 : 8;
      if (1 + session.peers.size >= max) {
        await roomSignal('reject', { code: roomCode, hostSecret, joinId: request.joinId, reason: 'La sala está completa.' });
      } else await createHostOffer(request.joinId);
    }
  }
  async function syncGuest() {
    if (!session || session.host || !guestTicket) return;
    const result = await roomSignal('guest-poll', { code: roomCode, ...guestTicket });
    if (result.status === 'rejected') {
      const message = result.reason || 'El anfitrión rechazó la solicitud.';
      leave(); startScreen(); say(message); return;
    }
    if (!result.offer || guestLink) return;
    const signal = await decodeSignal(result.offer);
    if (signal.type !== 'offer') throw new Error('La sala ha enviado una invitación incompatible.');
    const link = new LocalLink({ room: signal.room, link: signal.link,
      onState: state => {
        if (!session) return;
        if (state === 'connected') session.connected();
        if (['closed', 'failed', 'disconnected'].includes(state)) { session.disconnect(); say('Conexión interrumpida. Mantened ambos juegos abiertos y conectados a la misma red.'); }
      },
      onMessage: packet => {
        if (!session) return;
        session.receive('host', packet);
        if (packet.type === 'state' && session?.self) {
          clearInterval(signalTimer); signalTimer = null; guestTicket = null;
          say('Conectado al anfitrión. Elige tu equipo.');
        }
      },
    });
    guestLink = link;
    try {
      const answer = await link.answer(signal);
      await roomSignal('answer', { code: roomCode, ...guestTicket, answer });
      say('Conectando con el anfitrión…');
    } catch (error) { guestLink = null; link.close(); throw error; }
  }
  function closeHostedRoom() {
    const code = roomCode, token = hostSecret; hostSecret = '';
    clearInterval(signalTimer); signalTimer = null;
    void roomSignal('close', { code, hostSecret: token }).catch(() => {});
  }
  startScreen(); root.querySelector('#local-exit').focus();
}
