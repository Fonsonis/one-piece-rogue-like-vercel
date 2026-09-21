import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadAndroidApk } from '../public/local/android-update.mjs';

async function withAndroid({ installedCode, releaseCode, accepted = false }, run) {
  const previous = {
    Capacitor: globalThis.Capacitor,
    fetch: globalThis.fetch,
    confirm: globalThis.confirm,
  };
  const opened = [], messages = [];
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    registerPlugin(name) {
      if (name === 'App') return { getInfo: async () => ({ version: '1.2.0', build: String(installedCode) }) };
      if (name === 'Browser') return { open: async options => opened.push(options.url) };
      return null;
    },
  };
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ version: '1.2.0', versionCode: releaseCode, downloadUrl: 'https://example.test/game.apk' }),
  });
  globalThis.confirm = () => accepted;
  try {
    await run({ opened, messages, toast: message => messages.push(message) });
  } finally {
    Object.assign(globalThis, previous);
  }
}

test('the APK detects a newer build even when the semantic version is unchanged', async () => {
  await withAndroid({ installedCode: 102000001, releaseCode: 102000002, accepted: true }, async state => {
    await downloadAndroidApk({ toast: state.toast });
    assert.deepEqual(state.opened, ['https://example.test/game.apk']);
    assert.match(state.messages.at(-1), /Descarga abierta/);
  });
});

test('the APK does not offer the same or an older build', async () => {
  await withAndroid({ installedCode: 102000002, releaseCode: 102000002 }, async state => {
    await downloadAndroidApk({ toast: state.toast });
    assert.deepEqual(state.opened, []);
    assert.match(state.messages.at(-1), /versión más reciente/);
  });
});
