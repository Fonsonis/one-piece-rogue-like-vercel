import { isAndroidApp, pendingAndroidUpdate, downloadAndroidApk } from './android-update.mjs';

const loadedVersion = document.querySelector('meta[name="game-build"]')?.content;
const nativeDesktop = globalThis.OnePieceDesktop?.isDesktop === true;
let pending = null;
let busy = false;

function banner() {
  let notice = document.getElementById('game-update-notice');
  if (!notice) {
    notice = document.createElement('aside');
    notice.id = 'game-update-notice';
    notice.className = 'game-update-notice';
    notice.setAttribute('role', 'status');
    notice.innerHTML = '<span id="game-update-message"></span><button type="button" class="btn green small" id="game-update-action">Actualizar</button><button type="button" class="btn gray small" id="game-update-dismiss" aria-label="Cerrar aviso">×</button>';
    document.body.append(notice);
    notice.querySelector('#game-update-dismiss').onclick = () => { notice.hidden = true; };
    notice.querySelector('#game-update-action').onclick = applyUpdate;
  }
  return notice;
}

function show(message, action = 'Actualizar') {
  const notice = banner();
  notice.querySelector('#game-update-message').textContent = message;
  notice.querySelector('#game-update-action').textContent = action;
  notice.querySelector('#game-update-action').disabled = false;
  notice.hidden = false;
}

async function offlineCopyActive() {
  if (!('caches' in window)) return false;
  const cache = await caches.open('oplike-offline-meta');
  return !!(await cache.match('/__oplike_offline_active__'));
}

async function checkUpdate() {
  if (busy || !navigator.onLine) return;
  try {
    if (isAndroidApp()) {
      const release = await pendingAndroidUpdate();
      if (release) {
        pending = 'android';
        show(`Nueva versión Android disponible: ${release.version}.`, 'Descargar APK');
      }
      return;
    }
    if (nativeDesktop || !loadedVersion || loadedVersion === 'development') return;
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      try { await registration?.update(); } catch { /* El manifiesto aún puede estar disponible. */ }
    }
    const response = await fetch(`/offline-manifest.json?update=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const manifest = await response.json();
    if (/^[a-f0-9]{20}$/.test(manifest.version) && manifest.version !== loadedVersion) {
      pending = await offlineCopyActive() ? 'offline' : 'web';
      show('Hay una nueva versión del juego disponible.');
    }
  } catch { /* No mostramos avisos si estamos sin conexión o falla la búsqueda. */ }
}

async function applyUpdate() {
  if (busy || !pending) return;
  busy = true;
  const button = banner().querySelector('#game-update-action');
  button.disabled = true;
  try {
    if (pending === 'android') {
      await downloadAndroidApk({ toast: message => show(message, 'Descargar APK') });
    } else if (pending === 'offline') {
      const { prepareOffline } = await import('./offline.mjs');
      await prepareOffline();
    } else {
      location.reload();
    }
  } catch {
    show('No se pudo iniciar la actualización. Inténtalo de nuevo.');
  } finally {
    busy = false;
    if (button.isConnected) button.disabled = false;
  }
}

window.addEventListener('game-offline-updated', () => {
  pending = 'web';
  show('Actualización descargada. Reinicia el juego para aplicarla.', 'Reiniciar');
});
window.addEventListener('online', checkUpdate);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
checkUpdate();
setInterval(checkUpdate, 15 * 60 * 1000);
