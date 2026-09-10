import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('public/art/world-voyage.js','utf8');
const ctx=vm.createContext({});vm.runInContext(source,ctx);
const {makeRoute,pointAt,durationFor}=ctx.WorldVoyage;

test('one continuous route visits every port exactly in order and works in reverse',()=>{
 const stops=Array.from({length:57},(_,i)=>({id:`port-${i}`,x:i%2?350:110,y:16000-i*250}));
 const route=makeRoute(stops);
 assert.equal(Object.keys(route.ports).length,57);
 assert.equal((route.path.match(/ C /g)||[]).length,57);
 for(const stop of stops){const p=pointAt(route,route.ports[stop.id]);assert.equal(p.x,stop.x);assert.equal(p.y,stop.y);}
 for(let i=1;i<route.samples.length;i++)assert.ok(route.samples[i].distance>route.samples[i-1].distance);
 let previousY=-Infinity;
 for(let d=route.length;d>=0;d-=30){const p=pointAt(route,d);assert.ok(p.y>=previousY);previousY=p.y;}
 assert.equal(durationFor(100000),5000);assert.equal(durationFor(-100000),5000);assert.equal(durationFor(10),800);
 assert.equal(pointAt(makeRoute([]),1).x,0);
});

test('location names preserve every encounter, stable index and progression value',()=>{
 const c=vm.createContext({});vm.runInContext(fs.readFileSync('public/data.js','utf8'),c);
 const before=JSON.parse(vm.runInContext('JSON.stringify(SAGAS)',c));
 vm.runInContext(fs.readFileSync('public/art/world-locations.js','utf8'),c);
 const after=JSON.parse(vm.runInContext('JSON.stringify(SAGAS)',c));
 assert.equal(after.flatMap(s=>s.islands).length,57);
 for(let s=0;s<before.length;s++)for(let i=0;i<before[s].islands.length;i++){
   const {name,location,...rest}=after[s].islands[i],{name:oldName,...oldRest}=before[s].islands[i];
   assert.deepEqual(rest,oldRest);
   assert.equal(location.id,`${after[s].id}-${i}`);
   assert.match(location.source,/^https:\/\/onepiece\.fandom\.com\/wiki\//);
   assert.equal(name,`${location.place} · ${location.zone}`);
 }
 assert.equal(after[0].islands[3].location.kind,'Barco');
 assert.equal(after[10].islands[5].location.place,'Mary Geoise');
});

function mounted({reduce=false}={}){
 const frames=new Map();let count=0,observed=0,arrivals=[],travels=[];
 const listeners={},seaValues={};
 const sea={style:{setProperty:(k,v)=>seaValues[k]=v}};
 const style={setProperty(){}},classes=new Set();
 const img={},ship={style,dataset:{},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)},querySelector:()=>img};
 const path={setAttribute(){}},svg={setAttribute(){},querySelector:()=>path};
 const stops=[{id:'b',x:280,y:200},{id:'a',x:70,y:700}].map(({id,x,y})=>({dataset:{locationKey:id},classList:{contains:()=>true},querySelector:()=>({getBoundingClientRect:()=>({left:x,width:100,bottom:y})})}));
 const content={scrollHeight:1000,getBoundingClientRect:()=>({left:0,top:0,width:400}),querySelector:s=>s==='.world-ship'?ship:svg,querySelectorAll:()=>stops};
 const chart={isConnected:true,clientHeight:400,scrollHeight:1000,scrollTop:0,parentElement:{querySelector:s=>s==='.world-sea'?sea:null},querySelector:()=>content,addEventListener:(event,fn)=>listeners[event]=fn};
 const media={matches:reduce,addEventListener(){},removeEventListener(){}};
 const c=vm.createContext({AbortController,Image:class{},matchMedia:()=>media,document:{hidden:false,addEventListener(){}},addEventListener(){},requestAnimationFrame:fn=>{frames.set(++count,fn);return count;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{observe(){observed++;}disconnect(){observed=0;}}});
 vm.runInContext(source,c);
 const nav=c.WorldVoyage.mount(chart,{onTravel:id=>travels.push(id),onArrival:id=>arrivals.push(id)});
 const tick=t=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(t));};
 return {nav,chart,ship,frames,classes,arrivals,travels,tick,listeners,seaValues,observed:()=>observed};
}
test('travel reroutes from its current position, skips safely and destroys animation resources',()=>{
 const h=mounted();h.nav.travelTo('b');assert.equal(h.nav.sailing,true);
 h.tick(0);h.tick(300);const position=h.ship.dataset.y;
 h.nav.travelTo('a');assert.equal(h.ship.dataset.y,position,'reroute does not teleport');
 h.nav.finish();assert.deepEqual(h.arrivals,['a']);assert.equal(h.nav.sailing,false);assert.equal(h.frames.size,0);
 h.nav.travelTo('b');h.nav.destroy();assert.equal(h.frames.size,0);assert.equal(h.observed(),0);
 assert.equal(h.nav.travelTo('a'),false);
});
test('reduced motion arrives immediately and long journeys finish in five seconds',()=>{
 const reduced=mounted({reduce:true});reduced.nav.travelTo('b');assert.equal(reduced.frames.size,0);assert.deepEqual(reduced.arrivals,['b']);
 const h=mounted();h.nav.travelTo('b');h.tick(0);h.tick(5001);assert.equal(h.nav.sailing,false);assert.deepEqual(h.arrivals,['b']);
});

test('ocean scrolls pixel for pixel with the islands, including return scrolling',()=>{
 const h=mounted();assert.equal(h.seaValues['--sea-offset'],'0px');
 for(const y of [375,700,210,0]){h.chart.scrollTop=y;h.listeners.scroll();assert.equal(h.seaValues['--sea-offset'],`${-y}px`);}
});

test('every canonical destination and sailing direction has a bundled static image',()=>{
 const catalog=JSON.parse(fs.readFileSync('docs/world-location-catalog.json','utf8'));
 const ids=[...Object.values(catalog).flat().map(p=>p.id),'ship-north','ship-east','ship-south','ship-west','ocean','redline'];
 for(const id of ids){const bytes=fs.readFileSync(`public/art/world/${id}.webp`);assert.ok(bytes.length>1000,id);assert.equal(bytes.toString('ascii',8,12),'WEBP');}
});
