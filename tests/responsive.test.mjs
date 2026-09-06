import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const metrics=JSON.parse(fs.readFileSync('docs/motion-bounds.json','utf8'));
const sizing=JSON.parse(fs.readFileSync('docs/sprite-sizing.json','utf8'));
const css=fs.readFileSync('public/art/motion-bounds.css','utf8');

test('all 457 sprites fit the stage throughout attack, recoil and KO, including mirrored enemies',()=>{
 assert.equal(Object.keys(metrics).length,457);
 let checked=0;
 for(const [id,m] of Object.entries(metrics)){
   assert.ok(css.includes(`[data-character="${id}"]`));
   const s=sizing[id].atlasScale,center=(sizing[id].guardBounds[0]+sizing[id].guardBounds[2])/2;
   for(const [width,height] of [[100,60],[134,180],[169,430],[280,150],[320,245]]){
     const p=Math.min(192,(width-16)*192/(2*m.halfWidth),(height-16)*192/(m.top+m.bottom));
     for(const box of m.frames)for(const x of [box[0],box[2]])for(const y of [box[1],box[3]]){
       for(let angle=-13;angle<=13;angle++)for(const scale of [.985,1,1.08])for(const shift of [-15,0,15])for(const lift of [-3,0,5]){
         const a=angle*Math.PI/180,dx=x-96,dy=y-180.48;
         const nx=((dx*Math.cos(a)-dy*Math.sin(a))*scale+96-center+shift)*s;
         const ny=((dx*Math.sin(a)+dy*Math.cos(a))*scale+lift)*s+.48;
         const screenX=width/2+(nx-m.centerShift)*p/192;
         const screenY=height-8-m.bottom*p/192+ny*p/192;
         assert.ok(screenX>=5&&screenX<=width-5&&screenY>=5&&screenY<=height-5,`${id} clipped at ${width}x${height}`);
         assert.ok(width-screenX>=5&&width-screenX<=width-5,`${id} mirrored`);checked++;
       }
     }
   }
 }
 console.log('Motion corner samples contained:',checked);
});

async function viewHarness(){
 const {default:vm}=await import('node:vm');
 const appended=[];
 const node=()=>({innerHTML:'',onclick:null,isConnected:true,children:new Map(),remove(){this.isConnected=false;},querySelector(s){if(!this.children.has(s))this.children.set(s,node());return this.children.get(s);},querySelectorAll(){return [];}});
 const buttons=new Map();
 const ctx=vm.createContext({console,setTimeout(){return 1;},clearTimeout(){},document:{querySelector(s){if(['#island-carousel','.team-slots-list'].includes(s))return null;if(!buttons.has(s))buttons.set(s,node());return buttons.get(s);},querySelectorAll(){return [];},addEventListener(){},getElementById(){return null;},createElement:node,body:{appendChild(n){appended.push(n);}}},localStorage:{getItem(){return null;},setItem(){}}});
 for(const f of ['save-storage.js','data.js','game.js'])vm.runInContext(fs.readFileSync('public/'+f,'utf8').split('// ============ INICIO ============')[0],ctx);
 vm.runInContext('let capturedHTML="", resumed=0;render=html=>{capturedHTML=html};playMusic=()=>{};scheduleRound=()=>resumed++;',ctx);
 return {run:s=>vm.runInContext(s,ctx),appended};
}

test('all island routes retain every node, edge and reachable choice in both orientations',async()=>{
 const h=await viewHarness();
 const results=JSON.parse(h.run(`JSON.stringify(SAGAS.flatMap((s,saga)=>s.islands.map((island,islandIdx)=>{
  run={saga,islandIdx,mode:'classic',team:[makeChar('luffy',5)],items:{},berries:0,badges:[],map:genMap(island),pos:null};
  const before=JSON.stringify(run),nodes=run.map.rows.flat().length,edges=run.map.edges.length,reachable=reachableNodes().length;
  screenMap();return {before,after:JSON.stringify(run),nodes,edges,reachable,html:capturedHTML};
 })))`));
 assert.equal(results.length,57);
 for(const r of results){
  assert.equal(r.before,r.after);
  const nodes=[...r.html.matchAll(/<button type="button" class="map-node[^>]+>/g)].map(m=>m[0]);
  assert.equal(nodes.length,r.nodes);assert.equal(nodes.filter(n=>!n.includes(' disabled')).length,r.reachable);
  assert.equal((r.html.match(/<line /g)||[]).length,r.edges*2);
  for(const node of nodes)for(const [,value]of node.matchAll(/--map-(?:x|y|forward):([\d.]+)%/g))assert.ok(Number(value)>=0&&Number(value)<=100);
 }
});

test('crew review pauses once, preserves fighters and resumes only if it was running',async()=>{
 const h=await viewHarness();
 h.run("run={mode:'classic',team:[makeChar('luffy',35),makeChar('zoro',35)],items:{},saga:0};renderBattle=()=>{};startBattle([makeChar('kaido',35)],{wild:true});");
 const before=h.run('JSON.stringify(run)');
 h.run('showBattleCrew()');assert.equal(h.run('battle.waiting'),true);
 const close=h.appended.at(-1).querySelector('[data-close-crew]');
 close.onclick();const resumed=h.run('resumed');close.onclick();assert.equal(h.run('resumed'),resumed);
 assert.equal(h.run('battle.waiting'),false);assert.equal(h.run('JSON.stringify(run)'),before);
 h.run('pauseBattle();showBattleCrew()');h.appended.at(-1).querySelector('[data-close-crew]').onclick();
 assert.equal(h.run('battle.waiting'),true);assert.equal(h.run('resumed'),resumed);
});
