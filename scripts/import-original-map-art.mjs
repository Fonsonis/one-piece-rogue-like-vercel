import fs from 'node:fs';import sharp from 'sharp';
const aliases=JSON.parse(fs.readFileSync('public/content/asset-map.json'));
async function slice(source,columns,rows,prefix,size){const meta=await sharp(source).metadata(),w=Math.floor(meta.width/columns),h=Math.floor(meta.height/rows),files=[];for(let i=0;i<columns*rows;i++){const target=`content/art/${prefix}-${i}.webp`;await sharp(source).extract({left:(i%columns)*w,top:Math.floor(i/columns)*h,width:w,height:h}).resize(size,size,{kernel:'nearest',fit:'contain',background:'#00000000'}).webp({lossless:true}).toFile('public/'+target);files.push('/'+target);}return files;}
const islands=await slice('public/content/art/islands.png',4,4,'island',320);
const ships=await slice('public/content/art/ship.png',2,2,'vessel',160);
const explorers=await slice('public/content/art/explorers.png',4,4,'explorer',256);
const atlases=[];
for(let i=0;i<16;i++){
 const strip=`/content/art/explorer-motion-${i}.png`,sprite=await sharp('public'+explorers[i]).png().toBuffer();
 await sharp({create:{width:1024,height:256,channels:4,background:'#00000000'}}).composite([0,1,2,3].map(j=>({input:sprite,left:j*256,top:0}))).png({palette:true,colours:128}).toFile('public'+strip);atlases.push(strip);
}
for(const key of Object.keys(aliases)){
 const world=key.match(/^\/art\/world\/region_(\d+)-(\d+)\.webp$/);if(world)aliases[key]=islands[(Number(world[1])-1+Number(world[2]))%16];
 const ship=key.match(/^\/art\/world\/ship-(north|east|south|west)\.webp$/);if(ship)aliases[key]=ships[['north','east','south','west'].indexOf(ship[1])];
 const actor=key.match(/^\/(art\/characters|art\/portraits|sprites)\/(?:ultimates\/)?unit_(\d+)/);if(actor)aliases[key]=(actor[1]==='art/characters'?atlases:explorers)[(Number(actor[2])-1)%16];
}
fs.writeFileSync('public/content/asset-map.json',JSON.stringify(aliases));console.log('Original island, vessel and explorer atlas routes integrated.');
