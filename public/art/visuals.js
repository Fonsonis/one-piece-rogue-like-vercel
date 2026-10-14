
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



  const crewSpriteMetrics = {
    "unit_056": {"--unit_393-scale":0.9696969696969697,"--unit_393-shift":0,"--portrait-scale":0.8354430379746836,"--portrait-shift":0,"--motion-fit-x":0.7214872797605792,"--motion-fit-y":1.0513961100069789,"--motion-floor":0.14389493034591302,"--motion-center":0},
    "unit_056-jaya": {"--unit_393-scale":1.258119658119658,"--unit_393-shift":0,"--portrait-scale":0.960759493670886,"--portrait-shift":0,"--motion-fit-x":0.5660279127613724,"--motion-fit-y":0.8534675942130038,"--motion-floor":0.18130342244879996,"--motion-center":0},
    "unit_066-guild_05": {"--unit_393-scale":0.834783,"--unit_393-shift":0,"--portrait-scale":0.86087,"--portrait-shift":0,"--motion-fit-x":1.203008,"--motion-fit-y":1.203008,"--motion-floor":0.050821,"--motion-center":0},
    "unit_047-guild_01": {"--unit_393-scale":0.695652,"--unit_393-shift":0,"--portrait-scale":0.717391,"--portrait-shift":0,"--motion-fit-x":1.432836,"--motion-fit-y":1.432836,"--motion-floor":0.045371,"--motion-center":0},
    "unit_047-guild_06": {"--unit_393-scale":0.695652,"--unit_393-shift":0,"--portrait-scale":0.717391,"--portrait-shift":0,"--motion-fit-x":1.432836,"--motion-fit-y":1.432836,"--motion-floor":0.045371,"--motion-center":0},
    "unit_050-guild_14": {"--unit_393-scale":0.834783,"--unit_393-shift":0,"--portrait-scale":0.86087,"--portrait-shift":0,"--motion-fit-x":1.203008,"--motion-fit-y":1.203008,"--motion-floor":0.050821,"--motion-center":0},
    "unit_060-guild_06": {"--unit_393-scale":0.775758,"--unit_393-shift":0,"--portrait-scale":0.8,"--portrait-shift":0,"--motion-fit-x":1.290848,"--motion-fit-y":1.432836,"--motion-floor":0.048509,"--motion-center":0},
    "unit_060-guild_07": {"--unit_393-scale":0.695652,"--unit_393-shift":0,"--portrait-scale":0.717391,"--portrait-shift":0,"--motion-fit-x":1.432836,"--motion-fit-y":1.432836,"--motion-floor":0.045371,"--motion-center":0},
    "unit_073-guild_08": {"--unit_393-scale":0.820513,"--unit_393-shift":0,"--portrait-scale":0.846154,"--portrait-shift":0,"--motion-fit-x":1.22313,"--motion-fit-y":1.22313,"--motion-floor":0.050262,"--motion-center":0},
    "unit_073-unit_051": {"--unit_393-scale":0.914286,"--unit_393-shift":0,"--portrait-scale":0.942857,"--portrait-shift":0,"--motion-fit-x":1.102001,"--motion-fit-y":1.245829,"--motion-floor":0.053935,"--motion-center":0},
    "unit_056-guild_08": {"--unit_393-scale":0.695652,"--unit_393-shift":0.001812,"--portrait-scale":0.717391,"--portrait-shift":0.001868,"--motion-fit-x":1.432836,"--motion-fit-y":1.432836,"--motion-floor":0.045371,"--motion-center":0.001812},
    "unit_057-guild_19": {"--unit_393-scale":0.695652,"--unit_393-shift":0.001812,"--portrait-scale":0.717391,"--portrait-shift":0.001868,"--motion-fit-x":1.432836,"--motion-fit-y":1.432836,"--motion-floor":0.045371,"--motion-center":0.001812},
    "unit_055-unit_051": {"--unit_393-scale":0.695652,"--unit_393-shift":0,"--portrait-scale":0.717391,"--portrait-shift":0,"--motion-fit-x":1.432836,"--motion-fit-y":1.432836,"--motion-floor":0.045371,"--motion-center":0},
    "unit_034-unit_051": {"--unit_393-scale":0.695652,"--unit_393-shift":0.001812,"--portrait-scale":0.717391,"--portrait-shift":0.001868,"--motion-fit-x":1.432836,"--motion-fit-y":1.432836,"--motion-floor":0.045371,"--motion-center":0.001812},
    "unit_034-guild_07": {"--unit_393-scale":0.757396,"--unit_393-shift":0,"--portrait-scale":0.781065,"--portrait-shift":0,"--motion-fit-x":1.32085,"--motion-fit-y":1.32085,"--motion-floor":0.04779,"--motion-center":0},
    "unit_042-guild_14": {"--unit_393-scale":0.695652,"--unit_393-shift":0.001812,"--portrait-scale":0.717391,"--portrait-shift":0.001868,"--motion-fit-x":1.432836,"--motion-fit-y":1.432836,"--motion-floor":0.045371,"--motion-center":0.001812},
    "unit_122-guild_07": {"--unit_393-scale":0.775758,"--unit_393-shift":0,"--portrait-scale":0.8,"--portrait-shift":0,"--motion-fit-x":1.290848,"--motion-fit-y":1.432836,"--motion-floor":0.048509,"--motion-center":0},
    "unit_127-guild_07": {"--unit_393-scale":0.695652,"--unit_393-shift":0.001812,"--portrait-scale":0.717391,"--portrait-shift":0.001868,"--motion-fit-x":1.432836,"--motion-fit-y":1.432836,"--motion-floor":0.045371,"--motion-center":0.001812},
    "unit_202-guild_23": {"--unit_393-scale":0.723164,"--unit_393-shift":0,"--portrait-scale":0.745763,"--portrait-shift":0,"--motion-fit-x":1.380678,"--motion-fit-y":1.432836,"--motion-floor":0.046449,"--motion-center":0},
    "unit_251-guild_14": {"--unit_393-scale":0.695652,"--unit_393-shift":0.001812,"--portrait-scale":0.717391,"--portrait-shift":0.001868,"--motion-fit-x":1.432836,"--motion-fit-y":1.432836,"--motion-floor":0.045371,"--motion-center":0.001812},
    "unit_358-guild_23": {"--unit_393-scale":0.723164,"--unit_393-shift":0,"--portrait-scale":0.745763,"--portrait-shift":0,"--motion-fit-x":1.380678,"--motion-fit-y":1.432836,"--motion-floor":0.046449,"--motion-center":0},
    "unit_359-guild_23": {"--unit_393-scale":0.744186,"--unit_393-shift":0,"--portrait-scale":0.767442,"--portrait-shift":0,"--motion-fit-x":1.343313,"--motion-fit-y":1.432836,"--motion-floor":0.047272,"--motion-center":0},
    "unit_365-guild_11": {"--unit_393-scale":0.739884,"--unit_393-shift":0,"--portrait-scale":0.763006,"--portrait-shift":0,"--motion-fit-x":1.350793,"--motion-fit-y":1.350793,"--motion-floor":0.047104,"--motion-center":0},
    "unit_542": {"--unit_393-scale":1.147259,"--unit_393-shift":0,"--portrait-scale":1.010886,"--portrait-shift":-0.002633,"--motion-fit-x":0.966089,"--motion-fit-y":1.192912,"--motion-floor":0.015625,"--motion-center":0},
    "unit_543": {"--unit_393-scale":1.114245,"--unit_393-shift":-0.002902,"--portrait-scale":1.010886,"--portrait-shift":0,"--motion-fit-x":1.374282,"--motion-fit-y":1.067396,"--motion-floor":0.015625,"--motion-center":-0.002902},
    "unit_544": {"--unit_393-scale":1.312542,"--unit_393-shift":-0.003418,"--portrait-scale":1.010886,"--portrait-shift":0,"--motion-fit-x":0.847655,"--motion-fit-y":1.192324,"--motion-floor":0.015625,"--motion-center":-0.003418},
    "unit_545": {"--unit_393-scale":1.1264,"--unit_393-shift":0,"--portrait-scale":0.924841,"--portrait-shift":0,"--motion-fit-x":0.983429,"--motion-fit-y":1.240747,"--motion-floor":0.015625,"--motion-center":0},
    "unit_551": {"--unit_393-scale":0.998582,"--unit_393-shift":-0.0026,"--portrait-scale":0.918987,"--portrait-shift":0,"--motion-fit-x":1.144422,"--motion-fit-y":1.186806,"--motion-floor":0.015629,"--motion-center":-0.0026},
    "unit_575": {"--unit_393-scale":0.901408,"--unit_393-shift":0,"--portrait-scale":0.835443,"--portrait-shift":-0.002176,"--motion-fit-x":1.219538,"--motion-fit-y":1.432836,"--motion-floor":0.015871,"--motion-center":0}
  };


  safe(() => {
    const style = document.createElement('style');
    style.textContent = Object.entries(crewSpriteMetrics).map(([id, metrics]) => {
      const bounds = Object.entries(metrics).filter(([property]) => property.startsWith('--motion-'));
      return `.fcard-sprite .sprite:has(> .dex-sprite[data-sprite-id="${id}"]){${bounds.map(([property, value]) => `${property}:${value};`).join('')}}`;
    }).join('\n');
    document.head.appendChild(style);
  });

  charIcon = function(id, px = 26, crewId = null) {
    if (!Object.hasOwn(CHARS, id) || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      return originalIcon.apply(this, arguments);
    }
    const size = Number.isFinite(Number(px)) ? Math.max(12, Math.min(256, Number(px))) : 26;
    const spriteId = crewSkinFor(id, crewId) || CHARS[id].spriteId || id;
    const metrics = Object.entries(crewSpriteMetrics[spriteId] || {}).map(([property, value]) => `${property}:${value};`).join('');
    return `<span class="dex-sprite" role="img" aria-label="${escape(CHARS[id].name)}" data-character="${id}" data-sprite-id="${spriteId}" style="--sprite-size:${size}px;${metrics}--sprite-unit_393:url('/art/characters/${spriteId}.png');--sprite-portrait:url('/art/portraits/${spriteId}.png')"></span>`;
  };

  function safe(present) {

    try { present(); } catch (_) {  }
  }

  function cardFor(fighter) {
    if (!battle || !fighter) return null;
    const ally = battle.pTeam.includes(fighter);
    const team = ally ? battle.pTeam : battle.eTeam;
    const index = team.indexOf(fighter);
    return index < 0 ? null : document.getElementById(`fc-${ally ? 'p' : 'e'}-${index}`);
  }

  function animateSprite(sprite, kind, unit_370 = 1, ultimate = false, targetHost = null) {
    if (!sprite || !sprite.animate || !sprite.isConnected) return;
    const previous = motions.get(sprite);
    if (previous) previous.cancel();
    const VanguardAttack=kind==='attack'&&/^unit_00[1-7]$/.test(sprite.dataset.character)&&globalThis.UltimateFX;
    if(VanguardAttack&&sprite.dataset.character==="unit_007"){
      const source=sprite.closest('.fcard-sprite,.char-sheet-sprite')||sprite;
      globalThis.UltimateFX.play({profile:globalThis.UltimateArtProfiles.resolve("unit_007",CHARS.unit_007),source,target:targetHost||source,owner:sprite,unit_370,preview:!targetHost,basic:true});
      return;
    }
    const duration = reducedMotion.matches ? 1 : (VanguardAttack ? sprite.dataset.character==="unit_007"?1300:850 : ultimate ? 600 : 480) / unit_370;
    let frames = kind === 'hurt' ? [
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
    if(VanguardAttack){
      const id=sprite.dataset.character;
      const profile=globalThis.UltimateArtProfiles.resolve(id,CHARS[id]);
      const times=[0,.08,.16,.25,.27,.3,.32,.34,.36,.37,.4,.43,.44,.48,.49,.52,.55,.58,.62,.64,.69,.73,.76,.78,.85,.9,.94,.95,1];
      frames=times.map(offset=>{
        const m=globalThis.UltimateFX.choreography(profile,offset,reducedMotion.matches);
        return {offset,backgroundPosition:`${m.pose*100/3}% 0`,transform:`translate(${m.travel*32}px,${-m.lift*64}px) rotate(${m.angle}rad) scale(${m.scale})`};
      });
    }
    sprite.dataset.motion = kind;

    const poses = sprite.animate(frames.map(({backgroundPosition,offset}) => ({backgroundPosition,offset,easing:'steps(1,end)'})), {duration});
    const movement = sprite.animate(frames.map(({transform,offset}) => ({transform,offset})), {duration,easing:'ease-out'});
    const motion = {cancel(){poses.cancel();movement.cancel();},finished:Promise.all([poses.finished,movement.finished])};
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

    if (ultimate && globalThis.UltimateFX?.handlesSprites) return;
    const source = cardFor(attacker);
    const target = cardFor(defender);
    const unit_370 = Math.max(1, Number(battle?.unit_370) || 1);
    const healing = attacker.hp > oldSelfHP;
    animateSprite(source?.querySelector('.dex-sprite'), 'attack', unit_370, ultimate, target?.querySelector('.fcard-sprite'));
    if (healing) burst(source?.querySelector('.fcard-sprite'), move.type, ultimate, true);
    if (defender.hp < oldHP) {
      animateSprite(target?.querySelector('.dex-sprite'), 'hurt', unit_370);
      burst(target?.querySelector('.fcard-sprite'), move.type, ultimate);
    }
    for (const [fighter, hp] of oldTeamHP) {
      if (fighter !== defender && fighter !== attacker && fighter.hp < hp) {
        const card = cardFor(fighter);
        animateSprite(card?.querySelector('.dex-sprite'), 'hurt', unit_370);
        burst(card?.querySelector('.fcard-sprite'), move.type, false);
      }
    }
    if (ultimate) burst(source?.querySelector('.fcard-sprite'), move.type, true);
  }

  attackWith = function(attacker, defender, move) {

    const oldHP = defender?.hp;
    const oldSelfHP = attacker?.hp;
    const oldTeamHP = battle ? [...(battle.pTeam || []), ...(battle.eTeam || [])].map(f => [f, f.hp]) : [];
    const result = originalAttack.apply(this, arguments);
    if (!battle?.opts?.local) safe(() => presentAttack(attacker, defender, move, oldHP, oldSelfHP, oldTeamHP, ultimateDepth > 0));
    return result;
  };

  useUltimate = function() {
    ultimateDepth++;
    try { return originalUltimate.apply(this, arguments); }
    finally { ultimateDepth--; }
  };


  globalThis.BattlePresentation = Object.freeze({
    attack(attacker, defender, move, before, ultimate = false) {
      safe(() => presentAttack(attacker, defender, move, before.get(defender), before.get(attacker), [...before], ultimate));
    },
  });

  showCharModal = function() {
    const result = originalSheet.apply(this, arguments);
    safe(() => {
      const sheets = document.querySelectorAll('.char-sheet-hero');
      const hero = sheets[sheets.length - 1];
      const sprite = hero?.querySelector('.dex-sprite');
      if (!sprite || hero.dataset.phaseLocked === 'true' || hero.querySelector('.art-preview-button')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'art-preview-button';
      button.textContent = '▶ Ver ataque';
      button.setAttribute('aria-label', `Ver animación de ataque de ${CHARS[sprite.dataset.character].name}`);
      button.onclick = () => safe(() => {
        if (!hero.isConnected || hero.dataset.phaseLocked === 'true') return;
        animateSprite(sprite, 'attack', .75);
        burst(hero.querySelector('.char-sheet-sprite'), CHARS[sprite.dataset.character].types[0], false);
      });
      hero.appendChild(button);
    });
    return result;
  };




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
