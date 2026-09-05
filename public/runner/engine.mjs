export const RULES = Object.freeze({gravity:1850,jumpVelocity:-660,punchCooldown:2.4,punchDuration:0.32,startSpeed:285,maxSpeed:650});
const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export class RunnerEngine {
  constructor({width=900,height=540,random=Math.random,onEvent=()=>{}}={}) {
    this.random=random;this.onEvent=onEvent;this.width=width;this.height=height;this.reset();
  }
  reset() {
    this.ground=this.height-82;
    this.player={x:Math.min(150,this.width*.21),y:this.ground-90,w:52,h:90,vy:0};
    this.status='ready';this.time=0;this.distance=0;this.scroll=0;this.score=0;this.kills=0;
    this.speed=RULES.startSpeed;this.spawnIn=1.55;this.cooldown=0;this.punchLeft=0;
    this.enemies=[];this.particles=[];this.nextId=1;this.shake=0;this.hitStop=0;
  }
  resize(width,height) {
    const oldGround=this.ground;this.width=width;this.height=height;this.ground=height-82;
    this.player.x=Math.min(150,width*.21);this.player.y+=this.ground-oldGround;
    for(const e of this.enemies)e.y+=this.ground-oldGround;
  }
  start(){this.reset();this.status='running';this.onEvent('start');}
  pause(){if(this.status==='running'){this.status='paused';this.onEvent('pause');}}
  resume(){if(this.status==='paused'){this.status='running';this.onEvent('resume');}}
  jump() {
    if(this.status!=='running')return false;
    this.player.vy=RULES.jumpVelocity;
    this.burst(this.player.x+24,this.player.y+this.player.h,7,'#f8edba',-60);
    this.onEvent('jump');return true;
  }
  punch() {
    if(this.status!=='running'||this.cooldown>0)return false;
    this.cooldown=RULES.punchCooldown;this.punchLeft=RULES.punchDuration;this.onEvent('punch');return true;
  }
  punchBox() {
    if(this.punchLeft<=0)return null;
    const phase=1-this.punchLeft/RULES.punchDuration;
    if(phase<.18||phase>.8)return null;
    // Matches the fist in frame 6: (489 - 128) * 90 / 332 + torso anchor.
    return {x:this.player.x+24,y:this.player.y+27,w:100,h:37};
  }
  spawn() {
    const kind=Math.floor(this.random()*5);
    const w=[44,44,60,48,58][kind],h=[62,67,84,65,78][kind];
    this.enemies.push({id:this.nextId++,kind,x:this.width+70,y:this.ground-h,w,h,dead:false,age:0,angle:0,vx:0,vy:0,spin:0,life:0,chain:0,hop:this.time>20&&this.random()<.22});
    const reaction=Math.max(.85,1.65-this.time*.006);
    this.spawnIn=reaction+this.random()*.62;
  }
  burst(x,y,n,color,boost=-240) {
    for(let i=0;i<n;i++)this.particles.push({x,y,vx:(this.random()-.5)*350,vy:boost-this.random()*180,life:.35+this.random()*.35,max:.7,size:3+this.random()*5,color});
    if(this.particles.length>110)this.particles.splice(0,this.particles.length-110);
  }
  launch(e,chain=0) {
    if(e.dead)return;
    e.dead=true;e.vx=570+this.speed*.4+this.random()*180;e.vy=-580-this.random()*170;
    e.spin=9+this.random()*8;e.life=3.4;e.chain=chain;e.hop=false;
    this.kills++;this.shake=8;this.hitStop=.045;
    this.burst(e.x+e.w/2,e.y+e.h/2,18,'#ffd45c');
    this.onEvent('hit',{x:e.x,y:e.y,chain});
  }
  update(dt) {
    if(this.status!=='running')return;
    // Called at a fixed 120 Hz; the guard also prevents accidental giant catch-up steps.
    dt=Math.min(dt,1/30);
    if(this.hitStop>0){this.hitStop-=dt;return;}
    this.time+=dt;this.speed=Math.min(RULES.maxSpeed,RULES.startSpeed+this.time*4.5);
    const travel=this.speed*Math.min(1,this.width/700)*dt;
    this.distance+=this.speed*dt;this.scroll+=travel;this.score=Math.floor(this.distance/14)+this.kills*30;
    this.cooldown=Math.max(0,this.cooldown-dt);this.punchLeft=Math.max(0,this.punchLeft-dt);
    this.shake=Math.max(0,this.shake-dt*35);
    const p=this.player;p.vy+=RULES.gravity*dt;p.y+=p.vy*dt;
    if(p.y+p.h>=this.ground){p.y=this.ground-p.h;p.vy=0;}
    if(p.y<20){p.y=20;p.vy=Math.max(0,p.vy);}
    this.spawnIn-=dt;if(this.spawnIn<=0)this.spawn();
    const punch=this.punchBox();
    for(const e of this.enemies) {
      e.age+=dt;
      if(e.dead) {
        e.vy+=RULES.gravity*.78*dt;e.x+=e.vx*dt;e.y+=e.vy*dt;e.angle+=e.spin*dt;e.life-=dt;
        if(e.y+e.h>this.ground){e.y=this.ground-e.h;e.vy=-Math.abs(e.vy)*.45;e.vx*=.73;e.spin*=.76;}
      } else {
        e.x-=travel;
        if(e.hop)e.y=this.ground-e.h-Math.max(0,Math.sin(e.age*4))*85;
        if(punch&&overlaps(punch,e))this.launch(e);
      }
    }
    for(const flying of this.enemies)if(flying.dead&&flying.chain<3&&Math.abs(flying.vx)>160) {
      for(const target of this.enemies)if(!target.dead&&overlaps(flying,target)) {
        this.launch(target,flying.chain+1);flying.vx*=.7;
      }
    }
    const body={x:p.x+9,y:p.y+12,w:p.w-17,h:p.h-17};
    for(const e of this.enemies)if(!e.dead&&overlaps(body,{x:e.x+8,y:e.y+8,w:e.w-16,h:e.h-8})) {
      this.status='over';this.shake=9;this.onEvent('over',{score:this.score,kills:this.kills,distance:Math.floor(this.distance/14)});break;
    }
    for(const a of this.particles){a.vy+=850*dt;a.x+=a.vx*dt;a.y+=a.vy*dt;a.life-=dt;}
    this.particles=this.particles.filter(a=>a.life>0);
    this.enemies=this.enemies.filter(e=>e.dead?e.life>0&&e.x<this.width+500:e.x+e.w>-70);
  }
}
