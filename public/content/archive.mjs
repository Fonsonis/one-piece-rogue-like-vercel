const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const UTF8_FLAG = 0x0800;
const MAX_ENTRIES = 5000;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
const MAX_PACK_BYTES = 10 * 1024 * 1024;
const MAX_SVG_BYTES = 10 * 1024 * 1024;
const MAX_CENTRAL_BYTES = 32 * 1024 * 1024;
const READ_WINDOW_BYTES = 1024 * 1024;
const READ_TIMEOUT_MS = 30000;
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
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return crc >>> 0;
}

function checkAbort(signal) {
  if (signal?.aborted) throw new DOMException('Instalación cancelada.', 'AbortError');
}

async function readBytes(blob, signal) {
  checkAbort(signal);
  let reader;
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (error) { reader?.abort(); reject(error); }
      else resolve(new Uint8Array(value));
    };
    const abort = () => finish(new DOMException('Instalación cancelada.', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('La lectura del archivo no responde. Copia el mod a Descargas del móvil y vuelve a seleccionarlo.')), READ_TIMEOUT_MS);
    signal?.addEventListener('abort', abort, {once:true});
    const operation = typeof blob.arrayBuffer === 'function'
      ? () => blob.arrayBuffer()
      : () => new Promise((done, fail) => {
        if (typeof FileReader !== 'function') { fail(new Error('Este dispositivo no puede leer el archivo del mod.')); return; }
        reader = new FileReader();
        reader.onload = () => done(reader.result);
        reader.onerror = () => fail(new Error('No se pudo leer el archivo. Copia el mod a Descargas y vuelve a seleccionarlo.'));
        reader.onabort = () => fail(new DOMException('Instalación cancelada.', 'AbortError'));
        reader.readAsArrayBuffer(blob);
      });
    Promise.resolve().then(operation).then(value => finish(null, value), error => finish(error));
  });
}

const paint = () => new Promise(resolve => setTimeout(resolve, 0));

async function crc32(size, read, onChunk, signal) {
  let crc = 0xffffffff;
  for (let offset = 0; offset < size; offset += READ_WINDOW_BYTES) {
    checkAbort(signal);
    const bytes = await read(offset, Math.min(size, offset + READ_WINDOW_BYTES));
    crc = updateCrc(crc, bytes);
    onChunk(bytes.length);
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


export async function readModArchive(file, {onProgress = () => {}, signal} = {}) {
  checkAbort(signal);
  onProgress({phase:'directory', done:0, total:1, bytesDone:0, bytesTotal:file?.size || 0});
  await paint();
  if (!file || !Number.isSafeInteger(file.size) || file.size < 22 || typeof file.slice !== 'function') fail('el archivo no se puede leer.');
  // Android document providers have substantial per-read overhead. Reuse a
  // bounded window for nearby ZIP records instead of thousands of tiny reads.
  let windowStart = -1, windowBytes = new Uint8Array();
  const readRange = async (start, end, readSignal = signal) => {
    checkAbort(readSignal);
    if (start >= windowStart && end <= windowStart + windowBytes.length) return windowBytes.subarray(start - windowStart, end - windowStart);
    windowStart = start;
    windowBytes = await readBytes(file.slice(start, Math.min(file.size, start + Math.max(READ_WINDOW_BYTES, end - start))), readSignal);
    if (windowBytes.length < end - start) fail('contenido truncado al leer el archivo.');
    return windowBytes.subarray(0, end - start);
  };
  const tailLength = Math.min(file.size, 22 + 0xffff);
  const tailStart = file.size - tailLength;
  const tail = await readBytes(file.slice(tailStart), signal);
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

  const centralBytes = await readBytes(file.slice(centralOffset, centralOffset + centralSize), signal);
  const central = new DataView(centralBytes.buffer, centralBytes.byteOffset, centralBytes.byteLength);
  const entries = [];
  const names = new Set();
  let cursor = 0;
  let totalBytes = 0;
  let packCount = 0;
  for (let index = 0; index < entryCount; index++) {
    checkAbort(signal);
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
    if (canonical.extension === 'svg' && size > MAX_SVG_BYTES) fail('un SVG supera 10 MB.');
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
  onProgress({phase:'headers',done:0,total:entries.length,bytesDone:0,bytesTotal:totalBytes});
  for (const [index, entry] of entries.entries()) {
    checkAbort(signal);
    const headerEnd = checkedEnd(entry.localOffset, 30, centralOffset, 'cabecera local fuera del archivo.');
    const headerBytes = await readRange(entry.localOffset, headerEnd);
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
    const variable = await readRange(headerEnd, variableEnd);
    const localName = variable.slice(0, localNameLength);
    if (localFlags !== entry.flags || localMethod !== entry.method || localCrc !== entry.expectedCrc ||
        localCompressed !== entry.size || localSize !== entry.size || !bytesEqual(localName, entry.nameBytes)) {
      fail(`la cabecera local no coincide para ${entry.archivePath}.`);
    }
    const dataEnd = checkedEnd(variableEnd, entry.size, centralOffset, `contenido truncado: ${entry.archivePath}.`);
    ranges.push({ start: entry.localOffset, dataStart:variableEnd, end: dataEnd, entry, blob: file.slice(variableEnd, dataEnd, MIME_TYPES[entry.extension] || '') });
    if ((index + 1) % 32 === 0 || index + 1 === entries.length) {
      onProgress({phase:'headers',done:index+1,total:entries.length,bytesDone:0,bytesTotal:totalBytes});
      await paint();
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  for (let i = 1; i < ranges.length; i++) if (ranges[i].start < ranges[i - 1].end) fail('las entradas ZIP se solapan.');

  let pack;
  const files = [];
  let bytesDone = 0, done = 0, lastPaint = Date.now(), lastProgress = 0;
  const report = (force = false) => {
    const now = Date.now();
    if (force || now - lastProgress >= 32) {
      lastProgress = now;
      onProgress({phase:'checksums',done,total:ranges.length,bytesDone,bytesTotal:totalBytes});
    }
  };
  report(true);
  for (const { entry, blob, dataStart, end } of ranges) {
    checkAbort(signal);
    const crc = await crc32(blob.size, (start, stop) => readRange(dataStart + start, dataStart + stop), n => {bytesDone += n; report();}, signal);
    if (crc !== entry.expectedCrc) fail(`CRC32 incorrecto: ${entry.archivePath}.`);
    if (entry.archivePath === 'pack.json') {
      const text = new TextDecoder().decode(await readRange(dataStart, end));
      try {
        pack = JSON.parse(text);
      } catch {
        checkAbort(signal);
        fail('pack.json no contiene JSON válido.');
      }
      if (!pack || typeof pack !== 'object' || Array.isArray(pack)) fail('pack.json debe contener un objeto JSON.');
    } else {
      if(entry.extension==='svg'){
        const source=new TextDecoder().decode(await readRange(dataStart, end));
        if(/<\s*(?:script|foreignObject|iframe|object|embed)\b|\bon\w+\s*=|(?:javascript|vbscript)\s*:|<!ENTITY|<\?xml-stylesheet/i.test(source))fail(`SVG ejecutable: ${entry.archivePath}.`);
      }
      files.push({ path: entry.path, blob, read: (start, stop, readSignal = signal) => {
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(stop) || start < 0 || stop < start || stop > entry.size || stop - start > READ_WINDOW_BYTES) {
          throw new RangeError('La lectura de un recurso debe usar bloques de hasta 1 MB.');
        }
        return readRange(dataStart + start, dataStart + stop, readSignal);
      }});
    }
    done++;
    report(done === ranges.length);
    if (Date.now() - lastPaint >= 32) { await paint(); lastPaint = Date.now(); }
  }
  checkAbort(signal);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { pack, files };
}
