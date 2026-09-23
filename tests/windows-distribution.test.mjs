import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const main = readFileSync('desktop/main.mjs', 'utf8');
const preload = readFileSync('desktop/preload.cjs', 'utf8');
const downloads = readFileSync('public/local/downloads.mjs', 'utf8');
const game = readFileSync('public/game.js', 'utf8');
const workflow = readFileSync('.github/workflows/android-release.yml', 'utf8');
const manifest = JSON.parse(readFileSync('public/windows-version.json', 'utf8'));

test('Electron empaqueta la build estática en un instalador NSIS', () => {
  assert.equal(packageJson.main, 'desktop/main.mjs');
  assert.match(packageJson.scripts['desktop:exe'], /electron-builder --win nsis --x64/);
  assert.match(packageJson.scripts['desktop:dir'], /electron-builder --dir --win --x64/);
  assert.match(packageJson.scripts['desktop:exe'], /--publish never/);
  assert.match(packageJson.scripts['desktop:dir'], /--publish never/);
  assert.equal(packageJson.build.appId, 'com.fonsonis.onepieceroguelike.desktop');
  assert.equal(packageJson.build.win.artifactName, 'one-piece-rogue-like-setup.${ext}');
  assert.equal(packageJson.build.nsis.deleteAppDataOnUninstall, false);
  assert.ok(packageJson.build.files.includes('dist/**/*'));
});

test('el contenedor de escritorio mantiene aislado el juego', () => {
  assert.match(main, /protocol\.registerSchemesAsPrivileged/);
  assert.match(main, /protocol\.handle\('oprl'/);
  assert.match(main, /url\.protocol !== 'oprl:' \|\| url\.hostname !== 'game'/);
  assert.doesNotMatch(main, /url\.origin !== APP_ORIGIN/);
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(preload, /contextBridge\.exposeInMainWorld\('OnePieceDesktop'/);
  assert.doesNotMatch(preload, /ipcRenderer/);
});

test('el botón web abre un selector Android o Windows y Electron no lo muestra', () => {
  assert.match(game, /OnePieceDesktop\?\.isDesktop/);
  assert.match(game, /openDownloadChooser\(button\)/);
  assert.match(downloads, /APK para Android/);
  assert.match(downloads, /EXE para Windows/);
  assert.match(downloads, /one-piece-rogue-like\.apk/);
  assert.match(downloads, /one-piece-rogue-like-setup\.exe/);
  assert.equal(manifest.downloadUrl, 'https://github.com/Fonsonis/one-piece-rogue-like-vercel/releases/latest/download/one-piece-rogue-like-setup.exe');
});

test('Android y Windows se publican juntos para compartir la release latest', () => {
  assert.match(workflow, /android:\s*\n\s*needs: version/);
  assert.match(workflow, /windows:\s*\n\s*needs: version/);
  assert.match(workflow, /runs-on: windows-latest/);
  assert.match(workflow, /npm run desktop:exe/);
  assert.match(workflow, /one-piece-rogue-like-setup\.exe\.sha256/);
  assert.match(workflow, /merge-multiple: true/);
  assert.match(workflow, /make_latest: true/);
});
