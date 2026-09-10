import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url);
const sharp=require(process.env.SHARP_MODULE||'sharp');
const report=JSON.parse(fs.readFileSync('docs/zoan-art-import.json'));
const prompts=JSON.parse(fs.readFileSync('docs/zoan-art-prompts.json'));
const manifest=JSON.parse(fs.readFileSync('public/art/manifest.json'));
assert.equal(Object.keys(report).length,Object.keys(prompts.assets).length);
const cards=[];
for(const [id,entry] of Object.entries(report)){
  const path=`public/art/characters/${id}.png`,file=fs.readFileSync(path);
  const {width,height,channels}=await sharp(file).metadata();
  assert.deepEqual([width,height,channels],[768,192,4],id);
  assert.equal(createHash('sha256').update(file).digest('hex'),manifest.characters[id].sha256,id);
  const hashes=[];
  for(let i=0;i<4;i++){
    const raw=await sharp(file).extract({left:i*192,top:0,width:192,height:192}).raw().toBuffer();
    hashes.push(createHash('sha256').update(raw).digest('hex'));
    const [x,y,r,b]=entry.poses[i];
    assert.ok(x>=12&&r<=180&&y>=24&&b<=180,`${id} pose ${i} fits its cell`);
    assert.ok(raw.some((v,k)=>k%4===3&&v===0),id+' transparency');
  }
  assert.equal(new Set(hashes).size,4,id+' distinct poses');
  const label=Buffer.from(`<svg width="192" height="28"><text x="96" y="18" text-anchor="middle" fill="#edf4ff" font-family="sans-serif" font-size="12">${id}</text></svg>`);
  const guard=await sharp(file).extract({left:0,top:0,width:192,height:192}).png().toBuffer();
  cards.push(await sharp({create:{width:192,height:220,channels:4,background:'#111e30'}}).composite([{input:guard,top:0,left:0},{input:label,top:192,left:0}]).png().toBuffer());
}
fs.mkdirSync('outputs/zoan',{recursive:true});
for(let offset=0;offset<cards.length;offset+=36){
  const page=cards.slice(offset,offset+36);
  await sharp({create:{width:1152,height:Math.ceil(page.length/6)*220,channels:4,background:'#111e30'}}).composite(page.map((input,i)=>({input,left:(i%6)*192,top:Math.floor(i/6)*220}))).png().toFile(`outputs/zoan/atlas-review-${offset/36+1}.png`);
}
console.log(`Verified ${cards.length} atlases, ${cards.length*4} distinct transparent poses and manifest hashes.`);
