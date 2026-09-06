/* Additive adapter: loaded after visuals.js, never edits poses, stats or saves. */
(() => {
  'use strict';
  const originalUltimate=useUltimate,originalSheet=showCharModal;
  const safe=fn=>{try{return fn();}catch{return null;}};
  function profileFor(f) {
    return UltimateArtProfiles.resolve(f.id,CHARS[f.id],getUltimateMove(f),baseFormOf(f.id));
  }
  function stageFor(b,f) {
    const side=b.pTeam.includes(f)?'p':'e',team=side==='p'?b.pTeam:b.eTeam;
    return document.getElementById(`fc-${side}-${team.indexOf(f)}`)?.querySelector('.fcard-sprite');
  }
  useUltimate=function(f) {
    // Capture before calling the engine: damage can evolve a fighter or refresh cards.
    const before=safe(()=>{
      const b=battle;if(!b||b.over||!f||f.hp<=0||f.lvl<20||(f.ultCharge||0)<100||!b.curE||b.curE.hp<=0)return null;
      return {b,f,enemy:b.curE,hp:b.curE.hp,profile:profileFor(f)};
    });
    const result=originalUltimate.apply(this,arguments);
    if(before&&f.ultCharge<100)safe(()=>{
      const {b,enemy,profile}=before;
      UltimateFX.play({profile,source:stageFor(b,f),target:stageFor(b,enemy),owner:b,
        speed:b.speed,hit:enemy.hp<before.hp,valid:()=>battle===b&&!document.querySelector('.overlay')});
    });
    return result;
  };
  showCharModal=function(fOrId) {
    const result=originalSheet.apply(this,arguments);
    safe(()=>{
      const heroes=document.querySelectorAll('.char-sheet-hero'),hero=heroes[heroes.length-1];
      const stage=hero?.querySelector('.char-sheet-sprite');
      const id=stage?.dataset.character;if(!id||!CHARS[id]||hero.querySelector('.ultimate-preview-button'))return;
      const f={id,lvl:typeof fOrId==='object'?fOrId.lvl:startLvlOf(fOrId)};
      const button=document.createElement('button');button.type='button';button.className='ultimate-preview-button';
      button.textContent='✦ Ver ultimate';button.setAttribute('aria-label',`Ver ultimate de ${CHARS[id].name}`);
      button.onclick=()=>safe(()=>UltimateFX.play({profile:profileFor(f),source:stage,owner:hero,preview:true}));
      hero.appendChild(button);
    });
    return result;
  };
})();
