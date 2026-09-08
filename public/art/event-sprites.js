/* Presentation only: keep emoji/data strings intact for saves and native controls. */
(() => {
  const groups = [
    ['🍖'],['🍗'],['🍱','🍽️','🥪'],['🍶'],['📜','📃'],['🏅'],
    ['📯'],['🥤'],['🛡️','🛡'],['🍈','🍇'],['🎁','🧰'],['⛺','🏕️'],
    ['⚔️','⚔'],['🏴‍☠️'],['💀','☠️'],['🏪','🛒'],['❓','❔','🎲'],['🌟','🎰'],
    ['🧭','🎯','📍'],['⛵','🚢','🛳️','⚓'],['🎒','📦'],['💰','🪙'],['🏆','✨','🌠'],['🔒','🔐'],
    ['🔥'],['❄️','🧊'],['☣️','🧪','🐍'],['💨','🌪️','🐌'],['🌊','💧','♨️'],['⚡'],
    ['🌑','🌌'],['👊','💪','🥊'],['🔫','💥'],['🗡️'],['❤️','💚','💖','💕','💗','♥️','💊'],['🌀','🌈']
  ];
  const labels = ['Carne','Carne real','Comida','Sake','Cartel','Cartel dorado','Buster Call','Proteína','Defensa','Fruta del Diablo','Tesoro','Campamento','Combate','Pirata','Jefe','Tienda','Misterio','Crossguild','Log Pose','Viaje','Mochila','Berries','Estrella','Bloqueado','Fuego','Hielo','Veneno','Viento','Agua','Rayo','Oscuridad','Golpe','Disparo','Corte','Curación','Portal'];
  const uiGroups = [['💾'],['⚙️','⚙'],['ℹ️','ⓘ'],['🔎','🔍'],['📂','📁'],['🗑️'],['👥','👤','🤝'],['🌍','🌎','🌏','🌐'],['🧢'],['🗼','🏰'],['📋','📖','📚'],['📊','📈'],['⛓️','🔗'],['⛓️‍💥'],['🕸️'],['🥋','👴'],['🧑‍🌾'],['🏝️','🏝','🏖️'],[],['➕'],['✅','✔️'],['❌','🚫','⛔'],['🔄','🔁'],['⬆️','🔼'],['🎲'],['⚠️','🚨','❗'],['⏳','⏱️','⏰'],['💔'],['🩹','🏥'],['👑'],['🎵','🎶'],['🔊','🔉'],['🔇'],['🏃','🏃‍♂️','👟'],['🎮','🕹️'],['🦴']];
  labels.push('Guardar','Ajustes','Información','Buscar','Equipo guardado','Eliminar','Tripulación','Mundo','Marine','Torre','Registro','Estadísticas','Cadena','Cadena rota','Trampa','Entrenamiento','Aldeano','Isla','Estrella','Añadir','Confirmado','Cancelar','Cambiar','Mejorar','Azar','Aviso','Tiempo','Derrota','Curar','Corona','Música','Sonido','Silencio','Correr','Juego','Huesos');
  // Keep the original star glyphs for character rarity, fusion and their labels.
  const icons = new Map([...groups,...uiGroups].flatMap((list,index) => list.map(symbol => [symbol,index])));
  const difficultyIcons = new Set(DIFFICULTIES.map(d => d.emoji));
  const difficultyContext = '.diff-dropdown-trigger,.diff-dropdown-item,.world-difficulties,.world-mode-progress,.native-difficulty';
  const pattern = new RegExp([...icons.keys()].sort((a,b)=>b.length-a.length).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'gu');
  function paint(root) {
    if (!root || root.closest?.('script,style,textarea,select,.event-sprite,.dex-sprite')) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    if(root.nodeType === Node.TEXT_NODE) nodes.push(root);
    for(const text of nodes) {
      if(text.parentElement?.closest('script,style,textarea,select,.event-sprite,.dex-sprite')) continue;
      const value=text.textContent; pattern.lastIndex=0;
      const nativeDifficulty = text.parentElement?.closest(difficultyContext);
      const matches=[...value.matchAll(pattern)].filter(match => !nativeDifficulty || !difficultyIcons.has(match[0])); if(!matches.length)continue;
      const fragment=document.createDocumentFragment();let offset=0;
      for(const match of matches){
        fragment.append(value.slice(offset,match.index));
        const index=icons.get(match[0]), icon=document.createElement('span');
        icon.className='event-sprite'+(index===17?' crossguild-sprite':index>=36?' ui-sprite':'');icon.setAttribute('role','img');icon.setAttribute('aria-label',labels[index]);
        if(index!==17)icon.style.backgroundPosition=`${index%6*20}% ${Math.floor(index%36/6)*20}%`;
        fragment.append(icon);offset=match.index+match[0].length;
      }
      fragment.append(value.slice(offset));text.replaceWith(fragment);
    }
  }
  const observer = new MutationObserver(records=>{
    observer.disconnect();
    for(const record of records) {
      if(record.type==='characterData')paint(record.target);
      else for(const node of record.addedNodes)paint(node);
    }
    observe();
  });
  function observe(){observer.observe(document.body,{childList:true,subtree:true,characterData:true});}
  paint(document.body);observe();
})();
