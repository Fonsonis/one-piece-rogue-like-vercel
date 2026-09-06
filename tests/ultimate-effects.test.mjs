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
  assert.ok(families.includes(p.family),p.id);assert.ok(p.authored,'Character direction: '+p.id);assert.ok(p.technique&&p.name);
  for(const [width,height] of [[260,80],[350,180],[1200,350]])for(const source of [.2,.8])for(const t of [.1,.3,.58,.85]){
   draw(recording.ctx,p,t,{width,height,source,target:1-source});recording.drain();
  }
  draw(recording.ctx,p,.58);const frame=recording.drain();assert.ok(!signatures.has(frame),'unique choreography: '+p.id);signatures.add(frame);
  draw(recording.ctx,p,.58);assert.equal(recording.drain(),frame,'repeatable: '+p.id);
  draw(recording.ctx,p,.58,{reduced:true,hit:false});recording.drain();
 }
 assert.equal(h.randomCalls(),randomBefore,'No gameplay RNG for visuals');
 for(const id of ['luffy','luffy2','luffy3','luffy4','luffy5','zoro','law','kuma','teach','marco','aokiji'])assert.ok(profiles.find(p=>p.id===id)?.authored,id);
 console.log(`Ultimate art: ${profiles.length} characters, ${families.length} visual families, ${profiles.filter(p=>p.authored).length} character-specific directions.`);
});
function integrationHarness(withArt,broken=false) {
 const h=combatHarness();h.exec(read('profiles.js'));
 h.exec(`let effects=[];document.getElementById=()=>({querySelector:()=>({isConnected:true})});document.querySelector=()=>null;
  const UltimateFX={play(spec){${broken?'throw Error("Canvas unavailable");':'effects.push({id:spec.profile.id,hit:spec.hit,speed:spec.speed});'}}};`);
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
 const ctx=canvasRecorder().ctx;
 const doc={hidden:false,addEventListener(){},body:{appendChild(n){nodes.push(n);}},createElement(tag){return {tag,isConnected:true,dataset:{},style:{setProperty(){}},setAttribute(){},appendChild(){},append(){},getContext(){if(brokenCanvas)throw Error("Unsupported canvas");return ctx;},remove(){nodes=nodes.filter(n=>n!==this);}};}};
 const c=vm.createContext({document:doc,innerWidth:390,innerHeight:844,devicePixelRatio:3,matchMedia:()=>({matches:reduced}),requestAnimationFrame(fn){const n=++id;rafs.set(n,fn);return n;},cancelAnimationFrame(n){rafs.delete(n);},setTimeout(fn){const n=++id;timeouts.set(n,fn);return n;},clearTimeout(n){timeouts.delete(n);}});
 vm.runInContext(read('profiles.js')+read('effects.js'),c);
 const source={isConnected:true,closest(){return null;},getBoundingClientRect(){return {left:0,top:100,right:190,bottom:300,width:190,height:200};}};
 const target={...source,getBoundingClientRect(){return {left:200,top:100,right:390,bottom:300,width:190,height:200};}};
 return {play:vm.runInContext('UltimateFX.play',c),profile:vm.runInContext("UltimateArtProfiles.resolve('zoro',{name:'Zoro'},{name:'Ashura'})",c),source,target,doc,
 step(t){const q=[...rafs.values()];rafs.clear();q.forEach(fn=>fn(t));},nodes:()=>nodes,counts:()=>[nodes.length,rafs.size,timeouts.size]};
}
test('effects respect viewport bounds, cap concurrency and release timers and canvases',()=>{
 const h=lifecycle(),s={profile:h.profile,source:h.source,target:h.target};
 const handle=h.play(s);h.step(0);assert.equal(h.nodes()[0].style.width,'390px');assert.equal(h.nodes()[0].style.height,'200px');
 h.play(s);assert.equal(h.nodes().length,1,'replace previous effect on the same stage');handle.cancel();assert.equal(h.nodes().length,1);
 const two=h.play({...s,owner:{}});h.play({...s,owner:{}});assert.equal(h.nodes().length,2);two.cancel();
 h.step(0);h.step(2000);assert.deepEqual(h.counts(),[0,0,0]);
 h.play(s);h.source.isConnected=false;h.step(0);assert.deepEqual(h.counts(),[0,0,0]);
 h.source.isConnected=true;h.play(s);h.doc.hidden=true;h.step(0);assert.deepEqual(h.counts(),[0,0,0]);
});
test('reduced-motion mode is static and cleans up; interrupted screens cancel safely',()=>{
 const h=lifecycle(true),s={profile:h.profile,source:h.source,target:h.target};
 h.play(s);h.step(0);h.step(700);assert.deepEqual(h.counts(),[0,0,0]);
 h.play({...s,valid:()=>false});h.step(0);assert.deepEqual(h.counts(),[0,0,0]);
});

test('a failed canvas cannot leak an overlay or interrupt the game',()=>{
 const h=lifecycle(false,true);assert.equal(h.play({profile:h.profile,source:h.source,target:h.target}),null);assert.deepEqual(h.counts(),[0,0,0]);
});
