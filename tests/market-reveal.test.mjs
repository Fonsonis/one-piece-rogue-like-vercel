import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {combatHarness} from './balance-harness.mjs';

function harness(reduced=false){
 const clock=new Map(), classes=new Set(), panelClasses=new Set(), listeners=new Map();let observerCallback,disconnected=false,changes,claims=0;
 const panel={classList:{add:c=>panelClasses.add(c)},addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:k=>listeners.delete(k)};
 const button={textContent:'',onclick:null,focus(){}},status={textContent:''};
 const host={isConnected:true,innerHTML:'',classList:{add:c=>classes.add(c)},querySelector:s=>s==='.market-reveal'?panel:s==='.mr-continue'?button:status};
 const context=vm.createContext({window:{matchMedia:()=>({matches:reduced,addEventListener:(k,f)=>{changes=f;},removeEventListener:()=>{changes=null;}})},document:{body:{}},Math:Object.assign(Object.create(Math),{random(){throw Error('Presentation consumed gameplay RNG');}}),MutationObserver:class{constructor(f){observerCallback=f;}observe(){}disconnect(){disconnected=true;}},setTimeout:f=>{const id=clock.size+1;clock.set(id,f);return id;},clearTimeout:id=>clock.delete(id)});
 vm.runInContext(readFileSync('public/art/market-reveal.js','utf8'),context);
 const show=rarity=>vm.runInContext('MarketReveal.show',context)({host,name:'Luffy <&>',rarity,portraitHTML:'<img alt="" src="luffy.png">',onComplete:()=>{claims++;}});
 return {show,host,button,status,panelClasses,listeners,clock,get claims(){return claims;},get disconnected(){return disconnected;},tick:()=>{for(const f of [...clock.values()])f();},remove:()=>{host.isConnected=false;observerCallback();},reduce:()=>changes({matches:true})};
}

test('five deterministic rarity reveals use the actual character rarity and escape its name',()=>{
 for(let r=1;r<=5;r++){
  const h=harness();h.show(r);
  assert.match(h.host.innerHTML,new RegExp(`data-rarity="${r}"`));
  assert.equal((h.host.innerHTML.match(/--star-delay:/g)||[]).length,r);
  assert.match(h.host.innerHTML,/Luffy &lt;&amp;&gt;/);
  assert.equal(h.claims,0);h.tick();assert.match(h.status.textContent,new RegExp(`${r} estrella`));assert.equal(h.claims,0);
  const click=h.button.onclick;click();click();assert.equal(h.claims,1);assert.equal(h.clock.size,0);assert.equal(h.disconnected,true);
 }
});
test('skip reveals the result, then confirmation recruits only once even with repeated events',()=>{
 const h=harness();h.show(5);const click=h.button.onclick;
 click();assert.equal(h.claims,0);assert.equal(h.button.textContent,'CONTINUAR');assert.ok(h.panelClasses.has('mr-ready'));assert.equal(h.clock.size,0);
 click();click();h.tick();assert.equal(h.claims,1);
});
test('reduced motion and Escape reveal immediately without silently recruiting',()=>{
 const h=harness(true);h.show(4);assert.equal(h.clock.size,0);assert.equal(h.button.textContent,'CONTINUAR');assert.equal(h.claims,0);
 const other=harness();other.show(5);other.listeners.get('keydown')({key:'Escape',preventDefault(){},stopPropagation(){}});assert.equal(other.button.textContent,'CONTINUAR');assert.equal(other.claims,0);
 const changed=harness();changed.show(5);changed.reduce();assert.equal(changed.clock.size,0);assert.equal(changed.button.textContent,'CONTINUAR');
});
test('removing or cancelling a reveal releases timers and cannot award a ghost recruit',()=>{
 for(const remove of [false,true]){
  const h=harness();const handle=h.show(3);const click=h.button.onclick;
  if(remove)h.remove();else handle.cancel();
  click();handle.skip();h.tick();assert.equal(h.claims,0);assert.equal(h.clock.size,0);assert.equal(h.disconnected,true);
 }
});


test('all five market stops in every saga preserve rolls, pity and exactly one recruitment',()=>{
 const rolls=[.1,.5,.8,.97,.999];
 for(let saga=0;saga<11;saga++)for(let stop=0;stop<5;stop++){
  const h=combatHarness();let draws=0,shown;const joined=[];
  const node=()=>({innerHTML:'',disabled:true,onclick:null,focus(){},classList:{add(){},remove(){},toggle(){}}});
  const cards=Array.from({length:5},node),faces=Array.from({length:5},node);
  const host={isConnected:true,remove(){this.isConnected=false;},querySelectorAll:()=>cards,querySelector:s=>s.startsWith('#pf-')?faces[+s.slice(4)]:cards[+s.match(/data-p="(\d)"/)[1]]};
  h.ctx.document.createElement=()=>host;h.ctx.document.body={appendChild(){}};
  h.ctx.Math.random=()=>++draws===1?rolls[stop]:.123;
  h.ctx.MarketReveal={show:args=>{shown=args;}};h.ctx.specialJoin=(id,lvl)=>joined.push({id,lvl});
  h.exec(`run={saga:${saga},berries:1234};meta.starPity=0;renderSpecialGacha(20);`);
  assert.equal(draws,2);assert.equal(h.exec('run.berries'),1234);
  for(let i=0;i<=stop;i++){
   assert.deepEqual(cards.map(c=>c.disabled),cards.map((_,index)=>index!==i));cards[i].onclick();
  }
  assert.equal(draws,2);assert.ok(cards.every(c=>c.disabled));assert.equal(joined.length,0);
  shown.onComplete();shown.onComplete();assert.equal(joined.length,1);assert.equal(joined[0].lvl,20);
  const rarity=h.exec(`CHARS[${JSON.stringify(joined[0].id)}].rareza`);
  assert.equal(shown.rarity,rarity);assert.equal(h.exec('meta.starPity'),stop===4||rarity===5?0:stop+1);
 }
});
test('a missing or broken animation still completes the original recruitment once',()=>{
 for(const broken of [false,true]){
  const h=combatHarness();let scheduled,claims=0;
  const host={isConnected:true,remove(){this.isConnected=false;}};
  h.ctx.testHost=host;h.ctx.setTimeout=fn=>{scheduled=fn;};h.ctx.specialJoin=()=>claims++;
  if(broken)h.ctx.MarketReveal={show(){throw Error('No animation support');}};
  h.exec("revealSpecialRecruit(testHost,'luffy',10)");assert.equal(claims,0);scheduled();scheduled();assert.equal(claims,1);
 }
});
