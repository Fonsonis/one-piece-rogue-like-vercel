import {
  closeSync, copyFileSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync,
  rmSync, writeSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_ENTRIES = 5000;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
const MAX_PACK_BYTES = 10 * 1024 * 1024;
const MAX_CENTRAL_BYTES = 32 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['png', 'webp', 'jpg', 'jpeg', 'svg', 'mp3', 'json', 'ttf', 'woff2']);
const UTF8_FLAG = 0x0800;
const DOS_EPOCH_DATE = 0x0021;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < table.length; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function fail(message) {
  throw new Error(`No se pudo empaquetar el mod: ${message}`);
}

function safeAssetPath(path) {
  if (!path || path.includes('\\') || path.startsWith('/') || path.endsWith('/') || path.includes('//') ||
      /[?#%:]/.test(path) || /^[a-z]:/i.test(path)) {
    fail(`ruta no permitida: ${path}.`);
  }
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[\u0000-\u001f\u007f]/.test(part))) fail(`ruta no permitida: ${path}.`);
  const extension = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1).toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(extension)) fail(`extensión no permitida: ${path}.`);
  return path;
}

function collectAssets(assetsDirectory, directory = assetsDirectory, result = []) {
  if (!existsSync(directory)) return result;
  if (directory === assetsDirectory) {
    const rootStat = lstatSync(directory);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) fail(`assets debe ser un directorio real: ${directory}.`);
  }
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const diskPath = join(directory, entry.name);
    const stat = lstatSync(diskPath);
    if (stat.isSymbolicLink()) fail(`no se permiten enlaces simbólicos: ${diskPath}.`);
    if (entry.isDirectory()) collectAssets(assetsDirectory, diskPath, result);
    else if (entry.isFile()) {
      const path = relative(assetsDirectory, diskPath).split(sep).join('/');
      result.push({ archivePath: `assets/${safeAssetPath(path)}`, diskPath, size: stat.size });
    } else fail(`tipo de archivo no permitido: ${diskPath}.`);
  }
  return result;
}

function writeAll(fd, bytes) {
  let offset = 0;
  while (offset < bytes.length) offset += writeSync(fd, bytes, offset, bytes.length - offset);
}

function localHeader(entry) {
  const header = Buffer.alloc(30 + entry.name.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(UTF8_FLAG, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(DOS_EPOCH_DATE, 12);
  header.writeUInt32LE(entry.crc, 14);
  header.writeUInt32LE(entry.size, 18);
  header.writeUInt32LE(entry.size, 22);
  header.writeUInt16LE(entry.name.length, 26);
  header.writeUInt16LE(0, 28);
  entry.name.copy(header, 30);
  return header;
}

function centralHeader(entry) {
  const header = Buffer.alloc(46 + entry.name.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(UTF8_FLAG, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(DOS_EPOCH_DATE, 14);
  header.writeUInt32LE(entry.crc, 16);
  header.writeUInt32LE(entry.size, 20);
  header.writeUInt32LE(entry.size, 24);
  header.writeUInt16LE(entry.name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(entry.offset, 42);
  entry.name.copy(header, 46);
  return header;
}

function endRecord(entryCount, centralSize, centralOffset) {
  const record = Buffer.alloc(22);
  record.writeUInt32LE(0x06054b50, 0);
  record.writeUInt16LE(0, 4);
  record.writeUInt16LE(0, 6);
  record.writeUInt16LE(entryCount, 8);
  record.writeUInt16LE(entryCount, 10);
  record.writeUInt32LE(centralSize, 12);
  record.writeUInt32LE(centralOffset, 16);
  record.writeUInt16LE(0, 20);
  return record;
}

export function writeModArchive({ sourceDirectory, outputPath } = {}) {
  if (!sourceDirectory || !outputPath) fail('sourceDirectory y outputPath son obligatorios.');
  sourceDirectory = resolve(sourceDirectory);
  outputPath = resolve(outputPath);
  const packPath = join(sourceDirectory, 'pack.json');
  if (!existsSync(packPath) || !lstatSync(packPath).isFile()) fail(`falta ${packPath}.`);
  const packSize = lstatSync(packPath).size;
  if (packSize > MAX_PACK_BYTES) fail('pack.json supera 10 MB.');
  try {
    const parsed = JSON.parse(readFileSync(packPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('pack.json debe contener un objeto JSON.');
  } catch (error) {
    if (error.message.startsWith('No se pudo empaquetar')) throw error;
    fail('pack.json no contiene JSON válido.');
  }

  const sources = [{ archivePath: 'pack.json', diskPath: packPath, size: packSize }, ...collectAssets(join(sourceDirectory, 'assets'))]
    .sort((a, b) => a.archivePath.localeCompare(b.archivePath));
  if (sources.length > MAX_ENTRIES) fail(`el mod supera ${MAX_ENTRIES} entradas.`);
  const folded = new Set();
  let totalBytes = 0;
  let centralBytes = 0;
  for (const source of sources) {
    const key = source.archivePath.toLowerCase();
    if (folded.has(key)) fail(`ruta duplicada sin distinguir mayúsculas: ${source.archivePath}.`);
    folded.add(key);
    if (!Number.isSafeInteger(source.size) || source.size < 0 || source.size > 0xffffffff) fail(`archivo demasiado grande: ${source.archivePath}.`);
    source.name = Buffer.from(source.archivePath, 'utf8');
    if (source.name.length > 0xffff) fail(`ruta demasiado larga: ${source.archivePath}.`);
    centralBytes += 46 + source.name.length;
    if (centralBytes > MAX_CENTRAL_BYTES) fail('el directorio ZIP supera 32 MB.');
    totalBytes += source.size;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_TOTAL_BYTES) fail('el contenido supera 1 GB.');
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp-${process.pid}`;
  rmSync(temporary, { force: true });
  const fd = openSync(temporary, 'wx');
  const entries = [];
  let offset = 0;
  try {
    for (const source of sources) {
      const data = readFileSync(source.diskPath);
      if (data.length !== source.size) fail(`el archivo cambió durante el empaquetado: ${source.archivePath}.`);
      const entry = { ...source, crc: crc32(data), offset };
      const header = localHeader(entry);
      writeAll(fd, header);
      writeAll(fd, data);
      offset += header.length + data.length;
      entries.push(entry);
    }
    const centralOffset = offset;
    for (const entry of entries) {
      const header = centralHeader(entry);
      writeAll(fd, header);
      offset += header.length;
    }
    const centralSize = offset - centralOffset;
    writeAll(fd, endRecord(entries.length, centralSize, centralOffset));
  } catch (error) {
    closeSync(fd);
    rmSync(temporary, { force: true });
    throw error;
  }
  closeSync(fd);
  rmSync(outputPath, { force: true });
  try {
    renameSync(temporary, outputPath);
  } catch (error) {
    if (!['EPERM', 'EXDEV'].includes(error.code)) {
      rmSync(temporary, { force: true });
      throw error;
    }
    // Some Windows sandboxes deny rename even within one directory.
    copyFileSync(temporary, outputPath);
    rmSync(temporary, { force: true });
  }
  return { outputPath, entries: entries.length, bytes: fstatSafe(outputPath), contentBytes: totalBytes };
}

function fstatSafe(path) {
  const fd = openSync(path, 'r');
  try { return fstatSync(fd).size; } finally { closeSync(fd); }
}

const root = fileURLToPath(new URL('..', import.meta.url));
const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const id=process.argv[2]||'one-piece';
    if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id))throw Error('Identificador de mod inválido.');
    const result = writeModArchive({
      sourceDirectory: join(root, 'mods', id),
      outputPath: join(root, 'outputs', 'mods', `${id}.umbralmod`),
    });
    console.log(`Mod empaquetado: ${result.outputPath} (${result.entries} archivos, ${result.bytes} bytes).`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
