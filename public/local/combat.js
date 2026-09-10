// Adaptador síncrono: reutiliza las reglas del juego sin tocar su viaje ni su guardado.
'use strict';
globalThis.LocalCombat = (() => {
  const roster = Object.entries(CHARS).map(([id, c]) => ({ id, name: c.name, types: c.types }));
  const allowed = new Set(roster.map(c => c.id));
  const withBattle = (sessionBattle, fn) => {
    const previous = battle;
    battle = sessionBattle;
    try { return fn(); } finally { battle = previous; }
  };
  function validTeam(ids, size) {
    return [1, 3, 6].includes(size) && Array.isArray(ids) && ids.length === size &&
      new Set(ids).size === size && ids.every(id => typeof id === 'string' && allowed.has(id));
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
      participants: players.map(p => p.id), commands: {}, revision: 0 };
    [...pTeam, ...eTeam].forEach(f => { f.st = {}; f.dodgeLeft = passiveRule(f).dodge || 0; });
    b.lines.push(coop ? '¡Toda la alianza contra el yonko!' : '¡Comienza el duelo amistoso!');
    return b;
  }
  function command(b, playerId, action) {
    if (b.over || !b.participants.includes(playerId) || action !== 'ultimate') return false;
    const fighter = [...b.pTeam, ...b.eTeam].find(f => f.owner === playerId && f.hp > 0);
    if (!fighter || fighter.ultCharge < 100 || b.commands[playerId]) return false;
    b.commands[playerId] = action;
    return true;
  }
  function tick(b) {
    if (b.over) return;
    withBattle(b, () => {
      const active = b.opts.coop
        ? b.participants.map(id => b.pTeam.find(f => f.owner === id && f.hp > 0)).filter(Boolean)
        : [b.curP];
      // En cooperativo cada jugador vivo actúa y recibe una respuesta del yonko.
      const pairs = active.map(f => [f, b.curE]);
      b.localActors = [...active, b.curE];
      for (const [p, e] of pairs) {
        b.curP = p;
        const pSpeed = effectiveSpeed(p), eSpeed = effectiveSpeed(e);
        const first = pSpeed === eSpeed ? Math.random() < .5 : pSpeed > eSpeed;
        const order = first ? [p, e] : [e, p];
        for (const attacker of order) {
          const defender = attacker === p ? e : p;
          if (attacker.hp <= 0 || defender.hp <= 0) continue;
          const ultimate = b.commands[attacker.owner] === 'ultimate' && attacker.ultCharge >= 100;
          if (ultimate) { attacker.ultCharge = 0; log(`¡Definitiva de ${charName(attacker)}!`); }
          attackWith(attacker, defender, ultimate ? getUltimateMove(attacker) : chooseMove(attacker, defender), attacker === p ? 'enemy' : 'player');
        }
      }
      b.commands = {};
      // El drenaje del yonko se aplica a un único objetivo por ronda.
      b.curP = active[0];
      afterRound();
      b.revision++;
    });
  }
  function snapshot(b) {
    const fighter = f => ({ id: f.id, owner: f.owner, hp: f.hp, maxhp: f.maxhp,
      ultCharge: f.ultCharge, active: b.opts.coop && b.pTeam.includes(f)
        ? b.pTeam.find(x => x.owner === f.owner && x.hp > 0) === f
        : f === b.curP || f === b.curE });
    return { round: b.round, over: b.over, winner: b.winner, revision: b.revision,
      pTeam: b.pTeam.map(fighter), eTeam: b.eTeam.map(fighter), lines: [...b.lines] };
  }
  return Object.freeze({ roster, validTeam, create, command, tick, snapshot,
    icon: (id, size = 36) => allowed.has(id) ? charIcon(id, size) : '',
    name: id => allowed.has(id) ? CHARS[id].name : 'Nakama',
    home: () => screenHome(),
  });
})();
