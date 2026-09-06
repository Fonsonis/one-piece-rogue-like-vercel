import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {combatHarness} from './balance-harness.mjs';
const read=f=>fs.readFileSync('public/art/ultimates/'+f,'utf8');
function artHarness() {
 const h=combatHarness();h.exec(read('profiles.js'));
 h.exec(`globalThis.addEventListener=()=>{};`);
 h.exec(read('effects.js'));
 return h;
}
function canvasRecorder() {
 let operations=[];
 const ctx=new Proxy({globalAlpha:1}, {get(target,key){
   if(key in target)return target[key];
   if(key==='createRadialGradient')return (...args)=>{operations.push([key,...args]);return {addColorStop(...v){operations.push(['color',...v]);}};};
   return (...args)=>{for(const v of args)if(typeof v==='number')assert.ok(Number.isFinite(v),key+' finite');operations.push([key,...args]);};
 },set(target,key,v){if(typeof v==='number')assert.ok(Number.isFinite(v));target[key]=v;operations.push([key,v]);return true;}});
 return {ctx,drain(){const out=JSON.stringify(operations);operations=[];return out;}};
}
test('every character gets deterministic, drawable ultimate art in both directions, including all Gears',()=>{
 const h=artHarness(),profiles=Array.from(h.exec(`Object.entries(CHARS).map(([id,c])=>UltimateArtProfiles.resolve(id,c,getUltimateMove({id,lvl:100}),baseFormOf(id)))`));
 const families=Array.from(h.exec('UltimateArtProfiles.families'));
 const recording=canvasRecorder(),signatures=new Set();
 const draw=h.exec('UltimateFX.drawFrame');const randomBefore=h.randomCalls();
 for(const p of profiles){
  const sprite={naturalWidth:768,naturalHeight:192,src:'/art/characters/'+p.id+'.png'};
  assert.ok(families.includes(p.family),p.id);assert.ok(p.authored,'Character direction: '+p.id);assert.ok(p.technique&&p.name);
  for(const [width,height] of [[260,80],[350,180],[1200,350]])for(const source of [.2,.8])for(const t of [.1,.3,.58,.85]){
   draw(recording.ctx,p,t,{width,height,source,target:1-source,sprite});recording.drain();
  }
  draw(recording.ctx,p,.58,{sprite});const frame=recording.drain();assert.ok(!signatures.has(frame),'unique choreography: '+p.id);signatures.add(frame);
  draw(recording.ctx,p,.58,{sprite});assert.equal(recording.drain(),frame,'repeatable: '+p.id);
  draw(recording.ctx,p,.58,{reduced:true,hit:false,sprite});recording.drain();
 }
 assert.equal(h.randomCalls(),randomBefore,'No gameplay RNG for visuals');
 for(const id of ['luffy','luffy2','luffy3','luffy4','luffy5','zoro','law','kuma','teach','marco','aokiji'])assert.ok(profiles.find(p=>p.id===id)?.authored,id);
 console.log(`Ultimate art: ${profiles.length} characters, ${families.length} visual families, ${profiles.filter(p=>p.authored).length} character-specific directions.`);
});
function integrationHarness(withArt,broken=false) {
 const h=combatHarness();h.exec(read('profiles.js'));
 h.exec(`let effects=[];document.getElementById=()=>({querySelector:()=>({isConnected:true})});document.querySelector=()=>null;
  const UltimateFX={play(spec){${broken?'throw Error("Canvas unavailable");':'effects.push({id:spec.profile.id,technique:spec.profile.technique,hit:spec.hit,speed:spec.speed});'}}};`);
 if(withArt)h.exec(read('integration.js'));
 return h;
}
test('ultimate effects preserve damage, status, charge, logs and game RNG for the whole catalog',()=>{
 const a=integrationHarness(false),b=integrationHarness(true),broken=integrationHarness(true,true);
 const script=`(()=>{
 const result=[];
 for(const id of Object.keys(CHARS)){
  run={mode:'classic',saga:0,team:[makeChar(id,100)],items:{}};
  const f=run.team[0],e=makeChar('kaido',100,true);startBattle([e],{wild:true});f.ultCharge=100;
  useUltimate(f);result.push({id,hp:e.hp,st:e.st,charge:f.ultCharge,ownHP:f.hp});
 }
 return JSON.stringify(result);
 })()`;
 const expected=a.exec(script);assert.equal(b.exec(script),expected);assert.equal(broken.exec(script),expected);
 assert.equal(a.randomCalls(),b.randomCalls());assert.equal(a.randomCalls(),broken.randomCalls());
 assert.equal(b.exec('effects.length'),b.exec('Object.keys(CHARS).length'));
});
test('blocked ultimates do not animate, and misses never display a successful impact',()=>{
 const h=integrationHarness(true);
 h.exec(`run={mode:'classic',saga:0,team:[makeChar('zoro',35)],items:{}};startBattle([makeChar('buggy',35)],{wild:true});let f=run.team[0];
 useUltimate(f);f.ultCharge=100;f.lvl=19;useUltimate(f);f.lvl=35;f.hp=0;useUltimate(f);f.hp=f.maxhp;battle.over=true;useUltimate(f);`);
 assert.equal(h.exec('effects.length'),0);
 h.exec('battle.over=false;useUltimate(f);');assert.equal(h.exec('effects.length'),1);assert.equal(h.exec('effects[0].hit'),false);
});
function lifecycle(reduced=false,brokenCanvas=false) {
 let nodes=[],rafs=new Map(),timeouts=new Map(),id=0;
 const recording=canvasRecorder(),ctx=recording.ctx;
 const doc={hidden:false,addEventListener(){},body:{appendChild(n){nodes.push(n);}},createElement(tag){return {tag,isConnected:true,dataset:{},style:{setProperty(){}},setAttribute(){},appendChild(){},append(){},getContext(){if(brokenCanvas)throw Error("Unsupported canvas");return ctx;},remove(){nodes=nodes.filter(n=>n!==this);}};}};
 const images=[];class Image {naturalWidth=768;naturalHeight=192;set src(v){this.url=v;images.push(this);Promise.resolve().then(()=>this.onload?.());}}
 const c=vm.createContext({Image,document:doc,innerWidth:390,innerHeight:844,devicePixelRatio:3,matchMedia:()=>({matches:reduced}),requestAnimationFrame(fn){const n=++id;rafs.set(n,fn);return n;},cancelAnimationFrame(n){rafs.delete(n);},setTimeout(fn){const n=++id;timeouts.set(n,fn);return n;},clearTimeout(n){timeouts.delete(n);}});
 vm.runInContext(read('profiles.js')+read('effects.js'),c);
 const values=new Map();const sprite={dataset:{character:'zoro'},style:{setProperty(k,v){values.set(k,v);},getPropertyValue(k){return values.get(k)||'';},getPropertyPriority(){return '';},removeProperty(k){values.delete(k);}},getBoundingClientRect(){return {left:5,top:100,right:185,bottom:280,width:180,height:180};}};
 const source={querySelector(){return sprite;},isConnected:true,closest(){return null;},getBoundingClientRect(){return {left:0,top:100,right:190,bottom:300,width:190,height:200};}};
 const target={...source,getBoundingClientRect(){return {left:200,top:100,right:390,bottom:300,width:190,height:200};}};
 return {sprite,images,recording,ready:async()=>{for(let i=0;i<5;i++)await Promise.resolve();},play:vm.runInContext('UltimateFX.play',c),profile:vm.runInContext("UltimateArtProfiles.resolve('zoro',{name:'Zoro'},{name:'Ashura'})",c),source,target,doc,
 step(t){const q=[...rafs.values()];rafs.clear();q.forEach(fn=>fn(t));},nodes:()=>nodes,counts:()=>[nodes.length,rafs.size,timeouts.size]};
}
test('effects respect viewport bounds, cap concurrency and release timers and canvases',async()=>{
 const h=lifecycle(),s={profile:h.profile,source:h.source,target:h.target};
 const handle=h.play(s);await h.ready();h.step(0);assert.equal(h.nodes()[0].style.width,'390px');assert.equal(h.nodes()[0].style.height,'252px');
 h.play(s);assert.equal(h.nodes().length,1,'replace previous effect on the same stage');handle.cancel();assert.equal(h.nodes().length,1);
 const two=h.play({...s,owner:{}});h.play({...s,owner:{}});assert.equal(h.nodes().length,2);two.cancel();
 await h.ready();h.step(0);h.step(2000);assert.deepEqual(h.counts(),[0,0,0]);
 h.play(s);h.source.isConnected=false;h.step(0);assert.deepEqual(h.counts(),[0,0,0]);
 h.source.isConnected=true;h.play(s);h.doc.hidden=true;h.step(0);assert.deepEqual(h.counts(),[0,0,0]);
});
test('reduced-motion mode is static and cleans up; interrupted screens cancel safely',async()=>{
 const h=lifecycle(true),s={profile:h.profile,source:h.source,target:h.target};
 h.play(s);await h.ready();h.step(0);h.step(700);assert.deepEqual(h.counts(),[0,0,0]);
 h.play({...s,valid:()=>false});h.step(0);assert.deepEqual(h.counts(),[0,0,0]);
});

test('a failed canvas cannot leak an overlay or interrupt the game',()=>{
 const h=lifecycle(false,true);assert.equal(h.play({profile:h.profile,source:h.source,target:h.target}),null);assert.deepEqual(h.counts(),[0,0,0]);
});


test('sprite rendering uses atlas cells only, with a distinct movement for each Luffy Gear',()=>{
 const h=artHarness(),draw=h.exec('UltimateFX.drawFrame'),choreo=h.exec('UltimateFX.choreography'),recording=canvasRecorder();
 const motions=new Set();
 for(const id of ['luffy','luffy2','luffy3','luffy4','luffy5','zoro','sanji','law','ace']){
  const p=h.exec(`UltimateArtProfiles.resolve('${id}',CHARS['${id}'],getUltimateMove({id:'${id}',lvl:100}))`);
  if(id.startsWith('luffy'))motions.add(p.motion);
  assert.equal(choreo(p,0).pose,0);assert.equal(choreo(p,1).pose,0);assert.equal(choreo(p,1).travel,0);
  assert.equal(choreo(p,.5,true).travel,0);
  const sprite={naturalWidth:768,naturalHeight:192};
  for(const t of [.05,.2,.4,.5,.7,.9]){
   draw(recording.ctx,p,t,{sprite});
   const ops=JSON.parse(recording.drain()),draws=ops.filter(op=>op[0]==='drawImage');
   assert.ok(draws.length>0,id+' draws its sprite');
   assert.ok(!ops.some(op=>['fill','stroke','arc','fillRect','bezierCurveTo'].includes(op[0])),'No detached effects');
   for(const [,image,sx,sy,sw,sh] of draws){assert.equal(image.naturalWidth,768);assert.ok(sx>=0&&sx+sw<=768);assert.equal(Math.floor(sx/192),Math.floor((sx+sw-1)/192),'Never samples a neighboring pose');assert.equal(sy,0);assert.equal(sh,192);}
  }
 }
 assert.equal(motions.size,5);
});

test('loaded sprite replaces the original, and cancellation always restores its visibility',async()=>{
 const h=lifecycle(),spec={profile:h.profile,source:h.source,target:h.target};
 const handle=h.play(spec);assert.equal(h.sprite.style.getPropertyValue('visibility'),'');
 await h.ready();assert.equal(h.sprite.style.getPropertyValue('visibility'),'hidden');
 h.step(0);h.step(800);handle.cancel();assert.equal(h.sprite.style.getPropertyValue('visibility'),'');
 assert.deepEqual(h.counts(),[0,0,0]);
 const early=h.play(spec);early.cancel();await h.ready();assert.equal(h.sprite.style.getPropertyValue('visibility'),'');
 assert.deepEqual(h.counts(),[0,0,0]);
});

test('rotated cells, extended arms and enemy reactions stay inside narrow viewports',()=>{
 const h=artHarness(),draw=h.exec('UltimateFX.drawFrame');
 const profiles=Array.from(h.exec(`Object.entries(CHARS).map(([id,c])=>UltimateArtProfiles.resolve(id,c,getUltimateMove({id,lvl:100})))`));
 for(const [width,height] of [[260,80],[320,200],[844,210]]){
  let matrix=[1,0,0,1,0,0],stack=[];
  const multiply=n=>{const [a,b,c,d,e,f]=matrix,[g,j,k,l,m,o]=n;matrix=[a*g+c*j,b*g+d*j,a*k+c*l,b*k+d*l,a*m+c*o+e,b*m+d*o+f];};
  const ctx={clearRect(){},save(){stack.push([...matrix]);},restore(){matrix=stack.pop();},translate(x,y){multiply([1,0,0,1,x,y]);},scale(x,y){multiply([x,0,0,y,0,0]);},rotate(a){multiply([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]);},drawImage(image,sx,sy,sw,sh,x,y,w,h){
   const [a,b,c,d,e,f]=matrix;
   for(const [px,py] of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]){const xx=a*px+c*py+e,yy=b*px+d*py+f;assert.ok(xx>=-1e-6&&xx<=width+1e-6,`horizontal clip ${xx}/${width}`);assert.ok(yy>=-1e-6&&yy<=height+1e-6,`vertical clip ${yy}/${height}`);}
  }};
  const sprite={naturalHeight:192,naturalWidth:768};
  for(const p of profiles)for(const t of [.28,.42,.58,.7])for(const source of [.2,.8])draw(ctx,p,t,{width,height,source,target:1-source,sprite,actor:{x:width*source,y:height+40,size:350},defender:{image:sprite,x:width*(1-source),y:height+60,size:400}});
 }
});

test('invalid or unavailable sprite textures leave the original visible and release the scene',async()=>{
 const h=lifecycle();h.play({profile:h.profile,source:h.source,target:h.target});
 h.images[0].naturalWidth=0;await h.ready();assert.deepEqual(h.counts(),[0,0,0]);
 assert.equal(h.sprite.style.getPropertyValue('visibility'),'');
});

test('Luffy sheet previews use the ultimate of the displayed Gear',()=>{
 const h=integrationHarness(true);
 h.exec(`let previewButton;const stage={dataset:{character:'luffy'}},hero={querySelector(selector){return selector==='.char-sheet-sprite'?stage:null;},appendChild(button){previewButton=button;}};
 document.querySelectorAll=()=>[hero];document.createElement=()=>({setAttribute(){}});
 `);
 // Install a no-op sheet renderer first so this test exercises only the sheet adapter.
 h.exec(`showCharModal=()=>{};`);h.exec(read('integration.js'));
 for(const id of ['luffy','luffy2','luffy3','luffy4','luffy5']){
  h.exec(`stage.dataset.character='${id}';showCharModal({id:'${id}',lvl:100});previewButton.onclick();`);
  assert.equal(h.exec('effects.at(-1).technique'),h.exec(`getUltimateMove({id:'${id}',lvl:(CHARS['${id}'].evo?.lvl||101)-1}).name`));
 }
});
