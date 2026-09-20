// Optional, device-local help. It never writes to a game save or changes a journey.
export const GUIDE_KEY = 'oplike_learning_v1';
export function readGuide(storage, hasSave) {
  try {
    const value = JSON.parse(storage.getItem(GUIDE_KEY));
    if (value?.version === 1 && ['welcome','available','active','dismissed','complete'].includes(value.status)) {
      return {version:1,status:value.status,combatSeen:value.combatSeen === true,
        dismissed:Array.isArray(value.dismissed) ? value.dismissed.filter(id=>['home','world','crew','route','growth'].includes(id)) : []};
    }
  } catch { /* Help remains usable when storage is unavailable. */ }
  return {version:1,status:hasSave ? 'available' : 'welcome',combatSeen:false,dismissed:[]};
}

export const LESSONS = {
  home:{number:1,title:'Tu primera travesía',text:'Empieza por Historia. Elige una isla, reúne tu banda y avanza hasta derrotar a sus jefes. Los demás modos pueden esperar.',task:'Pulsa Historia para elegir tu primer destino.',target:'#mode-story'},
  world:{number:2,title:'Elige tu primera isla',text:'Para aprender, empieza en East Blue, con Clásico y dificultad Grumete. Toca una isla y abre su destino para preparar la banda. Las siguientes islas se abren al avanzar.',task:'Selecciona la primera isla de East Blue y entra en ella.',target:'[data-world-saga="0"][data-world-island="0"]'},
  crew:{number:3,title:'Prepara tu banda',text:'Toca un hueco para elegir un nakama. Empiezas con un hueco; podrás ampliar la banda en la Tienda del inicio. Cuando tengas más miembros, combina tipos y sinergias. Las mejoras con Log Poses suben su nivel inicial de forma permanente.',task:'Elige tu banda y pulsa Zarpar. Prueba primero el viaje manual.',target:'#starter-slots-container'},
  route:{number:4,title:'Cada parada es una decisión',text:'Avanza por los nodos iluminados: hay combates, objetos, descanso y tiendas. Revisa los PS de tu banda; en Equipo ves tus nakamas y en Mochila puedes usar lo que encuentres.',task:'Pulsa un nodo disponible para avanzar. Cada avance consume pasos diarios.',target:'.map-node.reachable'},
  growth:{number:6,title:'Ya conoces lo esencial',text:'Sigue la ruta hasta los jefes. El nivel que ganas durante el viaje es temporal; tu colección y las mejoras permanentes te ayudan en la próxima aventura. Si pierdes, puedes preparar otra banda y volver a intentarlo.',task:'Al volver al inicio, revisa Inventario, Tienda y Logros. «Cómo jugar» seguirá disponible.',target:'#tab-page-team'},
};

export const HANDBOOK = [
  {title:'Una aventura, paso a paso',text:'Historia es el punto de partida: elige una isla, prepara la banda y recorre sus rutas hasta los jefes. Empieza en Clásico y Grumete para aprender. Nuzlocke añade reglas más exigentes.',tip:'Las dificultades se desbloquean en orden. Para abrir la siguiente saga, supera la anterior en Capitán o superior.'},
  {title:'Tu banda y sus tipos',text:'Los tipos influyen en los enfrentamientos y en las sinergias de tu equipo. Toca un personaje para consultar sus detalles. Durante el viaje puedes reclutar nuevos nakamas; si la banda está llena, eliges a quién sustituir.',tip:'Dex es tu enciclopedia. Inventario es tu colección de personajes disponibles para preparar equipos.'},
  {title:'El mapa y la mochila',text:'Los nodos iluminados son las rutas que puedes tomar. Alterna combates con descanso, objetos y tiendas según el estado de tu banda. Cambia entre Mapa, Equipo y Mochila con las pestañas.',tip:'Los pasos limitan los avances diarios. Las bayas sirven para comprar durante el viaje; no son la moneda de las mejoras permanentes.'},
  {title:'El combate continúa solo',text:'Los nakamas atacan automáticamente. Vigila sus PS, los tipos y la carga de la técnica definitiva. Puedes consultar las bandas, usar objetos disponibles y hacer un relevo por combate cuando esté permitido.',tip:'El control de huida permite escapar de encuentros salvajes. El intento puede fallar y no está disponible en todos los combates.'},
  {title:'Lo que conservas al volver',text:'El nivel del viaje es temporal. Los Log Poses permiten mejorar permanentemente el nivel inicial de tus personajes y también se usan en Carteles. Para evolucionar, necesitas alcanzar el nivel requerido tanto de forma permanente como durante el viaje.',tip:'La fama se usa en la Tienda del inicio. Revisa Logros para reclamar premios. Exporta tu partida para guardar una copia fuera de este navegador.'},
  {title:'Descubre el resto a tu ritmo',text:'Torre Marine se desbloquea al nivel de cuenta 20 y Desafíos al 35. Luffy Run y el multijugador local ofrecen otras formas de jugar. No necesitas aprenderlo todo para empezar una aventura.',tip:'Cuando ya conozcas la ruta, puedes explorar el modo automático desde Ajustes. Siempre puedes repetir esta guía.'},
];

export function guideContext(root) {
  if (root.querySelector('.battle-layout')) return 'combat';
  if (root.querySelector('#mode-story')) return 'home';
  if (root.querySelector('#starter-team-heading')) return 'crew';
  if (root.querySelector('#world-map')) return 'world';
  if (root.querySelector('#island-carousel')) return 'route';
  return null;
}

function boot() {
  const app = document.getElementById('app');
  if (!app) return;
  let storage;
  try { storage = localStorage; } catch { storage = null; }
  let state = readGuide(storage, typeof loadedSave !== 'undefined' && !!loadedSave);
  let panel = null, dialog = null, frame = null;
  const persist = () => { try { storage?.setItem(GUIDE_KEY,JSON.stringify(state)); } catch { /* Session-only fallback. */ } };
  persist();
  const clear = () => {
    panel?.remove(); panel = null;
    app.querySelectorAll('.learn-target').forEach(node=>node.classList.remove('learn-target'));
  };
  const stop = () => { state.status='dismissed'; persist(); clear(); };
  const start = () => {
    state={version:1,status:'active',combatSeen:false,dismissed:[]}; persist(); clear(); update();
    panel?.scrollIntoView({block:'nearest',behavior:'auto'});
  };
  function openBook(combatIntro = false) {
    if (dialog) return;
    const currentBattle = typeof battle !== 'undefined' && battle && !battle.over ? battle : null;
    if (combatIntro && (!currentBattle || currentBattle.waiting || currentBattle.tower || currentBattle.opts?.challenge || currentBattle.opts?.local)) return;
    const wasWaiting = currentBattle?.waiting;
    if (currentBattle) pauseBattle();
    const previousFocus=document.activeElement;
    const pages=combatIntro ? [HANDBOOK[3],{title:'Cuida a tu tripulación',text:'Consulta Bandas para ver quién sigue en pie. Los objetos de curación de la mochila pueden ayudarte durante el combate. Combinar tipos y elegir bien el equipo importa más que pulsar deprisa.',tip:'El combate está pausado mientras lees. Al cerrar esta explicación volverá a continuar.'}] : HANDBOOK;
    let index=0;
    dialog=document.createElement('dialog');
    const element=dialog;
    element.className='learn-dialog';
    element.setAttribute('aria-labelledby','learn-dialog-title');
    element.addEventListener('keydown',event=>event.stopPropagation());
    const close=()=>{
      if (dialog !== element) return;
      if (combatIntro) { state.combatSeen=true; persist(); }
      element.close(); element.remove(); dialog=null;
      if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
      if (currentBattle && typeof battle !== 'undefined' && battle===currentBattle && !currentBattle.over && !wasWaiting) resumeBattle();
      update();
    };
    element.addEventListener('cancel',event=>{event.preventDefault();close();});
    const paint=()=>{
      const page=pages[index];
      element.innerHTML=`<div class="learn-eyebrow">${combatIntro ? 'PRIMER COMBATE · EN PAUSA' : 'CUADERNO DE NAVEGACIÓN'} · ${index+1}/${pages.length}</div>
        <h2 id="learn-dialog-title" tabindex="-1">${page.title}</h2><p>${page.text}</p><p class="learn-tip">${page.tip}</p>
        <div class="learn-actions"><button type="button" data-learn-back ${index===0 ? 'disabled' : ''}>Anterior</button><button type="button" class="learn-primary" data-learn-next>${index===pages.length-1 ? (combatIntro ? 'A luchar' : 'Entendido') : 'Siguiente'}</button></div>
        <div class="learn-actions learn-secondary">${combatIntro ? '' : '<button type="button" data-learn-start>Guiarme jugando</button>'}<button type="button" data-learn-close>${combatIntro ? 'Cerrar y continuar' : 'Cerrar guía'}</button></div>`;
      element.querySelector('[data-learn-back]').onclick=()=>{index--;paint();element.querySelector('h2').focus();};
      element.querySelector('[data-learn-next]').onclick=()=>{if(index===pages.length-1)close();else{index++;paint();element.querySelector('h2').focus();}};
      element.querySelector('[data-learn-close]').onclick=close;
      element.querySelector('[data-learn-start]')?.addEventListener('click',()=>{close();start();});
    };
    paint(); document.body.append(element); element.showModal();
    element.querySelector('[data-learn-next]').focus();
  }
  function update() {
    const context=guideContext(app);
    if (context==='home' && !app.querySelector('#btn-learn')) {
      const button=document.createElement('button');
      button.id='btn-learn';button.type='button';button.className='learn-open';button.textContent='🧭 Cómo jugar';button.onclick=()=>openBook();
      app.querySelector('.modes').before(button);
    }
    if (dialog) return;
    if (state.status==='welcome' && context==='home') {
      if (panel?.isConnected) return;
      panel=document.createElement('section'); panel.className='learn-card';panel.setAttribute('aria-label','Bienvenida al juego');
      panel.innerHTML='<div class="learn-eyebrow">TU PRIMERA AVENTURA</div><h2>Un paso cada vez, capitán</h2><p>Empieza con una isla y tu banda. Te enseñamos qué hacer en cada pantalla mientras juegas.</p><div class="learn-actions"><button type="button" class="learn-primary" data-learn-start>Aprender jugando</button><button type="button" data-learn-skip>Ahora no</button></div>';
      app.querySelector('.modes').before(panel);
      panel.querySelector('[data-learn-start]').onclick=start;
      panel.querySelector('[data-learn-skip]').onclick=stop;
      return;
    }
    if (state.status!=='active' || !context) { clear(); return; }
    if (context==='combat') {
      clear();
      if (!state.combatSeen && !document.querySelector('.overlay')) openBook(true);
      return;
    }
    const key=state.combatSeen && ['home','route'].includes(context) ? 'growth' : context;
    if (state.dismissed.includes(key)) { clear();return; }
    if (panel?.isConnected && panel.dataset.lesson===key) return;
    clear();
    const lesson=LESSONS[key];
    panel=document.createElement('section');panel.className='learn-card';panel.dataset.lesson=key;
    panel.setAttribute('aria-label',`Guía: ${lesson.title}`);
    panel.innerHTML=`<div class="learn-eyebrow">APRENDE JUGANDO · ${lesson.number}/6</div><h2>${lesson.title}</h2><p>${lesson.text}</p><p class="learn-task">${lesson.task}</p><div class="learn-actions"><button type="button" class="learn-primary" data-learn-ack>${key==='growth' ? 'Completar guía' : 'Entendido'}</button><button type="button" data-learn-skip>Salir de la guía</button></div>`;
    const topbar=app.querySelector('.topbar');
    if(topbar)topbar.after(panel);else app.prepend(panel);
    const target=app.querySelector(lesson.target);target?.classList.add('learn-target');
    panel.querySelector('[data-learn-ack]').onclick=()=>{
      state.dismissed.push(key);if(key==='growth')state.status='complete';persist();clear();
    };
    panel.querySelector('[data-learn-skip]').onclick=stop;
  }
  const schedule=()=>{if(frame===null)frame=requestAnimationFrame(()=>{frame=null;update();});};
  // Root replacements are the game's screen transitions; no hooks into gameplay.
  new MutationObserver(schedule).observe(app,{childList:true});
  new MutationObserver(schedule).observe(document.body,{childList:true});
  update();
}

if (typeof document !== 'undefined') boot();
