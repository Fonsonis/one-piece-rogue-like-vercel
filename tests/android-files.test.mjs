import assert from 'node:assert/strict';
import test from 'node:test';
import { exportAndroidJson, isAndroidApp } from '../public/local/android-files.mjs';

test('Android exports the save through a native temporary file and the system share sheet', async () => {
  const calls = [];
  const previous = globalThis.Capacitor;
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    registerPlugin(name) {
      if (name === 'Filesystem') return { writeFile: async options => {
        calls.push(['write', options]);
        return { uri: 'file:///cache/grandlinelike.json' };
      }};
      if (name === 'Share') return { share: async options => calls.push(['share', options]) };
      return null;
    },
  };
  try {
    assert.equal(isAndroidApp(), true);
    assert.equal(await exportAndroidJson('{"game":"grandlinelike"}'), 'file:///cache/grandlinelike.json');
    assert.deepEqual(calls[0], ['write', {
      path: 'grandlinelike.json', data: '{"game":"grandlinelike"}', directory: 'CACHE', encoding: 'utf8', recursive: true,
    }]);
    assert.equal(calls[1][0], 'share');
    assert.equal(calls[1][1].url, 'file:///cache/grandlinelike.json');
  } finally {
    globalThis.Capacitor = previous;
  }
});

test('native export fails explicitly when Android plugins are unavailable', async () => {
  const previous = globalThis.Capacitor;
  globalThis.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', registerPlugin: () => ({}) };
  try {
    await assert.rejects(exportAndroidJson('{}'), /plugins nativos/);
  } finally {
    globalThis.Capacitor = previous;
  }
});
