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

async function openExternal(url) {
  const capacitor = globalThis.Capacitor;
  const browser = capacitor?.registerPlugin?.('Browser') || capacitor?.Plugins?.Browser;
  if (browser?.open) return browser.open({ url });
  globalThis.open(url, '_blank', 'noopener,noreferrer');
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
      await openExternal(release.downloadUrl || RELEASE_URL);
      toast?.('⬇ Descarga abierta. Cuando termine, pulsa el APK descargado para instalar la actualización.');
    }
  } catch (error) {
    console.error('[android-update] No se pudo comprobar o abrir la actualización', error);
    toast?.('No se pudo comprobar la actualización. Revisa la conexión e inténtalo de nuevo.');
  }
}

export const androidRelease = Object.freeze({ version: CURRENT_VERSION, versionCode: CURRENT_VERSION_CODE, downloadUrl: RELEASE_URL });
