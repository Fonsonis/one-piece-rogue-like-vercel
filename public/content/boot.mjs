import {createContent,loadActivePack} from './runtime.mjs';
import {openMods} from './manager.mjs';
const scripts=['data.js','art/world-locations.js','save-storage.js','art/world-voyage.js','game.js','local/combat.js','local/battle.js','art/visuals.js','art/market-reveal.js','art/ultimates/profiles.js','art/ultimates/effects.js','art/ultimates/integration.js','art/event-sprites.js','art/character-sheet.js','onboarding.mjs','local/update-notice.mjs'];
const button=document.createElement('button');button.className='content-mods-button';button.textContent='MODS';button.onclick=openMods;document.body.append(button);
try{
  if('serviceWorker'in navigator){
    await navigator.serviceWorker.register('/service-worker.js',{updateViaCache:'none'});
    await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('No se pudo iniciar el almacén local de contenido. Recarga la página.')),10000);
      navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});
    });
  }
  const pack=await loadActivePack();
  globalThis.GameContent=createContent(pack);
  if(crypto.subtle)GameContent.fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(pack))))).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,20);
  if(pack.data.FONT_URL && pack.assets.includes(pack.data.FONT_URL) && 'FontFace' in globalThis){
    const font=new FontFace('Press Start 2P',`url('/${pack.data.FONT_URL}')`);document.fonts.add(font);await font.load().catch(()=>{});
  }
  globalThis.GameDistribution=await fetch('/distribution.json').then(r=>r.ok?r.json():{}).catch(()=>({}));
  document.title=GameContent.title;
  document.documentElement.dataset.content=GameContent.id;
  for(const src of scripts)await new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.src='/'+src;if(src.endsWith('.mjs'))s.type='module';s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar '+src));document.body.append(s);
  });
}catch(error){
  const app=document.getElementById('app');app.replaceChildren();const p=document.createElement('p');p.textContent=error.message;app.append(p);const b=document.createElement('button');b.textContent='Gestionar mods';b.onclick=openMods;app.append(b);
}
