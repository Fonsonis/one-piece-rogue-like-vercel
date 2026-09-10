// Technical sprite packing only: crop atlas cells, preserve alpha, resize and encode.
// Usage: node scripts/import-world-art.mjs /absolute/path/to/source-manifest.json
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const manifest=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const catalog=JSON.parse(await fs.readFile('docs/world-location-catalog.json','utf8'));
const output='public/art/world';await fs.mkdir(output,{recursive:true});
async function atlas(file,ids,cols,width,height){
 const meta=await sharp(file).metadata();
 if(!meta.hasAlpha)throw new Error(`Atlas needs real transparency: ${file}`);
 const cellWidth=Math.floor(meta.width/cols),cellHeight=Math.floor(meta.height/2);
 for(let i=0;i<ids.length;i++){
  const cell=await sharp(file).extract({left:(i%cols)*cellWidth,top:Math.floor(i/cols)*cellHeight,width:cellWidth,height:cellHeight}).png().toBuffer();
  await sharp(cell).trim({background:'#00000000',threshold:10}).resize(width-16,height-16,{fit:'inside'}).extend({top:8,bottom:8,left:8,right:8,background:'#00000000'}).resize(width,height,{fit:'contain',background:'#00000000'}).webp({quality:88,alphaQuality:100}).toFile(path.join(output,ids[i]+'.webp'));
 }
}
for(const [saga,file] of Object.entries(manifest.islands || {}))await atlas(file,catalog[saga].map(p=>p.id),Math.ceil(catalog[saga].length/2),320,240);
if(manifest.ship)await atlas(manifest.ship,['ship-north','ship-east','ship-south','ship-west'],2,160,160);
if(manifest.ocean)await sharp(manifest.ocean).resize(768,768).webp({quality:85}).toFile(path.join(output,'ocean.webp'));
if(manifest.redline)await sharp(manifest.redline).resize(1600).webp({quality:88}).toFile(path.join(output,'redline.webp'));
console.log('World art imported with original alpha.');
