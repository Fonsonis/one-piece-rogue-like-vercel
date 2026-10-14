import {readdir, readFile} from 'node:fs/promises';
import {extname, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)), 'public');
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.mjs', '.svg', '.webmanifest']);
const OMITTED_DIRECTORIES = new Set(['mods', 'node_modules']);
const MAX_PRINTED_FINDINGS = 200;

// Match complete franchise names and vocabulary rather than broad maritime words
// such as "pirata", "marina", "isla" or "tripulación".
const forbidden = [
  ['brand', /\bOne\s+Piece\b/giu],
  ['brand', /\bGrand\s+Line(?:\s+Like)?\b/giu],
  ['characters', /\b(?:Luffy|Zoro|Nami|Usopp|Sanji|Chopper|Robin|Franky|Brook|Jinbe)\b/giu],
  ['characters', /\b(?:Kaido|Shanks|Doflamingo|Mihawk|Buggy|Crocodile|Roger|Garp|Sengoku|Akainu|Aokiji|Kizaru)\b/giu],
  ['world', /\b(?:East\s+Blue|Alabasta|Skypiea|Water\s+Seven|Thriller\s+Bark|Sabaody|Marineford|Punk\s+Hazard|Dressrosa|Whole\s+Cake|Wano|Egghead|Elbaph|Gyojin|Zou)\b/giu],
  ['vocabulary', /\b(?:Haki|Nakama(?:s)?|Yonkou?s?|Zoan|Log\s+Pose(?:s)?|Den\s+Den\s+Mushi(?:s)?|Cross\s*Guild|Crossguild)\b/giu],
  ['vocabulary', /\b(?:Fruta(?:s)?\s+del\s+Diablo|Sombrero(?:s)?\s+de\s+Paja|Rey\s+(?:de\s+los\s+)?Piratas?|Berries)\b/giu],
  ['vocabulary', /\b(?:Sake\s+de\s+Binks|Law\s+y\s+Kid)\b/giu],
  ['forms', /\bGear\s*(?:2|3|4|5|Second|Third|Fourth|Fifth)\b/giu],
  ['source-url', /\bonepiece(?:\.fandom)?\.com\b/giu],
];

async function filesBelow(directory) {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes:true})) {
    if (entry.isDirectory() && OMITTED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesBelow(path));
    else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name).toLowerCase())) result.push(path);
  }
  return result;
}

function locationAt(source, offset) {
  const before = source.slice(0, offset);
  const line = 1 + (before.match(/\n/g)?.length || 0);
  const lastBreak = before.lastIndexOf('\n');
  return {line, column:offset - lastBreak};
}

const findings = [];
for (const path of (await filesBelow(root)).sort()) {
  const source = await readFile(path, 'utf8');
  for (const [category, pattern] of forbidden) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const {line, column} = locationAt(source, match.index);
      findings.push({
        category,
        file:relative(root, path).split(sep).join('/'),
        line,
        column,
        text:match[0],
      });
    }
  }
}

if (!findings.length) {
  console.log('Base content audit passed: no One Piece references found outside public/mods.');
  process.exit(0);
}

const counts = new Map();
for (const finding of findings) {
  const key = `${finding.category}\t${finding.text.toLocaleLowerCase('es')}`;
  counts.set(key, (counts.get(key) || 0) + 1);
}
console.error(`Base content audit failed: ${findings.length} forbidden reference(s) outside public/mods.`);
for (const finding of findings.slice(0, MAX_PRINTED_FINDINGS)) {
  console.error(`${finding.file}:${finding.line}:${finding.column} [${finding.category}] ${JSON.stringify(finding.text)}`);
}
if (findings.length > MAX_PRINTED_FINDINGS) console.error(`... ${findings.length - MAX_PRINTED_FINDINGS} additional finding(s) omitted.`);
console.error('Counts:');
for (const [key, count] of [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
  const [category, text] = key.split('\t');
  console.error(`  ${count}\t[${category}] ${text}`);
}
process.exitCode = 1;
