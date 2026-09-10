export const RULES = 'egghead-local-2';
export const DEFAULT_TEAM = ['luffy', 'zoro', 'nami', 'sanji', 'usopp', 'chopper'];
export const BOSSES = ['kaido', 'bigmom', 'shanks', 'teach', 'newgate'];
const cleanName = name => String(name || 'Pirata').replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 24) || 'Pirata';
const validRoster = (roster, engine) => Array.isArray(roster) && roster.length <= engine.roster.length &&
  new Set(roster).size === roster.length && roster.every(id => engine.roster.some(c => c.id === id));
const ownsTeam = (player, size, engine) => engine.validTeam(player.team, size) && player.team.every(id => player.roster.includes(id));
export function bracketPairs(ids, random = Math.random) {
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  let size = 2, seeds = [0, 1];
  while (size < ids.length) { size *= 2; seeds = seeds.flatMap(seed => [seed, size - 1 - seed]); }
  const ordered = seeds.map(seed => shuffled[seed] || null);
  return Array.from({ length: size / 2 }, (_, i) => ordered.slice(i * 2, i * 2 + 2));
}
export class LocalSession {
  constructor({ host, name, engine, send = () => false, onChange = () => {}, onError = () => {}, now = () => Date.now() }) {
    this.host = host; this.engine = engine; this.send = send; this.onChange = onChange; this.onError = onError; this.now = now;
    this.self = host ? 'host' : null; this.name = cleanName(name); this.visible = true; this.lastHost = now();
    this.peers = new Map(); this.arenas = new Map(); this.counter = 0; this.nextTick = 0;
    this.roster = engine.ownedRoster(); this.lastBroadcast = 0;
    this.view = { phase: 'lobby', mode: 'duel', size: 3, boss: 'kaido', round: 0, champion: null, paused: false,
      players: host ? [{ id: 'host', name: this.name, roster: [...this.roster], team: this.roster.slice(0, 3), ready: false, connected: true, visible: true }] : [], matches: [] };
  }
  notify() { this.onChange(this.view); }
  addPeer(id, send) {
    if (!this.host) return;
    this.peers.set(id, { send, lastSeen: this.now(), visible: true, connected: true });
  }
  connected() { if (!this.host) this.send({ type: 'hello', rules: RULES, name: this.name, roster: this.roster }); }
  disconnect(id) {
    if (!this.host) { this.view.paused = true; this.notify(); return; }
    const peer = this.peers.get(id); if (peer) peer.connected = false;
    const player = this.view.players.find(p => p.id === id);
    if (player) { player.connected = false; if (this.view.phase === 'lobby') player.ready = false; }
    this.refreshPause(); this.broadcast();
  }
  configure(config) {
    if (!this.host || this.view.phase !== 'lobby') return;
    const mode = ['duel', 'tournament', 'coop'].includes(config.mode) ? config.mode : this.view.mode;
    if (mode === 'duel' && this.view.players.length > 2) throw new Error('El duelo admite dos jugadores. Retira invitados o elige otro modo.');
    this.view.mode = mode;
    if ([1, 3, 6].includes(config.size)) this.view.size = config.size;
    if (BOSSES.includes(config.boss)) this.view.boss = config.boss;
    for (const p of this.view.players) {
      p.team = [...new Set([...p.team, ...p.roster])].filter(id => p.roster.includes(id)).slice(0, this.view.size); p.ready = false;
    }
    this.broadcast();
  }
  select(team) {
    if (!this.engine.validTeam(team, this.view.size) || team.some(id => !this.roster.includes(id))) throw new Error('Escoge una tripulación completa con personajes de tu cuenta, sin repetir nakamas.');
    this.action({ type: 'select', team });
  }
  ready(value) { this.action({ type: 'ready', ready: !!value }); }
  ultimate(match) { this.action({ type: 'command', match, action: 'ultimate' }); }
  relay(match, index) { this.action({ type: 'command', match, action: 'relay', index }); }
  action(packet) { this.host ? this.receive('host', packet) : this.send(packet); }
  receive(id, packet) {
    if (!packet || typeof packet.type !== 'string') return;
    if (!this.host) {
      if (packet.type === 'reject') { this.onError(String(packet.message).slice(0, 200)); return; }
      if (packet.type !== 'state' || packet.rules !== RULES || !validView(packet.view, this.engine)) return;
      if (typeof packet.self !== 'string' || !packet.view.players.some(p => p.id === packet.self)) return;
      this.self = packet.self; this.view = packet.view; this.lastHost = this.now(); this.notify(); return;
    }
    const peer = this.peers.get(id);
    if (id !== 'host' && !peer) return;
    if (peer) { peer.lastSeen = this.now(); peer.connected = true; }
    let player = this.view.players.find(p => p.id === id);
    if (packet.type === 'hello') {
      if (packet.rules !== RULES) { peer?.send({ type: 'reject', message: 'Las versiones del juego no coinciden. Recargad ambos dispositivos.' }); return; }
      if (!validRoster(packet.roster, this.engine)) { peer?.send({ type: 'reject', message: 'No se pudo leer el inventario del jugador.' }); return; }
      if (!player) {
        const max = this.view.mode === 'duel' ? 2 : 8;
        if (this.view.phase !== 'lobby' || this.view.players.length >= max) {
          peer?.send({ type: 'reject', message: 'La sala está completa o ya ha comenzado.' }); return;
        }
        player = { id, name: cleanName(packet.name), roster: [...packet.roster], team: packet.roster.slice(0, this.view.size), ready: false, connected: true, visible: true };
        this.view.players.push(player);
      }
      player.connected = true; this.broadcast(); return;
    }
    if (!player) return;
    if (packet.type === 'ping') {
      player.visible = packet.visible === true; player.connected = true;
      if (peer) peer.visible = player.visible;
      return;
    }
    if (packet.type === 'leave') { this.disconnect(id); return; }
    if (this.view.phase === 'lobby') {
      if (packet.type === 'select' && this.engine.validTeam(packet.team, this.view.size) && packet.team.every(id => player.roster.includes(id))) { player.team = [...packet.team]; player.ready = false; }
      if (packet.type === 'ready' && typeof packet.ready === 'boolean') player.ready = packet.ready && ownsTeam(player, this.view.size, this.engine);
      this.broadcast(); return;
    }
    if (packet.type === 'command' && !this.view.paused && typeof packet.match === 'string') {
      const b = this.arenas.get(packet.match);
      if (b && this.engine.command(b, id, packet.action, packet.index)) {
        this.view.matches.find(m => m.id === packet.match).battle = this.engine.snapshot(b); this.broadcast();
      }
    }
  }
  remove(id) {
    if (!this.host || this.view.phase !== 'lobby' || id === 'host') return;
    this.peers.get(id)?.send({ type: 'reject', message: 'El anfitrión te ha retirado de la sala.' });
    this.peers.delete(id); this.view.players = this.view.players.filter(p => p.id !== id); this.broadcast();
  }
  start() {
    if (!this.host || this.view.phase !== 'lobby') return;
    const v = this.view, n = v.players.length;
    if (n < (v.mode === 'tournament' ? 3 : 2) || n > (v.mode === 'duel' ? 2 : 8)) throw new Error(v.mode === 'tournament' ? 'El torneo necesita de 3 a 8 jugadores.' : 'Faltan jugadores para empezar.');
    if (v.players.some(p => !p.ready || !p.connected || !p.visible || !ownsTeam(p, v.size, this.engine))) throw new Error('Todos deben tener un equipo completo de su cuenta, estar conectados y listos.');
    v.phase = 'playing'; v.round = 1; v.matches = []; v.champion = null; this.arenas.clear();
    if (v.mode === 'tournament') this.makeRound(bracketPairs(v.players.map(p => p.id)));
    else this.addMatch(v.players.map(p => p.id));
    this.nextTick = this.now() + 2500; this.broadcast();
  }
  addMatch(ids, attempt = 1) {
    const participants = ids.filter(Boolean), matchId = `match-${++this.counter}`;
    const match = { id: matchId, round: this.view.round, players: participants, winner: null, status: 'playing', attempt, battle: null };
    if (participants.length === 1) { match.status = 'bye'; match.winner = participants[0]; }
    else {
      const b = this.engine.create(participants.map(id => this.view.players.find(p => p.id === id)), { mode: this.view.mode, boss: this.view.boss });
      b.nextTick = this.now() + 900;
      this.arenas.set(matchId, b); match.battle = this.engine.snapshot(b);
    }
    this.view.matches.push(match); return match;
  }
  makeRound(pairs) { for (const pair of pairs) this.addMatch(pair); }
  nextRound() {
    if (!this.host || this.view.phase !== 'round-end') return;
    const winners = this.view.matches.filter(m => m.round === this.view.round && m.winner && m.status !== 'replay').map(m => m.winner);
    this.view.round++; this.view.phase = 'playing';
    this.makeRound(Array.from({ length: winners.length / 2 }, (_, i) => winners.slice(i * 2, i * 2 + 2)));
    this.nextTick = this.now() + 2500; this.refreshPause(); this.broadcast();
  }
  reset() {
    if (!this.host || !['finished', 'round-end'].includes(this.view.phase)) return;
    this.view.phase = 'lobby'; this.view.round = 0; this.view.matches = []; this.view.champion = null; this.view.paused = false;
    this.arenas.clear(); for (const p of this.view.players) p.ready = false; this.broadcast();
  }
  refreshPause() {
    const required = new Set(this.view.matches.filter(m => m.status === 'playing').flatMap(m => {
      if (this.view.mode !== 'coop') return m.players;
      return m.players.filter(id => m.battle?.pTeam.some(f => f.owner === id && f.hp > 0));
    }));
    this.view.paused = !this.visible || this.view.players.some(p => required.has(p.id) && (!p.connected || !p.visible));
  }
  pulse() {
    const now = this.now();
    if (!this.host) {
      if (now - this.lastBroadcast >= 1000) { this.send({ type: 'ping', visible: this.visible }); this.lastBroadcast = now; }
      if (now - this.lastHost > 6500 && !this.view.paused) { this.view.paused = true; this.notify(); }
      return;
    }
    this.view.players[0].visible = this.visible;
    for (const p of this.view.players.slice(1)) {
      const peer = this.peers.get(p.id);
      p.connected = !!peer?.connected && now - peer.lastSeen < 6500;
      p.visible = !!peer?.visible;
      if (!p.connected && this.view.phase === 'lobby') p.ready = false;
    }
    const wasPaused = this.view.paused;
    this.refreshPause(); let changed = wasPaused !== this.view.paused;
    if (this.view.phase === 'playing' && !this.view.paused) {
      for (const match of [...this.view.matches].filter(m => m.status === 'playing')) {
        const b = this.arenas.get(match.id);
        if (now < b.nextTick) continue;
        this.engine.tick(b); b.nextTick = now + b.delay; match.battle = this.engine.snapshot(b); changed = true;
        if (b.over) {
          match.status = 'done';
          match.winner = b.winner === 'draw' ? null : b.winner === 'p' ? (this.view.mode === 'coop' ? 'alliance' : match.players[0]) : (this.view.mode === 'coop' ? 'yonko' : match.players[1]);
          if (this.view.mode === 'tournament' && !match.winner) {
            match.status = 'replay'; this.addMatch(match.players, match.attempt + 1);
          }
        }
      }
      if (!this.view.matches.some(m => m.status === 'playing')) {
        const winners = this.view.matches.filter(m => m.round === this.view.round && m.status !== 'replay').map(m => m.winner);
        if (this.view.mode === 'tournament' && winners.length > 1) this.view.phase = 'round-end';
        else { this.view.phase = 'finished'; this.view.champion = winners[0] || 'draw'; }
      }
    }
    if (changed || now - this.lastBroadcast >= 1000) this.broadcast();
  }
  broadcast() {
    this.lastBroadcast = this.now();
    this.notify();
    for (const p of this.view.players.slice(1)) this.peers.get(p.id)?.send({ type: 'state', rules: RULES, self: p.id, view: this.view });
  }
  close() { if (!this.host) this.send({ type: 'leave' }); this.peers.clear(); this.arenas.clear(); }
}
export function validView(v, engine) {
  if (!v || !['lobby', 'playing', 'round-end', 'finished'].includes(v.phase) || !['duel', 'tournament', 'coop'].includes(v.mode) ||
      ![1, 3, 6].includes(v.size) || !BOSSES.includes(v.boss) || typeof v.paused !== 'boolean' ||
      !Number.isInteger(v.round) || v.round < 0 || v.round > 3 || !Array.isArray(v.players) || v.players.length < 1 || v.players.length > 8 ||
      !Array.isArray(v.matches) || v.matches.length > 40) return false;
  const ids = new Set();
  for (const p of v.players) {
    if (!p || typeof p.id !== 'string' || !/^(host|[a-f0-9]{32})$/.test(p.id) || ids.has(p.id) ||
        typeof p.name !== 'string' || p.name.length > 24 || !validRoster(p.roster, engine) || !Array.isArray(p.team) || p.team.length > v.size ||
        p.team.some(id => !p.roster.includes(id)) || !engine.validSelection(p.team) ||
        new Set(p.team).size !== p.team.length || ((p.ready || v.phase !== 'lobby') && !ownsTeam(p, v.size, engine)) ||
        ['ready', 'connected', 'visible'].some(key => typeof p[key] !== 'boolean')) return false;
    ids.add(p.id);
  }
  const characterIds = new Set(engine.roster.map(c => c.id));
  for (const m of v.matches) {
    if (!m || typeof m.id !== 'string' || !/^match-\d+$/.test(m.id) || !Number.isInteger(m.round) || m.round < 1 || m.round > 3 ||
        !Array.isArray(m.players) || m.players.length < 1 || m.players.length > 8 || m.players.some(id => !ids.has(id)) ||
        !['playing', 'done', 'bye', 'replay'].includes(m.status) ||
        (m.winner !== null && !ids.has(m.winner) && !['alliance', 'yonko'].includes(m.winner))) return false;
    const b = m.battle;
    if (!b) { if (m.status !== 'bye') return false; continue; }
    if (!Number.isInteger(b.revision) || b.revision < 0 || !Number.isInteger(b.round) || b.round < 1 || b.round > 2000 || typeof b.over !== 'boolean' ||
        !['p', 'e', 'draw', null].includes(b.winner) || !Array.isArray(b.pTeam) || b.pTeam.length > 48 ||
        !Array.isArray(b.eTeam) || b.eTeam.length > 6 || !Array.isArray(b.lines) || b.lines.length > 12 ||
        b.lines.some(line => typeof line !== 'string' || line.length > 600)) return false;
    for (const f of [...b.pTeam, ...b.eTeam]) {
      if (!f || !characterIds.has(f.id) || (!ids.has(f.owner) && f.owner !== 'yonko') || !Number.isFinite(f.maxhp) ||
          f.maxhp < 1 || f.maxhp > 100000000 || !Number.isFinite(f.hp) || f.hp < 0 || f.hp > f.maxhp ||
          !Number.isFinite(f.ultCharge) || f.ultCharge < 0 || f.ultCharge > 100 || typeof f.active !== 'boolean' ||
          ['atk','def','spatk','spdef','spd'].some(key => !Number.isFinite(f[key]) || f[key] < 0 || f[key] > 100000000) ||
          !f.st || Object.keys(f.st).length > 25 || Object.values(f.st).some(value => typeof value !== 'boolean' && (!Number.isFinite(value) || Math.abs(value) > 100000000))) return false;
    }
    if (!b.relays || Object.keys(b.relays).some(id => !ids.has(id) || b.relays[id] !== true)) return false;
    if (b.event) {
      const event = b.event, count = b.pTeam.length + b.eTeam.length;
      if (!['attack','ultimate'].includes(event.kind) || !Number.isInteger(event.source) || event.source < 0 || event.source >= count ||
          !Number.isInteger(event.target) || event.target < 0 || event.target >= count || !event.move ||
          typeof event.move.name !== 'string' || event.move.name.length > 150 || typeof event.move.type !== 'string' || event.move.type.length > 40 ||
          !Array.isArray(event.before) || event.before.length !== count || event.before.some(hp => !Number.isFinite(hp) || hp < 0 || hp > 100000000)) return false;
    }
  }
  return v.champion === null || ids.has(v.champion) || ['draw', 'alliance', 'yonko'].includes(v.champion);
}
