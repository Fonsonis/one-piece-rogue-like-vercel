/* Cosmetic market reveal. Never rolls RNG, charges currency or grants recruits. */
const MarketReveal = (() => {
  'use strict';
  const tiers = [
    {title:'UN NUEVO RUMBO',hint:'Un nombre comienza a sonar en el puerto.',color:'#9cd6ce',delay:180,duration:1200,particles:6},
    {title:'PIRATA PROMETEDOR',hint:'Este cartel ya despierta algunas miradas.',color:'#99c5ef',delay:330,duration:1350,particles:10},
    {title:'UN NOMBRE TEMIDO',hint:'Los rumores cruzan la Grand Line.',color:'#b7a4f1',delay:550,duration:1850,particles:16},
    {title:'EL MAR SE ESTREMECE',hint:'Una presencia que impone respeto.',color:'#f0c472',delay:850,duration:2450,particles:22},
    {title:'NACE UNA LEYENDA',hint:'El mundo recordará este nombre.',color:'#ffcf76',delay:1200,duration:3250,particles:28},
  ].map(Object.freeze);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rarityOf = value => Math.max(1,Math.min(5,Math.floor(Number(value)||1)));
  function show({host,name,rarity,portraitHTML,onComplete}) {
    const stars=rarityOf(rarity), tier=tiers[stars-1];
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    host.classList.add('market-reveal-host');
    host.innerHTML=`<section class="modal market-reveal" data-rarity="${stars}" role="dialog" aria-modal="true" aria-label="Recluta de ${stars} estrellas" style="--reveal-color:${tier.color};--reveal-delay:${tier.delay}ms;--reveal-duration:${tier.duration}ms">
      <header class="mr-heading"><span>MERCADO CLANDESTINO</span><p>${tier.hint}</p></header>
      <div class="mr-scene">
        <div class="mr-effects" aria-hidden="true"><div class="mr-rays"></div><div class="mr-ring"></div><div class="mr-ring mr-ring-two"></div>
          <svg class="mr-haki" viewBox="0 0 500 380" preserveAspectRatio="none"><path d="M0 65 108 112 68 130 184 167 121 182 230 205M500 20 375 97 418 111 297 173 357 180 269 212M20 380 135 288 91 270 218 214M487 359 401 301 437 282 292 217"/></svg>
          ${Array.from({length:tier.particles},(_,i)=>{const angle=i*2.399963,radius=100+(i%5)*24;return `<i class="mr-spark" style="--x:${Math.round(Math.cos(angle)*radius)}px;--y:${Math.round(Math.sin(angle)*radius)}px;--spark-delay:${tier.delay+(i%6)*55}ms;--turn:${i*47}deg"></i>`;}).join('')}
        </div>
        <div class="mr-poster"><div class="mr-poster-top">WANTED</div><div class="mr-rule"></div>
          <div class="mr-portrait" aria-hidden="true">${portraitHTML}</div>
          <div class="mr-name">${escape(name)}</div><div class="mr-poster-bottom">DEAD OR ALIVE</div><span class="mr-stamp" aria-hidden="true">${stars===5?'LEGENDARIO':stars===4?'ÉPICO':'RECLUTA'}</span>
        </div>
        <div class="mr-stars" aria-hidden="true">${Array.from({length:stars},(_,i)=>`<span style="--star-delay:${tier.delay+220+i*120}ms">★</span>`).join('')}</div>
      </div>
      <div class="mr-caption">${tier.title}</div>
      <footer class="mr-footer"><p class="mr-status" role="status" aria-live="polite">Se está revelando tu recluta…</p><button class="btn gold mr-continue" type="button">OMITIR ANIMACIÓN</button></footer>
    </section>`;
    const panel=host.querySelector('.market-reveal'), button=host.querySelector('.mr-continue'), status=host.querySelector('.mr-status');
    let ready=false, ended=false, timer;
    const cleanup=()=>{clearTimeout(timer);observer?.disconnect();media.removeEventListener?.('change',motionChanged);panel.removeEventListener('keydown',onKey);button.onclick=null;};
    const skip=()=>{
      if(ended||ready)return;
      ready=true;clearTimeout(timer);panel.classList.add('mr-ready');
      status.textContent=`${name} · ${stars} ${stars===1?'estrella':'estrellas'}`;
      button.textContent='CONTINUAR';
    };
    const cancel=()=>{if(ended)return;ended=true;cleanup();};
    const finish=()=>{if(ended)return;if(!ready){skip();return;}ended=true;cleanup();if(host.isConnected)onComplete();};
    function motionChanged(event){if(event.matches)skip();}
    function onKey(event){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();skip();}if(event.key==='Tab'){event.preventDefault();button.focus();}}
    const observer=typeof MutationObserver==='undefined'?null:new MutationObserver(()=>{if(!host.isConnected)cancel();});
    observer?.observe(document.body,{childList:true});
    panel.addEventListener('keydown',onKey);media.addEventListener?.('change',motionChanged);button.onclick=finish;
    if(media.matches)skip();else timer=setTimeout(skip,tier.duration);
    button.focus({preventScroll:true});
    return Object.freeze({skip,cancel});
  }
  return Object.freeze({show});
})();
