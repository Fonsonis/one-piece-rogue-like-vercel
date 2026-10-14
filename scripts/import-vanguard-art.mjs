import fs from 'node:fs';import sharp from 'sharp';
const source='public/content/art/vanguard-frames.png';const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
function separator(scores,target,range){
 const start=Math.max(1,Math.floor(target-range)),end=Math.min(scores.length-1,Math.ceil(target+range));let best=target,distance=Infinity;
 for(let i=start;i<end;){if(scores[i]>3){i++;continue;}const a=i;while(i<end&&scores[i]<=3)i++;const middle=(a+i)/2,d=Math.abs(middle-target);if(i-a>=2&&d<distance){best=middle;distance=d;}}
 if(!Number.isFinite(distance)){let least=Infinity;for(let i=start;i<end;i++)if(scores[i]<least){least=scores[i];best=i;}}
 return Math.round(best);
}
const rowScores=Array(info.height).fill(0);for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>40)rowScores[y]++;
const rows=[0,separator(rowScores,info.height/3,info.height*.12),separator(rowScores,info.height*2/3,info.height*.1),info.height];
const frames=[];
for(let r=0;r<3;r++){
 const columns=Array(info.width).fill(0);for(let y=rows[r];y<rows[r+1];y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>40)columns[x]++;
 const edges=[0,...[1,2,3].map(c=>separator(columns,info.width*c/4,info.width*.10)),info.width];
 for(let c=0;c<4;c++){
  const cropped=await sharp(source).extract({left:edges[c],top:rows[r],width:edges[c+1]-edges[c],height:rows[r+1]-rows[r]}).png().toBuffer();
  const sprite=await sharp(cropped).trim({threshold:15}).png().toBuffer();const meta=await sharp(sprite).metadata();frames.push({sprite,width:meta.width,height:meta.height});
 }
}
fs.mkdirSync('public/content/art/vanguard',{recursive:true});const maxWidth=Math.max(...frames.map(f=>f.width)),maxHeight=Math.max(...frames.map(f=>f.height));const scale=Math.min(450/maxWidth,460/maxHeight);
const files=[];for(let i=0;i<frames.length;i++){
 const frame=frames[i],width=Math.round(frame.width*scale),height=Math.round(frame.height*scale);const sprite=await sharp(frame.sprite).resize(width,height,{kernel:'nearest'}).png().toBuffer();const file=`content/art/vanguard/frame-${i}.png`;
 await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite([{input:sprite,left:Math.round((512-width)/2),top:486-height}]).png({palette:true,colours:128}).toFile('public/'+file);files.push('/'+file);
}
await sharp({create:{width:2048,height:512,channels:4,background:'#00000000'}}).composite(await Promise.all(files.slice(0,4).map(async(file,i)=>({input:await sharp('public'+file).png().toBuffer(),left:i*512,top:0})))).png({palette:true,colours:128}).toFile('public/content/art/vanguard/battle.png');
const aliases=JSON.parse(fs.readFileSync('public/content/asset-map.json'));
for(const key of Object.keys(aliases)){
 if(aliases[key]==='/content/art/explorer-motion-0.png')aliases[key]='/content/art/vanguard/battle.png';
 else if(aliases[key]==='/content/art/explorer-0.webp')aliases[key]=files[0];
 const runner=key.match(/^\/runner\/unit_001-([0-7])\.png$/);if(runner)aliases[key]=files[4+Number(runner[1])];
}
fs.writeFileSync('public/content/asset-map.json',JSON.stringify(aliases));
const metadata='/runner/unit_001.json';
const original=JSON.parse(fs.readFileSync('public'+metadata));fs.writeFileSync('public'+metadata,JSON.stringify({...original,frameWidth:512,frameHeight:512,anchorX:256,baseline:486,bodyHeight:Math.round(frames[4].height*scale)}));
console.log(`Twelve original animation frames imported (${info.width}x${info.height}; row boundaries ${rows.join(',')}).`);
