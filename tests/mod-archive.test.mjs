import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readModArchive } from '../public/content/archive.mjs';
import { writeModArchive } from '../scripts/package-mod.mjs';

// Deliberately independent from the production writer: these fixtures encode ZIP records directly.
function fixtureCrc(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipFixture(entries, { prefixBytes = 0 } = {}) {
  const prefix = Buffer.alloc(prefixBytes, 0x5a);
  const localParts = [prefix];
  const records = [];
  let offset = prefix.length;
  for (const source of entries) {
    const name = Buffer.from(source.name, 'utf8');
    const data = Buffer.isBuffer(source.data) ? source.data : Buffer.from(source.data ?? '');
    const method = source.method ?? 0;
    const size = source.declaredSize ?? data.length;
    const crc = source.crc ?? fixtureCrc(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    localParts.push(local, data);
    records.push({ name, data, method, size, crc, offset });
    offset += local.length + data.length;
  }
  const centralOffset = offset;
  const centralParts = records.map(record => {
    const central = Buffer.alloc(46 + record.name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(record.method, 10);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(record.crc, 16);
    central.writeUInt32LE(record.size, 20);
    central.writeUInt32LE(record.size, 24);
    central.writeUInt16LE(record.name.length, 28);
    central.writeUInt32LE(record.offset, 42);
    record.name.copy(central, 46);
    return central;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

const basicEntries = () => [
  { name: 'pack.json', data: JSON.stringify({ id: 'one-piece', version: '1.0.0' }) },
  { name: 'assets/art/characters/unit-001.png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
  { name: 'assets/data/units.json', data: '{"units":[]}' },
];

test('lee un ZIP STORE independiente y devuelve rutas canónicas y blobs verificados', async () => {
  const archive = new Blob([zipFixture(basicEntries(), { prefixBytes: 100_000 })]);
  const slices = [];
  const tracked = {
    size: archive.size,
    slice(start, end, type) {
      slices.push([start ?? 0, end ?? archive.size]);
      return archive.slice(start, end, type);
    },
  };
  const result = await readModArchive(tracked);
  assert.deepEqual(result.pack, { id: 'one-piece', version: '1.0.0' });
  assert.deepEqual(result.files.map(file => file.path), ['art/characters/unit-001.png', 'data/units.json']);
  assert.deepEqual(Buffer.from(await result.files[0].blob.arrayBuffer()), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  assert.equal(slices.some(([start, end]) => start === 0 && end === archive.size), false, 'el lector no debe cargar el archivo completo');
});

test('el empaquetador produce un ZIP estándar que el lector puede abrir', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'umbral-mod-'));
  try {
    const source = join(directory, 'one-piece');
    mkdirSync(join(source, 'assets', 'art', 'characters'), { recursive: true });
    mkdirSync(join(source, 'assets', 'data'), { recursive: true });
    writeFileSync(join(source, 'pack.json'), JSON.stringify({ id: 'one-piece', version: '2.0.0' }));
    writeFileSync(join(source, 'assets', 'art', 'characters', 'unit-001.png'), Buffer.from([1, 2, 3]));
    writeFileSync(join(source, 'assets', 'data', 'units.json'), '{}');
    const output = join(directory, 'one-piece.umbralmod');
    const packaged = writeModArchive({ sourceDirectory: source, outputPath: output });
    assert.equal(packaged.entries, 3);
    const result = await readModArchive(new Blob([readFileSync(output)]));
    assert.equal(result.pack.version, '2.0.0');
    assert.deepEqual(result.files.map(file => file.path), ['art/characters/unit-001.png', 'data/units.json']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rechaza CRC corrupto antes de devolver archivos', async () => {
  const bytes = zipFixture(basicEntries());
  const marker = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const dataOffset = bytes.indexOf(marker);
  assert.ok(dataOffset > 0);
  bytes[dataOffset] ^= 0xff;
  await assert.rejects(readModArchive(new Blob([bytes])), /CRC32 incorrecto/);
});

test('contrasta cada cabecera local con el directorio central', async () => {
  const bytes = zipFixture(basicEntries());
  bytes.writeUInt16LE(8, 8); // El directorio dice STORE, la primera cabecera local dice DEFLATE.
  await assert.rejects(readModArchive(new Blob([bytes])), /cabecera local no coincide/);
});

test('rechaza rutas peligrosas, duplicadas por mayúsculas y tipos ejecutables', async () => {
  const invalidSets = [
    [{ name: 'pack.json', data: '{}' }, { name: 'assets/../secret.json', data: '{}' }],
    [{ name: 'pack.json', data: '{}' }, { name: 'assets\\unit.png', data: 'x' }],
    [{ name: 'pack.json', data: '{}' }, { name: '/assets/unit.png', data: 'x' }],
    [{ name: 'pack.json', data: '{}' }, { name: 'assets//unit.png', data: 'x' }],
    [{ name: 'pack.json', data: '{}' }, { name: 'assets/%2e%2e/unit.png', data: 'x' }],
    [{ name: 'pack.json', data: '{}' }, { name: 'assets/Unit.png', data: 'x' }, { name: 'assets/unit.PNG', data: 'x' }],
    [{ name: 'pack.json', data: '{}' }, { name: 'assets/install.js', data: 'alert(1)' }],
    [{ name: 'pack.json', data: '{}' }, { name: 'other/unit.png', data: 'x' }],
  ];
  for (const entries of invalidSets) await assert.rejects(readModArchive(new Blob([zipFixture(entries)])), /Archivo de mod inválido/);
});

test('exige pack.json único, JSON objeto y ZIP STORE UTF-8', async () => {
  await assert.rejects(readModArchive(new Blob([zipFixture([{ name: 'assets/unit.png', data: 'x' }])])), /pack\.json/);
  await assert.rejects(readModArchive(new Blob([zipFixture([{ name: 'pack.json', data: '[]' }])])), /objeto JSON/);
  await assert.rejects(readModArchive(new Blob([zipFixture([{ name: 'pack.json', data: '{}', method: 8 }])])), /ZIP STORE/);
});

test('aplica límites de entradas, contenido total y pack.json', async () => {
  const tooMany = [{ name: 'pack.json', data: '{}' }];
  for (let i = 0; i < 5000; i++) tooMany.push({ name: `assets/data/${i}.json`, data: '' });
  await assert.rejects(readModArchive(new Blob([zipFixture(tooMany)])), /5000 entradas/);
  await assert.rejects(readModArchive(new Blob([zipFixture([
    { name: 'pack.json', data: '{}', declaredSize: 10 * 1024 * 1024 + 1 },
  ])])), /pack\.json supera 10 MB/);
  await assert.rejects(readModArchive(new Blob([zipFixture([
    { name: 'pack.json', data: '{}' },
    { name: 'assets/music/theme.mp3', data: '', declaredSize: 1024 * 1024 * 1024 },
  ])])), /contenido supera 1 GB/);
});

test('el empaquetador rechaza assets fuera de la lista permitida', () => {
  const directory = mkdtempSync(join(tmpdir(), 'umbral-mod-invalid-'));
  try {
    const source = join(directory, 'one-piece');
    mkdirSync(join(source, 'assets'), { recursive: true });
    writeFileSync(join(source, 'pack.json'), '{}');
    writeFileSync(join(source, 'assets', 'code.css'), 'body{}');
    assert.throws(() => writeModArchive({ sourceDirectory: source, outputPath: join(directory, 'bad.umbralmod') }), /extensión no permitida/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('el empaquetador exige que assets sea un directorio real', () => {
  const directory = mkdtempSync(join(tmpdir(), 'umbral-mod-assets-'));
  try {
    const source = join(directory, 'one-piece');
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, 'pack.json'), '{}');
    writeFileSync(join(source, 'assets'), 'not a directory');
    assert.throws(() => writeModArchive({ sourceDirectory: source, outputPath: join(directory, 'bad.umbralmod') }), /directorio real/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('la validación agrupa lecturas pequeñas y comunica progreso sin usar Blob.stream', async () => {
  const entries = [{name:'pack.json',data:'{}'}, ...Array.from({length:200},(_,i)=>({name:`assets/art/unit-${i}.png`,data:Buffer.alloc(100,i)}))];
  const source = new Blob([zipFixture(entries)]);
  let reads = 0;
  const wrap = blob => ({
    size:blob.size,
    slice:(start,end,type)=>wrap(blob.slice(start,end,type)),
    arrayBuffer:()=>{reads++;return blob.arrayBuffer();},
    stream:()=>{throw Error('No se debe depender del stream del proveedor Android.');},
  });
  const progress = [];
  const result = await readModArchive(wrap(source),{onProgress:event=>progress.push(event)});
  assert.equal(result.files.length,200);
  assert.ok(reads<10,`No agrupa las lecturas: ${reads}`);
  assert.equal(progress[0].phase,'directory');
  assert.ok(progress.some(p=>p.phase==='headers' && p.done>0));
  const final = progress.at(-1);
  assert.equal(final.phase,'checksums');
  assert.equal(final.done,201);
  assert.equal(final.bytesDone,final.bytesTotal);
});

test('cancelar interrumpe una lectura del proveedor que no responde', async () => {
  const controller = new AbortController();
  let started;
  const reading = new Promise(resolve=>{started=resolve;});
  const stalled = {size:100,slice:()=>({arrayBuffer:()=>{started();return new Promise(()=>{});}})};
  const result = readModArchive(stalled,{signal:controller.signal});
  await reading;
  controller.abort();
  await assert.rejects(result,{name:'AbortError'});
});

test('una lectura bloqueada termina con un error visible en lugar de esperar indefinidamente', async () => {
  const originalTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback,delay,...args)=>originalTimeout(callback,delay===30000?10:delay,...args);
  try {
    const stalled = {size:100,slice:()=>({arrayBuffer:()=>new Promise(()=>{})})};
    await assert.rejects(readModArchive(stalled),/lectura del archivo no responde/);
  } finally {globalThis.setTimeout=originalTimeout;}
});

test('un SVG enorme se rechaza antes de reservar memoria para su contenido', async () => {
  const bytes = zipFixture([{name:'pack.json',data:'{}'},{name:'assets/large.svg',data:'',declaredSize:10*1024*1024+1}]);
  await assert.rejects(readModArchive(new Blob([bytes])), /SVG supera 10 MB/);
});

test('los recursos ofrecen lecturas cancelables y limitadas por bloques', async () => {
  const controller = new AbortController();
  const source = Buffer.from('sprite bytes');
  const {files} = await readModArchive(new Blob([zipFixture([{name:'pack.json',data:'{}'},{name:'assets/a.png',data:source}])]),{signal:controller.signal});
  assert.deepEqual(Buffer.from(await files[0].read(0,source.length)),source);
  assert.throws(()=>files[0].read(-1,source.length), /bloques/);
  assert.throws(()=>files[0].read(0,source.length+1), /bloques/);
  controller.abort();
  await assert.rejects(files[0].read(0,source.length),{name:'AbortError'});
});
