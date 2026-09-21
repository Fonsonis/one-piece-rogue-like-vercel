import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadAndroidApk } from '../public/local/android-update.mjs';

async function withAndroid({ installedCode, releaseCode, accepted = false, downloadStates = [{ state: 'successful', bytesDownloaded: 10, totalBytes: 10 }], installState = 'installing', httpStatus = 200, rawManifest, httpError, installError, nativeHttp = true }, run) {
  const previous = {
    Capacitor: globalThis.Capacitor,
    fetch: globalThis.fetch,
    confirm: globalThis.confirm,
  };
  const downloads = [], installs = [], messages = [], requests = [];
  let statusIndex = 0;
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    registerPlugin(name) {
      if (name === 'CapacitorHttp') return nativeHttp ? { get: async options => {
        requests.push(options);
        if (httpError) throw httpError;
        return { status: httpStatus, data: rawManifest === undefined ? { version: '1.2.0', versionCode: releaseCode, downloadUrl: 'https://example.test/game.apk' } : rawManifest };
      } } : null;
      if (name === 'App') return { getInfo: async () => ({ version: '1.2.0', build: String(installedCode) }) };
      if (name === 'AndroidUpdater') return {
        startDownload: async options => {
          downloads.push(options);
          return downloadStates[statusIndex++];
        },
        getStatus: async () => downloadStates[Math.min(statusIndex++, downloadStates.length - 1)],
        install: async () => {
          installs.push(true);
          if (installError) throw installError;
          return { state: installState };
        },
      };
      return null;
    },
  };
  globalThis.fetch = async () => { throw new Error('WebView fetch must not be used for GitHub release assets (CORS)'); };
  globalThis.confirm = () => accepted;
  try {
    await run({ downloads, installs, messages, requests, toast: message => messages.push(message) });
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


test('version lookup uses native HTTP with redirects and bounded timeouts, even when browser fetch is blocked', async () => {
  await withAndroid({ installedCode: 1, releaseCode: 2, accepted: true }, async state => {
    await downloadAndroidApk({ toast: state.toast });
    assert.equal(state.requests.length, 1);
    const request = state.requests[0];
    assert.match(request.url, /^https:\/\/github\.com\/Fonsonis\/one-piece-rogue-like-vercel\/releases\/latest\/download\/android-version\.json\?t=\d+$/);
    assert.equal(request.responseType, 'json');
    assert.equal(request.disableRedirects, false);
    assert.equal(request.connectTimeout, 15000);
    assert.equal(request.readTimeout, 15000);
    assert.equal(state.installs.length, 1);
  });
});

test('release manifests delivered as text still update and use the official fallback APK URL', async () => {
  await withAndroid({ installedCode: 1, accepted: true, rawManifest: JSON.stringify({ version: '1.2.0', versionCode: 2 }) }, async state => {
    await downloadAndroidApk({ toast: state.toast });
    assert.match(state.downloads[0].url, /github\.com\/Fonsonis\/one-piece-rogue-like-vercel\/releases\/latest\/download\/one-piece-rogue-like\.apk$/);
    assert.equal(state.installs.length, 1);
  });
});

for (const [label, options, message] of [
  ['HTTP failure', { httpStatus: 404 }, /HTTP 404/],
  ['invalid JSON', { rawManifest: '<html>error</html>' }, /JSON válido/],
  ['missing build', { rawManifest: { version: '1.2.0' } }, /incompleto o no es válido/],
  ['null manifest', { rawManifest: null }, /incompleto o no es válido/],
  ['network failure', { httpError: new Error('Connection timed out') }, /Connection timed out/],
  ['missing native module', { nativeHttp: false }, /conexión nativa no está disponible/],
]) {
  test(`${label} is reported as an update lookup failure, never as already up to date`, async () => {
    await withAndroid({ installedCode: 1, releaseCode: 2, accepted: true, ...options }, async state => {
      await downloadAndroidApk({ toast: state.toast });
      assert.match(state.messages.at(-1), /No se pudo buscar la actualización/);
      assert.match(state.messages.at(-1), message);
      assert.deepEqual(state.downloads, []);
      assert.deepEqual(state.installs, []);
      assert.ok(!state.messages.some(m => m.includes('versión más reciente')));
    });
  });
}

test('installer failures are not misreported as a connectivity problem', async () => {
  await withAndroid({ installedCode: 1, releaseCode: 2, accepted: true, installError: new Error('Android no pudo abrir el instalador') }, async state => {
    await downloadAndroidApk({ toast: state.toast });
    assert.match(state.messages.at(-1), /descargar o instalar/);
    assert.match(state.messages.at(-1), /Android no pudo abrir el instalador/);
    assert.doesNotMatch(state.messages.at(-1), /Revisa la conexión/);
  });
});

test('declining an update does not download or install it', async () => {
  await withAndroid({ installedCode: 1, releaseCode: 2, accepted: false }, async state => {
    await downloadAndroidApk({ toast: state.toast });
    assert.deepEqual(state.downloads, []);
    assert.deepEqual(state.installs, []);
  });
});
