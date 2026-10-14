import fs from 'node:fs';import path from 'node:path';
const id=process.argv[2],title=process.argv.slice(3).join(' ')||id;
if(!id||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)||id==='umbral')throw Error('Usage: node scripts/create-mod.mjs <id-en-minusculas> <título>');
const destination=path.resolve('mods',id);if(!destination.startsWith(path.resolve('mods')+path.sep)||fs.existsSync(destination))throw Error('El destino ya existe o no es válido.');
const pack=JSON.parse(fs.readFileSync('public/content/base.json','utf8'));pack.id=id;pack.title=title;pack.assets=[];delete pack.legacy;
fs.mkdirSync(destination,{recursive:true});fs.mkdirSync(path.join(destination,'assets'));
fs.writeFileSync(path.join(destination,'pack.json'),JSON.stringify(pack,null,2)+'\n');
console.log(`Plantilla lista: mods/${id}/pack.json. Edita datos y textos; añade a assets/ únicamente los recursos que quieras reemplazar.`);
