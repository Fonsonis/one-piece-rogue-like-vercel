import { cpSync, copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import './update-ultimate-manifest.mjs';
import './prepare-offline.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'public');
const output = join(root, 'dist');
function checkScripts(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) checkScripts(path);
    else if (/\.(mjs|js)$/.test(path)) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.status !== 0) throw new Error(`JavaScript inválido: ${path}`);
    }
  }
}
if (!existsSync(join(source, 'play.html'))) throw new Error('Falta public/play.html');
checkScripts(source);
rmSync(output, { recursive: true, force: true });
cpSync(source, output, { recursive: true });
copyFileSync(join(source, 'play.html'), resolve(output, 'index.html'));
const buildVersion = JSON.parse(readFileSync(join(source, 'offline-manifest.json'), 'utf8')).version;
for (const name of ['play.html', 'index.html']) {
  const path = join(output, name);
  writeFileSync(path, readFileSync(path, 'utf8').replace('content="development"', `content="${buildVersion}"`));
}
console.log('Cliente del juego listo en dist/ (la señalización multijugador se despliega desde api/).');
