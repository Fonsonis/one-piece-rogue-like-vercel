import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const game = readFileSync('public/game.js', 'utf8');
const updater = readFileSync('public/local/android-update.mjs', 'utf8');
const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const release = JSON.parse(readFileSync('public/android-version.json', 'utf8'));
const manifest = readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');

test('el menú ofrece la APK y conserva la preparación offline del navegador', () => {
  assert.match(game, /Descargar APK para Android/);
  assert.match(game, /btn-browser-offline/);
  assert.match(game, /Buscar actualización Android/);
});

test('la APK empaqueta la build estática completa y consulta actualizaciones firmadas', () => {
  assert.equal(config.webDir, 'dist');
  assert.equal(config.appId, 'com.fonsonis.onepieceroguelike');
  assert.match(updater, /Capacitor\?\.isNativePlatform/);
  assert.match(updater, /android-version\.json/);
  assert.equal(release.downloadUrl, 'https://github.com/Fonsonis/one-piece-rogue-like-vercel/releases/latest/download/one-piece-rogue-like.apk');
  assert.match(manifest, /android\.permission\.CAMERA/);
});
