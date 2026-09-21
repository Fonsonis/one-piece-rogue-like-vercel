import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const game = readFileSync('public/game.js', 'utf8');
const updater = readFileSync('public/local/android-update.mjs', 'utf8');
const nativeFiles = readFileSync('public/local/android-files.mjs', 'utf8');
const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const release = JSON.parse(readFileSync('public/android-version.json', 'utf8'));
const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
const workflow = readFileSync('.github/workflows/android-release.yml', 'utf8');

test('el menú ofrece la APK y conserva la preparación offline del navegador', () => {
  assert.match(game, /Descargar APK para Android/);
  assert.match(game, /btn-browser-offline/);
  assert.match(game, /Buscar actualización Android/);
});

test('la APK empaqueta la build estática completa y consulta actualizaciones firmadas', () => {
  assert.equal(config.webDir, 'dist');
  assert.equal(config.appId, 'com.fonsonis.onepieceroguelike');
  assert.match(updater, /Capacitor\?\.isNativePlatform/);
  assert.match(updater, /releases\/latest\/download\/android-version\.json/);
  assert.match(updater, /registerPlugin\?\.\('App'\)/);
  assert.match(nativeFiles, /registerPlugin\?\.\(name\)/);
  assert.match(nativeFiles, /nativePlugin\('Filesystem'\)/);
  assert.match(nativeFiles, /nativePlugin\('Share'\)/);
  assert.match(game, /exportAndroidJson\(json\)/);
  assert.equal(release.downloadUrl, 'https://github.com/Fonsonis/one-piece-rogue-like-vercel/releases/latest/download/one-piece-rogue-like.apk');
  assert.match(manifest, /android\.permission\.CAMERA/);
  assert.match(workflow, /branches:\s*\n\s*- main/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /app_version_code=\$\(date \+%s\)/);
  assert.match(workflow, /-PappVersionCode="\$APP_VERSION_CODE"/);
  assert.match(workflow, /assembleDebug/);
  assert.match(workflow, /tag_name: android-\$\{\{ env\.APP_VERSION_CODE \}\}/);
});
