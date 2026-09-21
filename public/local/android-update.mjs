const CURRENT_VERSION = '1.2.0';
const CURRENT_VERSION_CODE = 10200;
const RELEASE_URL = 'https://github.com/Fonsonis/one-piece-rogue-like-vercel/releases/latest/download/one-piece-rogue-like.apk';
const RELEASE_VERSION_URL = 'https://github.com/Fonsonis/one-piece-rogue-like-vercel/releases/latest/download/android-version.json';

export function isAndroidApp() {
  return globalThis.Capacitor?.isNativePlatform?.() === true && globalThis.Capacitor?.getPlatform?.() === 'android';
}

function compareVersions(left, right) {
  const a = String(left).split('.').map(Number);
  const b = String(right).split('.').map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
}

function androidUpdater() {
  return globalThis.Capacitor?.registerPlugin?.('AndroidUpdater') || globalThis.Capacitor?.Plugins?.AndroidUpdater;
}

function downloadMessage(status) {
  const downloaded = Number(status.bytesDownloaded) || 0;
  const total = Number(status.totalBytes) || 0;
  if (total > 0) {
    const percent = Math.min(100, Math.floor(downloaded * 100 / total));
    return `⬇ Descargando actualización… ${percent}% · ${(downloaded / 1048576).toFixed(1)}/${(total / 1048576).toFixed(1)} MB`;
  }
  return status.state === 'paused' ? '⏸ Android ha pausado la descarga; se reanudará cuando sea posible.' : '⬇ Preparando descarga segura en Android…';
}

async function finishNativeDownload(updater, initialStatus, toast) {
  let status = initialStatus;
  let previousMessage = '';
  while (['pending', 'running', 'paused'].includes(status?.state)) {
    const message = downloadMessage(status);
    if (message !== previousMessage) toast?.(message);
    previousMessage = message;
    await new Promise(resolve => setTimeout(resolve, 900));
    status = await updater.getStatus();
  }
  if (status?.state !== 'successful') {
    throw new Error(`Descarga Android fallida (${status?.reason ?? 'sin estado'})`);
  }

  toast?.('✅ APK descargado por completo. Abriendo el instalador de Android…');
  const result = await updater.install();
  if (result?.state === 'permissionRequired') {
    toast?.('🔐 Autoriza “instalar apps desconocidas”. Al volver se abrirá el instalador automáticamente.');
  }
}

async function installedRelease() {
  const capacitor = globalThis.Capacitor;
  const app = capacitor?.registerPlugin?.('App') || capacitor?.Plugins?.App;
  if (!app?.getInfo) return { version: CURRENT_VERSION, versionCode: CURRENT_VERSION_CODE };
  const info = await app.getInfo();
  return {
    version: info.version || CURRENT_VERSION,
    versionCode: Number(info.build) || CURRENT_VERSION_CODE,
  };
}

export async function downloadAndroidApk({ toast } = {}) {
  if (!isAndroidApp()) {
    globalThis.location.assign(RELEASE_URL);
    return;
  }

  try {
    const installed = await installedRelease();
    toast?.(`↻ Buscando una versión posterior a ${installed.version}…`);
    const response = await fetch(`${RELEASE_VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const release = await response.json();
    const releaseCode = Number(release.versionCode) || 0;
    const hasNewBuild = releaseCode > installed.versionCode || (!releaseCode && compareVersions(release.version, installed.version) > 0);
    if (!hasNewBuild) {
      toast?.(`✅ Ya tienes la versión más reciente (${installed.version}).`);
      return;
    }
    const accepted = globalThis.confirm(`Hay una actualización disponible: ${release.version} (compilación ${releaseCode}). ¿Quieres descargarla ahora?`);
    if (accepted) {
      const updater = androidUpdater();
      if (!updater?.startDownload || !updater?.getStatus || !updater?.install) throw new Error('Plugin AndroidUpdater no disponible');
      const status = await updater.startDownload({
        url: release.downloadUrl || RELEASE_URL,
        versionCode: releaseCode,
      });
      await finishNativeDownload(updater, status, toast);
    }
  } catch (error) {
    console.error('[android-update] No se pudo completar la actualización', error);
    toast?.('No se pudo completar la actualización. Revisa la conexión y vuelve a pulsar “Actualizar APK” para continuar o reintentar.');
  }
}

export const androidRelease = Object.freeze({ version: CURRENT_VERSION, versionCode: CURRENT_VERSION_CODE, downloadUrl: RELEASE_URL });
