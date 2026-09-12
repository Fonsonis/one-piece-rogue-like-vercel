// Vista del combate local: las cartas y animaciones son las mismas que en historia.
'use strict';
globalThis.LocalBattleView = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = new WeakMap();
  function update(root, match, session, playerName) {
    const data = match.battle, self = session.self, coop = session.view.mode === 'coop';
    const key = `${match.id}:${data.revision}:${session.view.paused}`;
    if (state.get(root)?.key === key) return;
    const hydrate = f => ({ ...makeChar(f.id, 30, false, true), ...f, st: { ...f.st } });
    const all = [...data.pTeam, ...data.eTeam].map(hydrate);
    const p = all.slice(0, data.pTeam.length), e = all.slice(data.pTeam.length);
    const reverse = !coop && e.some(f => f.owner === self);
    const b = { pTeam: reverse ? e : p, eTeam: reverse ? p : e, opts: { local: true, coop },
      speed: 1, round: data.round, over: data.over, waiting: session.view.paused, itemBuffs: new Map() };
    b.curP = b.pTeam.find(f => f.active) || b.pTeam.at(-1);
    b.curE = b.eTeam.find(f => f.active) || b.eTeam.at(-1);
    const event = data.event;
    if (coop && event) {
      const actor = [all[event.source], all[event.target]].find(f => p.includes(f));
      if (actor) b.curP = actor;
    }
    const old = state.get(root), fresh = !old || old.match !== match.id;
    state.set(root, { key, match: match.id, revision: data.revision });
    const labels = { p: esc(coop ? 'ALIANZA' : playerName(b.pTeam[0].owner)), e: esc(playerName(b.eTeam[0].owner)) };
    LocalCombat.withBattle(b, () => {
      if (fresh) root.innerHTML = battleLayoutHTML(data.lines.map(esc), labels);
      for (const [side, team, active] of [['p', b.pTeam, b.curP], ['e', b.eTeam, b.curE]]) {
        team.forEach((f, i) => {
          const card = root.querySelector(`#fc-${side}-${i}`);
          const template = document.createElement('template'); template.innerHTML = fighterCardHTML(f, side, i, active);
          const next = template.content.firstElementChild;
          card.className = next.className;
          // Conserva el nodo del sprite para que una actualización no corte sus animaciones.
          for (const selector of ['.fcard-title','.fcard-hp','.fcard-meters','.fcard-stats-mini']) {
            const current = card.querySelector(selector), replacement = next.querySelector(selector);
            if (current && replacement) current.innerHTML = replacement.innerHTML;
            else if (replacement) card.append(replacement);
            else current?.remove();
          }
          card.onclick = f.owner === self && f.active ? () => session.ultimate(match.id) : null;
        });
        root.querySelector(`#count-${side}`).textContent = battleTeamCount(side);
        root.querySelector(`#syn-${side}`).innerHTML = synChipsHTML(team);
        root.querySelector(`#passives-${side}`).innerHTML = battleTeamPassivesHTML(team);
      }
      const log = root.querySelector('#battle-log');
      const follow = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
      log.innerHTML = data.lines.map(line => `<div>${esc(line)}</div>`).join('');
      if (follow) log.scrollTop = log.scrollHeight;
      const own = all.filter(f => f.owner === self), active = own.find(f => f.active);
      const reserves = root.querySelector('#battle-reserves');
      if (own.length) {
        const reserveBattle = { ...b, pTeam: own, curP: active, switchUsed: !!data.relays[self] };
        reserves.innerHTML = LocalCombat.withBattle(reserveBattle, reservesHTML);
        reserves.querySelectorAll('[data-reserve]').forEach(button => {
          button.onclick = () => session.relay(match.id, Number(button.dataset.reserve));
        });
      } else reserves.replaceChildren();
      const controls = root.querySelector('#battle-controls');
      controls.innerHTML = `<p class="local-turn">Turno ${data.round}${event ? ` · ${esc(charName(all[event.source]))}` : ''}</p>${own.length ? `<button class="btn gold" data-ultimate="${match.id}" ${b.over || b.waiting || !active || active.hp <= 0 || active.ultCharge < 100 ? 'disabled' : ''}>⚡ Lanzar definitiva</button>` : '<p>Espectador</p>'}`;
      controls.querySelector('[data-ultimate]')?.addEventListener('click', event => {
        session.ultimate(match.id); event.currentTarget.disabled = true;
      });
      if (event && (!old || old.revision !== data.revision)) {
        const source = all[event.source], target = all[event.target];
        const before = new Map(all.map((f, i) => [f, event.before[i]]));
        BattlePresentation.attack(source, target, event.move, before, event.kind === 'ultimate');
        for (const f of all) {
          const delta = f.hp - before.get(f);
          if (!delta) continue;
          const side = b.pTeam.includes(f) ? 'p' : 'e', team = side === 'p' ? b.pTeam : b.eTeam;
          popDamageCard(root.querySelector(`#fc-${side}-${team.indexOf(f)}`), delta > 0 ? `+${delta}` : String(delta), delta > 0 ? '#78efb4' : null);
        }
        if (event.kind === 'ultimate' && globalThis.UltimateFX && globalThis.UltimateArtProfiles) {
          const stage = f => {
            const side = b.pTeam.includes(f) ? 'p' : 'e', team = side === 'p' ? b.pTeam : b.eTeam;
            return root.querySelector(`#fc-${side}-${team.indexOf(f)} .fcard-sprite`);
          };
          UltimateFX.play({ profile: UltimateArtProfiles.resolve(source.id, CHARS[source.id], event.move, baseFormOf(source.id)),
            source: stage(source), target: stage(target), owner: root, speed: 1, hit: target.hp < before.get(target),
            valid: () => root.isConnected && state.get(root)?.match === match.id });
        }
      }
    });
  }
  return Object.freeze({ update });
})();
