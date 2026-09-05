import { cpSync, copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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
console.log('Juego estático listo en dist/ (sin funciones, cuentas ni base de datos).');
