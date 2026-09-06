/* Procedural 2D choreography. Deterministic, bounded, and independent of combat. */
(() => {
  'use strict';
  const TAU=Math.PI*2, clamp=x=>Math.max(0,Math.min(1,x)), ease=x=>1-(1-clamp(x))**3;
  const active=new Map();
  const noise=(seed,i)=>{let x=Math.imul(seed^(i+1),1597334677);x^=x>>>16;return (x>>>0)/4294967295;};
  function drawFrame(ctx,p,t,{width=1000,height=400,source=.2,target=.8,hit=true,reduced=false}={}) {
    const w=width,h=height;
    ctx.clearRect(0,0,w,h);ctx.save();ctx.scale(w/1000,h/400);
    const sx=source*1000, tx=target*1000, y=228, dir=tx>=sx?1:-1;
    const wind=clamp(t/.28), strike=ease((t-.22)/.32), release=clamp((t-.55)/.45);
    const energy=Math.sin(Math.PI*clamp(t)), fade=clamp((1-t)/.22);
    ctx.globalAlpha=(reduced ? .34 : 1)*fade;
    ctx.lineCap='round';ctx.lineJoin='round';
    const line=(points,color=p.color,width=4,alpha=1)=>{ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.restore();};
    const orb=(x,y,r,color=p.color,alpha=1)=>{if(r<=0)return;ctx.save();ctx.globalAlpha*=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,p.accent);g.addColorStop(.2,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();ctx.restore();};
    const ring=(x,y,r,color=p.color,width=3,scaleY=1)=>{if(r<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(1,scaleY);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();ctx.restore();};
    const curve=(points,color=p.color,width=4,alpha=1)=>{ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(...points[0]);ctx.bezierCurveTo(...points[1],...points[2],...points[3]);ctx.stroke();ctx.restore();};
    const polygon=(points,color=p.color,alpha=1)=>{ctx.save();ctx.globalAlpha*=alpha;ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();ctx.restore();};
    const bolt=(x1,y1,x2,y2,i=0)=>{const pts=[];for(let k=0;k<=9;k++){const a=k/9,off=(k===0||k===9)?0:(noise(p.seed,i*17+k)-.5)*45;pts.push([x1+(x2-x1)*a+off,y1+(y2-y1)*a]);}line(pts,p.color,7);line(pts,p.accent,2);};
    const petal=(x,y,r,a,color=p.accent)=>{ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(0,0,r*.48,r,0,0,TAU);ctx.fill();ctx.restore();};
    const fist=(x,y,r,color=p.color)=>{ctx.save();ctx.translate(x,y);ctx.scale(dir,1);ctx.fillStyle=color;ctx.strokeStyle=p.accent;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-r*.8,-r*.7,r*1.7,r*1.4,r*.27);ctx.fill();ctx.stroke();for(let i=0;i<3;i++)line([[r*(i*.35-.35),-r*.68],[r*(i*.35-.35),-r*.2]],p.accent,2,.65);ctx.restore();};
    const heart=(x,y,r)=>{ctx.save();ctx.translate(x,y);ctx.fillStyle=p.color;ctx.beginPath();ctx.moveTo(0,r);ctx.bezierCurveTo(-r*1.8,-r*.2,-r,-r*1.5,0,-r*.5);ctx.bezierCurveTo(r,-r*1.5,r*1.8,-r*.2,0,r);ctx.fill();ctx.restore();};
    const slash=(i,count=p.count)=>{const q=clamp((t-.2-i*.018)/.24);if(!q)return;const a=(i-(count-1)/2)*.25+p.angle;
      ctx.save();ctx.translate(sx+(tx-sx)*q,y+(i%3-1)*22);ctx.rotate(a);ctx.scale(dir,1);
      ctx.fillStyle=p.color;ctx.beginPath();ctx.moveTo(-190*q,-95);ctx.quadraticCurveTo(90,-55,185*q,105);ctx.quadraticCurveTo(10,-5,-190*q,-95);ctx.fill();
      curve([[-160*q,-85],[-20,-45],[65,0],[170*q,90]],p.accent,2);ctx.restore();};
    const charge=()=>{orb(sx,y,44+wind*40,p.color,.7*(1-strike));for(let i=0;i<3;i++)ring(sx,y,16+wind*55+i*14,p.color,1.5,.6);};
    // A restrained, local ink vignette makes luminous effects legible on either theme.
    const vignette=ctx.createRadialGradient((sx+tx)/2,y,20,(sx+tx)/2,y,520);
    vignette.addColorStop(0,'rgba(14,19,35,.26)');vignette.addColorStop(1,'rgba(14,19,35,0)');
    ctx.fillStyle=vignette;ctx.globalAlpha*=energy;ctx.fillRect(0,35,1000,365);ctx.globalAlpha=(reduced ? .34 : 1)*fade;
    if(!reduced&&t>.12&&t<.7){
      for(let i=0;i<16;i++){
        const yy=55+noise(p.seed,i+90)*300,xx=noise(p.seed,i+130)*1000;
        line([[xx-dir*(30+strike*70),yy],[xx,yy]],p.accent,1,.12*energy);
      }
    }
    if(t<.45)charge();
    const x=sx+(tx-sx)*strike;
    switch(p.family) {
      case 'slash':
        for(let i=0;i<p.count;i++)slash(i);
        if(['conqueror','ashura','shrine'].includes(p.motif)&&t>.3)for(let i=0;i<4;i++)bolt(tx,y,tx+(noise(p.seed,i)-.5)*300,80+i*60,i);
        if(p.motif==='roses')for(let i=0;i<12;i++)petal(sx+(tx-sx)*noise(p.seed,i)+release*40,y+(noise(p.seed,i+20)-.5)*220,8,i+t*4);
        break;
      case 'rubber': case 'mochi': case 'impact': case 'sun': {
        const giant=['giant','kong','serious','dawn'].includes(p.motif);
        const n=giant?Math.min(3,p.count):p.count;
        for(let i=0;i<n;i++) {
          const u=ease((t-.2-i*.025)/.3), yy=y+(i-(n-1)/2)*22, xx=sx+(tx-sx)*u;
          if(!u)continue;
          if(p.family==='rubber'||p.family==='mochi')curve([[sx,yy],[sx+(xx-sx)*.35,yy-12],[xx-dir*70,yy+15],[xx,yy]],p.color,giant?26:12,.6);
          else line([[xx-dir*90,yy-10],[xx-dir*20,yy]],p.color,3,.65);
          fist(xx,yy,(giant?46:22)*(1-release*.5),p.motif==='kong'?'#492d3d':p.color);
        }
        if(p.motif==='kick')for(let i=0;i<3;i++)curve([[sx,y+70],[x,y-130],[x+dir*70,y-110],[x,y+40]],p.accent,7,.65);
        if(['galaxy','buddha','black-flash','serious'].includes(p.motif)&&t>.4)for(let i=0;i<6;i++){const a=i*TAU/6;bolt(tx,y,tx+Math.cos(a)*170,y+Math.sin(a)*105,i);}
        if(p.family==='sun'){ring(x,y,80+energy*40,p.accent,4);for(let i=0;i<12;i++){const a=i*TAU/12;line([[x+Math.cos(a)*95,y+Math.sin(a)*95],[x+Math.cos(a)*120,y+Math.sin(a)*120]],p.color,4);}orb(x,y,120,p.color,.35);}
        break;
      }
      case 'flame': case 'dragon': case 'phoenix': {
        if(p.motif==='sun-orb'){orb(x,y-35,40+wind*95);ring(x,y-35,80*wind,p.accent,3);}
        else if(p.family==='phoenix') {
          for(const side of [-1,1])for(let i=0;i<7;i++)curve([[x,y+25],[x+side*50,y-120],[x+side*(100+i*18),y-150+i*12],[x+side*(170+i*10),y-35+i*10]],i%2?p.accent:p.color,12-i,.8);
          orb(x,y,55,p.color,.7);
        } else {
          for(let i=0;i<7;i++){const offset=(i-3)*12;curve([[sx,y+offset],[sx+dir*110,y-80+offset],[x-dir*90,y+85+offset],[x,y+offset]],i%2?p.color:p.accent,18-i*1.8,.7);}
          orb(x,y,60+energy*35,p.color,.65);
          if(p.family==='dragon'){polygon([[x+dir*70,y],[x+dir*15,y-34],[x-dir*30,y-18],[x-dir*20,y+35]],p.color);polygon([[x+dir*15,y-30],[x-dir*15,y-65],[x-dir*8,y-20]],p.accent);orb(x+dir*27,y-10,5,p.accent);}
        }
        if(p.motif==='kick')for(let i=0;i<4;i++)curve([[x-70,y+80],[x+160,y+20],[x+80,y-170],[x-60,y-90]],i%2?p.color:p.accent,5+i*2,.5);
        break;
      }
      case 'lightning': case 'electricBeast':
        if(t>.2)for(let i=0;i<p.count;i++)bolt(p.motif==='cloud'?tx+(i-2)*28:sx,p.motif==='cloud'?60:y,tx,y+(i-2)*14,i);
        if(['cloud','drums'].includes(p.motif))for(let i=0;i<5;i++)orb(tx+(i-2)*32,62,38,'#abb8d6',.55);
        if(p.family==='electricBeast')for(let i=0;i<3;i++)slash(i,3);
        orb(x,y,55,p.color,.55);break;
      case 'laser': case 'shot': {
        const n=p.motif==='magatama'?p.count:p.family==='shot'?3:1;
        for(let i=0;i<n;i++){
          const yy=y+(i-(n-1)/2)*19;
          line([[sx,yy],[x,yy]],p.color,p.family==='shot'?5:24,.75);
          line([[sx,yy],[x,yy]],p.accent,p.family==='shot'?2:7);
          orb(x,yy,p.family==='shot'?14:35,p.color,.75);
        }
        if(p.family==='shot'){ring(tx,y,45+release*20,p.color,2);line([[tx-60,y],[tx-30,y]],p.accent,2);line([[tx,y-60],[tx,y-30]],p.accent,2);}
        break;
      }
      case 'water': case 'wind': case 'smoke': case 'sand': case 'snow': {
        for(let i=0;i<7;i++){
          const yy=y+(i-3)*17;
          curve([[sx,yy],[sx+(x-sx)*.3,yy-80*energy],[sx+(x-sx)*.7,yy+80*energy],[x,yy]],i%3?p.color:p.accent,Math.max(2,14-i),.65);
        }
        if(p.family==='water'){for(let i=0;i<4;i++)ring(x,y,25+i*18+release*50,p.accent,2,.45);}
        if(p.family==='wind'){for(let i=0;i<5;i++)ring(x,y-50+i*25,24+i*12,p.color,3,.35);}
        if(p.family==='smoke')for(let i=0;i<8;i++)orb(sx+(tx-sx)*noise(p.seed,i)*strike,y+(noise(p.seed,i+10)-.5)*140,45,p.color,.35);
        break;
      }
      case 'ice': case 'metal': case 'wax': case 'barrier': {
        if(p.family==='barrier'){
          const xx=sx+(tx-sx)*strike;polygon([[xx-70,70],[xx+65,90],[xx+65,335],[xx-70,315]],p.color,.35);
          line([[xx-70,70],[xx+65,90],[xx+65,335],[xx-70,315],[xx-70,70]],p.accent,4);
          for(let i=0;i<6;i++)line([[xx-68,90+i*35],[xx+64,110+i*35]],p.color,2);
        } else for(let i=0;i<p.count+3;i++){
          const xx=sx+(tx-sx)*((i+1)/(p.count+4)), size=25+noise(p.seed,i)*65;
          if(strike<(i+1)/(p.count+5))continue;
          if(p.family==='metal'){const yy=y+(i%2?1:-1)*(35+release*40);polygon([[xx-18,yy-size/2],[xx+22,yy-size/2+8],[xx+15,yy+size/2],[xx-25,yy+size/2-8]],p.color,.85);line([[xx-18,yy-size/2],[xx+15,yy+size/2]],p.accent,2);}
          else {polygon([[xx-25,y+75],[xx+25,y+75],[xx+8,y-size*wind],[xx-8,y-size*wind-20]],p.color,.7);line([[xx,y+60],[xx+8,y-size*wind]],p.accent,2);}
        }
        break;
      }
      case 'room': case 'portal': case 'gravity': case 'dark': {
        const cx=p.family==='room'?(sx+tx)/2:tx;
        for(let i=0;i<4;i++)ring(cx,y,30+wind*70+i*18,p.color,2,i%2?.45:1);
        if(p.family==='room'){
          for(let i=0;i<4;i++)line([[cx-120,y-80+i*40],[cx+120,y-80+i*40]],p.color,1,.4);
          line([[sx,y],[x,y]],p.accent,7);polygon([[x+dir*45,y],[x-dir*25,y-12],[x-dir*25,y+12]],p.accent);
        } else if(p.family==='portal'){
          ctx.save();ctx.strokeStyle=p.accent;ctx.lineWidth=4;ctx.strokeRect(cx-55,90,110,245);ctx.restore();
          if(p.motif==='clock')for(let i=0;i<12;i++){const a=i*TAU/12;line([[cx+Math.cos(a)*80,y+Math.sin(a)*80],[cx+Math.cos(a)*90,y+Math.sin(a)*90]],p.accent,2);}
        } else {
          for(let i=0;i<9;i++){const a=i*TAU/9+t*3,r=150*(1-strike*.7);curve([[cx+Math.cos(a)*r,y+Math.sin(a)*r],[cx+Math.cos(a+.7)*r,y+Math.sin(a+.7)*r],[cx+Math.cos(a+1.5)*r*.5,y+Math.sin(a+1.5)*r*.5],[cx,y]],p.color,3,.7);}
          orb(cx,y,75,p.color,.8);ctx.save();ctx.fillStyle='#181127';ctx.beginPath();ctx.arc(cx,y,30+strike*25,0,TAU);ctx.fill();ctx.restore();
          if(p.family==='gravity'){const my=60+strike*160;polygon([[tx-35,my],[tx,my-42],[tx+46,my-12],[tx+27,my+35],[tx-25,my+30]],p.accent,.85);}
        }
        break;
      }
      case 'string': case 'silk':
        for(let i=0;i<p.count;i++)curve([[sx,y],[sx+dir*80,35+i*23],[tx-dir*70,345-i*22],[x,y+(i-p.count/2)*13]],i%3?p.color:p.accent,2,.85);
        if(p.motif==='birdcage'||p.family==='silk')for(let j=1;j<4;j++)ring(tx,y,35+j*25,p.color,1.5);
        break;
      case 'paw':
        orb(x,y,60+wind*40,p.color,.5);
        for(const [dx,dy,r] of [[0,14,35],[-40,-28,17],[-14,-47,18],[17,-46,18],[42,-24,16]]){ctx.save();ctx.fillStyle=p.accent;ctx.globalAlpha*=.8;ctx.beginPath();ctx.arc(x+dx,y+dy,r*wind,0,TAU);ctx.fill();ctx.restore();}
        if(t>.5)for(let i=0;i<4;i++)ring(tx,y,35+i*25+release*100,p.color,3);break;
      case 'heart':
        for(let i=0;i<p.count;i++)heart(sx+(tx-sx)*ease((t-.18-i*.025)/.36),y+(i-p.count/2)*22,15+noise(p.seed,i)*10);
        if(hit&&t>.55)for(let i=0;i<6;i++)polygon([[tx-45+i*18,y+65],[tx-30+i*18,y+65],[tx-36+i*18,y-35]],'#c8c9dc',.5);break;
      case 'petals': case 'forest': case 'ink': {
        for(let i=0;i<p.count;i++){
          const yy=y+(i-p.count/2)*20;
          curve([[sx,y+75],[sx+dir*70,yy-100],[x-dir*70,yy+70],[x,yy]],p.color,p.family==='forest'?6:3,.65);
          for(let j=0;j<3;j++)petal(sx+(x-sx)*(j+1)/3,yy+Math.sin(i+j+t*4)*25,8+i%4,i+t,p.family==='forest'?p.color:p.accent);
          if(p.motif==='hands'&&strike>.3){fist(x,yy,13,p.accent);}
        }
        break;
      }
      case 'poison': case 'bubble': case 'ghost': case 'soul': {
        for(let i=0;i<p.count+3;i++){
          const xx=sx+(tx-sx)*ease((t-.17-i*.018)/.4), yy=y+Math.sin(i*2+t*5)*60;
          if(p.family==='ghost'||p.family==='soul'){
            ctx.save();ctx.fillStyle=p.accent;ctx.globalAlpha*=.7;ctx.beginPath();ctx.arc(xx,yy,20,Math.PI,0);ctx.lineTo(xx+20,yy+27);ctx.lineTo(xx+7,yy+19);ctx.lineTo(xx-5,yy+28);ctx.lineTo(xx-20,yy+20);ctx.closePath();ctx.fill();ctx.restore();
            orb(xx-7,yy-2,3,'#311b43');orb(xx+7,yy-2,3,'#311b43');
          } else {orb(xx,yy,24+i%3*8,p.color,.4);ring(xx,yy,17+i%3*7,p.accent,1);}
        }
        if(p.motif==='hydra'||p.motif==='serpents')for(let i=0;i<p.count;i++)curve([[sx,y+60],[sx+dir*110,y-120+i*30],[tx-dir*100,y-110+i*30],[x,y-30+i*30]],p.color,14,.65);
        break;
      }
      case 'music':
        for(let i=0;i<5;i++){ring(x,y,25+i*20,p.color,2,.8);const xx=sx+(tx-sx)*noise(p.seed,i),yy=100+i*33;line([[xx,yy+15],[xx,yy-20],[xx+15,yy-10]],p.accent,3);petal(xx-5,yy+15,7,1);}
        if(p.motif==='soul-sword')slash(0,1);break;
      case 'beast':
        for(let i=0;i<3;i++)curve([[sx,y+50],[sx+dir*100,y-130],[x-dir*30,y-90+i*25],[x,y+65]],p.color,6,.75);
        if(p.motif==='antlers')for(const d of [-1,1])line([[x,y+35],[x+d*35,y-15],[x+d*50,y-65],[x+d*35,y-55],[x+d*30,y-85]],p.accent,6);
        else for(let i=0;i<4;i++)polygon([[x-50+i*25,y-50],[x-30+i*25,y-50],[x-38+i*25,y+10]],p.accent,.9);
        break;
      case 'quake': case 'meteor': case 'bomb':
        if(p.family==='meteor'){const my=30+strike*200;line([[tx-dir*120,30],[tx,my]],p.color,25,.4);orb(tx,my,55,p.color,.8);polygon([[tx-30,my],[tx-15,my-30],[tx+30,my-18],[tx+22,my+25],[tx-22,my+25]],p.accent,.8);}
        else if(p.family==='bomb'){orb(x,y,40,p.color,.8);ring(x,y,24,p.accent,3);}
        if(t>.35)for(let i=0;i<9;i++){const a=i*TAU/9,r=(40+release*140);line([[tx,y],[tx+Math.cos(a+.1)*r*.5,y+Math.sin(a+.1)*r*.5],[tx+Math.cos(a)*r,y+Math.sin(a)*r]],p.accent,2,.8);}
        break;
    }
    // Named motifs add recognizable silhouettes on top of their material motion.
    if(t>.22) {
      if(['axe','axes','heavy-blade','hammer','club','tonfas','polearm','spear','lance','harpoon','scythes'].includes(p.motif)) {
        const count=['axes','tonfas','scythes'].includes(p.motif)?2:1;
        for(let i=0;i<count;i++){
          const yy=y+(i-(count-1)/2)*65;
          line([[x-dir*100,yy+45],[x+dir*30,yy-35]],p.color,9);
          if(p.motif==='hammer')polygon([[x+dir*15,yy-60],[x+dir*65,yy-35],[x+dir*40,yy+5],[x-dir*10,yy-20]],p.accent,.85);
          else if(['spear','lance','harpoon','polearm'].includes(p.motif))polygon([[x+dir*60,yy-55],[x+dir*5,yy-38],[x+dir*27,yy-15]],p.accent);
          else curve([[x+dir*10,yy-65],[x+dir*110,yy-70],[x+dir*105,yy+25],[x+dir*35,yy+35]],p.accent,14,.85);
        }
      }
      if(['arrow','dart','homing'].includes(p.motif)) {
        for(let i=0;i<p.count;i++){const yy=y+(i-(p.count-1)/2)*28;line([[x-dir*65,yy],[x+dir*12,yy]],p.accent,3);polygon([[x+dir*30,yy],[x,yy-9],[x,yy+9]],p.accent);}
      }
      if(['rifle','sniper','pistol','cannon','radical','scanner'].includes(p.motif)){
        ring(sx,y,28+wind*14,p.accent,2);
        for(let i=0;i<4;i++){const a=i*TAU/4;line([[sx+Math.cos(a)*35,y+Math.sin(a)*35],[sx+Math.cos(a)*50,y+Math.sin(a)*50]],p.color,3);}
      }
      if(p.motif==='plates')for(let i=0;i<5;i++)ring(sx+(tx-sx)*strike,y+(i-2)*23,15,p.accent,4,.3);
      if(['antlers','tusks','horns'].includes(p.motif))for(const d of [-1,1])curve([[x+d*15,y+40],[x+d*90,y+35],[x+d*75,y-50],[x+d*40,y-70]],p.accent,8);
      if(['wings','harpy','butterfly'].includes(p.motif))for(const side of [-1,1])for(let i=0;i<4;i++)curve([[x,y],[x+side*35,y-65],[x+side*(90+i*12),y-90],[x+side*(120+i*12),y-5+i*13]],p.accent,5,.55);
      if(['bats','ravens'].includes(p.motif))for(let i=0;i<7;i++){
        const xx=sx+(tx-sx)*strike+(noise(p.seed,i)-.5)*180,yy=y+(noise(p.seed,i+11)-.5)*180;
        polygon([[xx-23,yy-15],[xx-13,yy+4],[xx,yy],[xx+13,yy+4],[xx+23,yy-15],[xx+8,yy-6],[xx,yy-10],[xx-8,yy-6]],p.accent,.6);
      }
      if(['maw','shark'].includes(p.motif))for(let i=0;i<6;i++){
        const xx=x-65+i*25;polygon([[xx,y-50],[xx+20,y-50],[xx+10,y-15]],p.accent);polygon([[xx,y+50],[xx+20,y+50],[xx+10,y+15]],p.accent);
      }
      if(p.motif==='donuts')for(let i=0;i<4;i++){
        const yy=y+(i-1.5)*43;ring(sx+dir*60,yy,21,p.color,12);fist(x,yy,20,'#553540');
      }
      if(['candelabra','candy','branches','roots'].includes(p.motif))for(let i=0;i<5;i++)curve([[x,y+85],[x+(i-2)*18,y+15],[x+(i-2)*40,y-40],[x+(i-2)*50,y-85]],p.color,7);
      if(p.motif==='roses'||p.motif==='encourage'||p.motif==='tears')for(let i=0;i<8;i++){
        const xx=sx+(tx-sx)*noise(p.seed,i),yy=100+noise(p.seed,i+8)*200;
        for(let j=0;j<5;j++)petal(xx+Math.cos(j*TAU/5)*5,yy+Math.sin(j*TAU/5)*5,6,j*TAU/5,p.color);
      }
      if(['silence','infinity'].includes(p.motif))for(let i=0;i<4;i++)ring(tx,y,30+i*25+release*40,p.accent,1,.55+i*.12);
      if(['eye','wink','scanner'].includes(p.motif)){
        curve([[x-65,y],[x-25,y-40],[x+25,y-40],[x+65,y]],p.accent,3);
        curve([[x-65,y],[x-25,y+40],[x+25,y+40],[x+65,y]],p.accent,3);ring(x,y,19,p.color,5);
      }
      if(['pages','scroll','mirror','toys'].includes(p.motif))for(let i=0;i<5;i++){
        const xx=sx+(tx-sx)*strike+(i-2)*38,yy=y+Math.sin(i+t*4)*45;
        polygon([[xx-15,yy-25],[xx+15,yy-20],[xx+15,yy+25],[xx-15,yy+20]],p.accent,.55);
      }
      if(p.motif==='homies'){
        orb(x-65,y-40,42,'#ffaa52',.7);bolt(x+30,y-80,x+75,y+30,4);slash(0,1);
      }
      if(p.motif==='rasenshuriken')for(let i=0;i<4;i++){
        const a=i*TAU/4+t*7;line([[x+Math.cos(a)*20,y+Math.sin(a)*20],[x+Math.cos(a)*100,y+Math.sin(a)*100]],p.accent,8);
      }
    }

    // Impact follows the actual result: a miss has a trailing sweep, no hit burst.
    if(t>.47&&hit){
      const k=clamp((t-.47)/.38);orb(tx,y,90*Math.sin(Math.PI*k),p.color,.55);
      for(let i=0;i<3;i++)ring(tx,y,12+k*(85+i*30),i%2?p.color:p.accent,Math.max(.5,4*(1-k)),.8);
    }
    // Seeded embers/debris: stable across frames, no allocations or global RNG.
    const n=reduced?0:24;
    for(let i=0;i<n;i++){
      const a=noise(p.seed,i)*TAU,r=(24+noise(p.seed,i+31)*95)*strike;
      const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r*.8+release*25;
      const size=1.5+noise(p.seed,i+71)*3;
      ctx.fillStyle=i%3?p.color:p.accent;ctx.globalAlpha=fade*energy*.7;
      ctx.fillRect(px,py,size,size);
    }
    ctx.restore();
  }
  function play({profile,source,target=source,owner=source,valid=()=>true,speed=1,hit=true,preview=false}) {
    if(!source?.isConnected||!target?.isConnected)return null;
    active.get(owner)?.cancel();
    while(active.size>=2)active.values().next().value.cancel();
    const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
    const duration=reduced?650:(preview?1700:Math.max(720,1300/Math.max(1,speed)));
    const el=document.createElement('div');el.className='ultimate-scene';el.setAttribute('aria-hidden','true');
    el.dataset.character=profile.id;el.dataset.family=profile.family;el.style.setProperty('--ultimate-color',profile.color);
    const canvas=document.createElement('canvas');el.appendChild(canvas);
    const cutin=document.createElement('div');cutin.className='ultimate-cutin';
    const portrait=document.createElement('img');portrait.alt='';
    portrait.src='/art/portraits/'+profile.id+'.png';portrait.onerror=()=>cutin.remove();
    cutin.appendChild(portrait);el.appendChild(cutin);
    const title=document.createElement('div');title.className='ultimate-technique';
    const name=document.createElement('span');name.textContent=profile.name;
    const technique=document.createElement('strong');technique.textContent=profile.technique;
    title.append(name,technique);el.appendChild(title);
    const overlay=source.closest('.overlay');(overlay||document.body).appendChild(el);
    let ctx;try{ctx=canvas.getContext('2d');}catch{el.remove();return null;}
    if(!ctx){el.remove();return null;}
    let frame=0,timer=0,start=null,last=-100,closed=false;
    const cancel=()=>{if(closed)return;closed=true;cancelAnimationFrame(frame);clearTimeout(timer);el.remove();if(active.get(owner)===handle)active.delete(owner);};
    const handle={cancel};active.set(owner,handle);
    const tick=now=>{
      if(closed)return;
      try {
        if(!source.isConnected||!target.isConnected||document.hidden||!valid()){cancel();return;}
        if(start===null)start=now;
        const progress=clamp((now-start)/duration);
        if(progress>=1){cancel();return;}
        if(now-last>=1000/40){
          last=now;
          const a=source.getBoundingClientRect(),b=target.getBoundingClientRect();
          const left=Math.max(0,Math.min(a.left,b.left)),top=Math.max(0,Math.min(a.top,b.top));
          const right=Math.min(innerWidth,Math.max(a.right,b.right)),bottom=Math.min(innerHeight,Math.max(a.bottom,b.bottom));
          const width=right-left,height=bottom-top;if(width<24||height<24){cancel();return;}
          Object.assign(el.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
          const dpr=Math.min(1.5,globalThis.devicePixelRatio||1),cw=Math.round(Math.min(1600,width*dpr)),ch=Math.round(Math.min(600,height*dpr));
          if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
          const from=preview ? .18 : clamp((a.left+a.width/2-left)/width),to=preview ? .82 : clamp((b.left+b.width/2-left)/width);
          drawFrame(ctx,profile,reduced ? .58 : progress,{width:cw,height:ch,source:from,target:to,hit,reduced});
          title.style.opacity=String(reduced?1:Math.min(1,progress/.1,clamp((1-progress)/.17)));
          cutin.style.opacity=String(reduced?0:clamp(progress/.08)*clamp((.4-progress)/.12));
          cutin.style.transform=`translateX(${(1-ease(progress/.16))*(from<to?-22:22)}px)`;
          cutin.style.left=from<to?'0':'auto';cutin.style.right=from<to?'auto':'0';
        }
        frame=requestAnimationFrame(tick);
      } catch {cancel();}
    };
    timer=setTimeout(cancel,duration+250);frame=requestAnimationFrame(tick);return handle;
  }
  const cancelAll=()=>{for(const h of [...active.values()])h.cancel();};
  globalThis.addEventListener?.('pagehide',cancelAll);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelAll();});
  globalThis.UltimateFX=Object.freeze({play,drawFrame,cancelAll});
})();
