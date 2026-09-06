/* Presentation-only travel on the same curve drawn on the chart. No game RNG or saves. */
(() => {
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function makeRoute(stops) {
    if(!stops.length)return {samples:[],ports:{},length:0,path:''};
    const points=[{x:stops[0].x,y:stops[0].y+120},...stops];
    const samples=[{...points[0],distance:0}],ports={};let length=0;
    let path=`M ${points[0].x} ${points[0].y}`;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],mid=(a.y+b.y)/2;
      path+=` C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`;
      for(let j=1;j<=24;j++){
        const t=j/24,u=1-t,x=u*u*u*a.x+3*u*u*t*a.x+3*u*t*t*b.x+t*t*t*b.x;
        const y=u*u*u*a.y+3*u*u*t*mid+3*u*t*t*mid+t*t*t*b.y,previous=samples.at(-1);
        length+=Math.hypot(x-previous.x,y-previous.y);samples.push({x,y,distance:length});
      }
      if(b.id)ports[b.id]=length;
    }
    return {samples,ports,length,path};
  }
  function pointAt(route,distance) {
    const list=route.samples;if(!list.length)return {x:0,y:0};
    distance=clamp(distance,0,route.length);let lo=0,hi=list.length-1;
    while(lo<hi){const mid=Math.floor((lo+hi)/2);if(list[mid].distance<distance)lo=mid+1;else hi=mid;}
    const a=list[Math.max(0,lo-1)],b=list[lo],t=(distance-a.distance)/(b.distance-a.distance||1);
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  }
  function durationFor(distance){return clamp(Math.abs(distance)*.45,800,5000);}
  function mount(chart,{initialId=null,onArrival=()=>{},onTravel=()=>{}}={}) {
    const content=chart.querySelector('.world-chart'),ship=content?.querySelector('.world-ship');
    const svg=content?.querySelector('.world-route'),path=svg?.querySelector('path'),image=ship?.querySelector('img');
    if(!ship||!svg)return null;
    const media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    const events=new AbortController();let route,position=0,currentId=initialId,targetId=null,trip=null,frame=0,dead=false,follow=true,lastSize='';
    // Keep the viewport-sized ocean at the same world coordinate as the islands.
    const sea=chart.parentElement.querySelector('.world-sea');
    const syncSea=()=>sea?.style.setProperty('--sea-offset',`${-chart.scrollTop}px`);
    const assets=['north','east','south','west'];for(const dir of assets){const img=new Image();img.src=`/art/world/ship-${dir}.webp`;}
    function draw(direction=1,refollow=false){
      const p=pointAt(route,position),next=pointAt(route,position+direction*5),dx=next.x-p.x,dy=next.y-p.y;
      if(Math.abs(dx)+Math.abs(dy)>.01){
        const heading=Math.abs(dy)>=Math.abs(dx)?(dy<0?0:2):(dx>0?1:3);
        if(ship.dataset.heading!==assets[heading]){ship.dataset.heading=assets[heading];image.src=`/art/world/ship-${assets[heading]}.webp`;}
        ship.style.setProperty('--wake-angle',`${Math.atan2(dy,dx)*180/Math.PI-90}deg`);
      }
      ship.style.transform=`translate(${p.x}px,${p.y}px)`;
      ship.dataset.x=p.x.toFixed(1);ship.dataset.y=p.y.toFixed(1);
      if(follow&&(trip||refollow)){
        const panel=chart.parentElement.querySelector('.world-inspector');
        const sidePanel=panel&&!panel.hidden&&panel.offsetLeft>=chart.clientWidth;
        const reserve=panel&&!panel.hidden&&!sidePanel?panel.offsetHeight+20:20;
        const view=Math.max(90,chart.clientHeight-reserve);
        const anchor=Math.min(view-10,Math.max(110,view*.5));
        chart.scrollTop=clamp(p.y-anchor,0,chart.scrollHeight-chart.clientHeight);
      }
    }
    function complete(){
      if(dead||!targetId)return;
      position=route.ports[targetId];currentId=targetId;cancelAnimationFrame(frame);frame=0;
      ship.classList.remove('is-sailing');draw();trip=null;targetId=null;onArrival(currentId);
    }
    function refresh(){
      if(dead||!chart.isConnected){destroy();return;}
      const base=content.getBoundingClientRect();
      const size=`${base.width}:${chart.clientHeight}`,resized=!!lastSize&&lastSize!==size;lastSize=size;
      const stops=[...content.querySelectorAll('.world-stop, .world-redline')].reverse().flatMap(el=>{
        if(el.dataset.worldCrossing!=null){
          const crossing=el.getBoundingClientRect();
          return [{x:base.width/2,y:crossing.bottom-base.top+12},{x:base.width/2,y:crossing.top-base.top-12}];
        }
        const art=el.querySelector('.island-land').getBoundingClientRect();
        const sign=el.classList.contains('port')?1:-1;
        return [{id:el.dataset.locationKey,x:clamp(art.left-base.left+art.width/2+sign*(art.width*.43),35,base.width-35),y:art.bottom-base.top-10}];
      });
      route=makeRoute(stops);svg.setAttribute('viewBox',`0 0 ${base.width} ${content.scrollHeight}`);
      path.setAttribute('d',route.path);
      if(trip){complete();return;}
      position=currentId&&route.ports[currentId]!=null?route.ports[currentId]:0;draw(1,resized&&!!currentId);syncSea();
    }
    function tick(now){
      if(dead||!chart.isConnected){destroy();return;}if(document.hidden){complete();return;}
      if(!trip)return;
      trip.start??=now;const t=clamp((now-trip.start)/trip.duration,0,1),e=t*t*(3-2*t);
      position=trip.from+(trip.to-trip.from)*e;draw(Math.sign(trip.to-trip.from)||1);
      if(t>=1){complete();return;}frame=requestAnimationFrame(tick);
    }
    function travelTo(id){
      if(dead||route.ports[id]==null)return false;
      cancelAnimationFrame(frame);targetId=id;follow=true;
      const to=route.ports[id],distance=to-position;
      onTravel(id);ship.classList.add('is-sailing');
      trip={from:position,to,start:null,duration:durationFor(distance)};
      if(media?.matches||Math.abs(distance)<1){complete();return true;}
      draw(Math.sign(distance));frame=requestAnimationFrame(tick);return true;
    }
    function destroy(){
      if(dead)return;dead=true;trip=null;cancelAnimationFrame(frame);events.abort();resize?.disconnect();
      media?.removeEventListener?.('change',motionChanged);ship.classList.remove('is-sailing');
    }
    const motionChanged=()=>{if(media.matches&&trip)complete();};
    const resize=typeof ResizeObserver==='function'?new ResizeObserver(refresh):null;
    refresh();syncSea();resize?.observe(content);resize?.observe(chart);
    chart.addEventListener('scroll',syncSea,{passive:true,signal:events.signal});
    media?.addEventListener?.('change',motionChanged);
    chart.addEventListener('wheel',()=>{follow=false;},{passive:true,signal:events.signal});
    chart.addEventListener('touchstart',()=>{follow=false;},{passive:true,signal:events.signal});
    chart.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','PageUp','PageDown','Home','End'].includes(e.key))follow=false;},{signal:events.signal});
    globalThis.addEventListener('pagehide',destroy,{signal:events.signal});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&trip)complete();},{signal:events.signal});
    return {travelTo,finish:complete,destroy,refresh,get sailing(){return !!trip;}};
  }
  globalThis.WorldVoyage=Object.freeze({makeRoute,pointAt,durationFor,mount});
})();
