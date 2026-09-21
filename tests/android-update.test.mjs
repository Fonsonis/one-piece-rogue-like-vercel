import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadAndroidApk } from '../public/local/android-update.mjs';

async function withAndroid({ installedCode, releaseCode, accepted = false, downloadStates = [{ state: 'successful', bytesDownloaded: 10, totalBytes: 10 }], installState = 'installing' }, run) {
  const previous = {
    Capacitor: globalThis.Capacitor,
    fetch: globalThis.fetch,
    confirm: globalThis.confirm,
  };
  const downloads = [], installs = [], messages = [];
  let statusIndex = 0;
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    registerPlugin(name) {
      if (name === 'App') return { getInfo: async () => ({ version: '1.2.0', build: String(installedCode) }) };
      if (name === 'AndroidUpdater') return {
        startDownload: async options => {
          downloads.push(options);
          return downloadStates[statusIndex++];
        },
        getStatus: async () => downloadStates[Math.min(statusIndex++, downloadStates.length - 1)],
        install: async () => {
          installs.push(true);
          return { state: installState };
        },
      };
      return null;
    },
  };
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ version: '1.2.0', versionCode: releaseCode, downloadUrl: 'https://example.test/game.apk' }),
  });
  globalThis.confirm = () => accepted;
  try {
    await run({ downloads, installs, messages, toast: message => messages.push(message) });
  } finally {
    Object.assign(globalThis, previous);
  }
}

test('the APK detects a newer build even when the semantic version is unchanged', async () => {
  await withAndroid({ installedCode: 102000001, releaseCode: 102000002, accepted: true }, async state => {
    await downloadAndroidApk({ toast: state.toast });
    assert.deepEqual(state.downloads, [{ url: 'https://example.test/game.apk', versionCode: 102000002 }]);
    assert.equal(state.installs.length, 1);
    assert.match(state.messages.at(-1), /Abriendo el instalador/);
  });
});

test('the APK does not offer the same or an older build', async () => {
  await withAndroid({ installedCode: 102000002, releaseCode: 102000002 }, async state => {
    await downloadAndroidApk({ toast: state.toast });
    assert.deepEqual(state.downloads, []);
    assert.match(state.messages.at(-1), /versión más reciente/);
  });
});

test('an Android download resumed by DownloadManager reports progress and installs when complete', async () => {
  await withAndroid({
    installedCode: 102000001,
    releaseCode: 102000003,
    accepted: true,
    downloadStates: [
      { state: 'running', bytesDownloaded: 5242880, totalBytes: 10485760 },
      { state: 'successful', bytesDownloaded: 10485760, totalBytes: 10485760 },
    ],
  }, async state => {
    await downloadAndroidApk({ toast: state.toast });
    assert.match(state.messages.find(message => message.includes('Descargando')), /50%/);
    assert.equal(state.installs.length, 1);
  });
});

test('the updater explains the one-time Android installation permission', async () => {
  await withAndroid({ installedCode: 1, releaseCode: 2, accepted: true, installState: 'permissionRequired' }, async state => {
    await downloadAndroidApk({ toast: state.toast });
    assert.match(state.messages.at(-1), /instalar apps desconocidas/);
  });
});
