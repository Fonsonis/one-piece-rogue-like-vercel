import {RunnerEngine,RULES} from './engine.mjs';

function imageAsset(src) {
  return new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('No se pudo cargar '+src));image.src=src;
  });
}
function trimBounds(image) {
  const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const a=ctx.getImageData(0,0,c.width,c.height).data;
  let l=c.width,t=c.height,r=0,b=0;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(a[(y*c.width+x)*4+3]>25){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  return {image,x:l,y:t,w:r-l+1,h:b-t+1};
}
const spriteNames=["unit_021","unit_020","unit_043","unit_034","unit_117"];
let assetsPromise;
async function assets() {
  if(!assetsPromise)assetsPromise=Promise.all([
    imageAsset('/Images/asset_1958.jpg'),
    ...spriteNames.map(n=>imageAsset('/sprites/'+n+'.png').then(trimBounds)),
    ...Array.from({length:8},(_,i)=>imageAsset("/runner/unit_001-"+i+'.png')),
    fetch("/runner/unit_001.json").then(r=>{if(!r.ok)throw Error('No se pudo cargar la animación');return r.json();})
  ]).catch(e=>{assetsPromise=null;throw e;});
  return assetsPromise;
}

export async function openRunner({onExit,onScore,onSteps,onFame,onCheckpoint,best=0}={}) {
  if(document.querySelector('.runner-root'))return;
  const root=document.createElement('section');root.className='runner-root';root.setAttribute('aria-label',GameContent.text("text_0161"));
  root.innerHTML=`${GameContent.text("text_0162")}${Number(best)||0}${GameContent.text("text_0163")}`;
  document.body.appendChild(root);
  const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
  const $=s=>root.querySelector(s),canvas=$('canvas'),ctx=canvas.getContext('2d');
  const dialog=$('.runner-dialog'),primary=$('[data-primary]'),pause=$('[data-pause]');
  const events=new AbortController();let closed=false,raf=0,last=0,accumulator=0,loaded=null,calloutTime=0,hitLabel=0,earnedSteps=0,earnedFame=0;
  const formatFame=value=>value.toLocaleString('es-ES',{maximumFractionDigits:1});
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let audio;
  function sound(type) {

    try {
      if(GameContent.storage.getItem("umbral_muted")==='true')return;
      audio ||= new (window.AudioContext||window.webkitAudioContext)();
      if(audio.state==='suspended')audio.resume().catch(()=>{});
      const osc=audio.createOscillator(),gain=audio.createGain();osc.connect(gain);gain.connect(audio.destination);
      const now=audio.currentTime;osc.type=type==='hit'?'sawtooth':'triangle';
      const pair=type==='jump'?[240,550]:type==='hit'?[150,45]:type==='punch'?[330,75]:[200,50];
      osc.frequency.setValueAtTime(pair[0],now);osc.frequency.exponentialRampToValueAtTime(pair[1],now+.13);
      gain.gain.setValueAtTime(type==='hit'?.045:.035,now);gain.gain.exponentialRampToValueAtTime(.001,now+.16);
      osc.start();osc.stop(now+.17);
    } catch {}
  }
  const engine=new RunnerEngine({onEvent(type,data){
    if(['jump','punch','hit','over'].includes(type))sound(type);
    if(type==='pause')onCheckpoint?.();
    if(type==='hit'){hitLabel=.4;calloutTime=1.1;$('[data-callout]').textContent=data.chain?'¡GOLPE EN CADENA! +30':'¡POR LOS AIRES! +30';}
    if(type==='fame'){
      const credited=onFame?.(data.fame),gained=Number.isFinite(credited)?credited:data.fame;
      earnedFame+=gained;
    }
    if(type==='reward'){
      const credited=onSteps?.(data.steps),gained=Number.isFinite(credited)?credited:data.steps;
      earnedSteps+=gained;calloutTime=1.5;
      $('[data-callout]').textContent=gained?`¡+${gained} PASOS!`:'¡PASOS AL MÁXIMO!';
    }
    if(type==='over'){
      best=Math.max(best,engine.score);onScore?.(engine.score);onCheckpoint?.();pause.disabled=true;
      showDialog('¡Fin de la carrera!',`${engine.meters} metros · ${engine.score} puntos · ${engine.kills} enemigos.\nFama ganada: ${formatFame(earnedFame)} · Pasos recuperados: ${earnedSteps}. Récord: ${best} puntos.`, 'VOLVER A CORRER',start);
    }
  }});
  function showDialog(title,description,label,action) {
    $('[data-title]').textContent=title;$('[data-description]').textContent=description;primary.textContent=label;primary.disabled=false;primary.onclick=action;dialog.hidden=false;

    if(document.activeElement===canvas)primary.focus({preventScroll:true});
  }
  function start(){if(!loaded)return;dialog.hidden=true;earnedSteps=0;earnedFame=0;engine.start();last=performance.now();accumulator=0;pause.disabled=false;pause.textContent='Ⅱ Pausa';pause.setAttribute('aria-label','Pausar partida');$('[data-callout]').textContent='';canvas.focus({preventScroll:true});}
  function togglePause(){
    if(engine.status==='running'){
      engine.pause();pause.textContent='▶ Seguir';pause.setAttribute('aria-label','Continuar partida');
      showDialog('Pausa',GameContent.text("text_0164"),'SEGUIR CORRIENDO',togglePause);
    }else if(engine.status==='paused'){
      engine.resume();dialog.hidden=true;pause.textContent='Ⅱ Pausa';pause.setAttribute('aria-label','Pausar partida');last=performance.now();accumulator=0;canvas.focus({preventScroll:true});
    }
  }
  function finish(){
    if(closed)return;closed=true;cancelAnimationFrame(raf);events.abort();observer.disconnect();
    if(engine.score>0)onScore?.(engine.score);
    onCheckpoint?.();
    audio?.close().catch(()=>{});root.remove();document.body.style.overflow=oldOverflow;onExit?.();
  }
  $('[data-exit]').addEventListener('click',finish,{signal:events.signal});pause.addEventListener('click',togglePause,{signal:events.signal});
  function bindAction(element,action){
    element.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();action();},{signal:events.signal});
    element.addEventListener('click',e=>{if(e.detail===0)action();},{signal:events.signal});
  }
  bindAction($('[data-jump]'),()=>engine.jump());bindAction($('[data-punch]'),()=>engine.punch());
  canvas.addEventListener('pointerdown',e=>{if(e.button===0){e.preventDefault();engine.jump();}},{signal:events.signal});
  window.addEventListener('keydown',e=>{
    const key=e.code;
    if(!['Space','ArrowUp','KeyW','KeyX','KeyP','Escape'].includes(key))return;
    e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
    if(key==='Escape'||key==='KeyP'){togglePause();return;}
    if(engine.status==='ready'||engine.status==='over'){if(key==='Space')start();return;}
    if(key==='KeyX')engine.punch();else engine.jump();
  },{signal:events.signal,capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&engine.status==='running')togglePause();},{signal:events.signal});
  window.addEventListener('blur',()=>{if(engine.status==='running')togglePause();},{signal:events.signal});
  function resize(){
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    const ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(r.width*ratio);canvas.height=Math.round(r.height*ratio);
    engine.resize(540*r.width/r.height,540);ctx.imageSmoothingEnabled=false;
  }
  const observer=new ResizeObserver(resize);observer.observe($('.runner-stage'));resize();
  function drawSprite(sprite,x,y,w,h,angle=0){ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(angle);ctx.drawImage(sprite.image,sprite.x,sprite.y,sprite.w,sprite.h,-w/2,-h/2,w,h);ctx.restore();}
  function paint() {
    const {width:W,height:H,ground:G,player:p}=engine;
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);ctx.imageSmoothingEnabled=false;
    if(!loaded)return;
    const background=loaded[0];const bgH=G/.704,bgW=bgH*background.width/background.height;
    const offset=-(engine.scroll*.14%bgW);
    for(let x=offset;x<W;x+=bgW)ctx.drawImage(background,x,0,bgW+1,bgH);
    ctx.fillStyle='#447e32';ctx.fillRect(0,G,W,H-G);
    ctx.fillStyle='#c7b276';ctx.fillRect(0,G+7,W,16);ctx.fillStyle='#254b2a';ctx.fillRect(0,G+23,W,5);

    ctx.fillStyle='#88a551';for(let x=-(engine.scroll%65);x<W;x+=65)ctx.fillRect(x,G+40,26,4);
    ctx.save();
    if(engine.shake&&!reducedMotion)ctx.translate(Math.sin(engine.time*173)*engine.shake,Math.cos(engine.time*139)*engine.shake*.5);
    for(const e of engine.enemies) {
      if(!e.dead){ctx.fillStyle='#17302c38';ctx.beginPath();ctx.ellipse(e.x+e.w/2,G+3,e.w*.55,5,0,0,Math.PI*2);ctx.fill();}
      ctx.globalAlpha=e.dead?Math.min(1,e.life):1;
      drawSprite(loaded[e.kind+1],e.x,e.y,e.w,e.h,e.angle);
    }
    ctx.globalAlpha=1;
    ctx.fillStyle='#14352740';ctx.beginPath();ctx.ellipse(p.x+26,G+3,Math.max(12,29-(G-p.y-p.h)*.05),5,0,0,Math.PI*2);ctx.fill();
    let frame=0;
    if(engine.punchLeft>0){const phase=1-engine.punchLeft/RULES.punchDuration;frame=phase<.18?5:phase<.8?6:7;}
    else if(p.y+p.h<G-3)frame=4;
    else if(engine.status==='running')frame=Math.floor(engine.distance/23)%4;
    const spec=loaded[14];const scale=p.h/spec.bodyHeight;
    const bob=frame<4&&engine.status==='running'?Math.sin(engine.distance/23*Math.PI)*1.5:0;
    ctx.save();
    if(engine.status==='over'){ctx.translate(p.x+26,p.y+p.h);ctx.rotate(-.35);ctx.translate(-p.x-26,-p.y-p.h);}
    ctx.drawImage(loaded[6+frame],p.x+26-spec.anchorX*scale,p.y+p.h-spec.baseline*scale+bob,spec.frameWidth*scale,spec.frameHeight*scale);
    ctx.restore();
    for(const a of engine.particles){ctx.globalAlpha=Math.max(0,a.life/a.max);ctx.fillStyle=a.color;ctx.fillRect(a.x,a.y,a.size,a.size);}
    ctx.globalAlpha=1;
    if(hitLabel>0){ctx.save();ctx.font='900 27px system-ui';ctx.textAlign='center';ctx.lineWidth=5;ctx.strokeStyle='#7a2916';ctx.fillStyle='#ffed8a';ctx.translate(p.x+145,p.y-10);ctx.rotate(-.12);ctx.strokeText('¡BAM!',0,0);ctx.fillText('¡BAM!',0,0);ctx.restore();}
    ctx.restore();
  }
  let lastHud=0;
  function loop(now){
    if(closed)return;
    const elapsed=Math.min((now-(last||now))/1000,.08);last=now;
    if(engine.status==='running'){
      accumulator+=elapsed;
      while(accumulator>=1/120){engine.update(1/120);accumulator-=1/120;}
      hitLabel=Math.max(0,hitLabel-elapsed);calloutTime-=elapsed;
      if(calloutTime<=0)$('[data-callout]').textContent='';
    }else accumulator=0;
    paint();
    if(now-lastHud>70){
      lastHud=now;$('[data-score]').textContent=engine.score;$('[data-best]').textContent=Math.max(best,engine.score);$('[data-meters]').textContent=engine.meters;
      $('[data-jumps]').textContent=`Doble salto · ${RULES.maxJumps-engine.jumpsUsed} disponibles`;
      $('[data-jump]').setAttribute('aria-disabled',String(engine.status!=='running'||engine.jumpsUsed>=RULES.maxJumps));
      $('[data-reward]').textContent=`⭐ ${formatFame(earnedFame)} fama (+0,5/m) · ${engine.meters % RULES.metersPerReward}/1.000 m para ${RULES.stepsPerReward} pasos · Pasos ganados: ${earnedSteps}`;$("[data-speed]").textContent='×'+(engine.speed/RULES.startSpeed).toFixed(1);
      const waiting=engine.cooldown>0;
      $('[data-punch]').setAttribute('aria-disabled',String(waiting||engine.status!=='running'));
      $('[data-punch-label]').textContent=waiting?'RECARGANDO':'PUÑETAZO';
      $('[data-cooldown]').textContent=waiting?engine.cooldown.toFixed(1)+' s':GameContent.text("text_0165");
      $('.cooldown-fill').style.transform=`scaleX(${1-engine.cooldown/RULES.punchCooldown})`;
    }
    raf=requestAnimationFrame(loop);
  }
  raf=requestAnimationFrame(loop);
  async function load(){
    try{loaded=await assets();if(closed)return;showDialog('¡A correr, capitán!','Puedes hacer dos saltos seguidos. Toca el suelo para recuperarlos. Ganas 0,5 fama por cada metro recorrido y recuperas hasta 25 pasos cada 1.000 metros, sin superar el máximo diario de 1.000. Usa el puñetazo para mandar a los enemigos por los aires. ¡Cada vez irá más rápido!','EMPEZAR',start);}
    catch{if(!closed)showDialog('No han cargado los gráficos','Comprueba la conexión e inténtalo otra vez.','REINTENTAR',load);}
  }
  await load();
  return {close:finish};
}
