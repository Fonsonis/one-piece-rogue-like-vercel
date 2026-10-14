import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const game = readFileSync('public/game.js', 'utf8');
const updater = readFileSync('public/local/android-update.mjs', 'utf8');
const nativeFiles = readFileSync('public/local/android-files.mjs', 'utf8');
const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const release = JSON.parse(readFileSync('public/android-version.json', 'utf8'));
const distribution = JSON.parse(readFileSync('public/distribution.json', 'utf8'));
const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
const mainActivity = readFileSync('android/app/src/main/java/com/umbral/mareas/MainActivity.java', 'utf8');
const nativeUpdater = readFileSync('android/app/src/main/java/com/umbral/mareas/AndroidUpdaterPlugin.java', 'utf8');
const workflow = readFileSync('.github/workflows/android-release.yml', 'utf8');

test('el menú ofrece una descarga única y conserva la preparación offline del navegador', () => {
  assert.match(game, /Descargar juego/);
  assert.match(game, /openDownloadChooser/);
  assert.match(game, /btn-browser-offline/);
  assert.match(game, /Buscar actualización Android/);
});

test('la APK empaqueta la build estática completa y consulta actualizaciones firmadas', () => {
  assert.equal(config.webDir, 'dist');
  assert.equal(config.appId, 'com.umbral.mareas');
  assert.match(updater, /Capacitor\?\.isNativePlatform/);
  assert.match(updater, /GameDistribution\?\.androidVersionUrl/);
  assert.match(updater, /registerPlugin\?\.\('App'\)/);
  assert.match(updater, /registerPlugin\?\.\('AndroidUpdater'\)/);
  assert.match(manifest, /android\.permission\.REQUEST_INSTALL_PACKAGES/);
  assert.match(mainActivity, /registerPlugin\(AndroidUpdaterPlugin\.class\)/);
  assert.match(nativeUpdater, /DownloadManager/);
  assert.match(nativeUpdater, /getSharedPreferences/);
  assert.match(nativeUpdater, /github\.com/);
  assert.match(nativeUpdater, /releases\/download\/android-/);
  assert.match(nativeUpdater, /mareas-del-umbral\.apk/);
  assert.doesNotMatch(nativeUpdater, /Fonsonis\/mareas-del-umbral\/releases/);
  assert.match(nativeUpdater, /ACTION_MANAGE_UNKNOWN_APP_SOURCES/);
  assert.match(nativeUpdater, /application\/vnd\.android\.package-archive/);
  assert.match(nativeFiles, /registerPlugin\?\.\(name\)/);
  assert.match(nativeFiles, /nativePlugin\('Filesystem'\)/);
  assert.match(nativeFiles, /nativePlugin\('Share'\)/);
  assert.match(game, /exportAndroidJson\(json\)/);
  assert.equal(release.downloadUrl, '');
  assert.match(distribution.androidUrl, /^https:\/\/github\.com\/.+\/releases\/latest\/download\/mareas-del-umbral\.apk$/);
  assert.match(distribution.androidVersionUrl, /\/releases\/latest\/download\/android-version\.json$/);
  assert.match(distribution.androidReleasesApiUrl, /^https:\/\/api\.github\.com\/repos\/.+\/releases\/latest$/);
  assert.match(manifest, /android\.permission\.CAMERA/);
  assert.match(workflow, /branches:\s*\n\s*- main/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /app_version_code=\$\(date \+%s\)/);
  assert.match(workflow, /node scripts\/prepare-platform-release\.mjs/);
  assert.match(workflow, /mareas-del-umbral\.apk/);
  assert.match(workflow, /-PappVersionCode="\$APP_VERSION_CODE"/);
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /tag_name: android-\$\{\{ needs\.version\.outputs\.app_version_code \}\}/);
});
