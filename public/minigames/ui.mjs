const W=800,H=500;
const GAMES={
 zoro:{name:'Zoro · Corte de frutas',icon:'⚔️',hint:'Desliza para cortar frutas. Evita las bombas.',reward:'Cada 100 puntos: +10 fama.',kind:'fame'},
 nami:{name:'Nami · Ruta del navegante',icon:'⛵',hint:'Mueve el bote a izquierda y derecha para esquivar rocas.',reward:'Cada 100 puntos: +1 log pose.',kind:'logPoses'},
 usopp:{name:'Usopp · Cazaglobos',icon:'🎯',hint:'Apunta y dispara desde el centro a los globos que ascienden.',reward:'Cada 100 puntos: +10 fama.',kind:'fame'},
 sanji:{name:'Sanji · Cocina del Sunny',icon:'🍳',hint:'Sirve el ingrediente indicado antes de que termine el tiempo.',reward:'Cada 100 puntos: +1 log pose.',kind:'logPoses'},
 robin:{name:'Robin · Memoria arqueóloga',icon:'🌸',hint:'Memoriza la secuencia iluminada y repítela.',reward:'Cada 100 puntos: +10 fama.',kind:'fame'},
 chopper:{name:'Chopper · Trineo nevado',icon:'🛷',hint:'Guía el trineo por la ladera y esquiva árboles.',reward:'Cada 100 puntos: +1 log pose.',kind:'logPoses'},
 brook:{name:'Brook · Piano Tiles',icon:'🎹',hint:'Toca las teclas negras antes de que lleguen al final.',reward:'Cada 100 puntos: +10 fama.',kind:'fame'},
 franky:{name:'Franky · Alas de cola',icon:'🦾',hint:'Mantén pulsado para bajar en la pendiente; suelta para volar.',reward:'Cada 100 puntos: +1 log pose.',kind:'logPoses'},
 jinbe:{name:'Jinbe · Guardia del arrecife',icon:'🌊',hint:'Lanza ondas de agua contra los enemigos antes de que alcancen el coral.',reward:'Cada 100 puntos: +1 log pose.',kind:'logPoses'}
};
export const MINIGAMES=Object.freeze(Object.fromEntries(Object.entries(GAMES).map(([id,g])=>[id,{...g}])));
const rand=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hit=(a,b,r)=>Math.hypot(a.x-b.x,a.y-b.y)<r;
function circle(c,x,y,r,color){c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill()}
function txt(c,s,x,y,size=30,color='#fff'){c.fillStyle=color;c.font=`${size}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(s,x,y)}
function box(c,x,y,w,h,color,r=8){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill()}

/** Opens a full-screen minigame. Returns a close function. Callbacks receive run deltas. */
export function openMinigame({id,onExit,onReward,onScore,best=0}={}){
 const game=GAMES[id];if(!game)throw new Error(`Unknown minigame: ${id}`);
 if(!document.querySelector('link[href$="minigames/game.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./game.css',import.meta.url).href;document.head.append(link)}
 const root=document.createElement('section');root.className='nakama-game';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label',game.name);
 root.innerHTML=`<header><div><h1>${game.icon} ${game.name}</h1><p>${game.hint}</p></div><button class="ng-exit" type="button">Salir</button></header><div class="ng-stats"><span>Puntos: <strong data-score>0</strong></span><span>Récord: <strong data-best>${Math.max(0,Math.floor(Number(best)||0))}</strong></span><span data-life></span><span data-reward></span></div><div class="ng-stage"><canvas tabindex="0" aria-label="Zona de juego"></canvas><div class="ng-dialog"><div class="ng-card"><h2 data-title>${game.name}</h2><p data-message>${game.hint}</p><p>${game.reward}</p><button type="button" data-start>Jugar</button></div></div></div><footer>${game.hint} · Teclado: flechas, espacio o números 1–4 según el juego</footer>`;
 document.body.append(root);const canvas=root.querySelector('canvas'),c=canvas.getContext('2d');const dialog=root.querySelector('.ng-dialog');const scoreEl=root.querySelector('[data-score]'),lifeEl=root.querySelector('[data-life]'),bestEl=root.querySelector('[data-best]'),rewardEl=root.querySelector('[data-reward]');
 const initialExtra=()=>({seq:[],input:0,round:0,phase:'',timer:0,flash:-1,target:0,order:0,pressure:false,distance:0,cool:0});
 let disposed=false,raf=0,last=0,mode='ready',score=0,highest=Math.max(0,Math.floor(Number(best)||0)),milestones=0,life=3,elapsed=0,spawn=0,objects=[],player={x:400,y:410,vx:0,vy:0},pointer={x:400,y:250,down:false},held=new Set(),extra=initialExtra();
 const listeners=[];const listen=(target,type,fn,opts)=>{target.addEventListener(type,fn,opts);listeners.push(()=>target.removeEventListener(type,fn,opts))};
 const award=()=>{const n=Math.floor(score/100);while(milestones<n){milestones++;const delta=game.kind==='fame'?{fame:10,logPoses:0}:{fame:0,logPoses:1};onReward?.(delta)}rewardEl.textContent=`${game.kind==='fame'?'⭐':'🧭'} ${milestones} premio${milestones===1?'':'s'}`};
 const add=(n)=>{score+=n;scoreEl.textContent=score;if(score>highest){highest=score;bestEl.textContent=highest}award()};
 const damage=()=>{if(mode!=='playing')return;life--;lifeEl.textContent=`❤️ ${life}`;if(life<=0)finish()};
 const finish=()=>{if(mode!=='playing')return;mode='over';onScore?.(score);root.querySelector('[data-title]').textContent='Fin de la partida';root.querySelector('[data-message]').textContent=`${score} puntos · récord ${highest}`;root.querySelector('[data-start]').textContent='Reintentar';dialog.hidden=false};
 const reset=()=>{mode='playing';score=0;milestones=0;life=3;elapsed=0;spawn=0;objects=[];player={x:400,y:410,vx:0,vy:0};extra=initialExtra();scoreEl.textContent='0';lifeEl.textContent='❤️ 3';rewardEl.textContent='';dialog.hidden=true;if(id==='robin')nextRobin();canvas.focus()};
 const close=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);listeners.forEach(f=>f());if(mode==='playing')onScore?.(score);root.remove();onExit?.()};
 const pos=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}};
 function nextRobin(){extra.seq.push(Math.floor(rand(0,4)));extra.input=0;extra.round++;extra.phase='show';extra.timer=0;extra.flash=-1}
 function action(x,y){if(mode!=='playing')return;
  if(id==='zoro'){for(const o of objects){if(!o.cut&&o.type==='fruit'&&hit({x,y},o,50)){o.cut=true;add(20)}else if(!o.cut&&o.type==='bomb'&&hit({x,y},o,32)){o.cut=true;damage()}}}
  if(id==='usopp'){const dx=x-400,dy=y-320;const angle=Math.atan2(dy,dx);objects.push({type:'shot',x:400,y:320,vx:Math.cos(angle)*650,vy:Math.sin(angle)*650,r:7});extra.cool=.18}
  if(id==='sanji'){const lane=clamp(Math.floor(x/200),0,3);if(lane===extra.order){add(25);extra.order=Math.floor(rand(0,4));extra.timer=0}else damage()}
  if(id==='robin'&&extra.phase==='input'){const lane=clamp(Math.floor(x/400),0,1),row=clamp(Math.floor(y/250),0,1),index=row*2+lane;if(index===extra.seq[extra.input]){extra.input++;if(extra.input===extra.seq.length){add(25);nextRobin()}}else{damage();nextRobin()}}
  if(id==='brook'){const lane=clamp(Math.floor(x/200),0,3);const tile=objects.find(o=>o.type==='tile'&&o.lane===lane&&o.y>290&&o.y<480);if(tile){tile.done=true;add(20)}else damage()}
  if(id==='jinbe'){objects.push({type:'wave',x,y,r:5,age:0});for(const o of objects){if(o.type==='enemy'&&hit({x,y},o,100)){o.dead=true;add(20)}}}
 }
 listen(root.querySelector('.ng-exit'),'click',close);listen(root.querySelector('[data-start]'),'click',reset);
 listen(canvas,'pointerdown',e=>{e.preventDefault();canvas.setPointerCapture(e.pointerId);Object.assign(pointer,pos(e),{down:true});if(['zoro','usopp','sanji','robin','brook','jinbe'].includes(id))action(pointer.x,pointer.y);if(id==='franky')extra.pressure=true});
 listen(canvas,'pointermove',e=>{Object.assign(pointer,pos(e));if(pointer.down&&id==='zoro')action(pointer.x,pointer.y)});
 listen(canvas,'pointerup',()=>{pointer.down=false;extra.pressure=false});listen(canvas,'pointercancel',()=>{pointer.down=false;extra.pressure=false});
 listen(window,'keydown',e=>{if(disposed||mode!=='playing')return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Spacebar','Enter','1','2','3','4'].includes(e.key))e.preventDefault();held.add(e.key);if((e.key===' '||e.key==='Enter')&&['zoro','usopp','jinbe'].includes(id))action(pointer.x,pointer.y);if(id==='franky'&&(e.key===' '||e.key==='ArrowDown'))extra.pressure=true;if(/^[1-4]$/.test(e.key)&&['sanji','robin','brook'].includes(id)){const lane=Number(e.key)-1,xy=id==='robin'?{x:(lane%2)*400+200,y:Math.floor(lane/2)*250+125}:{x:lane*200+100,y:390};action(xy.x,xy.y)}});
 listen(window,'keyup',e=>{held.delete(e.key);if(id==='franky'&&(e.key===' '||e.key==='ArrowDown'))extra.pressure=false});
 listen(window,'blur',()=>{held.clear();pointer.down=false;extra.pressure=false});
 function background(top,bottom){const g=c.createLinearGradient(0,0,0,H);g.addColorStop(0,top);g.addColorStop(1,bottom);c.fillStyle=g;c.fillRect(0,0,W,H)}
 function drawWorld(){c.clearRect(0,0,W,H);if(id==='nami'){background('#67c7eb','#075777');for(let i=0;i<7;i++)txt(c,'〰️',i*140-30,(elapsed*70+i*90)%H,30,'#b2e9ff')}else if(id==='chopper'){background('#bddfff','#e9f8ff');for(let i=0;i<7;i++){c.strokeStyle='#b0cfed';c.beginPath();c.moveTo(i*150-100,0);c.lineTo(i*150+100,H);c.stroke()}}else if(id==='jinbe'){background('#0c86bb','#002c65');for(let i=0;i<15;i++)circle(c,(i*97)%W,((i*41-elapsed*30)%H+H)%H,3,'#b5f1ff')}else background('#275579','#081d39')}
 function update(dt){elapsed+=dt;spawn+=dt;extra.cool=Math.max(0,(extra.cool||0)-dt);if(['zoro','usopp','jinbe'].includes(id)){pointer.x=clamp(pointer.x+((held.has('ArrowRight')?1:0)-(held.has('ArrowLeft')?1:0))*360*dt,0,W);pointer.y=clamp(pointer.y+((held.has('ArrowDown')?1:0)-(held.has('ArrowUp')?1:0))*360*dt,0,H)}
  if(id==='zoro'){if(spawn>.55){spawn=0;objects.push({type:Math.random()<.17?'bomb':'fruit',x:rand(45,755),y:530,vx:rand(-80,80),vy:rand(-700,-520),cut:false,emoji:['🍎','🍊','🍉','🍍'][Math.floor(rand(0,4))]})}for(const o of objects){o.x+=o.vx*dt;o.y+=o.vy*dt;o.vy+=900*dt;if(o.y>540&&!o.cut){o.cut=true;if(o.type==='fruit')damage()}}objects=objects.filter(o=>o.y<550)}
  if(id==='nami'||id==='chopper'){const speed=id==='nami'?260:320;let target=pointer.down?pointer.x:player.x+(held.has('ArrowRight')||held.has('d')?speed*dt:0)-(held.has('ArrowLeft')||held.has('a')?speed*dt:0);player.x=clamp(pointer.down?player.x+(target-player.x)*Math.min(1,dt*11):target,32,768);if(spawn>.62){spawn=0;objects.push({x:rand(35,765),y:-40,r:30,passed:false})}for(const o of objects){o.y+=(id==='nami'?210:285+elapsed*3)*dt;if(!o.passed&&o.y>player.y+35){o.passed=true;add(10)}if(!o.passed&&hit(o,player,54)){o.passed=true;damage()}}objects=objects.filter(o=>o.y<550)}
  if(id==='usopp'){if(spawn>.6){spawn=0;objects.push({type:'balloon',x:rand(35,765),y:540,vx:rand(-45,45),vy:rand(-150,-85),r:24})}for(const o of objects){o.x+=(o.vx||0)*dt;o.y+=(o.vy||0)*dt;if(o.type==='balloon'&&o.y<0){o.dead=true;damage()}}for(const s of objects.filter(o=>o.type==='shot'))for(const b of objects.filter(o=>o.type==='balloon'))if(hit(s,b,29)){s.dead=b.dead=true;add(20)}objects=objects.filter(o=>!o.dead&&o.x>-30&&o.x<830&&o.y>-30&&o.y<550)}
  if(id==='sanji'){extra.timer+=dt;if(extra.timer>5){extra.timer=0;extra.order=Math.floor(rand(0,4));damage()}}
  if(id==='robin'){if(extra.phase==='show'){extra.timer+=dt;const step=Math.floor(extra.timer/.65);extra.flash=step<extra.seq.length?extra.seq[step]:-1;if(step>=extra.seq.length){extra.phase='input';extra.timer=0}}else{extra.timer+=dt;if(extra.timer>Math.max(5,extra.seq.length*2)){damage();nextRobin()}}}
  if(id==='brook'){if(spawn>Math.max(.55,1.1-elapsed*.01)){spawn=0;objects.push({type:'tile',lane:Math.floor(rand(0,4)),y:-80,done:false})}for(const o of objects){o.y+=(210+elapsed*3)*dt;if(o.y>500&&!o.done){o.done=true;damage()}}objects=objects.filter(o=>o.y<550&&!o.done)}
  if(id==='franky'){const terrain=x=>330+70*Math.sin((x+extra.distance)/115);extra.distance+=Math.max(130,player.vx+170)*dt;const ground=terrain(220)-20;player.vy+=(extra.pressure?1150:650)*dt;player.y+=player.vy*dt;if(player.y>=ground){if(player.vy>0){const slope=(terrain(230)-terrain(210))/20;player.vx=clamp(player.vx+Math.max(0,slope)*player.vy*.25-15,0,320);if(slope<-.2&&player.vx>100)player.vy=-player.vx*.9;else player.vy=0}player.y=Math.min(player.y,ground)}player.vx=Math.max(0,player.vx-12*dt);if(player.y>540)damage();if(Math.floor(extra.distance/220)>Math.floor((extra.distance-(Math.max(130,player.vx+170)*dt))/220))add(10)}
  if(id==='jinbe'){if(spawn>.75){spawn=0;objects.push({type:'enemy',x:rand(35,765),y:-25,vx:rand(-20,20),vy:rand(90,150),dead:false})}for(const o of objects){if(o.type==='enemy'){o.x+=o.vx*dt;o.y+=o.vy*dt;if(o.y>440){o.dead=true;damage()}}else{o.age+=dt;o.r+=250*dt;if(o.age>.4)o.dead=true}}objects=objects.filter(o=>!o.dead)}
 }
 function render(){drawWorld();
  if(id==='zoro'){for(const o of objects)if(!o.cut)txt(c,o.type==='bomb'?'💣':o.emoji,o.x,o.y,44);if(pointer.down){circle(c,pointer.x,pointer.y,13,'#d7fff8');circle(c,pointer.x,pointer.y,5,'#fff')}}
  if(id==='nami'||id==='chopper'){for(const o of objects)txt(c,id==='nami'?'🪨':'🌲',o.x,o.y,48);txt(c,id==='nami'?'⛵':'🛷',player.x,player.y,62);if(id==='chopper')txt(c,'🦌',player.x,player.y-44,38)}
  if(id==='usopp'){for(const o of objects)if(o.type==='balloon')txt(c,'🎈',o.x,o.y,43);else circle(c,o.x,o.y,7,'#ffe297');txt(c,'🏹',400,320,52);if(mode==='playing'){c.strokeStyle='#ffe297aa';c.setLineDash([7,8]);c.beginPath();c.moveTo(400,320);c.lineTo(pointer.x,pointer.y);c.stroke();c.setLineDash([])}}
  if(id==='sanji'){const foods=['🥩','🥕','🐟','🍞'];txt(c,'👨‍🍳',400,145,85);txt(c,`Pedido: ${foods[extra.order||0]}`,400,55,36);for(let i=0;i<4;i++){box(c,i*200+10,290,180,150,'#af704b');txt(c,foods[i],i*200+100,365,70);txt(c,String(i+1),i*200+100,460,23)}box(c,250,205,300*(1-Math.min(1,(extra.timer||0)/5)),12,'#f4d06f')}
  if(id==='robin'){for(let i=0;i<4;i++){const x=(i%2)*400,y=Math.floor(i/2)*250;box(c,x+12,y+10,376,230,extra.flash===i?'#f3c66d':['#854fac','#447daf','#3d9d8c','#ad6a6d'][i]);txt(c,['📜','🌸','🗿','🧭'][i],x+200,y+125,70);txt(c,String(i+1),x+355,y+32,22)}if(extra.phase==='show')txt(c,'¡Memoriza!',400,245,35,'#fff');else txt(c,`Repite ${extra.input+1}/${extra.seq.length}`,400,245,30,'#fff')}
  if(id==='brook'){for(let i=0;i<4;i++){box(c,i*200+4,0,192,500,i%2?'#e3e9f0':'#f9fafb',0);txt(c,String(i+1),i*200+100,470,21,'#758291')}for(const o of objects)box(c,o.lane*200+9,o.y,182,106,'#171d2b',5);box(c,0,395,800,5,'#f0c76d',0)}
  if(id==='franky'){c.fillStyle='#49a963';c.beginPath();c.moveTo(0,H);for(let x=0;x<=W;x+=5)c.lineTo(x,330+70*Math.sin((x+extra.distance)/115));c.lineTo(W,H);c.fill();txt(c,'🦾',220,player.y-14,58);txt(c,extra.pressure?'↓ Bajando':'↑ Volando',650,55,24)}
  if(id==='jinbe'){txt(c,'🪸',400,464,76);txt(c,'🐟',400,395,62);for(const o of objects){if(o.type==='enemy')txt(c,'🦈',o.x,o.y,46);else{c.strokeStyle='#a3f4ff';c.lineWidth=7;c.beginPath();c.arc(o.x,o.y,o.r,0,Math.PI*2);c.stroke()}}}
 }
 function frame(time){if(disposed)return;const dt=Math.min(.05,(time-last)/1000||0);last=time;if(mode==='playing')update(dt);render();raf=requestAnimationFrame(frame)}
 canvas.width=W;canvas.height=H;lifeEl.textContent='❤️ 3';render();raf=requestAnimationFrame(frame);root.querySelector('[data-start]').focus();return close;
}
