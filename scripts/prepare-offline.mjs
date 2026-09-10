import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../public/', import.meta.url));
const files = [], digest = createHash('sha256'); let bytes = 0;
function walk(dir = '') {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const path = dir + entry.name;
    if (entry.isDirectory()) walk(path + '/');
    else if (!['offline-manifest.json', 'service-worker.js'].includes(path) && !path.endsWith('.md') && !path.endsWith('.txt')) {
      const data = readFileSync(join(root, path)); digest.update(path); digest.update(data); bytes += data.length; files.push('/' + path);
    }
  }
}
walk();
writeFileSync(join(root, 'offline-manifest.json'), JSON.stringify({ version: digest.digest('hex').slice(0, 20), bytes, files: ['/', ...files] }));
console.log(`Copia sin conexión: ${files.length} archivos, ${Math.ceil(bytes / 1000000)} MB.`);
