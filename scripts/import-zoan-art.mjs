// Pack generated four-pose sheets into the game's atlas and portrait format.
// SHARP_MODULE may point to a bundled Sharp installation; otherwise use local sharp.
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const spec = JSON.parse(fs.readFileSync('docs/zoan-art-prompts.json'));
const ratios = JSON.parse(fs.readFileSync('docs/zoan-art-ratios.json'));
const manifest = JSON.parse(fs.readFileSync('public/art/manifest.json'));
const sizing = JSON.parse(fs.readFileSync('docs/sprite-sizing.json'));
let css = fs.readFileSync('public/art/sprite-sizes.css','utf8');
const report = {};
function bounds(data,width,height,left=0,right=width) {
  let x0=right,y0=height,x1=left,y1=0;
  for(let y=0;y<height;y++)for(let x=left;x<right;x++)if(data[(y*width+x)*4+3]>=128){
    x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);
  }
  if(x1<=x0||y1<=y0)throw new Error('Empty sprite cell');
  return [x0,y0,x1,y1];
}
function separatePoses(data,width,height) {
  // Connected silhouettes avoid slicing diagonal tails or weapons where columns overlap.
  const labels=new Int32Array(width*height).fill(-1),queue=new Int32Array(width*height),parts=[];
  for(let p=0;p<labels.length;p++)if(labels[p]<0&&data[p*4+3]>=128){
    const part={index:parts.length,count:0,x0:width,y0:height,x1:0,y1:0};
    let head=0,tail=1;queue[0]=p;labels[p]=part.index;
    while(head<tail){
      const q=queue[head++],x=q%width,y=Math.floor(q/width);
      part.count++;part.x0=Math.min(part.x0,x);part.x1=Math.max(part.x1,x+1);part.y0=Math.min(part.y0,y);part.y1=Math.max(part.y1,y+1);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const xx=x+dx,yy=y+dy,r=yy*width+xx;
        if(xx>=0&&xx<width&&yy>=0&&yy<height&&labels[r]<0&&data[r*4+3]>=128){labels[r]=part.index;queue[tail++]=r;}
      }
    }
    parts.push(part);
  }
  const main=[...parts].sort((a,b)=>b.count-a.count).slice(0,4).sort((a,b)=>a.x0-b.x0);
  if(main.length!==4||main.some(p=>p.count<1000))throw new Error('Expected four distinct character silhouettes');
  const owners=parts.map(part=>{
    const known=main.findIndex(p=>p.index===part.index);if(known>=0)return known;
    const x=(part.x0+part.x1)/2,y=(part.y0+part.y1)/2;
    return main.map((m,i)=>({i,d:Math.hypot(Math.max(m.x0-x,0,x-m.x1),Math.max(m.y0-y,0,y-m.y1))})).sort((a,b)=>a.d-b.d)[0].i;
  });
  const buffers=Array.from({length:4},()=>Buffer.alloc(data.length));
  for(let p=0;p<labels.length;p++)if(labels[p]>=0){const out=buffers[owners[labels[p]]];data.copy(out,p*4,p*4,p*4+4);}
  return buffers;
}
const requested=process.argv.slice(2);
for(const sourceId of Object.keys(spec.assets)) {
  if(requested.length&&!requested.includes(sourceId))continue;
  const id=sourceId==='minotauros-awakened'?'minotauros':sourceId.endsWith('-human')?sourceId.slice(0,-6):sourceId;
  const source=`docs/zoan-art-sources/${sourceId}.png`;
  if(!fs.existsSync(source)){console.log('Pending',id);continue;}
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const {width,height}=info;
  const transparent=Array.from({length:width},(_,x)=>data[x*4+3]).some(a=>a===0);
  if(!transparent)throw new Error(`${id}: expected transparent background`);
  const buffers=separatePoses(data,width,height);
  const boxes=buffers.map(buffer=>bounds(buffer,width,height));
  const scale=Math.min(...boxes.map(([x,y,r,b])=>Math.min(168/(r-x),156/(b-y))));
  const layers=[];
  for(const [i,[x,y,r,b]] of boxes.entries()){
    const w=Math.max(1,Math.round((r-x)*scale)),h=Math.max(1,Math.round((b-y)*scale));
    const input=await sharp(buffers[i],{raw:info}).extract({left:x,top:y,width:r-x,height:b-y}).resize(w,h,{kernel:'nearest'}).png().toBuffer();
    layers.push({input,left:i*192+Math.round((192-w)/2),top:180-h});
  }
  const atlas=await sharp({create:{width:768,height:192,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
  if(id!==sourceId){
    fs.mkdirSync('docs/zoan-art-sources/previous',{recursive:true});
    for(const folder of ['characters','portraits']){
      const backup=`docs/zoan-art-sources/previous/${id}-${folder}.png`;
      if(!fs.existsSync(backup))fs.copyFileSync(`public/art/${folder}/${id}.png`,backup);
    }
  }
  fs.writeFileSync(`public/art/characters/${id}.png`,atlas);
  const raw=await sharp(atlas).ensureAlpha().raw().toBuffer();
  const poses=Array.from({length:4},(_,i)=>bounds(raw,768,192,i*192,(i+1)*192).map((n,j)=>j%2===0?n-i*192:n));
  const g=poses[0],psize=Math.min(166/(g[2]-g[0]),158/(g[3]-g[1]));
  const pw=Math.round((g[2]-g[0])*psize),ph=Math.round((g[3]-g[1])*psize);
  const cut=await sharp(atlas).extract({left:g[0],top:g[1],width:g[2]-g[0],height:g[3]-g[1]}).resize(pw,ph,{kernel:'nearest'}).png().toBuffer();
  const portrait=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}}).composite([{input:cut,left:Math.round((192-pw)/2),top:176-ph}]).png().toBuffer();
  fs.writeFileSync(`public/art/portraits/${id}.png`,portrait);
  const pb=bounds(await sharp(portrait).ensureAlpha().raw().toBuffer(),192,192);
  const baseId=id.split('-')[0];
  const ratio=(ratios[baseId]||1)*(id.endsWith('-animal')?1.05:id.endsWith('-monster')?1.3:id.includes('-')?1.1:1);
  const as=128*ratio/(g[3]-g[1]),ps=132*ratio/(pb[3]-pb[1]);
  sizing[id]={ratio,guardBounds:g,portraitBounds:pb,atlasScale:as,portraitScale:ps};
  css=css.split('\n').filter(line=>!line.includes(`[data-character="${id}"]`)).join('\n').trimEnd()+`\n.dex-sprite[data-character="${id}"]{--atlas-scale:${as.toFixed(4)};--portrait-scale:${ps.toFixed(4)};--atlas-shift:${((96-(g[0]+g[2])/2)*as/192).toFixed(4)};--portrait-shift:${((96-(pb[0]+pb[2])/2)*ps/192).toFixed(4)}}\n`;
  manifest.characters[id]={frames:4,sha256:createHash('sha256').update(atlas).digest('hex'),poses:poses.map(bounds=>({bounds}))};
  report[id]={source,sourceBounds:boxes,poses};
  console.log('Packed',id);
}
fs.writeFileSync('public/art/manifest.json',JSON.stringify(manifest)+'\n');
fs.writeFileSync('docs/sprite-sizing.json',JSON.stringify(sizing,null,2)+'\n');
fs.writeFileSync('public/art/sprite-sizes.css',css);
const reportPath='docs/zoan-art-import.json';
const previous=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath)):{};
fs.writeFileSync(reportPath,JSON.stringify({...previous,...report},null,2)+'\n');
