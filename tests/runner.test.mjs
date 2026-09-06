import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RunnerEngine,RULES} from '../public/runner/engine.mjs';
const advance=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds*120);i++)g.update(1/120)};
const enemy=(g,x)=>({id:g.nextId++,kind:0,x,y:g.ground-62,w:44,h:62,dead:false,age:0,angle:0,vx:0,vy:0,spin:0,life:0,chain:0});

test('only two jumps before landing; pause, ceiling and resize never grant another',()=>{
 const g=new RunnerEngine();g.start();g.spawnIn=999;
 assert.equal(g.jump(),true);advance(g,.12);const firstY=g.player.y;
 assert.equal(g.jump(),true);advance(g,.035);assert.ok(g.player.y<firstY);
 for(let i=0;i<12;i++)assert.equal(g.jump(),false);
 assert.equal(g.jumpsUsed,2);
 g.pause();assert.equal(g.jump(),false);g.resume();g.resize(480,620);assert.equal(g.jump(),false);
 g.player.y=19;g.update(1/120);assert.ok(g.player.y>=20);assert.equal(g.jump(),false);
 advance(g,1.5);assert.equal(g.player.y+g.player.h,g.ground);assert.equal(g.player.vy,0);
 assert.equal(g.jumpsUsed,0);assert.equal(g.jump(),true);
 g.start();assert.equal(g.jumpsUsed,0);
});
test('25 fame per completed 1000 real metres, exactly once per milestone in each run',()=>{
 const rewards=[];const g=new RunnerEngine({onEvent:(name,data)=>{if(name==='reward')rewards.push(data);}});
 g.start();g.spawnIn=999;g.kills=1000;g.distance=999*14;g.update(1/120);assert.equal(rewards.length,0);
 g.distance=1000*14;g.update(1/120);assert.equal(rewards.length,1);assert.equal(rewards[0].fame,25);
 advance(g,.2);g.pause();advance(g,2);g.resume();g.update(1/120);assert.equal(rewards.length,1);
 g.distance=3000*14;g.update(1/120);assert.equal(rewards.length,2);assert.equal(rewards[1].fame,50);assert.equal(rewards[1].totalFame,75);
 g.status='over';advance(g,2);assert.equal(rewards.length,2);
 g.start();g.spawnIn=999;g.distance=1000*14;g.update(1/120);assert.equal(rewards.length,3);assert.equal(rewards[2].fame,25);
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
