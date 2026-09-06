// Pack the three image_gen sheets into the existing four-cell animation format.
// Usage: node scripts/import-luffy-gears.mjs (requires the local sharp dev tool).
import fs from 'node:fs';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
const sizing=JSON.parse(fs.readFileSync('docs/sprite-sizing.json'));
const manifest=JSON.parse(fs.readFileSync('public/art/manifest.json'));
let css=fs.readFileSync('public/art/sprite-sizes.css','utf8');
function box(data,width,height,left=0,right=width){
 let x0=right,y0=height,x1=left,y1=0;
 for(let y=0;y<height;y++)for(let x=left;x<right;x++)if(data[(y*width+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
 return [x0,y0,x1,y1];
}
for(const [id,cuts,ratio] of [
 ['luffy3',[0,480,935,1715,2172],1],
 ['luffy4',[0,435,970,1707,2172],1.2],
 ['luffy5',[0,474,943,1684,2172],1]
]){
 const {data,info}=await sharp(`docs/luffy-art-sources/${id}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 // Quantize soft transparency for crisp pixel art; discard imperceptible alpha noise.
 for(let i=3;i<data.length;i+=4)data[i]=data[i]>=128?255:0;
 const bounds=cuts.slice(0,4).map((x,i)=>box(data,info.width,info.height,x,cuts[i+1]));
 const scale=Math.min(...bounds.map(b=>Math.min(166/(b[2]-b[0]),156/(b[3]-b[1]))));
 const layers=[];
 for(let i=0;i<4;i++){
  const [x,y,r,b]=bounds[i],w=Math.round((r-x)*scale),h=Math.round((b-y)*scale);
  const input=await sharp(data,{raw:info}).extract({left:x,top:y,width:r-x,height:b-y}).resize(w,h,{kernel:'nearest'}).png().toBuffer();
  layers.push({input,left:i*192+Math.round((192-w)/2),top:180-h});
 }
 const atlas=await sharp({create:{width:768,height:192,channels:4,background:'#00000000'}}).composite(layers).png().toBuffer();
 fs.writeFileSync(`public/art/characters/${id}.png`,atlas);
 const raw=await sharp(atlas).raw().toBuffer();
 const poses=Array.from({length:4},(_,i)=>box(raw,768,192,i*192,(i+1)*192).map((v,j)=>j%2===0?v-i*192:v));
 const g=poses[0],pw=Math.round((g[2]-g[0])*Math.min(166/(g[2]-g[0]),158/(g[3]-g[1]))),ph=Math.round((g[3]-g[1])*Math.min(166/(g[2]-g[0]),158/(g[3]-g[1])));
 const cut=await sharp(atlas).extract({left:g[0],top:g[1],width:g[2]-g[0],height:g[3]-g[1]}).resize(pw,ph,{kernel:'nearest'}).png().toBuffer();
 const portrait=await sharp({create:{width:192,height:192,channels:4,background:'#00000000'}}).composite([{input:cut,left:Math.round((192-pw)/2),top:176-ph}]).png().toBuffer();
 fs.writeFileSync(`public/art/portraits/${id}.png`,portrait);
 const pb=box(await sharp(portrait).raw().toBuffer(),192,192);
 const as=128*ratio/(g[3]-g[1]),ps=132*ratio/(pb[3]-pb[1]);
 sizing[id]={ratio,guardBounds:g,portraitBounds:pb,atlasScale:as,portraitScale:ps};
 css=css.split('\n').filter(line=>!line.includes(`[data-character="${id}"]`)).join('\n').trimEnd()+`\n.dex-sprite[data-character="${id}"]{--atlas-scale:${as.toFixed(4)};--portrait-scale:${ps.toFixed(4)};--atlas-shift:${((96-(g[0]+g[2])/2)*as/192).toFixed(4)};--portrait-shift:${((96-(pb[0]+pb[2])/2)*ps/192).toFixed(4)}}\n`;
 manifest.characters[id]={frames:4,sha256:createHash('sha256').update(atlas).digest('hex'),poses:poses.map(bounds=>({bounds}))};
 console.log(id,poses);
}
fs.writeFileSync('docs/sprite-sizing.json',JSON.stringify(sizing,null,2)+'\n');
fs.writeFileSync('public/art/sprite-sizes.css',css);
fs.writeFileSync('public/art/manifest.json',JSON.stringify(manifest)+'\n');
