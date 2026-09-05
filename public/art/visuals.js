/* Presentation only. Animations never modify combat rules or character data.
 * Four authored poses per character: guard, windup, attack and recoil.
 * Never consume the game's random stream, change state, or delay a game action.
 */
(() => {
  'use strict';
  const originalIcon = charIcon;
  const originalAttack = attackWith;
  const originalUltimate = useUltimate;
  const originalSheet = showCharModal;
  const motions = new WeakMap();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let ultimateDepth = 0;

  const escape = value => String(value).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  charIcon = function(id, px = 26) {
    if (!Object.hasOwn(CHARS, id) || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return originalIcon.apply(this, arguments);
    }
    const size = Number.isFinite(Number(px)) ? Math.max(12, Math.min(256, Number(px))) : 26;
    return `<span class="dex-sprite" role="img" aria-label="${escape(CHARS[id].name)}" data-character="${id}" style="--sprite-size:${size}px;--sprite-atlas:url('/art/characters/${id}.png');--sprite-portrait:url('/art/portraits/${id}.png')"></span>`;
  };

  function safe(present) {
    // A browser without animation support must still run the original game.
    try { present(); } catch (_) { /* Cosmetic failure cannot interrupt combat. */ }
  }

  function cardFor(fighter) {
    if (!battle || !fighter) return null;
    const ally = battle.pTeam.includes(fighter);
    const team = ally ? battle.pTeam : battle.eTeam;
    const index = team.indexOf(fighter);
    return index < 0 ? null : document.getElementById(`fc-${ally ? 'p' : 'e'}-${index}`);
  }

  function animateSprite(sprite, kind, speed = 1, ultimate = false) {
    if (!sprite || !sprite.animate || !sprite.isConnected) return;
    const previous = motions.get(sprite);
    if (previous) previous.cancel();
    const duration = reducedMotion.matches ? 1 : (ultimate ? 600 : 480) / speed;
    const frames = kind === 'hurt' ? [
      { backgroundPosition: '100% 0', transform: 'translateX(0) rotate(0deg)', offset: 0 },
      { backgroundPosition: '100% 0', transform: 'translateX(-9px) rotate(-8deg)', offset: .24 },
      { backgroundPosition: '100% 0', transform: 'translateX(-4px) rotate(-3deg)', offset: .62, easing: 'steps(1,end)' },
      { backgroundPosition: '0% 0', transform: 'translateX(0) rotate(0deg)', offset: 1 }
    ] : [
      { backgroundPosition: '33.333333% 0', transform: 'translateX(-3px) scale(1)', offset: 0, easing: 'steps(1,end)' },
      { backgroundPosition: '33.333333% 0', transform: 'translateX(-5px) scale(1)', offset: .16, easing: 'steps(1,end)' },
      { backgroundPosition: '66.666667% 0', transform: `translateX(${ultimate ? 15 : 9}px) scale(${ultimate ? 1.08 : 1.03})`, offset: .25 },
      { backgroundPosition: '66.666667% 0', transform: 'translateX(6px) scale(1)', offset: .69, easing: 'steps(1,end)' },
      { backgroundPosition: '0% 0', transform: 'translateX(0) scale(1)', offset: 1 }
    ];
    sprite.dataset.motion = kind;
    const motion = sprite.animate(frames, { duration, easing: 'ease-out' });
    motions.set(sprite, motion);
    const cleanup = () => {
      if (motions.get(sprite) === motion) {
        motions.delete(sprite);
        delete sprite.dataset.motion;
      }
    };
    motion.finished.then(cleanup, cleanup);
  }

  function burst(host, type, ultimate, heal = false) {
    if (!host || reducedMotion.matches || !host.animate) return;
    const color = heal ? '#78efb4' : TYPES[type]?.color || '#ffda69';
    const node = document.createElement('span');
    node.className = `art-impact${ultimate ? ' art-impact-ultimate' : ''}${heal ? ' art-heal' : ''}`;
    node.setAttribute('aria-hidden', 'true');
    node.style.setProperty('--impact-color', color);
    host.appendChild(node);
    const fx = node.animate([
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.2) rotate(-15deg)' },
      { opacity: .85, transform: 'translate(-50%,-50%) scale(.8) rotate(0deg)', offset: .2 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.4) rotate(18deg)' }
    ], { duration: ultimate ? 550 : 400, easing: 'ease-out' });
    fx.finished.then(() => node.remove(), () => node.remove());
  }

  function presentAttack(attacker, defender, move, oldHP, oldSelfHP, oldTeamHP, ultimate) {
    if (!move) return;
    const source = cardFor(attacker);
    const target = cardFor(defender);
    const speed = Math.max(1, Number(battle?.speed) || 1);
    const healing = attacker.hp > oldSelfHP;
    animateSprite(source?.querySelector('.dex-sprite'), 'attack', speed, ultimate);
    if (healing) burst(source?.querySelector('.fcard-sprite'), move.type, ultimate, true);
    if (defender.hp < oldHP) {
      animateSprite(target?.querySelector('.dex-sprite'), 'hurt', speed);
      burst(target?.querySelector('.fcard-sprite'), move.type, ultimate);
    }
    for (const [fighter, hp] of oldTeamHP) {
      if (fighter !== defender && fighter !== attacker && fighter.hp < hp) {
        const card = cardFor(fighter);
        animateSprite(card?.querySelector('.dex-sprite'), 'hurt', speed);
        burst(card?.querySelector('.fcard-sprite'), move.type, false);
      }
    }
    if (ultimate) burst(source?.querySelector('.fcard-sprite'), move.type, true);
  }

  attackWith = function(attacker, defender, move) {
    // Read-only snapshot. Call the original once, synchronously, with every argument.
    const oldHP = defender?.hp;
    const oldSelfHP = attacker?.hp;
    const oldTeamHP = battle ? [...(battle.pTeam || []), ...(battle.eTeam || [])].map(f => [f, f.hp]) : [];
    const result = originalAttack.apply(this, arguments);
    safe(() => presentAttack(attacker, defender, move, oldHP, oldSelfHP, oldTeamHP, ultimateDepth > 0));
    return result;
  };

  useUltimate = function() {
    ultimateDepth++;
    try { return originalUltimate.apply(this, arguments); }
    finally { ultimateDepth--; }
  };

  showCharModal = function() {
    const result = originalSheet.apply(this, arguments);
    safe(() => {
      const sheets = document.querySelectorAll('.char-sheet-hero');
      const hero = sheets[sheets.length - 1];
      const sprite = hero?.querySelector('.dex-sprite');
      if (!sprite || hero.querySelector('.art-preview-button')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'art-preview-button';
      button.textContent = '▶ Ver ataque';
      button.setAttribute('aria-label', `Ver animación de ataque de ${CHARS[sprite.dataset.character].name}`);
      button.onclick = () => safe(() => {
        animateSprite(sprite, 'attack', .75);
        burst(hero.querySelector('.char-sheet-sprite'), CHARS[sprite.dataset.character].types[0], false);
      });
      hero.appendChild(button);
    });
    return result;
  };

  // A few legacy crossover/recruitment dialogs embed an emoji directly instead
  // of calling charIcon. Replace only their illustration, retaining their nodes
  // and all existing click handlers. Never inspect or reveal unseen Dex cards.
  function decorateLegacyDialogs(root) {
    const selector = '.special-card,.pick-row[data-pick],.reward-list,.modal > p';
    const containers = [...root.querySelectorAll(selector)];
    if (root.matches(selector)) containers.unshift(root);
    for (const container of containers) {
      if (container.querySelector('.dex-sprite')) continue;
      let id = container.dataset.pick;
      if (!Object.hasOwn(CHARS, id)) {
        const nameNode = container.querySelector('.char-name,b');
        const name = nameNode?.firstChild?.textContent?.trim();
        id = Object.keys(CHARS).find(key => CHARS[key].name === name);
      }
      if (!id) continue;
      const illustration = container.querySelector('.big-emoji,.emoji');
      if (illustration) {
        illustration.innerHTML = charIcon(id, illustration.classList.contains('big-emoji') ? 96 : 46);
        continue;
      }
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let text;
      while ((text = walker.nextNode())) {
        const index = text.textContent.indexOf(CHARS[id].emoji);
        if (index < 0) continue;
        const fragment = document.createDocumentFragment();
        fragment.append(document.createTextNode(text.textContent.slice(0, index)));
        const icon = document.createElement('span');
        icon.innerHTML = charIcon(id, 46);
        fragment.append(icon, document.createTextNode(text.textContent.slice(index + CHARS[id].emoji.length)));
        text.replaceWith(fragment);
        break;
      }
    }
  }
  if (typeof MutationObserver === 'function') {
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1) safe(() => decorateLegacyDialogs(node));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  // If the local save rendered the home screen before this script
  // finished downloading, refresh its existing icons without rerunning a screen.
  safe(() => {
    document.querySelectorAll('img.pix[alt]').forEach(image => {
      const id = Object.keys(CHARS).find(key => CHARS[key].name === image.alt);
      if (!id) return;
      const wrapper = document.createElement('span');
      wrapper.innerHTML = charIcon(id, parseFloat(image.style.height) || 26);
      image.replaceWith(wrapper.firstElementChild);
    });
  });
})();
