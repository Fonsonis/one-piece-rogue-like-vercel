import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const characters = join(root, 'public/art/characters');
const ultimateDir = join(characters, 'ultimates');
const effectsPath = join(root, 'public/art/ultimates/effects.js');
const ids = existsSync(ultimateDir)
  ? readdirSync(ultimateDir).filter(name => /^[a-zA-Z0-9_-]+\.png$/.test(name) && name !== 'luffy5.png')
      .map(name => name.slice(0, -4)).sort()
  : [];
for (const id of ids) {
  if (!existsSync(join(characters, `${id}.png`))) throw new Error(`Ultimate sin atlas base: ${id}`);
}
const entries = ids.map(id => `    ${JSON.stringify(id)}:${JSON.stringify(`ultimates/${id}.png`)},`).join('\n');
const replacement = `const ultimateAtlasManifest=Object.freeze({\n${entries}${entries ? '\n' : ''}  });`;
const original = readFileSync(effectsPath, 'utf8');
const pattern = /const ultimateAtlasManifest=Object\.freeze\(\{[\s\S]*?\n  \}\);/;
if (!pattern.test(original)) throw new Error('No se encontró el manifiesto de atlas de ultimate.');
const updated = original.replace(pattern, replacement);
if (updated !== original) writeFileSync(effectsPath, updated);
console.log(`Atlas de ultimate registrados: ${ids.length}`);
