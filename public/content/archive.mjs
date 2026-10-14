const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const UTF8_FLAG = 0x0800;
const MAX_ENTRIES = 5000;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
const MAX_PACK_BYTES = 10 * 1024 * 1024;
const MAX_CENTRAL_BYTES = 32 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['png', 'webp', 'jpg', 'jpeg', 'svg', 'mp3', 'json', 'ttf', 'woff2']);
const MIME_TYPES = Object.freeze({
  png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', json: 'application/json', ttf: 'font/ttf', woff2: 'font/woff2',
});

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < table.length; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[i] = value >>> 0;
  }
  return table;
})();

function fail(message) {
  throw new Error(`Archivo de mod inválido: ${message}`);
}

function canonicalArchivePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\0') || path.includes('\\') || path.startsWith('/') ||
      path.endsWith('/') || path.includes('//') || /[?#%:]/.test(path) || /^[a-z]:/i.test(path)) fail('ruta no permitida.');
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[\u0000-\u001f\u007f]/.test(part))) fail('ruta no permitida.');
  if (path === 'pack.json') return { archivePath: path, path: null, extension: 'json' };
  if (parts[0] !== 'assets' || parts.length < 2) fail('solo se permiten pack.json y archivos bajo assets/.');
  const assetPath = parts.slice(1).join('/');
  const extension = assetPath.includes('.') ? assetPath.slice(assetPath.lastIndexOf('.') + 1).toLowerCase() : '';
  if (!ALLOWED_EXTENSIONS.has(extension)) fail(`extensión no permitida en ${path}.`);
  return { archivePath: path, path: assetPath, extension };
}

function bytesEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false;
  return true;
}

function updateCrc(crc, bytes) {
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return crc >>> 0;
}

async function crc32(blob) {
  let crc = 0xffffffff;
  if (typeof blob.stream === 'function') {
    const reader = blob.stream().getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        crc = updateCrc(crc, value);
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    const chunkSize = 1024 * 1024;
    for (let offset = 0; offset < blob.size; offset += chunkSize) {
      crc = updateCrc(crc, new Uint8Array(await blob.slice(offset, offset + chunkSize).arrayBuffer()));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findEocd(bytes) {
  for (let offset = bytes.length - 22; offset >= 0; offset--) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.length - offset);
    if (view.getUint32(0, true) !== EOCD_SIGNATURE) continue;
    const commentLength = view.getUint16(20, true);
    if (offset + 22 + commentLength === bytes.length) return offset;
  }
  return -1;
}

function decodeName(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    fail('un nombre de archivo no es UTF-8 válido.');
  }
}

function checkedEnd(start, length, limit, message) {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 0 || length < 0 || start > limit - length) fail(message);
  return start + length;
}


export async function readModArchive(file) {
  if (!file || !Number.isSafeInteger(file.size) || file.size < 22 || typeof file.slice !== 'function') fail('el archivo no se puede leer.');
  const tailLength = Math.min(file.size, 22 + 0xffff);
  const tailStart = file.size - tailLength;
  const tail = new Uint8Array(await file.slice(tailStart).arrayBuffer());
  const eocdOffsetInTail = findEocd(tail);
  if (eocdOffsetInTail < 0) fail('falta el directorio ZIP.');
  const eocdAbsolute = tailStart + eocdOffsetInTail;
  const eocd = new DataView(tail.buffer, tail.byteOffset + eocdOffsetInTail, tail.length - eocdOffsetInTail);
  const disk = eocd.getUint16(4, true);
  const centralDisk = eocd.getUint16(6, true);
  const diskEntries = eocd.getUint16(8, true);
  const entryCount = eocd.getUint16(10, true);
  const centralSize = eocd.getUint32(12, true);
  const centralOffset = eocd.getUint32(16, true);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entryCount) fail('los ZIP multidisco no están permitidos.');
  if (!entryCount || entryCount > MAX_ENTRIES) fail(`el archivo debe contener entre 1 y ${MAX_ENTRIES} entradas.`);
  if (centralSize > MAX_CENTRAL_BYTES || centralOffset === 0xffffffff || centralSize === 0xffffffff) fail('el directorio ZIP es demasiado grande.');
  if (checkedEnd(centralOffset, centralSize, eocdAbsolute, 'el directorio ZIP está fuera del archivo.') !== eocdAbsolute) {
    fail('hay datos inesperados antes del final del ZIP.');
  }

  const centralBytes = new Uint8Array(await file.slice(centralOffset, centralOffset + centralSize).arrayBuffer());
  const central = new DataView(centralBytes.buffer, centralBytes.byteOffset, centralBytes.byteLength);
  const entries = [];
  const names = new Set();
  let cursor = 0;
  let totalBytes = 0;
  let packCount = 0;
  for (let index = 0; index < entryCount; index++) {
    if (cursor + 46 > centralBytes.length || central.getUint32(cursor, true) !== CENTRAL_SIGNATURE) fail('directorio ZIP truncado.');
    const flags = central.getUint16(cursor + 8, true);
    const method = central.getUint16(cursor + 10, true);
    const expectedCrc = central.getUint32(cursor + 16, true);
    const compressedSize = central.getUint32(cursor + 20, true);
    const size = central.getUint32(cursor + 24, true);
    const nameLength = central.getUint16(cursor + 28, true);
    const extraLength = central.getUint16(cursor + 30, true);
    const commentLength = central.getUint16(cursor + 32, true);
    const startDisk = central.getUint16(cursor + 34, true);
    const localOffset = central.getUint32(cursor + 42, true);
    const next = checkedEnd(cursor + 46, nameLength + extraLength + commentLength, centralBytes.length, 'directorio ZIP truncado.');
    if ((flags & ~UTF8_FLAG) !== 0 || (flags & UTF8_FLAG) === 0) fail('las entradas deben usar nombres UTF-8 sin cifrado ni descriptor de datos.');
    if (method !== 0 || compressedSize !== size) fail('solo se admite ZIP STORE sin compresión.');
    if (startDisk !== 0 || localOffset === 0xffffffff || size === 0xffffffff) fail('ZIP64 o multidisco no permitido.');
    const nameBytes = centralBytes.slice(cursor + 46, cursor + 46 + nameLength);
    const archivePath = decodeName(nameBytes);
    const canonical = canonicalArchivePath(archivePath);
    const folded = archivePath.toLowerCase();
    if (names.has(folded)) fail(`ruta duplicada: ${archivePath}.`);
    names.add(folded);
    if (archivePath === 'pack.json') {
      packCount++;
      if (size > MAX_PACK_BYTES) fail('pack.json supera 10 MB.');
    }
    totalBytes += size;
    if (!Number.isSafeInteger(totalBytes) || totalBytes > MAX_TOTAL_BYTES) fail('el contenido supera 1 GB.');
    entries.push({ ...canonical, archivePath, nameBytes, flags, method, expectedCrc, size, localOffset });
    cursor = next;
  }
  if (cursor !== centralBytes.length) fail('el directorio ZIP contiene datos sobrantes.');
  if (packCount !== 1) fail('debe existir exactamente un pack.json.');

  const ranges = [];
  for (const entry of entries) {
    const headerEnd = checkedEnd(entry.localOffset, 30, centralOffset, 'cabecera local fuera del archivo.');
    const headerBytes = new Uint8Array(await file.slice(entry.localOffset, headerEnd).arrayBuffer());
    if (headerBytes.length !== 30) fail('cabecera local truncada.');
    const local = new DataView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength);
    if (local.getUint32(0, true) !== LOCAL_SIGNATURE) fail('cabecera local inválida.');
    const localFlags = local.getUint16(6, true);
    const localMethod = local.getUint16(8, true);
    const localCrc = local.getUint32(14, true);
    const localCompressed = local.getUint32(18, true);
    const localSize = local.getUint32(22, true);
    const localNameLength = local.getUint16(26, true);
    const localExtraLength = local.getUint16(28, true);
    const variableEnd = checkedEnd(headerEnd, localNameLength + localExtraLength, centralOffset, 'cabecera local truncada.');
    const variable = new Uint8Array(await file.slice(headerEnd, variableEnd).arrayBuffer());
    const localName = variable.slice(0, localNameLength);
    if (localFlags !== entry.flags || localMethod !== entry.method || localCrc !== entry.expectedCrc ||
        localCompressed !== entry.size || localSize !== entry.size || !bytesEqual(localName, entry.nameBytes)) {
      fail(`la cabecera local no coincide para ${entry.archivePath}.`);
    }
    const dataEnd = checkedEnd(variableEnd, entry.size, centralOffset, `contenido truncado: ${entry.archivePath}.`);
    ranges.push({ start: entry.localOffset, end: dataEnd, entry, blob: file.slice(variableEnd, dataEnd, MIME_TYPES[entry.extension] || '') });
  }
  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) if (ranges[i].start < ranges[i - 1].end) fail('las entradas ZIP se solapan.');

  let pack;
  const files = [];
  for (const { entry, blob } of ranges) {
    if (await crc32(blob) !== entry.expectedCrc) fail(`CRC32 incorrecto: ${entry.archivePath}.`);
    if (entry.archivePath === 'pack.json') {
      try {
        pack = JSON.parse(await blob.text());
      } catch {
        fail('pack.json no contiene JSON válido.');
      }
      if (!pack || typeof pack !== 'object' || Array.isArray(pack)) fail('pack.json debe contener un objeto JSON.');
    } else {
      if(entry.extension==='svg'){
        const source=await blob.text();
        if(/<\s*(?:script|foreignObject|iframe|object|embed)\b|\bon\w+\s*=|(?:javascript|vbscript)\s*:|<!ENTITY|<\?xml-stylesheet/i.test(source))fail(`SVG ejecutable: ${entry.archivePath}.`);
      }
      files.push({ path: entry.path, blob });
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { pack, files };
}
