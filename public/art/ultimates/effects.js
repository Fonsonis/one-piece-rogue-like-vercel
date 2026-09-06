/* Sprite choreography only: every attack pixel comes from the character's atlas. */
(() => {
  'use strict';
  const clamp=x=>Math.max(0,Math.min(1,x)), ease=x=>1-(1-clamp(x))**3;
  const active=new Map(), atlases=new Map(), hiddenSprites=new Map();
  const between=(t,a,b)=>clamp((t-a)/(b-a));

  function loadSprite(id) {
    if(!/^[a-zA-Z0-9_-]+$/.test(id))return Promise.resolve(null);
    if(atlases.has(id))return atlases.get(id);
    const pending=new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(img.naturalWidth===img.naturalHeight*4?img:null);
      img.onerror=()=>{atlases.delete(id);resolve(null);};
      img.src='/art/characters/'+id+'.png';
    });
    atlases.set(id,pending);
    if(atlases.size>32)atlases.delete(atlases.keys().next().value);
    return pending;
  }

  // Shared timing vocabulary, selected by the authored weapon/fruit profile.
  // Pixels, clothes, weapons, fists, flames and cuts always belong to that fighter.
  function choreography(p,t,reduced=false) {
    t=clamp(t);
    const attack=between(t,.27,.73), returnHome=1-ease(between(t,.76,.99));
    const envelope=Math.sin(Math.PI*attack), reach=ease(attack/.38)*returnHome;
    const m={pose:t<.08||t>.94?0:t<.27||t>.76?1:2,travel:0,lift:0,angle:0,stretch:0,scale:1,echoes:0,alpha:1};
    if(reduced){m.pose=2;return m;}
    const moving=t>=.27&&t<=.76;
    const beat=attack*Math.min(6,p.count), pulse=Math.sin(Math.PI*(beat%1));
    switch(p.motion) {
      case 'barrage': case 'jet':
        m.travel=reach*(p.motion==='jet'?.65:.28);m.stretch=moving?pulse*.42:0;
        if(moving)m.pose=beat%1<.2?1:2;
        m.lift=p.motion==='jet'?envelope*.05:0;m.echoes=moving?2:0;break;
      case 'heavy':
        m.travel=reach*.78;m.angle=-.09*Math.sin(Math.PI*between(t,.08,.5));
        m.scale=1+envelope*.06;break;
      case 'bound':
        m.travel=reach*.76;m.lift=envelope*.22;m.angle=envelope*.12;m.echoes=moving?1:0;break;
      case 'dawn':
        m.travel=reach*.58;m.lift=envelope*.36;m.angle=-envelope*.16;
        m.stretch=moving?envelope*.5:0;m.echoes=moving?2:0;break;
      case 'sword':
        m.travel=reach*.86;m.angle=envelope*(p.angle*.4+.07);
        if(moving&&p.count>2)m.pose=beat%1<.14?1:2;
        m.echoes=moving?Math.min(2,p.count-1):0;break;
      case 'kick':
        m.travel=reach*.8;m.lift=envelope*.23;m.angle=-envelope*.48;m.echoes=moving?2:0;break;
      case 'ranged':
        m.travel=-envelope*.06;m.angle=-envelope*.05;
        if(moving)m.pose=beat%1<.2?1:2;break;
      case 'blink':
        m.travel=reach*.9;m.alpha=t>.23&&t<.3?1-between(t,.23,.3):t>=.3&&t<.37?between(t,.3,.37):1;
        m.echoes=moving?1:0;break;
      case 'flight':
        m.travel=reach*.72;m.lift=envelope*.4;m.angle=envelope*.14;m.echoes=moving?2:0;break;
      case 'pounce':
        m.travel=reach*.88;m.lift=envelope*.2;m.angle=envelope*.2;break;
      case 'cast':
        m.lift=envelope*.06;m.scale=1+envelope*.04;m.echoes=moving?1:0;break;
      default:
        m.travel=reach*.7;m.angle=envelope*.08;break;
    }
    if(t<.27)m.travel=-.025*Math.sin(Math.PI*between(t,.08,.27));
    return m;
  }

  function drawFrame(ctx,p,t,{width=1000,height=400,source=.22,target=.78,hit=true,reduced=false,sprite,actor,defender}={}) {
    ctx.clearRect(0,0,width,height);
    if(!sprite)return;
    const dir=target>=source?1:-1, m=choreography(p,t,reduced);
    const size=actor?.size||Math.min(height*.95,width*.48);
    const origin=actor?.x??source*width, floor=actor?.y??height*.94;
    const end=defender?.x??target*width;
    const distance=Math.max(0,Math.abs(end-origin)-size*.28);
    let x=origin+dir*distance*m.travel, y=floor-m.lift*size;
    // Only these authored atlases have a horizontal, unobstructed rubber arm.
    const rubber=['luffy','luffy2','luffy5'].includes(p.id)&&m.pose===2?m.stretch:0;
    const drawActor=(image,state,px,py,sz,alpha=1,arm=0,direction=dir)=>{
      const unit=(image.naturalHeight||192), ratio=unit/192;
      // Bound the rotated, extended cell, including transparent margins, for both fighters.
      const angle=state.angle||0,scale=state.scale||1,cos=Math.cos(angle),sin=Math.sin(angle);
      const corners=[[-.5,-.9375],[.5+arm,-.9375],[-.5,.0625],[.5+arm,.0625]];
      const xs=corners.map(([x,y])=>(x*cos-y*sin)*scale*direction),ys=corners.map(([x,y])=>(x*sin+y*cos)*scale);
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      sz=Math.min(sz,(width-4)/(maxX-minX),(height-4)/(maxY-minY));
      px=Math.max(2-minX*sz,Math.min(width-2-maxX*sz,px));
      py=Math.max(2-minY*sz,Math.min(height-2-maxY*sz,py));
      ctx.save();ctx.globalAlpha=alpha;ctx.translate(px,py);ctx.scale(direction,1);ctx.rotate(state.angle||0);
      ctx.scale(state.scale||1,state.scale||1);ctx.imageSmoothingEnabled=false;
      const originX=-sz*.5,originY=-sz*.9375,frame=state.pose*unit;
      if(arm>0){
        // Keep the torso and fist intact; lengthen only the straight forearm strip.
        const split=112,tip=120,k=sz/192,extra=arm*sz;
        ctx.drawImage(image,frame,0,split*ratio,unit,originX,originY,split*k,sz);
        ctx.drawImage(image,frame+split*ratio,0,(tip-split)*ratio,unit,originX+split*k,originY,(tip-split)*k+extra,sz);
        ctx.drawImage(image,frame+tip*ratio,0,(192-tip)*ratio,unit,originX+tip*k+extra,originY,(192-tip)*k,sz);
      }else ctx.drawImage(image,frame,0,unit,unit,originX,originY,sz,sz);
      ctx.restore();
    };
    if(defender?.image){
      const reaction=hit&&!reduced?Math.sin(Math.PI*between(t,.43,.82)):0;
      const ds=defender.size;
      drawActor(defender.image,{pose:reaction>0?3:0,angle:-reaction*.09},
        defender.x+dir*reaction*ds*.035,defender.y,ds,1,0,-dir);
    }
    // Afterimages repeat actual attack cells, never substitute geometric effects.
    for(let i=m.echoes;i>0;i--){
      const past=choreography(p,Math.max(.27,t-i*.027));
      const ex=x-dir*Math.min(size*.12*i,Math.abs(m.travel)*distance*.2);
      drawActor(sprite,past,ex,y+i*size*.008,size,.12/i,0);
    }
    drawActor(sprite,m,x,y,size,m.alpha,rubber);
  }

  // Reference counts allow two previews to share a sprite without restoring it early.
  function hide(sprite) {
    if(!sprite)return ()=>{};
    let state=hiddenSprites.get(sprite);
    if(!state){state={count:0,value:sprite.style.getPropertyValue('visibility'),priority:sprite.style.getPropertyPriority('visibility')};hiddenSprites.set(sprite,state);}
    state.count++;sprite.style.setProperty('visibility','hidden','important');
    return ()=>{if(--state.count)return;hiddenSprites.delete(sprite);
      if(state.value)sprite.style.setProperty('visibility',state.value,state.priority);else sprite.style.removeProperty('visibility');};
  }

  function play({profile,source,target=source,owner=source,valid=()=>true,speed=1,hit=true,preview=false}) {
    if(!source?.isConnected||!target?.isConnected)return null;
    active.get(owner)?.cancel();while(active.size>=2)active.values().next().value.cancel();
    const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
    const duration=reduced?650:(preview?2100:Math.max(850,1650/Math.max(1,speed)));
    const el=document.createElement('div');el.className='ultimate-scene';el.setAttribute('aria-hidden','true');
    el.dataset.character=profile.id;el.dataset.family=profile.family;el.dataset.motion=profile.motion;
    el.style.setProperty('--ultimate-color',profile.color);
    const canvas=document.createElement('canvas');el.appendChild(canvas);
    const cutin=document.createElement('div');cutin.className='ultimate-cutin';
    const portrait=document.createElement('img');portrait.alt='';portrait.src='/art/portraits/'+profile.id+'.png';portrait.onerror=()=>cutin.remove();
    cutin.appendChild(portrait);el.appendChild(cutin);
    const title=document.createElement('div');title.className='ultimate-technique';
    const name=document.createElement('span');name.textContent=profile.name;
    const technique=document.createElement('strong');technique.textContent=profile.technique;title.append(name,technique);el.appendChild(title);
    (source.closest('.overlay')||document.body).appendChild(el);
    let ctx;try{ctx=canvas.getContext('2d');}catch{el.remove();return null;}if(!ctx){el.remove();return null;}
    const sourceSprite=source.matches?.('.dex-sprite')?source:source.querySelector?.('.dex-sprite');
    const targetSprite=target!==source?target.querySelector?.('.dex-sprite'):null;
    let sprite=null,enemyImage=null,ready=false,frame=0,timer=0,start=null,last=-100,closed=false;
    let restore=()=>{},restoreEnemy=()=>{};
    const cancel=()=>{if(closed)return;closed=true;cancelAnimationFrame(frame);clearTimeout(timer);restore();restoreEnemy();el.remove();if(active.get(owner)===handle)active.delete(owner);};
    const handle={cancel};active.set(owner,handle);
    // Hide the in-place sprite only after its replacement has loaded successfully.
    Promise.all([loadSprite(profile.id),targetSprite?.dataset.character?loadSprite(targetSprite.dataset.character):null]).then(([own,enemy])=>{
      if(closed)return;if(!own){cancel();return;}sprite=own;enemyImage=enemy;ready=true;
      restore=hide(sourceSprite);if(enemy)restoreEnemy=hide(targetSprite);
    }).catch(cancel);
    const tick=now=>{
      if(closed)return;
      try{
        if(!source.isConnected||!target.isConnected||document.hidden||!valid()){cancel();return;}
        if(!ready){frame=requestAnimationFrame(tick);return;}
        if(start===null){start=now;clearTimeout(timer);timer=setTimeout(cancel,duration+250);}
        const progress=clamp((now-start)/duration);if(progress>=1){cancel();return;}
        if(now-last>=1000/40){
          last=now;
          const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
          const ar=sourceSprite?.getBoundingClientRect()||a,br=targetSprite?.getBoundingClientRect()||b;
          const stageLeft=Math.min(a.left,b.left,ar.left,br.left),stageRight=Math.max(a.right,b.right,ar.right,br.right);
          const left=Math.max(0,stageLeft-40),right=Math.min(innerWidth,stageRight+40);
          const top=Math.max(0,Math.min(a.top,b.top,ar.top,br.top)-40),bottom=Math.min(innerHeight,Math.max(a.bottom,b.bottom,ar.bottom,br.bottom)+12);
          const width=right-left,height=bottom-top;if(width<24||height<24){cancel();return;}
          Object.assign(el.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
          const dpr=Math.min(1.5,globalThis.devicePixelRatio||1),cw=Math.round(Math.min(1600,width*dpr)),ch=Math.round(Math.min(900,height*dpr));
          if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
          // Draw in CSS pixels with one uniform backing-store transform.
          ctx.setTransform(cw/width,0,0,ch/height,0,0);
          const actor={x:ar.left+ar.width/2-left,y:ar.bottom-ar.height*.0625-top,size:ar.width};
          const defender=enemyImage?{image:enemyImage,x:br.left+br.width/2-left,y:br.bottom-br.height*.0625-top,size:br.width}:null;
          const from=preview ? .22:clamp((actor.x)/width),to=preview ? .78:clamp((b.left+b.width/2-left)/width);
          if(preview){actor.size=Math.min(actor.size,width*.56,height*.92);actor.x=width*.3;actor.y=height*.93;}
          drawFrame(ctx,profile,reduced ? .58:progress,{width,height,source:from,target:to,hit,reduced,sprite,actor,defender});
          title.style.opacity=String(Math.min(1,progress/.08,clamp((.42-progress)/.1)));
          cutin.style.opacity=String(reduced?0:clamp(progress/.06)*clamp((.32-progress)/.08));
          cutin.style.transform=`translateX(${(1-ease(progress/.14))*(from<to?-22:22)}px)`;
          cutin.style.left=from<to?'0':'auto';cutin.style.right=from<to?'auto':'0';
          el.dataset.phase=progress<.27?'prepare':progress<.76?'attack':'return';
        }
        frame=requestAnimationFrame(tick);
      }catch{cancel();}
    };
    timer=setTimeout(cancel,4000);frame=requestAnimationFrame(tick);return handle;
  }
  const cancelAll=()=>{for(const h of [...active.values()])h.cancel();};
  globalThis.addEventListener?.('pagehide',cancelAll);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAll();});
  globalThis.UltimateFX=Object.freeze({play,drawFrame,choreography,loadSprite,cancelAll,handlesSprites:true});
})();
