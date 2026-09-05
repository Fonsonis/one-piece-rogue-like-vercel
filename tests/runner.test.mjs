import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RunnerEngine,RULES} from '../public/runner/engine.mjs';
const advance=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds*120);i++)g.update(1/120)};
const enemy=(g,x)=>({id:g.nextId++,kind:0,x,y:g.ground-62,w:44,h:62,dead:false,age:0,angle:0,vx:0,vy:0,spin:0,life:0,chain:0});

test('unlimited air jumps and a ceiling; landing resets vertical velocity',()=>{
 const g=new RunnerEngine();g.start();g.spawnIn=999;
 assert.equal(g.jump(),true);advance(g,.12);const firstY=g.player.y;
 for(let i=0;i<12;i++){g.jump();advance(g,.035);}
 assert.ok(g.player.y<firstY);assert.ok(g.player.y>=20);
 advance(g,1.5);assert.equal(g.player.y+g.player.h,g.ground);assert.equal(g.player.vy,0);
});
test('rubber punch hits within visible reach, applies gravity and rotation, and enforces cooldown',()=>{
 const g=new RunnerEngine({random:()=>.5});g.start();g.spawnIn=999;
 const target=enemy(g,g.player.x+91);g.enemies.push(target);
 assert.equal(g.punch(),true);assert.equal(g.punch(),false);advance(g,.07);
 assert.equal(target.dead,true);assert.equal(g.kills,1);assert.ok(target.vx>500);assert.ok(target.vy<0);
 const x=target.x,y=target.y;advance(g,.17);assert.ok(target.x>x);assert.ok(target.y<y);assert.ok(target.angle>0);
 assert.equal(g.punch(),false);advance(g,RULES.punchCooldown);assert.equal(g.punch(),true);
});
test('flying enemies can knock out another enemy; ordinary collisions end the run',()=>{
 const g=new RunnerEngine({random:()=>.5});g.start();g.spawnIn=999;
 const thrown=enemy(g,340),target=enemy(g,363);g.enemies.push(thrown,target);g.launch(thrown);g.hitStop=0;g.update(1/120);
 assert.equal(target.dead,true);assert.equal(g.kills,2);
 const b=new RunnerEngine();b.start();b.spawnIn=999;b.enemies.push(enemy(b,b.player.x));b.update(1/120);assert.equal(b.status,'over');
});
test('progressive speed, paused clocks, reset and stable resize',()=>{
 const g=new RunnerEngine();g.start();g.spawnIn=999;advance(g,25);assert.ok(g.speed>RULES.startSpeed);
 g.punch();g.pause();const time=g.time,cooldown=g.cooldown;advance(g,10);assert.equal(g.time,time);assert.equal(g.cooldown,cooldown);
 g.resume();advance(g,.2);assert.ok(g.cooldown<cooldown);
 const altitude=g.ground-g.player.y;g.resize(480,620);assert.equal(g.ground-g.player.y,altitude);
 g.start();assert.equal(g.enemies.length,0);assert.equal(g.cooldown,0);assert.equal(g.score,0);assert.equal(g.speed,RULES.startSpeed);
});
