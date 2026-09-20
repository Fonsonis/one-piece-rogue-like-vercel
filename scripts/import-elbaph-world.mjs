// Pack generated destination icons without altering their art or alpha.
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(process.env.SHARP_MODULE||'sharp');
const pack=process.argv.includes('--punkhazard')?'punkhazard':process.argv.includes('--zou')?'zou':process.argv.includes('--sabaody')?'sabaody':'elbaph';
const spec=JSON.parse(await fs.readFile(`docs/${pack}-world-prompts.json`,'utf8'));
for(const id of Object.keys(spec.assets)){
 const source=`docs/${pack}-world-sources/${id}.png`;
 if(id===`${pack}-scene`){
  await sharp(source).resize(1600,900,{fit:'cover'}).webp({quality:88}).toFile(`public/art/scenes/${pack}.webp`);
 }else{
  const meta=await sharp(source).metadata();
  if(!meta.hasAlpha)throw Error(`Missing transparency: ${id}`);
  await sharp(source).trim({background:'#00000000',threshold:10})
   .resize(304,224,{fit:'inside'}).extend({top:8,bottom:8,left:8,right:8,background:'#00000000'})
   .resize(320,240,{fit:'contain',background:'#00000000'}).webp({quality:88,alphaQuality:100})
   .toFile(`public/art/world/${id}.webp`);
 }
 console.log('Packed',id);
}
