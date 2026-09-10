// Adaptador síncrono: reutiliza las reglas del juego sin tocar su viaje ni su guardado.
'use strict';
globalThis.LocalCombat = (() => {
  const roster = Object.entries(CHARS).map(([id, c]) => ({ id, name: c.name, types: c.types }));
  const allowed = new Set(roster.map(c => c.id));
  function ownedRoster() {
    const bases = [...new Set(['luffy', ...(meta.roster || [])].filter(id => allowed.has(id)).map(baseFormOf))];
    return bases.filter(isNakamaUnlocked).map(id => evolutionFormAt(id, startLvlOf(id)));
  }
  const withBattle = (sessionBattle, fn) => {
    const previous = battle;
    battle = sessionBattle;
    try { return fn(); } finally { battle = previous; }
  };
  function validSelection(ids) {
    return Array.isArray(ids) && ids.length <= 6 &&
      new Set(ids.map(id => allowed.has(id) ? baseFormOf(id) : id)).size === ids.length && ids.every(id => typeof id === 'string' && allowed.has(id));
  }
  function validTeam(ids, size) {
    return [1, 3, 6].includes(size) && validSelection(ids) && ids.length === size;
  }
  function crew(player) {
    if (!validTeam(player.team, player.team.length)) throw new Error('Tripulación inválida.');
    return player.team.map(id => ({ ...makeChar(id, 30, false, true), owner: player.id }));
  }
  function create(players, options = {}) {
    if (players.length < 2 || players.length > 8) throw new Error('Se necesitan entre 2 y 8 jugadores.');
    const coop = options.mode === 'coop';
    const pTeam = coop ? players.flatMap(crew) : crew(players[0]);
    const eTeam = coop ? [{ ...makeChar(options.boss || 'kaido', 30, false, true), owner: 'yonko' }] : crew(players[1]);
    if (coop) {
      const strength = players.length * players[0].team.length;
      const boss = eTeam[0];
      boss.maxhp = boss.hp = Math.round(boss.maxhp * strength * 2.5);
      boss.atk = Math.round(boss.atk * (1.25 + .12 * players.length));
      boss.spatk = Math.round(boss.spatk * (1.25 + .12 * players.length));
      boss.def = Math.round(boss.def * 1.15);
      boss.spdef = Math.round(boss.spdef * 1.15);
    }
    const b = { pTeam, eTeam, curP: pTeam[0], curE: eTeam[0], round: 1,
      opts: { local: true, coop }, over: false, winner: null,
      firstHit: { p: true, e: true }, localGuard: { p: false, e: false }, lines: [],
      participants: players.map(p => p.id), commands: {}, revision: 0, speed: 1,
      activeByOwner: {}, relays: {}, turns: [], event: null, delay: 900 };
    for (const f of [...pTeam, ...eTeam]) b.activeByOwner[f.owner] ??= f;
    [...pTeam, ...eTeam].forEach(f => { f.st = {}; f.dodgeLeft = passiveRule(f).dodge || 0; });
    b.lines.push(coop ? '¡Toda la alianza contra el yonko!' : '¡Comienza el duelo amistoso!');
    return b;
  }
  function activeFor(b, owner) {
    const previous = b.activeByOwner[owner];
    if (previous?.hp > 0) return previous;
    return b.activeByOwner[owner] = [...b.pTeam, ...b.eTeam].find(f => f.owner === owner && f.hp > 0);
  }
  function command(b, playerId, action, index) {
    if (b.over || !b.participants.includes(playerId)) return false;
    const fighter = b.activeByOwner[playerId];
    if (!fighter || fighter.hp <= 0) return false;
    if (action === 'relay') {
      const next = [...b.pTeam, ...b.eTeam].filter(f => f.owner === playerId)[index];
      if (b.relays[playerId] || !fighter || !next || next === fighter || next.hp <= 0) return false;
      b.activeByOwner[playerId] = next; b.relays[playerId] = true;
      if (b.curP === fighter) b.curP = next;
      if (b.curE === fighter) b.curE = next;
      delete b.commands[playerId]; b.revision++; b.event = null;
      b.lines.push(`🔄 ${charName(fighter)} se retira. ¡Adelante, ${charName(next)}! Relevo utilizado.`);
      b.lines = b.lines.slice(-12);
      return true;
    }
    if (action !== 'ultimate') return false;
    if (!fighter || fighter.ultCharge < 100 || b.commands[playerId]) return false;
    b.commands[playerId] = action;
    return true;
  }
  function tick(b) {
    if (b.over) return;
    withBattle(b, () => {
      b.event = null;
      const allies = () => (b.opts.coop ? b.participants : [b.participants[0]]).map(id => activeFor(b, id)).filter(Boolean);
      const enemy = () => activeFor(b, b.opts.coop ? 'yonko' : b.participants[1]);
      if (!b.turns.length && !b.endRound) {
        const active = allies(); b.roundOwners = active.map(f => f.owner);
        for (const p of active) {
          const e = enemy(); b.curP = p; b.curE = e;
          if (!e) break;
          // Mismo orden y ritmo que runRound; las referencias de propietario permiten el relevo.
          const pair = [[p.owner, e.owner], [e.owner, p.owner]];
          b.turns.push(...(effectiveSpeed(p) >= effectiveSpeed(e) ? pair : pair.reverse()));
        }
        b.endRound = true;
      }
      if (b.turns.length) {
        const [source, target] = b.turns.shift();
        const attacker = b.activeByOwner[source], defender = b.activeByOwner[target];
        if (attacker?.hp > 0 && defender?.hp > 0) {
          b.curP = b.pTeam.includes(attacker) ? attacker : defender;
          b.curE = b.eTeam.includes(attacker) ? attacker : defender;
          const ultimate = b.commands[source] === 'ultimate' && attacker.ultCharge >= 100;
          const move = ultimate ? getUltimateMove(attacker) : chooseMove(attacker, defender);
          const all = [...b.pTeam, ...b.eTeam], before = all.map(f => f.hp);
          if (ultimate) { delete b.commands[source]; useUltimate(attacker); }
          else attackWith(attacker, defender, move, b.pTeam.includes(attacker) ? 'enemy' : 'player');
          b.event = { kind: ultimate ? 'ultimate' : 'attack', source: all.indexOf(attacker), target: all.indexOf(defender),
            move: { name: move.name, type: move.type }, before };
        }
        b.delay = 900;
      } else {
        b.localActors = [...b.roundOwners.map(id => b.activeByOwner[id]), b.activeByOwner[b.opts.coop ? 'yonko' : b.participants[1]]].filter(Boolean);
        b.curP = b.localActors.find(f => b.pTeam.includes(f)) || b.curP;
        b.curE = b.localActors.find(f => b.eTeam.includes(f)) || b.curE;
        afterRound();
        b.endRound = false; b.delay = 1200;
        b.curP = allies()[0]; b.curE = enemy();
      }
      b.revision++;
    });
  }
  function snapshot(b) {
    const fighter = f => ({ id: f.id, owner: f.owner, hp: f.hp, maxhp: f.maxhp,
      atk: f.atk, def: f.def, spatk: f.spatk, spdef: f.spdef, spd: f.spd, st: { ...f.st },
      ultCharge: f.ultCharge, active: b.activeByOwner[f.owner] === f });
    return { round: b.round, over: b.over, winner: b.winner, revision: b.revision,
      pTeam: b.pTeam.map(fighter), eTeam: b.eTeam.map(fighter), lines: [...b.lines],
      relays: { ...b.relays }, event: b.event };
  }
  return Object.freeze({ roster, ownedRoster, validSelection, validTeam, create, command, tick, snapshot, withBattle,
    icon: (id, size = 36) => allowed.has(id) ? charIcon(id, size) : '',
    name: id => allowed.has(id) ? CHARS[id].name : 'Nakama',
    home: () => screenHome(),
  });
})();
